import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  HIGH_SCORE: "@lastsafetile:highScore",
  COINS: "@lastsafetile:coins",
  SETTINGS: "@lastsafetile:settings",
  DAILY_RETRY: "@lastsafetile:dailyRetry",
  STABILITY_TOKENS: "@lastsafetile:stabilityTokens",
};

export interface GameSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  visualWarningsEnabled: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
  visualWarningsEnabled: true,
};

export async function getHighScore(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.HIGH_SCORE);
    return value ? parseFloat(value) : 0;
  } catch {
    return 0;
  }
}

export async function setHighScore(score: number): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.HIGH_SCORE, score.toString());
  } catch {
    console.error("Failed to save high score");
  }
}

export async function getCoins(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.COINS);
    return value ? parseInt(value, 10) : 50;
  } catch {
    return 50;
  }
}

export async function setCoins(coins: number): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.COINS, coins.toString());
  } catch {
    console.error("Failed to save coins");
  }
}

export async function addCoins(amount: number): Promise<number> {
  const current = await getCoins();
  const newAmount = current + amount;
  await setCoins(newAmount);
  return newAmount;
}

export async function spendCoins(amount: number): Promise<boolean> {
  const current = await getCoins();
  if (current >= amount) {
    await setCoins(current - amount);
    return true;
  }
  return false;
}

export async function getSettings(): Promise<GameSettings> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
    return value ? { ...DEFAULT_SETTINGS, ...JSON.parse(value) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function setSettings(settings: Partial<GameSettings>): Promise<void> {
  try {
    const current = await getSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
  } catch {
    console.error("Failed to save settings");
  }
}

export async function getDailyRetryAvailable(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.DAILY_RETRY);
    if (!value) return true;
    const lastUsed = new Date(value);
    const now = new Date();
    return lastUsed.toDateString() !== now.toDateString();
  } catch {
    return true;
  }
}

export async function useDailyRetry(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.DAILY_RETRY, new Date().toISOString());
  } catch {
    console.error("Failed to save daily retry");
  }
}

export async function getStabilityTokens(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.STABILITY_TOKENS);
    return value ? parseInt(value, 10) : 0;
  } catch {
    return 0;
  }
}

export async function setStabilityTokens(tokens: number): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.STABILITY_TOKENS, tokens.toString());
  } catch {
    console.error("Failed to save stability tokens");
  }
}

export async function buyStabilityToken(): Promise<boolean> {
  const success = await spendCoins(5);
  if (success) {
    const current = await getStabilityTokens();
    await setStabilityTokens(current + 1);
  }
  return success;
}

export async function resetAllData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
  } catch {
    console.error("Failed to reset data");
  }
}
