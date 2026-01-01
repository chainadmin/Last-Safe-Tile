import React, { useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { GameColors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { getHighScore } from "@/lib/storage";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

export default function HighScoreScreen() {
  const insets = useSafeAreaInsets();
  const [highScore, setHighScore] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadHighScore();
    }, [])
  );

  const loadHighScore = async () => {
    const score = await getHighScore();
    setHighScore(score);
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + Spacing["2xl"] }]}>
      <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.trophyContainer}>
        <View style={styles.trophyCircle}>
          <Feather name="award" size={64} color={GameColors.premium} />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.scoreContainer}>
        <ThemedText style={styles.label}>YOUR BEST SCORE</ThemedText>
        <ThemedText style={styles.scoreValue}>{highScore}</ThemedText>
        <ThemedText style={styles.points}>points</ThemedText>
      </Animated.View>

      {highScore === 0 ? (
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.noScoreContainer}>
          <ThemedText style={styles.noScoreText}>
            Play a game to set your first high score!
          </ThemedText>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.tipContainer}>
          <Feather name="info" size={16} color={GameColors.accent} />
          <ThemedText style={styles.tipText}>
            Wait longer before moving to increase your multiplier and score higher!
          </ThemedText>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GameColors.background,
    padding: Spacing["2xl"],
    alignItems: "center",
    justifyContent: "center",
  },
  trophyContainer: {
    marginBottom: Spacing["3xl"],
  },
  trophyCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: GameColors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: GameColors.premium,
  },
  scoreContainer: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  label: {
    ...Typography.small,
    color: GameColors.textSecondary,
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  scoreValue: {
    fontSize: 72,
    fontWeight: "700",
    color: GameColors.premium,
    fontFamily: "monospace",
  },
  points: {
    ...Typography.body,
    color: GameColors.textSecondary,
  },
  noScoreContainer: {
    backgroundColor: GameColors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
  },
  noScoreText: {
    ...Typography.body,
    color: GameColors.textSecondary,
    textAlign: "center",
  },
  tipContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GameColors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: GameColors.accent,
  },
  tipText: {
    ...Typography.small,
    color: GameColors.textSecondary,
    flex: 1,
  },
});
