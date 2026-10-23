export type PlanId = "project_pass" | "weekly";
export type PurchaseMode = "live" | "dev" | "unavailable";
export type PurchaseResult = { status: "purchased" | "cancelled" | "unavailable" | "dev" };
