import { ScrollView, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { activeVertical } from "../config/vertical.config";
import { Disclaimer } from "../components/Disclaimer";

export function LegalScreen({ kind }: { kind: "terms" | "privacy" }) {
  const router = useRouter();
  const legal = activeVertical.legal;
  const title = kind === "terms" ? legal.termsTitle : legal.privacyTitle;
  const body = kind === "terms" ? legal.termsBody : legal.privacyBody;

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
        <Pressable onPress={() => router.back()} className="mb-4 mt-2 self-start">
          <Text className="text-sm font-semibold text-slate-400">Back</Text>
        </Pressable>
        <Text className="text-xs font-bold uppercase tracking-wider text-amber-400">{activeVertical.displayName}</Text>
        <Text className="mt-1 text-2xl font-extrabold text-white">{title}</Text>
        {body.split("\n\n").map((paragraph) => (
          <Text key={paragraph.slice(0, 40)} className="mt-4 text-sm leading-6 text-slate-300">
            {paragraph}
          </Text>
        ))}
        <ViewSpacer />
        <Disclaimer />
      </ScrollView>
    </SafeAreaView>
  );
}

function ViewSpacer() {
  return <Text className="h-6"> </Text>;
}
