import React, { useEffect } from "react";
import { View, StyleSheet, Image, Pressable } from "react-native";
import { useNavigation, CommonActions } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { GameColors, Spacing, Typography } from "@/constants/theme";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Branding">;

export default function BrandingScreen() {
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigateToMenu();
    }, 2500);

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

  return (
    <Pressable style={styles.container} onPress={navigateToMenu}>
      <Animated.View 
        entering={FadeIn.duration(800)} 
        style={styles.content}
      >
        <Image
          source={require("@assets/images/chain-software-logo.jpg")}
          style={styles.logo}
          resizeMode="contain"
        />
        <ThemedText style={styles.companyName}>Chain Software Group</ThemedText>
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
  content: {
    alignItems: "center",
  },
  logo: {
    width: 180,
    height: 180,
    borderRadius: 24,
    marginBottom: Spacing.xl,
  },
  companyName: {
    ...Typography.h2,
    color: GameColors.textPrimary,
    textAlign: "center",
    letterSpacing: 1,
  },
});
