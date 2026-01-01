import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, Image, Pressable } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { GameColors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { getDailyRetryAvailable, getCoins } from "@/lib/storage";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "MainMenu">;

interface MenuButtonProps {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  primary?: boolean;
  delay?: number;
}

function MenuButton({ title, icon, onPress, primary, delay = 0 }: MenuButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View
          style={[
            styles.button,
            primary ? styles.primaryButton : styles.secondaryButton,
            animatedStyle,
          ]}
        >
          <Feather
            name={icon}
            size={24}
            color={primary ? GameColors.background : GameColors.textPrimary}
            style={styles.buttonIcon}
          />
          <ThemedText
            style={[
              styles.buttonText,
              primary ? styles.primaryButtonText : styles.secondaryButtonText,
            ]}
          >
            {title}
          </ThemedText>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default function MainMenuScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [dailyRetryAvailable, setDailyRetryAvailable] = useState(false);
  const [coins, setCoins] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    const [retry, coinCount] = await Promise.all([
      getDailyRetryAvailable(),
      getCoins(),
    ]);
    setDailyRetryAvailable(retry);
    setCoins(coinCount);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.header}>
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <ThemedText style={styles.title}>Last Safe Tile</ThemedText>
        </Animated.View>
      </View>

      <View style={styles.coinDisplay}>
        <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.coinContainer}>
          <Feather name="circle" size={20} color={GameColors.premium} />
          <ThemedText style={styles.coinText}>{coins}</ThemedText>
        </Animated.View>
      </View>

      <View style={styles.buttonsContainer}>
        <MenuButton
          title="Play"
          icon="play"
          onPress={() => navigation.navigate("Game")}
          primary
          delay={300}
        />
        <MenuButton
          title="High Score"
          icon="award"
          onPress={() => navigation.navigate("HighScore")}
          delay={400}
        />
        <MenuButton
          title="Store"
          icon="shopping-bag"
          onPress={() => navigation.navigate("Store")}
          delay={500}
        />
        <MenuButton
          title="Settings"
          icon="settings"
          onPress={() => navigation.navigate("Settings")}
          delay={600}
        />
      </View>

      {dailyRetryAvailable ? (
        <Animated.View entering={FadeInDown.delay(700).springify()} style={styles.footer}>
          <ThemedText style={styles.footerText}>Daily free retry available</ThemedText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GameColors.background,
    paddingHorizontal: Spacing["2xl"],
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h2,
    color: GameColors.textPrimary,
    textAlign: "center",
  },
  coinDisplay: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  coinContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GameColors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  coinText: {
    ...Typography.displaySmall,
    color: GameColors.premium,
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: "center",
    gap: Spacing.lg,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 64,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing["2xl"],
    gap: Spacing.md,
  },
  primaryButton: {
    backgroundColor: GameColors.safe,
  },
  secondaryButton: {
    backgroundColor: GameColors.surface,
  },
  buttonIcon: {
    marginRight: Spacing.xs,
  },
  buttonText: {
    ...Typography.button,
  },
  primaryButtonText: {
    color: GameColors.background,
  },
  secondaryButtonText: {
    color: GameColors.textPrimary,
  },
  footer: {
    alignItems: "center",
    paddingTop: Spacing.lg,
  },
  footerText: {
    ...Typography.small,
    color: GameColors.success,
    opacity: 0.8,
  },
});
