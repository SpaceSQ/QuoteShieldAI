import type { ExpoConfig } from "expo/config";

/**
 * Display strings match Quote Shield AI in src/config/vertical.config.ts.
 * This file stays free of TypeScript imports so Expo can load it in Node.
 */
const displayName = "Quote Shield AI";
const background = "#020617";
const cameraPermission = "Quote Shield AI uses the camera to photograph a contractor quote.";
const photosPermission = "Quote Shield AI opens your photo library so you can choose a contractor quote.";

const config: ExpoConfig = {
  name: displayName,
  slug: "quote-shield-ai",
  scheme: "quote-shield-ai",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  backgroundColor: background,
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.future.quote.shield.ai",
    infoPlist: {
      NSCameraUsageDescription: cameraPermission,
      NSPhotoLibraryUsageDescription: photosPermission,
    },
  },
  android: {
    package: "com.future.quote.shield.ai",
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: background,
    },
  },
  web: {
    favicon: "./assets/icon.png",
    bundler: "metro",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: background,
        image: "./assets/icon.png",
        resizeMode: "contain",
        imageWidth: 200,
      },
    ],
    [
      "expo-image-picker",
      {
        cameraPermission,
        photosPermission,
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
    revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "",
  },
};

export default config;
