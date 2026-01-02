import React, { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { PaymentModal } from "@/components/PaymentModal";
import { GameColors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { getCoins, addCoins, getStabilityTokens, buyStabilityToken } from "@/lib/storage";
import { getApiUrl } from "@/lib/query-client";
import {
  COIN_PACKS,
  initializePurchases,
  isIAPAvailable,
  purchaseProduct,
  setPurchaseListener,
  validateAndProcessPurchase,
  disconnectPurchases,
} from "@/lib/purchases";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

interface CoinPackProps {
  coins: number;
  price: string;
  popular?: boolean;
  onPurchase: () => void;
  delay: number;
}

function CoinPack({ coins, price, popular, onPurchase, delay }: CoinPackProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPurchase();
  };

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()}>
      <Pressable onPress={handlePress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View style={[styles.packCard, popular && styles.popularCard, animatedStyle]}>
          {popular ? (
            <View style={styles.popularBadge}>
              <ThemedText style={styles.popularText}>MOST POPULAR</ThemedText>
            </View>
          ) : null}
          <View style={styles.packContent}>
            <View style={styles.coinInfo}>
              <Feather name="circle" size={32} color={GameColors.premium} />
              <ThemedText style={styles.coinAmount}>{coins}</ThemedText>
            </View>
            <View style={styles.priceButton}>
              <ThemedText style={styles.priceText}>{price}</ThemedText>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

interface PaymentConfig {
  configured: boolean;
  publicKey: string | null;
  apiLoginId: string | null;
  testMode: boolean;
}

interface SelectedPack {
  productId: string;
  coins: number;
  price: string;
}

export default function StoreScreen() {
  const insets = useSafeAreaInsets();
  const [coins, setCoins] = useState(0);
  const [stabilityTokens, setStabilityTokens] = useState(0);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedPack, setSelectedPack] = useState<SelectedPack | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [iapAvailable, setIapAvailable] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPaymentConfig();
    initIAP();

    return () => {
      disconnectPurchases();
    };
  }, []);

  useEffect(() => {
    if (!iapAvailable) return;

    const cleanup = setPurchaseListener(
      async (purchase) => {
        const result = await validateAndProcessPurchase(purchase);
        if (result.success && result.coins) {
          setCoins(prev => prev + result.coins!);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("Purchase Complete", `${result.coins} coins have been added!`);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert("Purchase Failed", result.error || "Please try again");
        }
        setProcessing(false);
      },
      (error) => {
        if (error.code !== "cancelled") {
          Alert.alert("Purchase Error", error.message);
        }
        setProcessing(false);
      }
    );

    return cleanup || undefined;
  }, [iapAvailable]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const initIAP = async () => {
    const available = await initializePurchases();
    setIapAvailable(available);
  };

  const loadPaymentConfig = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/payment-config`);
      const config = await response.json();
      setPaymentConfig(config);
    } catch (error) {
      console.error("Failed to load payment config:", error);
    }
  };

  const loadData = async () => {
    const [coinCount, tokens] = await Promise.all([
      getCoins(),
      getStabilityTokens(),
    ]);
    setCoins(coinCount);
    setStabilityTokens(tokens);
  };

  const handlePurchase = async (pack: typeof COIN_PACKS[0]) => {
    if (iapAvailable && Platform.OS !== "web") {
      setProcessing(true);
      const result = await purchaseProduct(pack.productId);
      if (!result.success && result.error !== "Purchase cancelled") {
        Alert.alert("Error", result.error || "Failed to start purchase");
        setProcessing(false);
      } else if (result.error === "Purchase cancelled") {
        setProcessing(false);
      }
      return;
    }

    if (!paymentConfig?.configured) {
      Alert.alert(
        "Demo Mode",
        `Buy ${pack.coins} coins for ${pack.displayPrice}?\n\n(Payment system not configured - coins will be added for free)`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Get Coins",
            onPress: async () => {
              const newBalance = await addCoins(pack.coins);
              setCoins(newBalance);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          },
        ]
      );
      return;
    }

    setSelectedPack({
      productId: pack.productId,
      coins: pack.coins,
      price: pack.displayPrice,
    });
    setPaymentModalVisible(true);
  };

  const handlePaymentSuccess = async (purchasedCoins: number) => {
    setPaymentModalVisible(false);
    setSelectedPack(null);
    const newBalance = await addCoins(purchasedCoins);
    setCoins(newBalance);
    Alert.alert("Purchase Complete", `${purchasedCoins} coins have been added to your balance!`);
  };

  const handleBuyStabilityToken = async () => {
    if (coins < 5) {
      Alert.alert("Not Enough Coins", "You need at least 5 coins to buy a Stability Token.");
      return;
    }

    Alert.alert(
      "Buy Stability Token",
      "Spend 5 coins for a Stability Token?\n\nThis token prevents your tile from cracking once per game.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Buy",
          onPress: async () => {
            const success = await buyStabilityToken();
            if (success) {
              await loadData();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
        },
      ]
    );
  };

  const getPaymentMethodText = () => {
    if (iapAvailable && Platform.OS !== "web") {
      return Platform.OS === "ios" 
        ? "Secure payments via Apple App Store"
        : "Secure payments via Google Play";
    }
    if (paymentConfig?.configured) {
      return "Secure payments powered by Authorize.net";
    }
    return "Payment system in demo mode";
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing["2xl"] },
        ]}
      >
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.balanceCard}>
          <ThemedText style={styles.balanceLabel}>Your Balance</ThemedText>
          <View style={styles.balanceRow}>
            <Feather name="circle" size={28} color={GameColors.premium} />
            <ThemedText style={styles.balanceValue}>{coins}</ThemedText>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <ThemedText style={styles.sectionTitle}>Coin Packs</ThemedText>
        </Animated.View>

        <View style={styles.packsContainer}>
          {COIN_PACKS.map((pack, index) => (
            <CoinPack
              key={pack.productId}
              coins={pack.coins}
              price={pack.displayPrice}
              popular={pack.popular}
              onPurchase={() => handlePurchase(pack)}
              delay={300 + index * 100}
            />
          ))}
        </View>

        <Animated.View entering={FadeInDown.delay(600).springify()}>
          <ThemedText style={styles.sectionTitle}>Power Items</ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(700).springify()}>
          <Pressable onPress={handleBuyStabilityToken}>
            <View style={styles.powerItemCard}>
              <View style={styles.powerItemHeader}>
                <View style={styles.powerItemIcon}>
                  <Feather name="shield" size={24} color={GameColors.accent} />
                </View>
                <View style={styles.powerItemInfo}>
                  <ThemedText style={styles.powerItemName}>Stability Token</ThemedText>
                  <ThemedText style={styles.powerItemDesc}>
                    Prevents your tile from cracking once per game
                  </ThemedText>
                </View>
              </View>
              <View style={styles.powerItemFooter}>
                <ThemedText style={styles.ownedText}>Owned: {stabilityTokens}</ThemedText>
                <View style={styles.powerItemPrice}>
                  <Feather name="circle" size={16} color={GameColors.premium} />
                  <ThemedText style={styles.priceAmount}>5</ThemedText>
                </View>
              </View>
            </View>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(800).springify()} style={styles.disclaimer}>
          <Feather name="lock" size={14} color={GameColors.textSecondary} />
          <ThemedText style={styles.disclaimerText}>
            {getPaymentMethodText()}
          </ThemedText>
        </Animated.View>

        {processing ? (
          <Animated.View entering={FadeInDown.springify()} style={styles.processingOverlay}>
            <ThemedText style={styles.processingText}>Processing purchase...</ThemedText>
          </Animated.View>
        ) : null}
      </ScrollView>

      {selectedPack && paymentConfig?.configured && paymentConfig.publicKey && paymentConfig.apiLoginId && !iapAvailable ? (
        <PaymentModal
          visible={paymentModalVisible}
          onClose={() => {
            setPaymentModalVisible(false);
            setSelectedPack(null);
          }}
          onSuccess={handlePaymentSuccess}
          productId={selectedPack.productId}
          coins={selectedPack.coins}
          price={selectedPack.price}
          apiLoginId={paymentConfig.apiLoginId}
          publicClientKey={paymentConfig.publicKey}
          testMode={paymentConfig.testMode}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GameColors.background,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  balanceCard: {
    backgroundColor: GameColors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  balanceLabel: {
    ...Typography.small,
    color: GameColors.textSecondary,
    marginBottom: Spacing.sm,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  balanceValue: {
    ...Typography.display,
    color: GameColors.premium,
    fontFamily: "monospace",
  },
  sectionTitle: {
    ...Typography.h4,
    color: GameColors.textPrimary,
    marginTop: Spacing.md,
  },
  packsContainer: {
    gap: Spacing.md,
  },
  packCard: {
    backgroundColor: GameColors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: "transparent",
  },
  popularCard: {
    borderColor: GameColors.premium,
  },
  popularBadge: {
    position: "absolute",
    top: -10,
    right: Spacing.lg,
    backgroundColor: GameColors.premium,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  popularText: {
    ...Typography.caption,
    color: GameColors.background,
    fontWeight: "700",
  },
  packContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coinInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  coinAmount: {
    ...Typography.h2,
    color: GameColors.premium,
  },
  priceButton: {
    backgroundColor: GameColors.safe,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  priceText: {
    ...Typography.button,
    color: GameColors.background,
  },
  powerItemCard: {
    backgroundColor: GameColors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: GameColors.accent,
  },
  powerItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  powerItemIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: GameColors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
  },
  powerItemInfo: {
    flex: 1,
  },
  powerItemName: {
    ...Typography.body,
    color: GameColors.textPrimary,
    fontWeight: "600",
  },
  powerItemDesc: {
    ...Typography.small,
    color: GameColors.textSecondary,
  },
  powerItemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: GameColors.surfaceLight,
  },
  ownedText: {
    ...Typography.small,
    color: GameColors.textSecondary,
  },
  powerItemPrice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  priceAmount: {
    ...Typography.button,
    color: GameColors.premium,
  },
  disclaimer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingTop: Spacing.lg,
  },
  disclaimerText: {
    ...Typography.caption,
    color: GameColors.textSecondary,
    textAlign: "center",
  },
  processingOverlay: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  processingText: {
    ...Typography.body,
    color: GameColors.textSecondary,
  },
});
