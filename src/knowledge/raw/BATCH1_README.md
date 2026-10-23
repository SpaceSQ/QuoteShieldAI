# Quote Shield AI — Batch 1: US ZIP Cost Matrix 2026

## Deliverable

- **File:** `knowledge/us_zip_cost_matrix_2026.json`
- **Version:** 1.0.0
- **Metro count:** 30 (exact list from brief)
- **Generated:** 2026-10-23 (Asia/Shanghai)

## What’s inside

Each metro object includes:

| Block | Contents |
|-------|----------|
| Geography | `metro_id`, name, state, ≥3 ZIP3 prefixes, ≥2 representative ZIPs |
| Labor | Burdened hourly USD (low/mid/high) for electrician, HVAC tech, plumber, roofer, low-voltage tech; BLS × regional burden |
| Cost indices | Material / permit / overall install vs national 1.0 (clamped ~0.85–1.45) |
| Permits | Typical city fee ranges USD for panel upgrade, HVAC changeout, water heater, reroof |
| Incentives | Brief DSIRE / IRA HEAR / utility pointers |
| Evidence | `evidence_level` E1/E4 + `source_note` + `last_verified` |

## Methodology (short)

1. **Labor (E1):** BLS OEWS May 2025 MSA mean hourly × burden 2.10–2.35. Bay Area = 60% SF + 40% San Jose.
2. **Indices (E4):** ENR Jul 2026 city BCI / 20-city avg (8962.81) where published; else wage-proxy. Clamped 0.85–1.45.
3. **Permits:** BuildPermitGuide + PermitCalculator city fee tables (E1 when schedule coverage sufficient; E4 otherwise).
4. **ZIP3:** Primary USPS prefixes for each MSA core.

Full URLs and raw dumps: `raw/batch1_sources.md`, `raw/bls_oews_may2025_metros.json`.

## Caveats

- **Burdened rates ≠ homeowner invoice.** They are contractor shop cost (~wage × burden), not turnkey job quotes.
- **Permit $ = city fees only**, not inspection soft costs, HOA, or contractor markup.
- **12 metros are E4-only on permits** — verify local fee schedules before production quoting (see sources list).
- **ENR BCI** is heavy-civil / building construction; residential remodel may diverge. Dallas/Atlanta raw ENR ratios were floored to 0.85.
- **Incentives** change frequently; treat notes as starting points, re-check DSIRE / state portals.
- Low-voltage uses SOC 49-2098 as proxy — not a perfect match for all smart-home techs.
- Numbers are realistic 2025–2026 USD integers; not fake precision.

## Validation performed

- Exactly 30 metro objects; `json.load` OK.
- Each metro ≥3 ZIP3 and ≥2 representative ZIPs.
- Every labor mid strictly between low and high.
- Cost indices within 0.85–1.45 vs national.
