import { useEffect, useState, type ReactNode } from "react";
import { Alert, Pressable, ScrollView, Share, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { Mail, MessageSquare, ShieldAlert } from "lucide-react-native";
import { activeVertical } from "../config/vertical.config";
import { BlurLock } from "../components/BlurLock";
import { Disclaimer } from "../components/Disclaimer";
import { EvidenceBadge } from "../components/EvidenceBadge";
import { PaywallDrawer } from "../components/PaywallDrawer";
import { unlockAudit } from "../lib/auditApi";
import { evidenceForPriceBenchmark, evidenceLevelsIn, type EvidenceLevel } from "../lib/evidenceLevel";
import { formatUsd, riskLabel, stripForClient } from "../engine/auditEngine";
import { successHaptic, tapHeavy, tapLight, tapMedium, warnHaptic } from "../lib/haptics";
import { revenueCatIosKey } from "../lib/env";
import type { PlanId } from "../lib/purchaseTypes";
import { configurePurchases, purchasePlan, restorePlan } from "../lib/purchases";
import { isSupabaseConfigured } from "../lib/supabase";
import { type GoldenDemoCase, goldenDemoCatalog } from "../knowledge/knowledgeAdapter";
import { useSession } from "../state/SessionContext";
import type { ClientAudit } from "../types/audit";

export const UNPAID_LOCAL_BANNER =
  "This is a local benchmark, not the cloud line-item read. The local fair band can differ from a cloud one-shot read.";

export const QUOTA_LOCAL_BANNER =
  "Today's 3 cloud audits are used. This result is the local benchmark. The local fair band can differ from a cloud one-shot read. Cloud audits reset tomorrow (next UTC day).";

const SAMPLE_BANNER = "Sample report. This is a Quote Shield AI example, not your own quote. No photo was uploaded and no model was called.";

export function HybridAuditScreen() {
  const router = useRouter();
  const session = useSession();
  const audit = session.audit;
  const [selected, setSelected] = useState<PlanId>("project_pass");
  const [trial, setTrial] = useState(true);
  const [loading, setLoading] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(true);
  const colors = activeVertical.colors;
  const quiet = session.reportKind === "sample" || session.localReason === "quota";

  useEffect(() => {
    if (!quiet) void warnHaptic();
    void configurePurchases(revenueCatIosKey() || undefined, session.userId);
  }, [session.userId, quiet]);

  if (session.reportKind === "sample" && session.sampleCaseId) {
    return <SampleReport caseId={session.sampleCaseId} />;
  }

  if (!audit) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-950 px-8">
        <Text className="text-center text-base text-slate-300">No audit yet.</Text>
        <Pressable onPress={() => router.replace("/scan")} className="mt-4">
          <Text className="font-bold text-amber-400">Back to the scanner</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const view = session.unlocked ? { ...audit, is_unlocked: true as const } : stripForClient(audit);
  const highRisk = view.risk_score >= 65;
  const blueprintId = audit.full_audit_json?.benchmark_id;
  const showPaywall = !view.is_unlocked && paywallOpen;

  async function copyText(value: string | undefined, label: string) {
    if (!value) return;
    void tapMedium();
    await Clipboard.setStringAsync(value);
    Alert.alert("Copied", `${label} is on your clipboard.`);
  }

  async function shareText(value: string | undefined) {
    if (!value) return;
    void tapMedium();
    await Share.share({ message: value, title: "Counter-offer" });
  }

  async function reveal(next: ClientAudit | null) {
    if (next) session.setAuditResult(next);
    session.setUnlocked(true);
    await successHaptic();
  }

  async function onUnlock() {
    if (!audit) return;
    void tapHeavy();
    setLoading(true);
    try {
      const mode = await configurePurchases(revenueCatIosKey() || undefined, session.userId);
      if (mode === "live") {
        const result = await purchasePlan(selected);
        if (result.status === "cancelled") return;
        if (result.status === "purchased") session.noteCloudQuota({ isPro: true });
        const localReport = session.reportKind === "local";
        if (result.status !== "purchased" && !audit.demo && !localReport) {
          Alert.alert("Purchase didn't finish", "The App Store did not confirm the pass. The demo audit can still be revealed from Try Demo Quote.");
          return;
        }
        if (localReport && result.status !== "purchased") {
          Alert.alert("Purchase didn't finish", "The App Store did not confirm the pass.");
          return;
        }
      }
      if (audit.demo || session.reportKind === "local" || !isSupabaseConfigured) {
        await reveal(null);
        return;
      }
      const full = await unlockAudit({
        auditId: audit.id,
        devUnlock: mode !== "live",
        revenueCatAppUserId: session.userId ?? undefined,
      });
      await reveal(full);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Try again.";
      if (audit.demo || session.reportKind === "local") {
        await reveal(null);
        return;
      }
      Alert.alert("Unlock failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function onRestore() {
    void tapLight();
    setLoading(true);
    try {
      const mode = await configurePurchases(revenueCatIosKey() || undefined, session.userId);
      if (mode !== "live") {
        Alert.alert("No Active Pass", "No previous purchases found on this Apple ID.");
        return;
      }
      const restored = await restorePlan();
      if (!restored.active || !audit) {
        Alert.alert("No Active Pass", "No previous purchases found on this Apple ID.");
        return;
      }
      session.noteCloudQuota({ isPro: true });
      if (audit.demo || session.reportKind === "local" || !isSupabaseConfigured) {
        await reveal(null);
        return;
      }
      const full = await unlockAudit({
        auditId: audit.id,
        devUnlock: false,
        revenueCatAppUserId: session.userId ?? undefined,
      });
      await reveal(full);
      Alert.alert("Restored", "Your Pro pass is active.");
    } finally {
      setLoading(false);
    }
  }

  function choosePlan(plan: PlanId) {
    void tapMedium();
    setSelected(plan);
    if (plan === "weekly") setTrial(true);
  }

  function openPaywall() {
    void tapMedium();
    setPaywallOpen(true);
  }

  const contractorLabel =
    session.reportKind === "local" && view.contractor_total_usd <= 0 ? "Not read on this device" : formatUsd(view.contractor_total_usd);

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: showPaywall ? 380 : 48 }}>
        <View className="mb-4 mt-2 flex-row items-center justify-between">
          <Pressable onPress={() => router.replace("/scan")}>
            <Text className="text-sm font-semibold text-slate-400">New quote</Text>
          </Pressable>
          <Text className="text-xs font-bold text-slate-500">{activeVertical.displayName}</Text>
        </View>

        {session.reportKind === "local" && session.localReason === "unpaid" ? (
          <View className="mb-4 rounded-2xl border border-amber-400/50 bg-amber-500/10 p-4">
            <Text className="text-sm font-bold text-amber-200">Local benchmark</Text>
            <Text className="mt-2 text-sm leading-5 text-slate-200">{UNPAID_LOCAL_BANNER}</Text>
            {!view.is_unlocked ? (
              <Pressable onPress={openPaywall} className="mt-3 self-start rounded-xl bg-amber-400 px-4 py-2">
                <Text className="text-sm font-black text-slate-950">Upgrade</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {session.reportKind === "local" && session.localReason === "quota" ? (
          <View className="mb-4 rounded-2xl border border-sky-400/40 bg-sky-500/10 p-4">
            <Text className="text-sm font-bold text-sky-200">Local benchmark</Text>
            <Text className="mt-2 text-sm leading-5 text-slate-200">{QUOTA_LOCAL_BANNER}</Text>
          </View>
        ) : null}

        <View className={`rounded-2xl border p-4 ${highRisk ? "border-red-500/50 bg-red-950/60" : "border-amber-500/40 bg-slate-900"}`}>
          <View className="mb-2 flex-row items-center">
            <ShieldAlert size={20} color={highRisk ? colors.danger : colors.accent} />
            <Text className={`ml-2 text-xs font-bold uppercase tracking-wider ${highRisk ? "text-red-400" : "text-amber-300"}`}>
              ZIP {view.zip_code} · {riskLabel(view.risk_score)} ({view.risk_score}/100)
            </Text>
          </View>
          <Text className="text-3xl font-extrabold text-white">
            {formatUsd(view.savings_low_usd)} – {formatUsd(view.savings_high_usd)}
          </Text>
          <Text className="mt-1 text-sm text-slate-300">estimated savings to negotiate before you sign</Text>
          <Text className="mt-1 text-xs text-slate-400">Flagged line items: {formatUsd(view.estimated_savings_usd)}</Text>

          <View className="mt-4 flex-row justify-between border-t border-white/10 pt-3">
            <View className="flex-1 pr-3">
              <Text className="text-xs text-slate-400">Contractor quoted</Text>
              <Text className="text-lg font-bold text-white">{contractorLabel}</Text>
            </View>
            <View className="flex-1 items-end">
              <Text className="text-xs text-slate-400">Local fair benchmark</Text>
              {view.is_unlocked && view.fair_price_low_usd != null && view.fair_price_high_usd != null ? (
                <Text className="text-right text-lg font-bold text-emerald-400">
                  {formatUsd(view.fair_price_low_usd)} – {formatUsd(view.fair_price_high_usd)}
                </Text>
              ) : (
                <Text className="text-lg font-bold text-slate-500">$••,••• – $••,•••</Text>
              )}
            </View>
          </View>
          <Text className="mt-3 text-sm font-bold text-red-300">{view.red_flag_count} red flags</Text>
        </View>

        <Text className="mb-3 mt-5 text-base font-bold text-slate-200">Detected quote red flags ({view.red_flag_count})</Text>
        {view.red_flags.length === 0 ? (
          <Text className="mb-3 text-sm leading-5 text-slate-400">No red-flag lines were priced on this result.</Text>
        ) : null}
        {session.unlocked
          ? audit.red_flags.map((flag, index) => (
              <View key={`${flag.title}-${index}`} className="mb-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
                <View className="flex-row items-start justify-between">
                  <Text className="flex-1 pr-2 text-sm font-bold text-red-400">
                    #{index + 1}: {flag.title}
                  </Text>
                  <Text className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-300">{flag.severity}</Text>
                </View>
                {flag.fair_benchmark_usd != null ? (
                  <View className="mt-3 gap-2">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="text-xs text-slate-300">
                        Quoted {formatUsd(flag.quoted_amount_usd ?? 0)} · Fair {formatUsd(flag.fair_benchmark_usd)} · Overcharge{" "}
                        {formatUsd(flag.potential_overcharge_usd ?? 0)}
                      </Text>
                      <EvidenceRow
                        levels={evidenceForPriceBenchmark({
                          zipCode: audit.zip_code,
                          tradeCategory: audit.trade_category,
                          blueprintId,
                          label: flag.title,
                          note: flag.insider_explanation,
                          role: "trap",
                        })}
                      />
                    </View>
                    <Text className="text-xs leading-5 text-slate-300">{flag.insider_explanation}</Text>
                    <Text className="text-xs leading-5 text-emerald-300">Ask: {flag.what_to_ask}</Text>
                  </View>
                ) : (
                  <Pressable onPress={onUnlock}>
                    <BlurLock />
                  </Pressable>
                )}
              </View>
            ))
          : view.red_flags.map((flag, index) => (
              <View key={`${flag.title}-${index}`} className="mb-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
                <View className="flex-row items-start justify-between">
                  <Text className="flex-1 pr-2 text-sm font-bold text-red-400">
                    #{index + 1}: {flag.title}
                  </Text>
                  <Text className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-300">{flag.severity}</Text>
                </View>
                <Pressable onPress={onUnlock}>
                  <BlurLock />
                </Pressable>
              </View>
            ))}

        {view.is_unlocked ? (
          <View className="mt-2 gap-4">
            <View className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <Text className="mb-2 text-sm font-bold text-white">Fair price table</Text>
              {view.band_note ? <Text className="mb-3 text-xs leading-5 text-slate-400">{view.band_note}</Text> : null}
              {(view.line_items_breakdown ?? []).map((line) => (
                <View key={line.description} className="mb-3 border-b border-slate-800 pb-3">
                  <Text className="text-sm font-semibold text-white">{line.description}</Text>
                  <View className="mt-1 flex-row flex-wrap items-center gap-2">
                    <Text className="text-xs text-slate-300">
                      Quoted {formatUsd(line.quoted_usd)}
                      {line.fair_low_usd != null && line.fair_high_usd != null
                        ? ` · Fair ${formatUsd(line.fair_low_usd)} – ${formatUsd(line.fair_high_usd)}`
                        : " · Outside the core band"}
                    </Text>
                    {line.fair_low_usd != null && line.fair_high_usd != null ? (
                      <EvidenceRow
                        levels={evidenceForPriceBenchmark({
                          zipCode: view.zip_code,
                          tradeCategory: view.trade_category,
                          blueprintId,
                          label: line.description,
                          note: line.note,
                          role: "line",
                        })}
                      />
                    ) : null}
                  </View>
                  <Text className="mt-1 text-xs text-slate-500">{line.note}</Text>
                </View>
              ))}
            </View>

            <View className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <Text className="mb-2 text-sm font-bold text-white">Missing clauses</Text>
              {(view.missing_protections ?? []).map((clause) => (
                <Text key={clause} className="mb-2 text-sm leading-5 text-slate-300">
                  • {clause}
                </Text>
              ))}
            </View>

            <ScriptCard
              icon={<Mail size={18} color={colors.success} />}
              title="Counter-offer email"
              body={view.negotiation_script_email}
              onCopy={() => copyText(view.negotiation_script_email, "Email")}
              onShare={() => shareText(view.negotiation_script_email)}
            />
            <ScriptCard
              icon={<MessageSquare size={18} color={colors.success} />}
              title="Counter-offer text"
              body={view.negotiation_script_sms}
              onCopy={() => copyText(view.negotiation_script_sms, "Text")}
              onShare={() => shareText(view.negotiation_script_sms)}
            />
          </View>
        ) : null}

        <View className="mt-6">
          <Disclaimer />
          <Text className="mt-2 text-center text-[11px] text-slate-600">100% homeowner-neutral. Zero contractor kickbacks.</Text>
        </View>
      </ScrollView>

      {showPaywall ? (
        <PaywallDrawer
          savingsLabel={`${formatUsd(view.savings_low_usd)} – ${formatUsd(view.savings_high_usd)}`}
          selected={selected}
          trial={trial}
          loading={loading}
          onSelect={choosePlan}
          onTrial={(value) => {
            void tapLight();
            setTrial(value);
            if (value) setSelected("weekly");
          }}
          onUnlock={onUnlock}
          onRestore={onRestore}
        />
      ) : null}
    </SafeAreaView>
  );
}

function SampleReport({ caseId }: { caseId: string }) {
  const router = useRouter();
  const sample = goldenDemoCatalog.cases.find((item) => item.case_id === caseId);
  const colors = activeVertical.colors;

  async function copyScript() {
    if (!sample) return;
    void tapMedium();
    await Clipboard.setStringAsync(sample.winning_counter_offer_script);
    Alert.alert("Copied", "Counter-offer script is on your clipboard.");
  }

  async function shareScript() {
    if (!sample) return;
    void tapMedium();
    await Share.share({ message: sample.winning_counter_offer_script, title: "Sample counter-offer" });
  }

  if (!sample) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-950 px-8">
        <Text className="text-center text-base text-slate-300">That sample report is unavailable.</Text>
        <Pressable onPress={() => router.replace("/scan")} className="mt-4">
          <Text className="font-bold text-amber-400">Back to the scanner</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const fairLow = sample.verified_fair_range_usd[0];
  const fairHigh = sample.verified_fair_range_usd[1];
  const traps = sample.line_by_line_xray.filter((line) => line.overcharge_usd > 0);

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 48 }}>
        <View className="mb-4 mt-2 flex-row items-center justify-between">
          <Pressable onPress={() => router.replace("/scan")}>
            <Text className="text-sm font-semibold text-slate-400">New quote</Text>
          </Pressable>
          <Text className="text-xs font-bold text-slate-500">{activeVertical.displayName}</Text>
        </View>

        <View className="mb-4 rounded-2xl border border-amber-400/50 bg-amber-500/10 p-4">
          <Text className="text-sm font-bold text-amber-200">Sample report</Text>
          <Text className="mt-2 text-sm leading-5 text-slate-200">{SAMPLE_BANNER}</Text>
        </View>

        <View className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <Text className="text-xs font-bold uppercase tracking-wider text-amber-300">Sample · {sample.location_zip}</Text>
          <Text className="mt-2 text-lg font-extrabold leading-6 text-white">{sample.display_badge}</Text>
          <Text className="mt-2 text-sm leading-5 text-slate-300">{sample.scenario_summary}</Text>
          <Text className="mt-3 text-xs text-slate-400">
            Sample risk {riskLabel(sample.risk_score)} ({sample.risk_score}/100)
          </Text>
          <View className="mt-4 flex-row justify-between border-t border-white/10 pt-3">
            <View className="flex-1 pr-3">
              <Text className="text-xs text-slate-400">Sample contractor total</Text>
              <Text className="text-lg font-bold text-white">{formatUsd(sample.contractor_quoted_total_usd)}</Text>
            </View>
            <View className="flex-1 items-end">
              <Text className="text-xs text-slate-400">Sample fair band</Text>
              <Text className="text-right text-lg font-bold text-emerald-400">
                {formatUsd(fairLow)} – {formatUsd(fairHigh)}
              </Text>
            </View>
          </View>
          <Text className="mt-3 text-sm text-slate-300">Sample savings {formatUsd(sample.verified_savings_achieved_usd)}</Text>
        </View>

        <Text className="mb-3 mt-5 text-base font-bold text-slate-200">Sample line x-ray</Text>
        {sample.line_by_line_xray.map((line) => (
          <LineXray key={line.item} line={line} />
        ))}

        <Text className="mb-3 mt-2 text-base font-bold text-slate-200">Sample traps</Text>
        {traps.map((line) => (
          <LineXray key={`trap-${line.item}`} line={line} />
        ))}

        <View className="mt-2">
          <ScriptCard
            icon={<Mail size={18} color={colors.success} />}
            title="Sample counter-offer script"
            body={sample.winning_counter_offer_script}
            onCopy={copyScript}
            onShare={shareScript}
          />
        </View>

        <View className="mt-6">
          <Disclaimer />
          <Text className="mt-2 text-center text-[11px] text-slate-600">100% homeowner-neutral. Zero contractor kickbacks.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LineXray({ line }: { line: GoldenDemoCase["line_by_line_xray"][number] }) {
  const levels = evidenceLevelsIn(line.evidence_badge);
  return (
    <View className="mb-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <Text className="text-sm font-semibold text-white">{line.item}</Text>
      <View className="mt-2 flex-row flex-wrap items-center gap-2">
        <Text className="text-xs leading-5 text-slate-300">
          Quoted {quotedLabel(line.quoted_usd)} · Wholesale {formatUsd(line.wholesale_bom_usd)} · Fair{" "}
          {formatUsd(line.fair_installed_equipment_usd)} · Overcharge {formatUsd(line.overcharge_usd)}
        </Text>
        <EvidenceRow levels={levels} />
      </View>
      {/\bpermit\b/i.test(line.item) ? (
        <View className="mt-2 flex-row flex-wrap items-center gap-2">
          <Text className="text-xs text-slate-300">Permit fee {formatUsd(line.fair_installed_equipment_usd)}</Text>
          <EvidenceRow levels={levels} />
        </View>
      ) : null}
    </View>
  );
}

function EvidenceRow({ levels }: { levels: EvidenceLevel[] }) {
  if (levels.length === 0) return null;
  return (
    <>
      {levels.map((level) => (
        <EvidenceBadge key={level} level={level} />
      ))}
    </>
  );
}

function quotedLabel(value: number | string): string {
  if (typeof value === "number") return Number.isFinite(value) ? formatUsd(value) : "";
  return value;
}

function ScriptCard({
  icon,
  title,
  body,
  onCopy,
  onShare,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  onCopy: () => void;
  onShare: () => void;
}) {
  return (
    <View className="rounded-2xl border border-emerald-500/40 bg-slate-900 p-4">
      <View className="mb-2 flex-row items-center">
        {icon}
        <Text className="ml-2 text-sm font-bold text-emerald-300">{title}</Text>
      </View>
      <Text className="rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-200">{body}</Text>
      <View className="mt-3 flex-row gap-2">
        <Pressable onPress={onCopy} className="rounded-lg bg-emerald-600 px-3 py-2">
          <Text className="text-xs font-bold text-white">Copy</Text>
        </Pressable>
        <Pressable onPress={onShare} className="rounded-lg bg-slate-800 px-3 py-2">
          <Text className="text-xs font-bold text-white">Share</Text>
        </Pressable>
      </View>
    </View>
  );
}
