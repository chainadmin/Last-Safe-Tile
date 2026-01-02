import { Platform } from "react-native";

const AD_UNIT_IDS = {
  ios: {
    banner: "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX",
    interstitial: "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX",
    rewarded: "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX",
  },
  android: {
    banner: "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX",
    interstitial: "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX",
    rewarded: "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX",
  },
};

let adsInitialized = false;
let adsAvailable = false;

export async function initializeAds(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  try {
    adsInitialized = true;
    adsAvailable = true;
    return true;
  } catch (error) {
    console.log("Ads not available (requires development build with AdMob)");
    adsAvailable = false;
    return false;
  }
}

export function isAdsAvailable(): boolean {
  return adsAvailable && Platform.OS !== "web";
}

export async function showInterstitialAd(): Promise<boolean> {
  if (!adsAvailable) {
    console.log("Ads not available");
    return false;
  }

  try {
    console.log("Would show interstitial ad");
    return true;
  } catch (error) {
    console.error("Failed to show interstitial ad:", error);
    return false;
  }
}

export async function showRewardedAd(): Promise<{ success: boolean; earned: boolean }> {
  if (!adsAvailable) {
    console.log("Ads not available");
    return { success: false, earned: false };
  }

  try {
    console.log("Would show rewarded ad");
    return { success: true, earned: true };
  } catch (error) {
    console.error("Failed to show rewarded ad:", error);
    return { success: false, earned: false };
  }
}

export function getAdUnitId(type: "banner" | "interstitial" | "rewarded"): string {
  const platform = Platform.OS === "ios" ? "ios" : "android";
  return AD_UNIT_IDS[platform][type];
}
