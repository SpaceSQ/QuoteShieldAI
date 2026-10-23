import { ActivityIndicator, Pressable, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowRight, BadgeDollarSign } from "lucide-react-native";
import { activeVertical } from "../config/vertical.config";
import type { PlanId } from "../lib/purchaseTypes";

export function PaywallDrawer({
  savingsLabel,
  selected,
  trial,
  loading,
  onSelect,
  onTrial,
  onUnlock,
  onRestore,
}: {
  savingsLabel: string;
  selected: PlanId;
  trial: boolean;
  loading: boolean;
  onSelect: (plan: PlanId) => void;
  onTrial: (value: boolean) => void;
  onUnlock: () => void;
  onRestore: () => void;
}) {
  const router = useRouter();
  const paywall = activeVertical.paywall;
  const colors = activeVertical.colors;
  const weeklyPrice = trial ? paywall.weeklyTrialPrice : paywall.weeklyPrice;

  return (
    <View className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t-2 border-amber-500/50 bg-slate-900 px-5 pb-8 pt-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="mr-3 flex-1 flex-row items-center">
          <BadgeDollarSign size={20} color={colors.accent} />
          <Text className="ml-1.5 flex-1 text-base font-extrabold text-white">Unlock & save {savingsLabel}</Text>
        </View>
        <View className="flex-row items-center rounded-full bg-slate-800 px-2.5 py-1">
          <Text className="mr-2 text-xs text-slate-300">{paywall.trialToggleLabel}</Text>
          <Switch
            value={trial}
            onValueChange={onTrial}
            trackColor={{ false: "#334155", true: "#10B981" }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <View className="mb-4 flex-row gap-3">
        <Pressable
          onPress={() => onSelect("project_pass")}
          className={`flex-1 rounded-2xl border-2 p-3 ${selected === "project_pass" ? "border-amber-400 bg-amber-500/10" : "border-slate-800 bg-slate-950"}`}
        >
          <Text className="self-start rounded-md bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold uppercase text-slate-950">
            {paywall.projectPassBadge}
          </Text>
          <Text className="mt-1 text-sm font-bold text-white">{paywall.projectPassName}</Text>
          <Text className="mt-0.5 text-xl font-extrabold text-amber-400">{paywall.projectPassPrice}</Text>
          <Text className="mt-1 text-[11px] text-slate-400">{paywall.projectPassDetail}</Text>
        </Pressable>

        <Pressable
          onPress={() => onSelect("weekly")}
          className={`flex-1 rounded-2xl border-2 p-3 ${selected === "weekly" ? "border-emerald-400 bg-emerald-500/10" : "border-slate-800 bg-slate-950"}`}
        >
          <Text className="self-start rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-400">
            {paywall.weeklyBadge}
          </Text>
          <Text className="mt-1 text-sm font-bold text-white">{paywall.weeklyName}</Text>
          <Text className="mt-0.5 text-xl font-extrabold text-white">{weeklyPrice}</Text>
          <Text className="mt-1 text-[11px] text-slate-400">{trial ? paywall.weeklyTrialDetail : paywall.weeklyNoTrialDetail}</Text>
        </Pressable>
      </View>

      <Pressable
        disabled={loading}
        onPress={onUnlock}
        className="flex-row items-center justify-center rounded-2xl bg-amber-400 px-3 py-4"
      >
        {loading ? (
          <ActivityIndicator color={colors.accentInk} />
        ) : (
          <>
            <Text className="mr-2 flex-1 text-center text-base font-black text-slate-950">
              {selected === "weekly" && trial ? paywall.ctaTrial : paywall.ctaUnlock}
            </Text>
            <ArrowRight size={20} color={colors.accentInk} strokeWidth={3} />
          </>
        )}
      </Pressable>

      <Text className="mt-3 text-center text-[10px] leading-4 text-slate-500">{paywall.subscriptionFinePrint}</Text>

      <View className="mt-3 flex-row justify-center gap-6">
        <Pressable onPress={onRestore}>
          <Text className="text-xs text-slate-500 underline">{paywall.restore}</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/terms")}>
          <Text className="text-xs text-slate-500 underline">{paywall.terms}</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/privacy")}>
          <Text className="text-xs text-slate-500 underline">{paywall.privacy}</Text>
        </Pressable>
      </View>
    </View>
  );
}
