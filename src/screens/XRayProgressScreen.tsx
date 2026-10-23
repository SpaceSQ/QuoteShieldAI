import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { activeVertical } from "../config/vertical.config";
import { Logo } from "../components/Logo";
import { requestQuoteAudit, AuditApiError } from "../lib/auditApi";
import { buildLocalClientAudit, localFallbackReason, type LocalFallbackReason } from "../lib/localAuditClient";
import { tapLight } from "../lib/haptics";
import { isSupabaseConfigured } from "../lib/supabase";
import { useSession } from "../state/SessionContext";
import type { ClientAudit } from "../types/audit";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Outcome = { kind: "remote"; audit: ClientAudit } | { kind: "local"; reason: LocalFallbackReason };

export function XRayProgressScreen() {
  const router = useRouter();
  const session = useSession();
  const stages = activeVertical.xrayStages;
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const run = session.readRun();
    if (!run) {
      router.replace("/scan");
      return;
    }
    const activeRun = run;
    let cancelled = false;
    const timers = stages.map((_, index) =>
      setTimeout(() => {
        if (cancelled) return;
        setStage(index);
        void tapLight();
      }, index * 1500),
    );
    (async () => {
      try {
        const [outcome] = await Promise.all([resolveOutcome(), delay(6000)]);
        if (cancelled) return;
        if (outcome.kind === "local") {
          const audit = buildLocalClientAudit({
            zipCode: activeRun.zipCode,
            tradeCategory: activeRun.tradeId,
            userId: session.userId,
          });
          if (outcome.reason === "quota") session.noteCloudQuota({ remaining: 0, isPro: true });
          session.presentReport({
            audit,
            kind: "local",
            localReason: outcome.reason,
            sampleCaseId: null,
            unlocked: outcome.reason === "quota",
          });
          router.replace("/audit");
          return;
        }
        session.presentReport({
          audit: outcome.audit,
          kind: outcome.audit.demo ? "demo" : "cloud",
          localReason: null,
          sampleCaseId: null,
          unlocked: !outcome.audit.demo && Boolean(outcome.audit.is_unlocked || outcome.audit.negotiation_script_email),
        });
        router.replace("/audit");
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof AuditApiError || error instanceof Error ? error.message : "Try the demo quote.";
        Alert.alert("Audit stopped", message);
        router.back();
      }
    })();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };

    async function resolveOutcome(): Promise<Outcome> {
      const body = {
        demo: activeRun.demo,
        zipCode: activeRun.zipCode,
        tradeCategory: activeRun.tradeId,
        imageBase64: activeRun.base64,
        mimeType: activeRun.mimeType,
        quizAnswers: activeRun.quizAnswers,
      };
      if (activeRun.demo) return { kind: "remote", audit: await requestQuoteAudit(body) };
      if (session.isPro && session.cloudRemaining === 0) return { kind: "local", reason: "quota" };
      if (!isSupabaseConfigured) return { kind: "local", reason: "unpaid" };
      try {
        return { kind: "remote", audit: await requestQuoteAudit(body) };
      } catch (error) {
        if (error instanceof AuditApiError) {
          const reason = localFallbackReason(error, session.isPro);
          if (reason) {
            if (reason === "unpaid" && /pro_audit|entitlement/i.test(error.message)) {
              session.noteCloudQuota({ isPro: false });
            }
            return { kind: "local", reason };
          }
        }
        throw error;
      }
    }
    // The run is captured once from the session ref when this screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = Math.round(((stage + 1) / stages.length) * 100);

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-slate-950 px-8">
      <Logo size={96} showWordmark={false} />
      <Text className="mt-6 text-center text-xl font-extrabold text-white">{activeVertical.displayName}</Text>
      <Text className="mt-6 min-h-[64px] text-center text-lg font-semibold text-amber-300">{stages[stage]}</Text>
      <View className="mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <View className="h-full rounded-full bg-amber-400" style={{ width: `${progress}%` }} />
      </View>
      <Text className="mt-3 text-xs uppercase tracking-wider text-slate-500">About 6 seconds</Text>
    </SafeAreaView>
  );
}
