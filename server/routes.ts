import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { processedTransactions } from "@shared/schema";

const AUTHORIZE_NET_API_URL = process.env.NODE_ENV === "production" 
  ? "https://api.authorize.net/xml/v1/request.api"
  : "https://apitest.authorize.net/xml/v1/request.api";

const COIN_PACKS: Record<string, { coins: number; price: string }> = {
  "pack_50": { coins: 50, price: "0.99" },
  "pack_120": { coins: 120, price: "1.99" },
  "pack_300": { coins: 300, price: "3.99" },
  "coins_50": { coins: 50, price: "0.99" },
  "coins_120": { coins: 120, price: "1.99" },
  "coins_300": { coins: 300, price: "3.99" },
};

interface OpaqueData {
  dataDescriptor: string;
  dataValue: string;
}

interface PaymentRequest {
  productId: string;
  opaqueData: OpaqueData;
}

interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
}

async function isTransactionProcessed(txKey: string): Promise<boolean> {
  const existing = await db.select().from(processedTransactions).where(eq(processedTransactions.transactionKey, txKey)).limit(1);
  return existing.length > 0;
}

async function markTransactionProcessed(txKey: string, platform: string, productId: string): Promise<void> {
  await db.insert(processedTransactions).values({
    transactionKey: txKey,
    platform,
    productId,
  });
}

async function getGoogleAccessToken(serviceAccount: GoogleServiceAccount): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600;
    
    const header = Buffer.from(JSON.stringify({
      alg: "RS256",
      typ: "JWT"
    })).toString("base64url");
    
    const payload = Buffer.from(JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: exp
    })).toString("base64url");
    
    const crypto = await import("node:crypto");
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(serviceAccount.private_key, "base64url");
    
    const jwt = `${header}.${payload}.${signature}`;
    
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    
    if (!response.ok) {
      console.error("Failed to get Google access token:", response.status);
      return null;
    }
    
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Error getting Google access token:", error);
    return null;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/products", (req, res) => {
    const products = Object.entries(COIN_PACKS).map(([id, pack]) => ({
      id,
      coins: pack.coins,
      price: pack.price,
      displayPrice: `$${pack.price}`
    }));
    res.json({ products });
  });

  app.post("/api/process-payment", async (req, res) => {
    try {
      const { productId, opaqueData }: PaymentRequest = req.body;

      if (!productId || !opaqueData) {
        return res.status(400).json({ 
          success: false, 
          error: "Missing required payment fields" 
        });
      }

      const product = COIN_PACKS[productId];
      if (!product) {
        return res.status(400).json({
          success: false,
          error: "Invalid product"
        });
      }

      const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
      const transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY;

      if (!apiLoginId || !transactionKey) {
        console.error("Authorize.net credentials not configured");
        return res.status(500).json({ 
          success: false, 
          error: "Payment system not configured" 
        });
      }

      const requestBody = {
        createTransactionRequest: {
          merchantAuthentication: {
            name: apiLoginId,
            transactionKey: transactionKey
          },
          transactionRequest: {
            transactionType: "authCaptureTransaction",
            amount: product.price,
            payment: {
              opaqueData: {
                dataDescriptor: opaqueData.dataDescriptor,
                dataValue: opaqueData.dataValue
              }
            },
            lineItems: {
              lineItem: {
                itemId: productId,
                name: `${product.coins} Coins`,
                description: `Last Safe Tile coin pack`,
                quantity: "1",
                unitPrice: product.price
              }
            }
          }
        }
      };

      const response = await fetch(AUTHORIZE_NET_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (result.messages?.resultCode === "Ok" && 
          result.transactionResponse?.responseCode === "1") {
        console.log(`Payment successful: ${result.transactionResponse.transId} for product ${productId} (${product.coins} coins)`);
        return res.json({
          success: true,
          transactionId: result.transactionResponse.transId,
          coins: product.coins
        });
      } else {
        const errorMessage = result.transactionResponse?.errors?.[0]?.errorText ||
                            result.messages?.message?.[0]?.text ||
                            "Payment failed";
        console.error("Payment failed:", errorMessage);
        return res.status(400).json({
          success: false,
          error: errorMessage
        });
      }
    } catch (error) {
      console.error("Payment processing error:", error);
      return res.status(500).json({
        success: false,
        error: "Payment processing failed"
      });
    }
  });

  app.get("/api/payment-config", (req, res) => {
    const publicKey = process.env.AUTHORIZE_NET_PUBLIC_CLIENT_KEY;
    const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
    
    res.json({
      configured: !!(publicKey && apiLoginId),
      publicKey: publicKey || null,
      apiLoginId: apiLoginId || null,
      testMode: process.env.NODE_ENV !== "production"
    });
  });

  app.post("/api/validate-purchase", async (req, res) => {
    try {
      const { productId, transactionReceipt, platform } = req.body;

      if (!productId) {
        return res.status(400).json({
          success: false,
          error: "Missing product ID"
        });
      }

      const product = COIN_PACKS[productId];
      if (!product) {
        return res.status(400).json({
          success: false,
          error: "Invalid product"
        });
      }

      if (platform === "ios" && transactionReceipt) {
        const sharedSecret = process.env.APPLE_SHARED_SECRET;
        
        if (!sharedSecret) {
          console.error("APPLE_SHARED_SECRET not configured - cannot validate iOS purchases");
          return res.status(500).json({
            success: false,
            error: "iOS validation not configured"
          });
        }

        const appleValidationUrl = process.env.NODE_ENV === "production"
          ? "https://buy.itunes.apple.com/verifyReceipt"
          : "https://sandbox.itunes.apple.com/verifyReceipt";

        try {
          let appleResult = null;
          
          const response = await fetch(appleValidationUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              "receipt-data": transactionReceipt,
              password: sharedSecret,
            }),
          });
          
          appleResult = await response.json();
          
          if (appleResult.status === 21007) {
            const sandboxResponse = await fetch("https://sandbox.itunes.apple.com/verifyReceipt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                "receipt-data": transactionReceipt,
                password: sharedSecret,
              }),
            });
            appleResult = await sandboxResponse.json();
          }
          
          if (appleResult.status !== 0) {
            console.error("Apple receipt validation failed:", appleResult.status);
            return res.status(400).json({
              success: false,
              error: "Invalid receipt"
            });
          }

          const inAppPurchases = appleResult.receipt?.in_app || appleResult.latest_receipt_info || [];
          const matchingPurchase = inAppPurchases.find((p: { product_id: string }) => p.product_id === productId);
          
          if (!matchingPurchase) {
            console.error("No matching product in Apple receipt");
            return res.status(400).json({
              success: false,
              error: "Product not found in receipt"
            });
          }

          const transactionId = matchingPurchase.transaction_id || matchingPurchase.original_transaction_id;
          const txKey = `ios:${transactionId}`;
          
          if (await isTransactionProcessed(txKey)) {
            console.error("Duplicate iOS transaction:", transactionId);
            return res.status(400).json({
              success: false,
              error: "Transaction already processed"
            });
          }

          await markTransactionProcessed(txKey, "ios", productId);
          
          console.log(`iOS purchase validated: ${productId} tx:${transactionId} (${product.coins} coins)`);
          return res.json({
            success: true,
            coins: product.coins
          });
        } catch (error) {
          console.error("Apple validation request failed:", error);
          return res.status(500).json({
            success: false,
            error: "Validation service error"
          });
        }
      }
      
      if (platform === "android" && transactionReceipt) {
        const googleServiceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        
        if (!googleServiceAccountJson) {
          console.error("GOOGLE_SERVICE_ACCOUNT_KEY not configured - cannot validate Android purchases");
          return res.status(500).json({
            success: false,
            error: "Android validation not configured"
          });
        }

        try {
          const receiptData = JSON.parse(transactionReceipt);
          const { packageName, productId: purchaseProductId, purchaseToken } = receiptData;
          
          if (!packageName || !purchaseProductId || !purchaseToken) {
            console.error("Invalid Android receipt format");
            return res.status(400).json({
              success: false,
              error: "Invalid receipt format"
            });
          }

          if (purchaseProductId !== productId) {
            console.error("Product ID mismatch in Android receipt");
            return res.status(400).json({
              success: false,
              error: "Product mismatch"
            });
          }

          const serviceAccount = JSON.parse(googleServiceAccountJson);
          const accessToken = await getGoogleAccessToken(serviceAccount);
          
          if (!accessToken) {
            console.error("Failed to get Google access token");
            return res.status(500).json({
              success: false,
              error: "Validation service error"
            });
          }

          const verifyUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${purchaseProductId}/tokens/${purchaseToken}`;
          
          const verifyResponse = await fetch(verifyUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (!verifyResponse.ok) {
            console.error("Google Play verification failed:", verifyResponse.status);
            return res.status(400).json({
              success: false,
              error: "Invalid purchase"
            });
          }

          const purchaseData = await verifyResponse.json();
          
          if (purchaseData.purchaseState !== 0) {
            console.error("Purchase not completed:", purchaseData.purchaseState);
            return res.status(400).json({
              success: false,
              error: "Purchase not completed"
            });
          }

          const txKey = `android:${purchaseToken}`;
          
          if (await isTransactionProcessed(txKey)) {
            console.error("Duplicate Android transaction:", purchaseToken);
            return res.status(400).json({
              success: false,
              error: "Transaction already processed"
            });
          }

          await markTransactionProcessed(txKey, "android", productId);

          console.log(`Android purchase validated: ${productId} token:${purchaseToken.substring(0, 20)}... (${product.coins} coins)`);
          return res.json({
            success: true,
            coins: product.coins
          });
        } catch (parseError) {
          console.error("Failed to validate Android receipt:", parseError);
          return res.status(400).json({
            success: false,
            error: "Invalid receipt data"
          });
        }
      }

      return res.status(400).json({
        success: false,
        error: "Missing receipt for validation"
      });
    } catch (error) {
      console.error("Purchase validation error:", error);
      return res.status(500).json({
        success: false,
        error: "Validation failed"
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
