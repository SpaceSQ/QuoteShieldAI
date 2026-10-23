import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Flame } from "lucide-react-native";
import { tradeLabel } from "../config/vertical.config";
import { tapMedium } from "../lib/haptics";
import {
  type GoldenDemoCase,
  type KnowledgeTrade,
  goldenDemoCatalog,
  normalizeTradeKey,
  selectBestGoldenDemo,
  toAppTradeId,
} from "../knowledge/knowledgeAdapter";

const TRADE_ORDER: KnowledgeTrade[] = ["hvac", "electrical", "plumbing", "roofing", "smart_home"];

const DRAWER_TITLE = "15 real US quote traps (Irvine / DFW / NYC / Seattle / Phoenix / Orlando)";

export function GoldenDemoDrawer({
  zipCode,
  tradeId,
  onOpenCase,
}: {
  zipCode: string;
  tradeId: string;
  onOpenCase: (caseId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<KnowledgeTrade | "all">("all");
  const selection = useMemo(() => selectBestGoldenDemo(zipCode, tradeId), [zipCode, tradeId]);
  const groups = useMemo(() => {
    const trades = filter === "all" ? TRADE_ORDER : [filter];
    return trades
      .map((trade) => ({
        trade,
        cases: goldenDemoCatalog.cases.filter((item) => normalizeTradeKey(item.trade_category) === trade),
      }))
      .filter((group) => group.cases.length > 0);
  }, [filter]);

  return (
    <View className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-500/10">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          void tapMedium();
          setOpen((current) => !current);
        }}
        className="flex-row items-center px-4 py-4"
      >
        <Flame color="#F59E0B" size={18} />
        <Text className="ml-2 flex-1 text-sm font-extrabold leading-5 text-amber-200">{DRAWER_TITLE}</Text>
      </Pressable>

      {open ? (
        <View className="px-4 pb-4">
          <View className="mb-3 flex-row flex-wrap gap-2">
            <FilterChip label="All" selected={filter === "all"} onPress={() => setFilter("all")} />
            {TRADE_ORDER.map((trade) => (
              <FilterChip
                key={trade}
                label={tradeLabel(toAppTradeId(trade))}
                selected={filter === trade}
                onPress={() => setFilter(trade)}
              />
            ))}
          </View>
          {groups.map((group) => (
            <View key={group.trade} className="mb-3">
              <Text className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {tradeLabel(toAppTradeId(group.trade))}
              </Text>
              {group.cases.map((item) => (
                <CaseRow
                  key={item.case_id}
                  item={item}
                  matchLabel={matchLabel(selection.match, selection.case.case_id === item.case_id)}
                  onPress={() => onOpenCase(item.case_id)}
                />
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function matchLabel(match: "metro_and_trade" | "trade" | "global_default", selected: boolean): string | null {
  if (!selected || match === "global_default") return null;
  return match === "metro_and_trade" ? "Best match" : "Same trade";
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        void tapMedium();
        onPress();
      }}
      className={`rounded-full px-3 py-1.5 ${selected ? "bg-amber-400" : "bg-slate-900"}`}
    >
      <Text className={`text-xs font-bold ${selected ? "text-slate-950" : "text-slate-300"}`}>{label}</Text>
    </Pressable>
  );
}

function CaseRow({
  item,
  matchLabel: label,
  onPress,
}: {
  item: GoldenDemoCase;
  matchLabel: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.display_badge}
      onPress={() => {
        void tapMedium();
        onPress();
      }}
      className="mb-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-3"
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-bold leading-5 text-white">{item.display_badge}</Text>
        {label ? (
          <Text className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">{label}</Text>
        ) : null}
      </View>
      <Text className="mt-1 text-xs text-amber-200/80">{item.location_zip}</Text>
      <Text className="mt-1 text-xs leading-5 text-slate-400" numberOfLines={3}>
        {item.scenario_summary}
      </Text>
    </Pressable>
  );
}
