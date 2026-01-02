import { Platform } from "react-native";

const AD_UNIT_IDS = {
  ios: {
    banner: process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID || "ca-app-pub-3940256099942544/2934735716",
    interstitial: process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID || "ca-app-pub-3940256099942544/4411468910",
  },
  android: {
    banner: process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID || "ca-app-pub-1580761947831808/8250933561",
    interstitial: process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID || "ca-app-pub-1580761947831808/6019505985",
  },
};

const TEST_AD_UNIT_IDS = {
  banner: "ca-app-pub-3940256099942544/6300978111",
  interstitial: "ca-app-pub-3940256099942544/1033173712",
};

let mobileAds: typeof import("react-native-google-mobile-ads").default | null = null;
let InterstitialAd: typeof import("react-native-google-mobile-ads").InterstitialAd | null = null;
let AdEventType: typeof import("react-native-google-mobile-ads").AdEventType | null = null;
let TestIds: typeof import("react-native-google-mobile-ads").TestIds | null = null;

let adsInitialized = false;
let adsAvailable = false;
let interstitialAd: ReturnType<typeof import("react-native-google-mobile-ads").InterstitialAd.createForAdRequest> | null = null;
let interstitialLoaded = false;

type AdsReadyListener = (ready: boolean) => void;
const adsReadyListeners: Set<AdsReadyListener> = new Set();

export function subscribeToAdsReady(listener: AdsReadyListener): () => void {
  adsReadyListeners.add(listener);
  listener(adsAvailable);
  return () => adsReadyListeners.delete(listener);
}

function notifyAdsReady(ready: boolean): void {
  adsReadyListeners.forEach((listener) => listener(ready));
}

export async function initializeAds(): Promise<boolean> {
  if (Platform.OS === "web") {
    console.log("Ads not available on web");
    return false;
  }

  try {
    const adsModule = await import("react-native-google-mobile-ads");
    mobileAds = adsModule.default;
    InterstitialAd = adsModule.InterstitialAd;
    AdEventType = adsModule.AdEventType;
    TestIds = adsModule.TestIds;

    await mobileAds().initialize();
    adsInitialized = true;
    adsAvailable = true;
    notifyAdsReady(true);
    console.log("AdMob initialized successfully");

    loadInterstitialAd();
    return true;
  } catch (error) {
    console.log("AdMob not available (requires development build):", error);
    adsAvailable = false;
    notifyAdsReady(false);
    return false;
  }
}

function loadInterstitialAd(): void {
  if (!InterstitialAd || !AdEventType || !adsAvailable) {
    return;
  }

  try {
    const adUnitId = __DEV__ ? TEST_AD_UNIT_IDS.interstitial : getAdUnitId("interstitial");
    interstitialAd = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
      console.log("Interstitial ad loaded");
      interstitialLoaded = true;
    });

    interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
      console.log("Interstitial ad closed");
      interstitialLoaded = false;
      loadInterstitialAd();
    });

    interstitialAd.addAdEventListener(AdEventType.ERROR, (error: unknown) => {
      console.log("Interstitial ad error:", error);
      interstitialLoaded = false;
    });

    interstitialAd.load();
  } catch (error) {
    console.log("Failed to load interstitial ad:", error);
  }
}

export function isAdsAvailable(): boolean {
  return adsAvailable && Platform.OS !== "web";
}

export function isInterstitialReady(): boolean {
  return interstitialLoaded && interstitialAd !== null;
}

export async function showInterstitialAd(): Promise<boolean> {
  if (!adsAvailable || !interstitialAd) {
    console.log("Interstitial ad not available");
    return false;
  }

  if (!interstitialLoaded) {
    console.log("Interstitial ad not loaded yet");
    return false;
  }

  try {
    await interstitialAd.show();
    return true;
  } catch (error) {
    console.error("Failed to show interstitial ad:", error);
    return false;
  }
}

export function getAdUnitId(type: "banner" | "interstitial"): string {
  if (__DEV__) {
    return type === "banner" ? TEST_AD_UNIT_IDS.banner : TEST_AD_UNIT_IDS.interstitial;
  }
  const platform = Platform.OS === "ios" ? "ios" : "android";
  return AD_UNIT_IDS[platform][type];
}

export function getBannerAdUnitId(): string {
  if (__DEV__) {
    return TEST_AD_UNIT_IDS.banner;
  }
  const platform = Platform.OS === "ios" ? "ios" : "android";
  return AD_UNIT_IDS[platform].banner;
}
