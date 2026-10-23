/** Same bands as riskLabel() in src/engine/auditEngine.ts. */

export function usd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function riskTone(score: number): "high" | "review" | "lower" {
  if (score >= 65) return "high";
  if (score >= 40) return "review";
  return "lower";
}

export function riskLabel(score: number): string {
  if (score >= 65) return "High rip-off risk";
  if (score >= 40) return "Review before you sign";
  return "Lower risk";
}
