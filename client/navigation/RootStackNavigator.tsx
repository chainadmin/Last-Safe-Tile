import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SplashScreen from "@/screens/SplashScreen";
import BrandingScreen from "@/screens/BrandingScreen";
import MainMenuScreen from "@/screens/MainMenuScreen";
import GameScreen from "@/screens/GameScreen";
import GameOverScreen from "@/screens/GameOverScreen";
import StoreScreen from "@/screens/StoreScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import HighScoreScreen from "@/screens/HighScoreScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { GameColors } from "@/constants/theme";

export type RootStackParamList = {
  Splash: undefined;
  Branding: undefined;
  MainMenu: undefined;
  Game: undefined;
  GameOver: {
    timeSurvived: number;
    avgMultiplier: number;
    finalScore: number;
    gridsBeaten: number;
    stabilityTokenUsed: boolean;
  };
  Store: undefined;
  Settings: undefined;
  HighScore: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions({ transparent: false });

  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        ...screenOptions,
        headerStyle: {
          backgroundColor: GameColors.background,
        },
        headerTintColor: GameColors.textPrimary,
        contentStyle: {
          backgroundColor: GameColors.background,
        },
      }}
    >
      <Stack.Screen
        name="Splash"
        component={SplashScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="Branding"
        component={BrandingScreen}
        options={{ headerShown: false, gestureEnabled: false, animation: "fade" }}
      />
      <Stack.Screen
        name="MainMenu"
        component={MainMenuScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="Game"
        component={GameScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="GameOver"
        component={GameOverScreen}
        options={{
          presentation: "transparentModal",
          headerShown: false,
          gestureEnabled: false,
          animation: "fade",
        }}
      />
      <Stack.Screen
        name="Store"
        component={StoreScreen}
        options={{
          headerTitle: "Store",
          headerBackTitle: "Back",
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerTitle: "Settings",
          headerBackTitle: "Back",
        }}
      />
      <Stack.Screen
        name="HighScore"
        component={HighScoreScreen}
        options={{
          headerTitle: "High Score",
          headerBackTitle: "Back",
        }}
      />
    </Stack.Navigator>
  );
}
