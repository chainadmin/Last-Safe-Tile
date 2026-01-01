import { Platform } from "react-native";

export const GameColors = {
  safe: "#00FF88",
  warning: "#FFB800",
  danger: "#000000",
  accent: "#00D4FF",
  background: "#1A1A2E",
  surface: "#16213E",
  surfaceLight: "#1E2A4A",
  textPrimary: "#FFFFFF",
  textSecondary: "#8E9AAF",
  success: "#4CAF50",
  premium: "#FFD700",
  multiplierGlow: "#00D4FF",
};

const tintColorLight = "#00FF88";
const tintColorDark = "#00FF88";

export const Colors = {
  light: {
    text: "#FFFFFF",
    buttonText: "#1A1A2E",
    tabIconDefault: "#8E9AAF",
    tabIconSelected: tintColorLight,
    link: "#00D4FF",
    backgroundRoot: "#1A1A2E",
    backgroundDefault: "#16213E",
    backgroundSecondary: "#1E2A4A",
    backgroundTertiary: "#253052",
  },
  dark: {
    text: "#FFFFFF",
    buttonText: "#1A1A2E",
    tabIconDefault: "#8E9AAF",
    tabIconSelected: tintColorDark,
    link: "#00D4FF",
    backgroundRoot: "#1A1A2E",
    backgroundDefault: "#16213E",
    backgroundSecondary: "#1E2A4A",
    backgroundTertiary: "#253052",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  "2xl": 40,
  "3xl": 50,
  full: 9999,
};

export const Typography = {
  display: {
    fontSize: 32,
    fontWeight: "700" as const,
  },
  displayMedium: {
    fontSize: 24,
    fontWeight: "700" as const,
  },
  displaySmall: {
    fontSize: 18,
    fontWeight: "600" as const,
  },
  h1: {
    fontSize: 32,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 28,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 24,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 20,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
  },
  button: {
    fontSize: 18,
    fontWeight: "600" as const,
  },
  link: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
