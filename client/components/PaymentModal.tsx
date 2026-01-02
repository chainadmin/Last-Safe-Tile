import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import { WebView } from "react-native-webview";
import { ThemedText } from "@/components/ThemedText";
import { GameColors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import * as Haptics from "expo-haptics";

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (coins: number) => void;
  productId: string;
  coins: number;
  price: string;
  apiLoginId: string;
  publicClientKey: string;
  testMode: boolean;
}

export function PaymentModal({
  visible,
  onClose,
  onSuccess,
  productId,
  coins,
  price,
  apiLoginId,
  publicClientKey,
  testMode,
}: PaymentModalProps) {
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  const handleClose = () => {
    setProcessing(false);
    setLoading(true);
    onClose();
  };

  const processPaymentWithToken = async (opaqueData: { dataDescriptor: string; dataValue: string }) => {
    setProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await fetch(`${getApiUrl()}/api/process-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: productId,
          opaqueData: opaqueData,
        }),
      });

      const result = await response.json();

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSuccess(result.coins);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Payment Failed", result.error || "Please try again");
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Unable to process payment. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "token") {
        processPaymentWithToken(data.opaqueData);
      } else if (data.type === "error") {
        Alert.alert("Card Error", data.message || "Invalid card details");
      } else if (data.type === "cancel") {
        handleClose();
      }
    } catch (e) {
      console.error("WebView message parse error:", e);
    }
  };

  const acceptJsUrl = testMode
    ? "https://jstest.authorize.net/v1/Accept.js"
    : "https://js.authorize.net/v1/Accept.js";

  const paymentFormHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <script src="${acceptJsUrl}"></script>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #1a1a2e;
          color: #ffffff;
          padding: 16px;
          min-height: 100vh;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .title {
          font-size: 20px;
          font-weight: 600;
        }
        .close-btn {
          background: none;
          border: none;
          color: #888;
          font-size: 28px;
          cursor: pointer;
          padding: 8px;
        }
        .purchase-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: #2a2a4a;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
        }
        .coins {
          color: #FFD700;
          font-weight: 600;
        }
        .price {
          color: #4CAF50;
          font-size: 20px;
          font-weight: 600;
        }
        .form-group {
          margin-bottom: 16px;
        }
        label {
          display: block;
          color: #888;
          font-size: 14px;
          margin-bottom: 6px;
        }
        input {
          width: 100%;
          background-color: #0d0d1a;
          border: 1px solid #2a2a4a;
          border-radius: 8px;
          padding: 14px;
          color: #ffffff;
          font-size: 16px;
        }
        input:focus {
          outline: none;
          border-color: #4CAF50;
        }
        .row {
          display: flex;
          gap: 12px;
        }
        .row .form-group {
          flex: 1;
        }
        .pay-btn {
          width: 100%;
          background-color: #4CAF50;
          color: #0d0d1a;
          border: none;
          border-radius: 12px;
          padding: 16px;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 8px;
        }
        .pay-btn:disabled {
          opacity: 0.7;
        }
        .secure-note {
          text-align: center;
          color: #888;
          font-size: 12px;
          margin-top: 16px;
        }
        .error {
          color: #ff5252;
          font-size: 14px;
          margin-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <span class="title">Complete Purchase</span>
        <button class="close-btn" onclick="cancel()">×</button>
      </div>
      
      <div class="purchase-info">
        <span class="coins">${coins} Coins</span>
        <span class="price">${price}</span>
      </div>

      <form id="paymentForm" onsubmit="sendPaymentDataToAnet(event)">
        <div class="form-group">
          <label>Card Number</label>
          <input type="text" id="cardNumber" placeholder="1234 5678 9012 3456" 
                 inputmode="numeric" maxlength="19" autocomplete="cc-number">
        </div>
        
        <div class="row">
          <div class="form-group">
            <label>Expiration</label>
            <input type="text" id="expDate" placeholder="MM/YY" 
                   inputmode="numeric" maxlength="5" autocomplete="cc-exp">
          </div>
          <div class="form-group">
            <label>CVV</label>
            <input type="text" id="cvv" placeholder="123" 
                   inputmode="numeric" maxlength="4" autocomplete="cc-csc">
          </div>
        </div>

        <button type="submit" class="pay-btn" id="payBtn">Pay ${price}</button>
        <div id="error" class="error"></div>
      </form>

      <div class="secure-note">Secure payment via Authorize.net</div>

      <script>
        const cardInput = document.getElementById('cardNumber');
        const expInput = document.getElementById('expDate');
        const cvvInput = document.getElementById('cvv');

        cardInput.addEventListener('input', (e) => {
          let val = e.target.value.replace(/\\D/g, '');
          val = val.match(/.{1,4}/g)?.join(' ') || val;
          e.target.value = val.substring(0, 19);
        });

        expInput.addEventListener('input', (e) => {
          let val = e.target.value.replace(/\\D/g, '');
          if (val.length >= 2) {
            val = val.substring(0, 2) + '/' + val.substring(2, 4);
          }
          e.target.value = val;
        });

        cvvInput.addEventListener('input', (e) => {
          e.target.value = e.target.value.replace(/\\D/g, '').substring(0, 4);
        });

        function cancel() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cancel' }));
        }

        function sendPaymentDataToAnet(event) {
          event.preventDefault();
          
          const cardNumber = cardInput.value.replace(/\\s/g, '');
          const expParts = expInput.value.split('/');
          const cvv = cvvInput.value;

          if (cardNumber.length < 15) {
            showError('Please enter a valid card number');
            return;
          }
          if (expParts.length !== 2 || expParts[0].length !== 2 || expParts[1].length !== 2) {
            showError('Please enter expiration as MM/YY');
            return;
          }
          if (cvv.length < 3) {
            showError('Please enter a valid CVV');
            return;
          }

          document.getElementById('payBtn').disabled = true;
          document.getElementById('payBtn').textContent = 'Processing...';
          hideError();

          const authData = {
            clientKey: "${publicClientKey}",
            apiLoginID: "${apiLoginId}"
          };

          const cardData = {
            cardNumber: cardNumber,
            month: expParts[0],
            year: '20' + expParts[1],
            cardCode: cvv
          };

          const secureData = {
            authData: authData,
            cardData: cardData
          };

          Accept.dispatchData(secureData, responseHandler);
        }

        function responseHandler(response) {
          if (response.messages.resultCode === "Error") {
            let errorMessage = "";
            for (let i = 0; i < response.messages.message.length; i++) {
              errorMessage += response.messages.message[i].text + " ";
            }
            showError(errorMessage.trim());
            document.getElementById('payBtn').disabled = false;
            document.getElementById('payBtn').textContent = 'Pay ${price}';
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'token',
              opaqueData: response.opaqueData
            }));
          }
        }

        function showError(msg) {
          document.getElementById('error').textContent = msg;
        }

        function hideError() {
          document.getElementById('error').textContent = '';
        }
      </script>
    </body>
    </html>
  `;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {loading || processing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={GameColors.safe} />
              <ThemedText style={styles.loadingText}>
                {processing ? "Processing payment..." : "Loading payment form..."}
              </ThemedText>
            </View>
          ) : null}
          <WebView
            ref={webViewRef}
            source={{ html: paymentFormHtml }}
            style={[styles.webView, (loading || processing) && styles.hidden]}
            onMessage={handleMessage}
            onLoadEnd={() => setLoading(false)}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={["*"]}
            scrollEnabled={false}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  container: {
    width: "100%",
    maxWidth: 400,
    height: 480,
    backgroundColor: GameColors.surface,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
  },
  hidden: {
    opacity: 0,
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    backgroundColor: GameColors.surface,
  },
  loadingText: {
    ...Typography.body,
    color: GameColors.textSecondary,
    marginTop: Spacing.md,
  },
});
