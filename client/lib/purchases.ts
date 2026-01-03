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
  transactionId?: string;
  purchaseToken?: string;
}

let iapModule: typeof import("react-native-iap") | null = null;
let iapInitialized = false;
let iapAvailable = false;
let purchaseUpdateSubscription: { remove: () => void } | null = null;
let purchaseErrorSubscription: { remove: () => void } | null = null;

export async function initializePurchases(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  try {
    const module = await import("react-native-iap");
    iapModule = module;
    
    await iapModule.initConnection();
    iapInitialized = true;
    iapAvailable = true;
    
    const productIds = COIN_PACKS.map(pack => pack.productId);
    await iapModule.fetchProducts({ skus: productIds });
    
    return true;
  } catch (error) {
    console.log("In-app purchases not available (requires development build):", error);
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
    await iapModule.requestPurchase({
      request: Platform.OS === "ios" 
        ? { apple: { sku: productId } }
        : { google: { skus: [productId] } },
      type: "in-app",
    });
    return { success: true };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === "E_USER_CANCELLED" || err.message?.includes("cancelled")) {
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

  purchaseUpdateSubscription = iapModule.purchaseUpdatedListener((purchase) => {
    const mappedPurchase: IAPPurchase = {
      productId: purchase.productId,
      transactionReceipt: (purchase as any).transactionReceipt || undefined,
      transactionId: purchase.transactionId || undefined,
      purchaseToken: purchase.purchaseToken || undefined,
    };
    onPurchaseComplete(mappedPurchase);
  });

  purchaseErrorSubscription = iapModule.purchaseErrorListener((error) => {
    const errorCode = String(error.code || "error");
    if (errorCode.includes("USER_CANCELLED") || errorCode.includes("E_USER_CANCELLED")) {
      onPurchaseError({ code: "cancelled", message: "Purchase cancelled" });
    } else {
      onPurchaseError({ code: errorCode, message: error.message || "Purchase failed" });
    }
  });

  return () => {
    purchaseUpdateSubscription?.remove();
    purchaseErrorSubscription?.remove();
    purchaseUpdateSubscription = null;
    purchaseErrorSubscription = null;
  };
}

export async function finishPurchase(purchase: IAPPurchase): Promise<boolean> {
  if (!iapModule) return false;
  
  try {
    if (Platform.OS === "android" && purchase.purchaseToken) {
      await iapModule.acknowledgePurchaseAndroid(purchase.purchaseToken);
    }
    await iapModule.finishTransaction({ 
      purchase: purchase as any, 
      isConsumable: true 
    });
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
        purchaseToken: purchase.purchaseToken,
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
    const purchases = await iapModule.getAvailablePurchases();
    return { success: true, restored: purchases?.length || 0 };
  } catch (error) {
    console.error("Failed to restore purchases:", error);
    return { success: false, restored: 0 };
  }
}

export async function disconnectPurchases(): Promise<void> {
  if (iapModule && iapInitialized) {
    try {
      purchaseUpdateSubscription?.remove();
      purchaseErrorSubscription?.remove();
      purchaseUpdateSubscription = null;
      purchaseErrorSubscription = null;
      await iapModule.endConnection();
      iapInitialized = false;
    } catch (error) {
      console.error("Failed to disconnect IAP:", error);
    }
  }
}
