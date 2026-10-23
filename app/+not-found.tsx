import { Text, View } from "react-native";
import { Link } from "expo-router";
import { activeVertical } from "../src/config/vertical.config";

export default function NotFound() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-950 px-8">
      <Text className="text-lg font-bold text-white">{activeVertical.displayName}</Text>
      <Text className="mt-2 text-center text-slate-400">That screen is not in the funnel.</Text>
      <Link href="/" className="mt-4 text-amber-400">
        Start over
      </Link>
    </View>
  );
}
