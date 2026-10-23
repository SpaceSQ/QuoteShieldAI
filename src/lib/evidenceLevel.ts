/**
 * Quote Shield AI evidence labels.
 * HANDOFF does not define the E1–E4 scale in one line.
 * Levels are read from labor, permit, and trap fields in the knowledge pack.
 */

import {
  lookupBlueprintById,
  lookupMetroByZip,
  normalizeTradeKey,
  tradeBlueprintCatalog,
} from "../knowledge/knowledgeAdapter";

export const EVIDENCE_LEVELS = ["E1", "E2", "E3", "E4"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

/** One-line scale used when HANDOFF does not define one. */
export const EVIDENCE_SCALE = "E1 city primary source, E2 trade manual, E3 retail anchor, E4 illustrative.";

export function evidenceLevelsIn(value: string | null | undefined): EvidenceLevel[] {
  if (!value) return [];
  const head = value.split(":")[0] ?? "";
  const matches = head.match(/E[1-4]\b/g);
  if (!matches) return [];
  const levels: EvidenceLevel[] = [];
  for (const token of matches) {
    if (isEvidenceLevel(token) && !levels.includes(token)) levels.push(token);
  }
  return levels;
}

export function evidenceForPriceBenchmark(input: {
  zipCode: string;
  tradeCategory: string;
  blueprintId?: string | null;
  label: string;
  note?: string;
  role: "trap" | "line";
}): EvidenceLevel[] {
  if (input.role === "trap") {
    const trapLevels = trapEvidenceLevels(input.label, input.tradeCategory, input.blueprintId);
    if (trapLevels.length > 0) return trapLevels;
  }

  const text = `${input.label} ${input.note ?? ""}`;
  if (/\bmissing\b/i.test(text)) return [];
  const metro = lookupMetroByZip(input.zipCode);
  if (!metro) return [];
  if (/\bpermit\b/i.test(text)) return evidenceLevelsIn(metro.permits.evidence_level);
  if (/\blabor\b|\bhourly\b/i.test(text)) return evidenceLevelsIn(metro.labor.evidence_level);
  return [];
}

function trapEvidenceLevels(
  title: string,
  tradeCategory: string,
  blueprintId?: string | null,
): EvidenceLevel[] {
  const trade = normalizeTradeKey(tradeCategory);
  const preferred = blueprintId ? lookupBlueprintById(blueprintId) : null;
  const pool = [
    ...(preferred ? [preferred] : []),
    ...tradeBlueprintCatalog.blueprints.filter((blueprint) => !trade || normalizeTradeKey(blueprint.trade_category) === trade),
  ];
  const seen = new Set<string>();
  for (const blueprint of pool) {
    if (seen.has(blueprint.blueprint_id)) continue;
    seen.add(blueprint.blueprint_id);
    const trap = blueprint.common_contractor_padding_traps.find((item) => item.trap_name === title);
    if (trap) return evidenceLevelsIn(trap.evidence_level);
  }
  return [];
}

function isEvidenceLevel(value: string): value is EvidenceLevel {
  return (EVIDENCE_LEVELS as readonly string[]).includes(value);
}
