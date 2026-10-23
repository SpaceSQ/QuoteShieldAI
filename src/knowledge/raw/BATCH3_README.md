# Quote Shield AI — Batch 3: Plumbing + Roofing + Smart Home (append)

## Deliverables

| File | Version | Count |
|------|---------|-------|
| `knowledge/trade_reference_blueprints_2026.json` | 1.0.0 | **15** blueprints (8 Batch2 + 7 Batch3) |
| `knowledge/golden_demo_cases_2026.json` | 1.0.0 | **15** cases (6 Batch2 + 9 Batch3) |
| `raw/batch3_sources.md` | — | URL ledger |
| `knowledge/HANDOFF.md` | — | Import summary + SHA256 |

## New blueprints (7)

**Plumbing (4):**
1. `plumb_wh_50gal_tank_2026` — 50-gal conventional tank WH replacement
2. `plumb_wh_hpwh_50_2026` — 50-gal heat pump / hybrid WH
3. `plumb_tankless_gas_2026` — Tankless gas retrofit (Rinnai / Navien)
4. `plumb_wholehouse_pex_repipe_2026` — Whole-house Uponor PEX-A repipe

**Roofing (1):**
5. `roof_arch_shingle_2500sqft_2026` — Architectural shingles full reroof (~2–3k sq.ft.); gutter-guard + skylight padding traps folded in

**Smart Home (2):**
6. `smart_cat6_wholehome_2026` — Whole-home Cat6 retrofit / structured wiring
7. `smart_unifi_wifi_lutron_2026` — UniFi Wi-Fi 7 + Lutron Caséta / RadioRA 3 (PoE cams optional trap)

Brands covered: Bradford White, Rheem, Rinnai, Navien, Uponor, GAF, Owens Corning, UniFi, Lutron Caséta, RadioRA 3.

## New golden demos (9)

| # | case_id | Trade | Metro |
|---|---------|-------|-------|
| 7 | `demo_co_plumb_denver_tank_07` | Plumbing | Denver / Aurora |
| 8 | `demo_ga_plumb_atlanta_hpwh_08` | Plumbing | Atlanta / Suwanee |
| 9 | `demo_tx_plumb_houston_tankless_09` | Plumbing | Houston / Katy |
| 10 | `demo_il_plumb_chicago_pex_10` | Plumbing | Chicago / Lake Forest |
| 11 | `demo_nc_roof_charlotte_shingle_11` | Roofing | Charlotte / Huntersville |
| 12 | `demo_mn_roof_minneapolis_reroof_12` | Roofing | Minneapolis / St. Paul |
| 13 | `demo_tx_smart_austin_cat6_13` | Smart Home | Austin |
| 14 | `demo_ca_smart_sandiego_unifi_14` | Smart Home | San Diego / La Jolla |
| 15 | `demo_or_smart_portland_lutron_15` | Smart Home | Portland |

Mix: Plumbing 4 · Roofing 2 · Smart Home 3.

## Fair-price formulas

- Fair_Equipment = Wholesale_BOM × 1.35  
- Fair_Labor = crew × hours × Batch1 regional burdened rate  
- Fair_Total_Range = (Equip+Labor+Permit) × [0.92, 1.12]  
- Wholesale_Estimate = Retail × 0.80 when only retail is public  

## Caveats

- Batch2 HVAC/Electrical entries were **kept** (append-only).  
- Standalone gutter-guard blueprint deferred; traps live inside `roof_arch_shingle_2500sqft_2026`.  
- RadioRA 3 and some Bradford White plumber-channel stickers are range-labeled (dealer/account pricing).  
- Demos are evidence-anchored composites for product UX — not claims about a named contractor.  
- Always re-verify live distributor prices before production quoting.

## SHA256 (post-write)

- blueprints: `3b4d359cedbf9c9b969ee7f95fb9ea0c8192f9c1eb0a570d95367090e0d6d426`
- golden demos: `666b932e1e6beb64bb74e31b016a8b93c232a6981ae3dbfcbe8c45ddcb6b5c1b`
- zip cost matrix (unchanged reference): `61b5fb0cdd7c41b7adf9e72df149aa5d3ec49409c84466975263df4d90766588`
