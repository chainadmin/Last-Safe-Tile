import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useNavigation, useRoute, CommonActions, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { GameColors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import {
  getHighScore,
  setHighScore,
  getCoins,
  spendCoins,
  getDailyRetryAvailable,
  useDailyRetry,
} from "@/lib/storage";
import { showInterstitialAd } from "@/lib/ads";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeInUp,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

type Props = NativeStackScreenProps<RootStackParamList, "GameOver">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, "GameOver">;

const CONTINUE_COST = 10;
const INITIAL_GRID_SIZE = 5;

interface ActionButtonProps {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  variant: "success" | "premium" | "neutral";
  subtitle?: string;
  disabled?: boolean;
}

function ActionButton({ title, icon, onPress, variant, subtitle, disabled }: ActionButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handlePress = () => {
    if (!disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  const backgroundColor =
    variant === "success"
      ? GameColors.success
      : variant === "premium"
      ? GameColors.premium
      : GameColors.surface;

  const textColor = variant === "neutral" ? GameColors.textPrimary : GameColors.background;

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View
        style={[
          styles.actionButton,
          { backgroundColor },
          disabled && styles.buttonDisabled,
          animatedStyle,
        ]}
      >
        <Feather name={icon} size={20} color={textColor} />
        <View style={styles.buttonTextContainer}>
          <ThemedText style={[styles.buttonText, { color: textColor }]}>{title}</ThemedText>
          {subtitle ? (
            <ThemedText style={[styles.buttonSubtitle, { color: textColor }]}>{subtitle}</ThemedText>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function GameOverScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<Props["route"]>();
  const { timeSurvived, avgMultiplier, finalScore, gridsBeaten, stabilityTokenUsed, continueState } = route.params;

  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [coins, setCoins] = useState(0);
  const [dailyRetryAvailable, setDailyRetryAvailable] = useState(false);
  const adShownRef = useRef(false);

  useEffect(() => {
    checkHighScore();
    loadData();
  }, []);

  const showAdOnce = async () => {
    if (!adShownRef.current) {
      adShownRef.current = true;
      await showInterstitialAd();
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const checkHighScore = async () => {
    const currentHighScore = await getHighScore();
    if (finalScore > currentHighScore) {
      await setHighScore(finalScore);
      setIsNewHighScore(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const loadData = async () => {
    const [coinCount, retry] = await Promise.all([
      getCoins(),
      getDailyRetryAvailable(),
    ]);
    setCoins(coinCount);
    setDailyRetryAvailable(retry);
  };

  const handleRetry = useCallback(async () => {
    await showAdOnce();
    if (dailyRetryAvailable) {
      await useDailyRetry();
    }
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Game" }],
      })
    );
  }, [navigation, dailyRetryAvailable]);

  const handleContinue = useCallback(async () => {
    if (coins < CONTINUE_COST) {
      navigation.navigate("Store");
      return;
    }
    const success = await spendCoins(CONTINUE_COST);
    if (success) {
      setCoins((c) => c - CONTINUE_COST);
      
      if (continueState) {
        const freshTiles: Array<{ id: string; row: number; col: number; state: "safe" | "cracking" | "gone" }> = [];
        for (let row = 0; row < INITIAL_GRID_SIZE; row++) {
          for (let col = 0; col < INITIAL_GRID_SIZE; col++) {
            freshTiles.push({
              id: `continue-${continueState.gridNumber}-${row}-${col}`,
              row,
              col,
              state: "safe",
            });
          }
        }
        
        const resumeState = {
          ...continueState,
          tiles: freshTiles,
          playerPosition: { row: 2, col: 2 },
        };
        
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "Game", params: { continueState: resumeState } }],
          })
        );
      } else {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "Game" }],
          })
        );
      }
    }
  }, [navigation, coins, continueState]);

  const handleHome = useCallback(async () => {
    await showAdOnce();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "MainMenu" }],
      })
    );
  }, [navigation]);

  return (
    <View style={styles.container}>
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
      
      <Animated.View entering={FadeIn.duration(300)} style={styles.overlay} />

      <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.card}>
        {isNewHighScore ? (
          <View style={styles.newHighScoreBadge}>
            <Feather name="star" size={16} color={GameColors.premium} />
            <ThemedText style={styles.newHighScoreText}>NEW HIGH SCORE!</ThemedText>
          </View>
        ) : null}

        <ThemedText style={styles.title}>YOU LASTED</ThemedText>
        <ThemedText style={styles.timeValue}>{timeSurvived.toFixed(1)}s</ThemedText>

        {stabilityTokenUsed ? (
          <View style={styles.tokenUsedBadge}>
            <Feather name="shield" size={14} color={GameColors.success} />
            <ThemedText style={styles.tokenUsedText}>Stability Token Used</ThemedText>
          </View>
        ) : null}

        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <ThemedText style={styles.statLabel}>Time</ThemedText>
            <ThemedText style={styles.statValue}>{timeSurvived.toFixed(1)}s</ThemedText>
          </View>
          <View style={styles.statRow}>
            <ThemedText style={styles.statLabel}>Grids Beaten</ThemedText>
            <ThemedText style={styles.statValue}>{gridsBeaten}</ThemedText>
          </View>
          <View style={styles.statRow}>
            <ThemedText style={styles.statLabel}>Avg Multiplier</ThemedText>
            <ThemedText style={styles.statValue}>x{avgMultiplier.toFixed(1)}</ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statRow}>
            <ThemedText style={styles.statLabelBig}>Final Score</ThemedText>
            <ThemedText style={styles.statValueBig}>{finalScore} pts</ThemedText>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <ActionButton
            title={dailyRetryAvailable ? "Retry (FREE)" : "Retry"}
            icon="refresh-cw"
            onPress={handleRetry}
            variant="success"
            subtitle={dailyRetryAvailable ? "Daily retry" : undefined}
          />

          <ActionButton
            title={coins < CONTINUE_COST ? "Get Coins" : "Continue"}
            icon={coins < CONTINUE_COST ? "shopping-cart" : "zap"}
            onPress={handleContinue}
            variant="premium"
            subtitle={coins < CONTINUE_COST ? `Need ${CONTINUE_COST} coins` : `${CONTINUE_COST} coins (${coins} available)`}
          />

          <ActionButton
            title="Home"
            icon="home"
            onPress={handleHome}
            variant="neutral"
          />
        </View>

        <ThemedText style={styles.disclaimer}>Continuing resets multiplier</ThemedText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  card: {
    width: "100%",
    backgroundColor: GameColors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  newHighScoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GameColors.surfaceLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  newHighScoreText: {
    ...Typography.small,
    color: GameColors.premium,
    fontWeight: "600",
  },
  tokenUsedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GameColors.surfaceLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  tokenUsedText: {
    ...Typography.small,
    color: GameColors.success,
    fontWeight: "600",
  },
  title: {
    ...Typography.body,
    color: GameColors.textSecondary,
    letterSpacing: 2,
  },
  timeValue: {
    ...Typography.display,
    fontSize: 48,
    color: GameColors.textPrimary,
    fontFamily: "monospace",
    marginBottom: Spacing.lg,
  },
  statsContainer: {
    width: "100%",
    backgroundColor: GameColors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing["2xl"],
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  statLabel: {
    ...Typography.small,
    color: GameColors.textSecondary,
  },
  statValue: {
    ...Typography.small,
    color: GameColors.textPrimary,
    fontFamily: "monospace",
  },
  statDivider: {
    height: 1,
    backgroundColor: GameColors.surface,
    marginVertical: Spacing.sm,
  },
  statLabelBig: {
    ...Typography.body,
    color: GameColors.textSecondary,
    fontWeight: "600",
  },
  statValueBig: {
    ...Typography.displaySmall,
    color: GameColors.safe,
    fontFamily: "monospace",
  },
  actionsContainer: {
    width: "100%",
    gap: Spacing.md,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonTextContainer: {
    alignItems: "center",
  },
  buttonText: {
    ...Typography.button,
  },
  buttonSubtitle: {
    ...Typography.caption,
    opacity: 0.8,
  },
  disclaimer: {
    ...Typography.caption,
    color: GameColors.textSecondary,
    marginTop: Spacing.lg,
    opacity: 0.6,
  },
});
