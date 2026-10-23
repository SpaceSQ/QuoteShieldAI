import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "../src/state/SessionContext";
import { activeVertical } from "../src/config/vertical.config";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: activeVertical.colors.background },
            animation: "slide_from_right",
          }}
        />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
