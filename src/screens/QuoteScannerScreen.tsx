import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Camera, FileText, Image as ImageIcon, Sparkles } from "lucide-react-native";
import { GoldenDemoDrawer } from "../components/GoldenDemoDrawer";
import { activeVertical } from "../config/vertical.config";
import { uriToBase64 } from "../lib/files";
import { tapMedium } from "../lib/haptics";
import { buildSampleClientAudit } from "../lib/sampleReport";
import { isSupabaseConfigured } from "../lib/supabase";
import { useSession } from "../state/SessionContext";
import type { TradeId } from "../types/audit";

export function QuoteScannerScreen() {
  const router = useRouter();
  const session = useSession();
  const [zipError, setZipError] = useState("");
  const [busy, setBusy] = useState(false);
  const colors = activeVertical.colors;
  const tradeId = (session.answers.trade || "hvac") as TradeId;
  const trade = activeVertical.trades.find((item) => item.id === tradeId);
  const zipReady = /^\d{5}$/.test(session.zipCode);

  async function rememberFile(name: string, mimeType: string, base64: string) {
    session.setQuoteName(name);
    session.beginRun({
      demo: false,
      zipCode: session.zipCode,
      tradeId,
      mimeType,
      base64,
      fileName: name,
      quizAnswers: session.answers,
    });
  }

  async function pickImage(source: "camera" | "library") {
    void tapMedium();
    setBusy(true);
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", source === "camera" ? activeVertical.permissions.camera : activeVertical.permissions.photos);
        return;
      }
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6, base64: true })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6, base64: true });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const base64 = asset.base64 || (await uriToBase64(asset.uri));
      await rememberFile(asset.fileName || "quote.jpg", asset.mimeType || "image/jpeg", base64);
    } catch {
      Alert.alert("Could not open that photo", "Try the library, a PDF, or Try Demo Quote.");
    } finally {
      setBusy(false);
    }
  }

  async function pickPdf() {
    void tapMedium();
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const base64 = await uriToBase64(asset.uri);
      await rememberFile(asset.name || "quote.pdf", asset.mimeType || "application/pdf", base64);
    } catch {
      Alert.alert("Could not read that file", "A photo of the quote works best.");
    } finally {
      setBusy(false);
    }
  }

  function runRealAudit() {
    if (!zipReady) {
      setZipError("Enter a 5-digit US ZIP code.");
      return;
    }
    const run = session.readRun();
    if (!run || run.demo || !run.base64) {
      Alert.alert("Add the quote", "Take a photo, choose one from your library, or pick a PDF.");
      return;
    }
    session.beginRun({ ...run, zipCode: session.zipCode, tradeId, quizAnswers: session.answers, demo: false });
    router.push("/xray");
  }

  function openSample(caseId: string) {
    try {
      const audit = buildSampleClientAudit(caseId, session.userId);
      session.presentReport({
        audit,
        kind: "sample",
        localReason: null,
        sampleCaseId: caseId,
        unlocked: true,
      });
      router.push("/audit");
    } catch {
      Alert.alert("Sample unavailable", "Quote Shield AI could not open that sample report.");
    }
  }

  function runDemo() {
    void tapMedium();
    session.beginRun({
      demo: true,
      zipCode: "90210",
      tradeId: "hvac",
      fileName: "Los Angeles HVAC demo",
      quizAnswers: { ...session.answers, trade: "hvac" },
    });
    router.push("/xray");
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 48 }}>
        <Pressable onPress={() => router.back()} className="mb-3 mt-2 self-start">
          <Text className="text-sm font-semibold text-slate-400">Back</Text>
        </Pressable>
        <GoldenDemoDrawer zipCode={session.zipCode} tradeId={tradeId} onOpenCase={openSample} />
        <Text className="mt-6 text-xs font-bold uppercase tracking-wider text-amber-400">{trade?.label ?? "Quote"}</Text>
        <Text className="mt-1 text-2xl font-extrabold text-white">Photograph the quote</Text>
        <Text className="mt-2 text-sm leading-5 text-slate-400">
          Add a 5-digit US ZIP, then a photo or PDF. App Review can skip the photo.
        </Text>

        {!isSupabaseConfigured ? (
          <Text className="mt-4 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400">
            Photo audits on this device use a local benchmark until Supabase is configured. Try Demo Quote still runs the full funnel.
          </Text>
        ) : null}

        <Text className="mb-2 mt-6 text-xs font-bold uppercase text-slate-400">US ZIP code</Text>
        <TextInput
          value={session.zipCode}
          onChangeText={(value) => {
            session.setZipCode(value.replace(/\D/g, "").slice(0, 5));
            setZipError("");
          }}
          keyboardType="number-pad"
          maxLength={5}
          placeholder="90210"
          placeholderTextColor="#64748B"
          className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 text-2xl font-bold tracking-widest text-white"
        />
        {zipError ? <Text className="mt-2 text-sm text-red-400">{zipError}</Text> : null}

        <View className="mt-5 gap-3">
          <Pressable disabled={busy} onPress={() => pickImage("camera")} className="flex-row items-center rounded-2xl bg-slate-900 px-4 py-4">
            <Camera color={colors.accent} size={22} />
            <Text className="ml-3 text-base font-semibold text-white">Take a photo</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={() => pickImage("library")} className="flex-row items-center rounded-2xl bg-slate-900 px-4 py-4">
            <ImageIcon color={colors.accent} size={22} />
            <Text className="ml-3 text-base font-semibold text-white">Choose from library</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={pickPdf} className="flex-row items-center rounded-2xl bg-slate-900 px-4 py-4">
            <FileText color={colors.accent} size={22} />
            <Text className="ml-3 text-base font-semibold text-white">Upload a PDF</Text>
          </Pressable>
        </View>
        {session.quoteName ? <Text className="mt-3 text-sm text-slate-400">Attached: {session.quoteName}</Text> : null}

        <Pressable
          onPress={runRealAudit}
          className={`mt-6 items-center rounded-2xl py-4 ${zipReady && session.quoteName ? "bg-white" : "bg-slate-800"}`}
        >
          <Text className={`text-base font-black ${zipReady && session.quoteName ? "text-slate-950" : "text-slate-500"}`}>
            Run audit
          </Text>
        </Pressable>

        <Pressable onPress={runDemo} className="mt-4 rounded-2xl border border-amber-400/60 bg-amber-500/10 px-4 py-4">
          <View className="flex-row items-center">
            <Sparkles color={colors.accent} size={20} />
            <Text className="ml-2 text-base font-extrabold text-amber-300">Try Demo Quote</Text>
          </View>
          <Text className="mt-2 text-sm leading-5 text-slate-300">
            Los Angeles 90210 · HVAC · $16,800 3-ton heat pump. No contractor photo and no model call.
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
