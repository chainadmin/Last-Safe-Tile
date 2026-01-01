import React, { useEffect } from "react";
import { View, StyleSheet, Pressable, Image } from "react-native";
import { useNavigation, CommonActions } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { GameColors, Spacing, Typography } from "@/constants/theme";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  FadeIn,
} from "react-native-reanimated";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Splash">;

export default function SplashScreen() {
  const navigation = useNavigation<NavigationProp>();
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );

    const timer = setTimeout(() => {
      navigateToMenu();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const navigateToMenu = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "MainMenu" }],
      })
    );
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Pressable style={styles.container} onPress={navigateToMenu}>
      <Animated.View style={animatedStyle}>
        <Image
          source={require("../../assets/images/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
      <Animated.View entering={FadeIn.delay(300).duration(500)}>
        <ThemedText style={styles.title}>Last Safe Tile</ThemedText>
      </Animated.View>
      <Animated.View entering={FadeIn.delay(600).duration(500)}>
        <ThemedText style={styles.subtitle}>How long can you stay?</ThemedText>
      </Animated.View>
      <Animated.View entering={FadeIn.delay(1200).duration(500)} style={styles.tapHint}>
        <ThemedText style={styles.tapText}>Tap to continue</ThemedText>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GameColors.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: Spacing["3xl"],
  },
  title: {
    ...Typography.h1,
    color: GameColors.textPrimary,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  subtitle: {
    ...Typography.body,
    color: GameColors.textSecondary,
    textAlign: "center",
  },
  tapHint: {
    position: "absolute",
    bottom: 80,
  },
  tapText: {
    ...Typography.small,
    color: GameColors.textSecondary,
    opacity: 0.6,
  },
});
