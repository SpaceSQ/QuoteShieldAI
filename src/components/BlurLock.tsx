import { StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Lock } from "lucide-react-native";
import { activeVertical } from "../config/vertical.config";

/** Visual lock. The children are placeholders, never insider dollar amounts. */
export function BlurLock({ label = "Unlock" }: { label?: string }) {
  return (
    <View className="mt-2 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <View className="gap-2 p-3 pr-24">
        <Text className="text-xs text-slate-500">Wholesale benchmark  $•,•••</Text>
        <Text className="text-xs text-slate-600">Counter-offer  Ask them to reprice the ██████ line…</Text>
      </View>
      <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
      <View className="absolute bottom-2 right-2 flex-row items-center rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-1.5">
        <Lock size={14} color={activeVertical.colors.accent} />
        <Text className="ml-1.5 text-xs font-bold text-amber-400">{label}</Text>
      </View>
    </View>
  );
}
