# Quote Shield AI — Knowledge HANDOFF (import)

**Generated:** 2026-10-23 Asia/Shanghai (UTC+8)  
**Status:** Batch 1 + Batch 2 + Batch 3 complete → knowledge pack **v1.0.0**

## Files to import

| # | Path | Version | Records | SHA256 |
|---|------|---------|---------|--------|
| 1 | `knowledge/us_zip_cost_matrix_2026.json` | (Batch1) | 30 metros | `61b5fb0cdd7c41b7adf9e72df149aa5d3ec49409c84466975263df4d90766588` |
| 2 | `knowledge/trade_reference_blueprints_2026.json` | **1.0.0** | **15** blueprints | `3b4d359cedbf9c9b969ee7f95fb9ea0c8192f9c1eb0a570d95367090e0d6d426` |
| 3 | `knowledge/golden_demo_cases_2026.json` | **1.0.0** | **15** cases | `666b932e1e6beb64bb74e31b016a8b93c232a6981ae3dbfcbe8c45ddcb6b5c1b` |

Supporting docs (not runtime): `knowledge/BATCH1_README.md`, `BATCH2_README.md`, `BATCH3_README.md`, `raw/batch1_sources.md`, `raw/batch2_sources.md`, `raw/batch3_sources.md`.

## All blueprint_ids (15)

- `hvac_3ton_heatpump_2026`
- `hvac_4ton_heatpump_2026`
- `hvac_furnace_80_96_2026`
- `hvac_minisplit_2zone_2026`
- `elec_panel_100_to_200a_2026`
- `elec_spd_whole_home_2026`
- `elec_evse_level2_2026`
- `elec_generator_transfer_2026`
- `plumb_wh_50gal_tank_2026`
- `plumb_wh_hpwh_50_2026`
- `plumb_tankless_gas_2026`
- `plumb_wholehouse_pex_repipe_2026`
- `roof_arch_shingle_2500sqft_2026`
- `smart_cat6_wholehome_2026`
- `smart_unifi_wifi_lutron_2026`

## All case_ids (15)

- `demo_ca_hvac_irvine_3ton_01`
- `demo_az_hvac_phoenix_a2l_02`
- `demo_tx_elec_dfw_panel_03`
- `demo_wa_elec_seattle_evse_04`
- `demo_fl_hvac_orlando_flush_05`
- `demo_ny_elec_nyc_spd_bundle_06`
- `demo_co_plumb_denver_tank_07`
- `demo_ga_plumb_atlanta_hpwh_08`
- `demo_tx_plumb_houston_tankless_09`
- `demo_il_plumb_chicago_pex_10`
- `demo_nc_roof_charlotte_shingle_11`
- `demo_mn_roof_minneapolis_reroof_12`
- `demo_tx_smart_austin_cat6_13`
- `demo_ca_smart_sandiego_unifi_14`
- `demo_or_smart_portland_lutron_15`

## Fair formulas (embedded in blueprints JSON)

- Fair_Equipment = Wholesale_BOM × 1.35
- Fair_Labor = crew × hours × regional burdened hourly from zip matrix
- Fair_Total_Range = (Equip + Labor + Permit) × [0.92, 1.12]
- Wholesale_from_retail = Retail × 0.80 when only public retail visible

## Import notes

1. Load zip matrix first (labor/permit lookups for demos & runtime fair calc).  
2. Load blueprints (trade reference tiers + padding traps + contract clauses).  
3. Load golden demos (UX / eval fixtures — composites, not contractor accusations).  
4. Re-verify E2 retail anchors before any customer-facing quote challenge in production.
