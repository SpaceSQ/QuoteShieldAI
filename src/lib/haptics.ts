import * as Haptics from "expo-haptics";

async function safe(run: () => Promise<void>) {
  try {
    await run();
  } catch {
    // Web and some simulators do not expose haptics.
  }
}

export function tapLight() {
  return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function tapMedium() {
  return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export function tapHeavy() {
  return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
}

export function warnHaptic() {
  return safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

export function successHaptic() {
  return safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function tap(weight: "light" | "medium" | "heavy" = "medium") {
  if (weight === "light") return tapLight();
  if (weight === "heavy") return tapHeavy();
  return tapMedium();
}

export const warn = warnHaptic;
export const succeed = successHaptic;

