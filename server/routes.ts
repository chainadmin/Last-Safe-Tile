import type { Express } from "express";
import { createServer, type Server } from "node:http";

const AUTHORIZE_NET_API_URL = process.env.NODE_ENV === "production" 
  ? "https://api.authorize.net/xml/v1/request.api"
  : "https://apitest.authorize.net/xml/v1/request.api";

const COIN_PACKS: Record<string, { coins: number; price: string }> = {
  "pack_50": { coins: 50, price: "0.99" },
  "pack_120": { coins: 120, price: "1.99" },
  "pack_300": { coins: 300, price: "3.99" },
};

interface OpaqueData {
  dataDescriptor: string;
  dataValue: string;
}

interface PaymentRequest {
  productId: string;
  opaqueData: OpaqueData;
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

  const httpServer = createServer(app);

  return httpServer;
}
