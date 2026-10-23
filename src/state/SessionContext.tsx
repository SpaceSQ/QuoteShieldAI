import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LocalFallbackReason } from "../lib/localAuditClient";
import type { TradeId } from "../types/audit";
import type { ClientAudit } from "../types/audit";
import { supabase } from "../lib/supabase";

export type SessionMode = "booting" | "local" | "supabase";
export type ReportKind = "cloud" | "local" | "sample" | "demo";

export interface PresentedReport {
  audit: ClientAudit;
  kind: ReportKind;
  localReason: LocalFallbackReason | null;
  sampleCaseId: string | null;
  unlocked: boolean;
}

export interface AuditRun {
  demo: boolean;
  zipCode: string;
  tradeId: TradeId;
  mimeType?: string;
  base64?: string;
  fileName?: string;
  quizAnswers: Record<string, string>;
}

interface SessionValue {
  mode: SessionMode;
  userId: string | null;
  answers: Record<string, string>;
  zipCode: string;
  quoteName: string | null;
  audit: ClientAudit | null;
  unlocked: boolean;
  reportKind: ReportKind | null;
  localReason: LocalFallbackReason | null;
  sampleCaseId: string | null;
  /** Paid cloud audits left today. Null until this device has seen a quota response. */
  cloudRemaining: number | null;
  isPro: boolean;
  setAnswer: (questionId: string, optionId: string) => void;
  setZipCode: (zip: string) => void;
  setQuoteName: (name: string | null) => void;
  beginRun: (run: AuditRun) => void;
  readRun: () => AuditRun | null;
  setAuditResult: (audit: ClientAudit) => void;
  setUnlocked: (value: boolean) => void;
  presentReport: (report: PresentedReport) => void;
  noteCloudQuota: (input: { remaining?: number | null; isPro?: boolean }) => void;
  resetFunnel: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SessionMode>(supabase ? "booting" : "local");
  const [userId, setUserId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [zipCode, setZipCode] = useState("");
  const [quoteName, setQuoteName] = useState<string | null>(null);
  const [audit, setAudit] = useState<ClientAudit | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [reportKind, setReportKind] = useState<ReportKind | null>(null);
  const [localReason, setLocalReason] = useState<LocalFallbackReason | null>(null);
  const [sampleCaseId, setSampleCaseId] = useState<string | null>(null);
  const [cloudRemaining, setCloudRemaining] = useState<number | null>(null);
  const [isPro, setIsPro] = useState(false);
  const runRef = useRef<AuditRun | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      try {
        const existing = await supabase.auth.getSession();
        let user = existing.data.session?.user ?? null;
        if (!user) {
          const signed = await supabase.auth.signInAnonymously();
          if (signed.error) throw signed.error;
          user = signed.data.user;
        }
        if (!cancelled) {
          setUserId(user?.id ?? null);
          setMode(user ? "supabase" : "local");
        }
      } catch {
        if (!cancelled) setMode("local");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      mode,
      userId,
      answers,
      zipCode,
      quoteName,
      audit,
      unlocked,
      reportKind,
      localReason,
      sampleCaseId,
      cloudRemaining,
      isPro,
      setAnswer: (questionId, optionId) => {
        setAnswers((current) => ({ ...current, [questionId]: optionId }));
      },
      setZipCode,
      setQuoteName,
      beginRun: (run) => {
        runRef.current = run;
        setAnswers((current) => ({ ...current, trade: run.tradeId }));
        setZipCode(run.zipCode);
        setQuoteName(run.fileName ?? null);
        setAudit(null);
        setUnlocked(false);
        setReportKind(null);
        setLocalReason(null);
        setSampleCaseId(null);
      },
      readRun: () => runRef.current,
      setAuditResult: setAudit,
      setUnlocked,
      presentReport: (report) => {
        setAudit(report.audit);
        setUnlocked(report.unlocked);
        setReportKind(report.kind);
        setLocalReason(report.localReason);
        setSampleCaseId(report.sampleCaseId);
      },
      noteCloudQuota: (input) => {
        if (typeof input.isPro === "boolean") setIsPro(input.isPro);
        if (typeof input.remaining === "number") setCloudRemaining(input.remaining);
      },
      resetFunnel: () => {
        runRef.current = null;
        setAudit(null);
        setUnlocked(false);
        setQuoteName(null);
        setReportKind(null);
        setLocalReason(null);
        setSampleCaseId(null);
      },
    }),
    [mode, userId, answers, zipCode, quoteName, audit, unlocked, reportKind, localReason, sampleCaseId, cloudRemaining, isPro],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider is missing");
  return value;
}
