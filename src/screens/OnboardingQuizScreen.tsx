import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { activeVertical } from "../config/vertical.config";
import { Disclaimer } from "../components/Disclaimer";
import { Logo } from "../components/Logo";
import { tapMedium } from "../lib/haptics";
import { useSession } from "../state/SessionContext";

export function OnboardingQuizScreen() {
  const router = useRouter();
  const { answers, setAnswer } = useSession();
  const [index, setIndex] = useState(0);
  const lock = useRef(false);
  const questions = activeVertical.onboarding;
  const question = questions[index];
  const colors = activeVertical.colors;

  function choose(optionId: string) {
    if (!question || lock.current) return;
    lock.current = true;
    void tapMedium();
    setAnswer(question.id, optionId);
    setTimeout(() => {
      lock.current = false;
      if (index < questions.length - 1) setIndex(index + 1);
      else router.push("/scan");
    }, 180);
  }

  if (!question) return null;

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
        {index === 0 ? (
          <View className="mb-6 mt-4 items-center">
            <Logo />
            <Text className="mt-2 px-4 text-center text-base text-slate-300">{activeVertical.tagline}</Text>
          </View>
        ) : (
          <Pressable onPress={() => setIndex(index - 1)} className="mb-4 mt-2 self-start">
            <Text className="text-sm font-semibold text-slate-400">Back</Text>
          </Pressable>
        )}

        <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-400">
          Question {index + 1} of {questions.length}
        </Text>
        <Text className="mb-5 text-2xl font-extrabold text-white">{question.prompt}</Text>

        <View className="gap-3">
          {question.options.map((option) => {
            const selected = answers[question.id] === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => choose(option.id)}
                className={`rounded-2xl border px-4 py-5 ${selected ? "border-amber-400 bg-amber-500/10" : "border-slate-800 bg-slate-900"}`}
              >
                <Text className="text-lg font-semibold" style={{ color: selected ? colors.accent : colors.text }}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="mt-8">
          <Disclaimer />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
