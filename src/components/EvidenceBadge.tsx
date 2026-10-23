import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { EVIDENCE_SCALE, type EvidenceLevel } from "../lib/evidenceLevel";
import { tapLight } from "../lib/haptics";

const TONE: Record<EvidenceLevel, { pill: string; text: string }> = {
  E1: { pill: "bg-emerald-500/20 border-emerald-400/50", text: "text-emerald-300" },
  E2: { pill: "bg-sky-500/20 border-sky-400/50", text: "text-sky-300" },
  E3: { pill: "bg-amber-500/20 border-amber-400/50", text: "text-amber-300" },
  E4: { pill: "bg-slate-700/80 border-slate-500/60", text: "text-slate-300" },
};

export function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  const [open, setOpen] = useState(false);
  const tone = TONE[level];
  if (!tone) return null;

  return (
    <View className="items-start">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${level}. ${EVIDENCE_SCALE}`}
        onPress={() => {
          void tapLight();
          setOpen((current) => !current);
        }}
        className={`rounded-full border px-2 py-0.5 ${tone.pill}`}
      >
        <Text className={`text-[10px] font-black ${tone.text}`}>{level}</Text>
      </Pressable>
      {open ? <Text className="mt-1 max-w-[240px] text-[10px] leading-4 text-slate-400">{EVIDENCE_SCALE}</Text> : null}
    </View>
  );
}
