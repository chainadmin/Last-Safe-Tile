import React, { useEffect, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { getBannerAdUnitId, subscribeToAdsReady } from "@/lib/ads";

let BannerAdComponent: React.ComponentType<{
  unitId: string;
  size: string;
  requestOptions?: { requestNonPersonalizedAdsOnly?: boolean };
}> | null = null;
let BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: string } | null = null;

export function AdBanner() {
  const [adsReady, setAdsReady] = useState(false);
  const [componentsLoaded, setComponentsLoaded] = useState(false);
  const [adError, setAdError] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAdsReady(setAdsReady);
    return unsubscribe;
  }, []);

  useEffect(() => {
    async function loadAdComponents() {
      if (Platform.OS === "web") {
        return;
      }

      try {
        const adsModule = await import("react-native-google-mobile-ads");
        BannerAdComponent = adsModule.BannerAd;
        BannerAdSize = adsModule.BannerAdSize;
        setComponentsLoaded(true);
      } catch (error) {
        console.log("Banner ads not available:", error);
        setAdError(true);
      }
    }

    loadAdComponents();
  }, []);

  if (Platform.OS === "web" || adError) {
    return null;
  }

  if (!adsReady || !componentsLoaded || !BannerAdComponent || !BannerAdSize) {
    return null;
  }

  const adUnitId = getBannerAdUnitId();

  return (
    <View style={styles.container}>
      <BannerAdComponent
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
