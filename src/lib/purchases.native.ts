import Purchases from "react-native-purchases";
import { activeVertical } from "../config/vertical.config";
import type { PlanId, PurchaseMode, PurchaseResult } from "./purchaseTypes";

export type { PlanId, PurchaseMode, PurchaseResult };

let mode: PurchaseMode = "dev";

export async function configurePurchases(apiKey: string | undefined, appUserId: string | null): Promise<PurchaseMode> {
  if (!apiKey) {
    mode = "dev";
    return mode;
  }
  try {
    Purchases.configure({ apiKey });
    if (appUserId) await Purchases.logIn(appUserId);
    mode = "live";
  } catch {
    mode = "unavailable";
  }
  return mode;
}

export async function purchasePlan(plan: PlanId): Promise<PurchaseResult> {
  if (mode !== "live") return { status: mode === "dev" ? "dev" : "unavailable" };
  try {
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    const wantedId = plan === "project_pass" ? activeVertical.paywall.projectPassPackageId : activeVertical.paywall.weeklyPackageId;
    const wantedType = plan === "project_pass" ? Purchases.PACKAGE_TYPE.LIFETIME : Purchases.PACKAGE_TYPE.WEEKLY;
    const selected =
      packages.find((item) => item.identifier === wantedId) ??
      packages.find((item) => item.packageType === wantedType) ??
      null;
    if (!selected) return { status: "unavailable" };
    const { customerInfo } = await Purchases.purchasePackage(selected);
    const active = customerInfo.entitlements.active[activeVertical.paywall.entitlementId] != null;
    return { status: active ? "purchased" : "unavailable" };
  } catch (error) {
    const cancelled =
      typeof error === "object" &&
      error !== null &&
      "userCancelled" in error &&
      Boolean((error as { userCancelled?: boolean }).userCancelled);
    if (cancelled) return { status: "cancelled" };
    return { status: "unavailable" };
  }
}

export async function restorePlan(): Promise<{ active: boolean }> {
  if (mode !== "live") return { active: false };
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { active: customerInfo.entitlements.active[activeVertical.paywall.entitlementId] != null };
  } catch {
    return { active: false };
  }
}
