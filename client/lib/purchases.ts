import { Platform } from "react-native";
import { getApiUrl } from "@/lib/query-client";
import { addCoins } from "@/lib/storage";

export interface CoinPack {
  productId: string;
  coins: number;
  price: string;
  displayPrice: string;
  popular?: boolean;
}

export const COIN_PACKS: CoinPack[] = [
  { productId: "coins_50", coins: 50, price: "0.99", displayPrice: "$0.99", popular: false },
  { productId: "coins_120", coins: 120, price: "1.99", displayPrice: "$1.99", popular: true },
  { productId: "coins_300", coins: 300, price: "3.99", displayPrice: "$3.99", popular: false },
];

interface IAPPurchase {
  productId: string;
  transactionReceipt?: string;
  acknowledged?: boolean;
}

interface IAPModule {
  connectAsync: () => Promise<void>;
  disconnectAsync: () => Promise<void>;
  getProductsAsync: (productIds: string[]) => Promise<any>;
  purchaseItemAsync: (productId: string) => Promise<void>;
  finishTransactionAsync: (purchase: IAPPurchase, consumeItem: boolean) => Promise<void>;
  getPurchaseHistoryAsync: () => Promise<{ results?: IAPPurchase[] }>;
  setPurchaseListener: (listener: (event: any) => void) => { remove: () => void };
  IAPResponseCode: {
    OK: number;
    USER_CANCELED: number;
    ERROR: number;
  };
}

let iapModule: IAPModule | null = null;
let iapInitialized = false;
let iapAvailable = false;

export async function initializePurchases(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  try {
    const module = await import("expo-in-app-purchases") as unknown as IAPModule;
    iapModule = module;
    await iapModule.connectAsync();
    iapInitialized = true;
    iapAvailable = true;
    
    const productIds = COIN_PACKS.map(pack => pack.productId);
    await iapModule.getProductsAsync(productIds);
    
    return true;
  } catch (error) {
    console.log("In-app purchases not available (requires development build)");
    iapAvailable = false;
    return false;
  }
}

export function isIAPAvailable(): boolean {
  return iapAvailable && Platform.OS !== "web";
}

export async function purchaseProduct(productId: string): Promise<{ success: boolean; coins?: number; error?: string }> {
  if (!iapModule || !iapAvailable) {
    return { success: false, error: "In-app purchases not available" };
  }

  try {
    await iapModule.purchaseItemAsync(productId);
    return { success: true };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === "E_USER_CANCELLED") {
      return { success: false, error: "Purchase cancelled" };
    }
    return { success: false, error: err.message || "Purchase failed" };
  }
}

export function setPurchaseListener(
  onPurchaseComplete: (purchase: IAPPurchase) => void,
  onPurchaseError: (error: { code: string; message: string }) => void
): (() => void) | null {
  if (!iapModule || !iapAvailable) {
    return null;
  }

  const subscription = iapModule.setPurchaseListener((event: { responseCode: number; results?: IAPPurchase[]; errorCode?: string }) => {
    const { responseCode, results, errorCode } = event;
    if (responseCode === iapModule!.IAPResponseCode.OK && results) {
      results.forEach((purchase: IAPPurchase) => {
        if (!purchase.acknowledged) {
          onPurchaseComplete(purchase);
        }
      });
    } else if (responseCode === iapModule!.IAPResponseCode.USER_CANCELED) {
      onPurchaseError({ code: "cancelled", message: "Purchase cancelled" });
    } else {
      onPurchaseError({ code: errorCode || "error", message: "Purchase failed" });
    }
  });

  return () => {
    subscription.remove();
  };
}

export async function finishPurchase(purchase: IAPPurchase): Promise<boolean> {
  if (!iapModule) return false;
  
  try {
    await iapModule.finishTransactionAsync(purchase, true);
    return true;
  } catch (error) {
    console.error("Failed to finish transaction:", error);
    return false;
  }
}

export async function validateAndProcessPurchase(
  purchase: IAPPurchase
): Promise<{ success: boolean; coins?: number; error?: string }> {
  const pack = COIN_PACKS.find(p => p.productId === purchase.productId);
  if (!pack) {
    return { success: false, error: "Unknown product" };
  }

  try {
    const response = await fetch(`${getApiUrl()}/api/validate-purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: purchase.productId,
        transactionReceipt: purchase.transactionReceipt,
        platform: Platform.OS,
      }),
    });

    const result = await response.json();

    if (result.success) {
      await addCoins(result.coins);
      await finishPurchase(purchase);
      return { success: true, coins: result.coins };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error("Server validation failed:", error);
    return { success: false, error: "Validation failed - please try again" };
  }
}

export async function restorePurchases(): Promise<{ success: boolean; restored: number }> {
  if (!iapModule || !iapAvailable) {
    return { success: false, restored: 0 };
  }

  try {
    const { results } = await iapModule.getPurchaseHistoryAsync();
    return { success: true, restored: results?.length || 0 };
  } catch (error) {
    console.error("Failed to restore purchases:", error);
    return { success: false, restored: 0 };
  }
}

export async function disconnectPurchases(): Promise<void> {
  if (iapModule && iapInitialized) {
    try {
      await iapModule.disconnectAsync();
      iapInitialized = false;
    } catch (error) {
      console.error("Failed to disconnect IAP:", error);
    }
  }
}
