import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Switch, Pressable, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { GameColors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { getSettings, setSettings, resetAllData, GameSettings } from "@/lib/storage";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

interface SettingRowProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

function SettingRow({ icon, title, value, onValueChange }: SettingRowProps) {
  const handleChange = (newValue: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange(newValue);
  };

  return (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Feather name={icon} size={20} color={GameColors.textSecondary} />
        <ThemedText style={styles.settingTitle}>{title}</ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={handleChange}
        trackColor={{ false: GameColors.surfaceLight, true: GameColors.safe }}
        thumbColor={GameColors.textPrimary}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [settings, setLocalSettings] = useState<GameSettings>({
    soundEnabled: true,
    vibrationEnabled: true,
    visualWarningsEnabled: true,
  });

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  const loadSettings = async () => {
    const loadedSettings = await getSettings();
    setLocalSettings(loadedSettings);
  };

  const updateSetting = async (key: keyof GameSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setLocalSettings(newSettings);
    await setSettings({ [key]: value });
  };

  const handleResetHighScores = () => {
    Alert.alert(
      "Reset All Data",
      "This will reset your high scores, coins, and all other data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await resetAllData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert("Done", "All data has been reset.");
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + Spacing["2xl"] },
      ]}
    >
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <ThemedText style={styles.sectionTitle}>Gameplay</ThemedText>
        <View style={styles.card}>
          <SettingRow
            icon="volume-2"
            title="Sound Effects"
            value={settings.soundEnabled}
            onValueChange={(value) => updateSetting("soundEnabled", value)}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="smartphone"
            title="Vibration"
            value={settings.vibrationEnabled}
            onValueChange={(value) => updateSetting("vibrationEnabled", value)}
          />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).springify()}>
        <ThemedText style={styles.sectionTitle}>Data</ThemedText>
        <Pressable onPress={handleResetHighScores}>
          <View style={styles.dangerCard}>
            <Feather name="trash-2" size={20} color={GameColors.warning} />
            <View style={styles.dangerInfo}>
              <ThemedText style={styles.dangerTitle}>Reset All Data</ThemedText>
              <ThemedText style={styles.dangerDesc}>
                Clears high scores, coins, and settings
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={GameColors.textSecondary} />
          </View>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.footer}>
        <ThemedText style={styles.footerText}>Last Safe Tile v1.0.0</ThemedText>
        <ThemedText style={styles.footerSubtext}>Made with React Native + Expo</ThemedText>
      </Animated.View>
    </ScrollView>
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
  sectionTitle: {
    ...Typography.h4,
    color: GameColors.textPrimary,
    marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: GameColors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  settingTitle: {
    ...Typography.body,
    color: GameColors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: GameColors.surfaceLight,
    marginVertical: Spacing.sm,
  },
  dangerCard: {
    backgroundColor: GameColors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: GameColors.warning,
  },
  dangerInfo: {
    flex: 1,
  },
  dangerTitle: {
    ...Typography.body,
    color: GameColors.warning,
    fontWeight: "600",
  },
  dangerDesc: {
    ...Typography.small,
    color: GameColors.textSecondary,
  },
  footer: {
    alignItems: "center",
    paddingTop: Spacing["3xl"],
  },
  footerText: {
    ...Typography.small,
    color: GameColors.textSecondary,
  },
  footerSubtext: {
    ...Typography.caption,
    color: GameColors.textSecondary,
    opacity: 0.6,
  },
});
