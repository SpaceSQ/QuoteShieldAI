import type { PlanId, PurchaseMode, PurchaseResult } from "./purchaseTypes";

export type { PlanId, PurchaseMode, PurchaseResult };

/** Web and missing-key builds never touch the store SDK. The demo can still unlock. */
export async function configurePurchases(
  _apiKey: string | undefined,
  _appUserId: string | null,
): Promise<PurchaseMode> {
  return "dev";
}

export async function purchasePlan(_plan: PlanId): Promise<PurchaseResult> {
  return { status: "dev" };
}

export async function restorePlan(): Promise<{ active: boolean }> {
  return { active: false };
}
