# Quote Shield AI — Batch 2: HVAC + Electrical Blueprints & Golden Demos

## Deliverables

| File | Version | Count |
|------|---------|-------|
| `knowledge/trade_reference_blueprints_2026.json` | 0.2.0-batch2 | 8 blueprints |
| `knowledge/golden_demo_cases_2026.json` | 0.2.0-batch2 | 6 cases |
| `raw/batch2_sources.md` | — | URL ledger |

## Blueprints (8)

**HVAC:** `hvac_3ton_heatpump_2026`, `hvac_4ton_heatpump_2026`, `hvac_furnace_80_96_2026`, `hvac_minisplit_2zone_2026`  
**Electrical:** `elec_panel_100_to_200a_2026`, `elec_spd_whole_home_2026`, `elec_evse_level2_2026`, `elec_generator_transfer_2026`

Each has good/better/best tiers, labor allocation, ≥2 padding traps (E2/E3 primary), and mandatory contract clauses.

## Golden demos (6)

1. `demo_ca_hvac_irvine_3ton_01` — SoCal mid-tier heat-pump ripoff  
2. `demo_az_hvac_phoenix_a2l_02` — Phoenix A2L sensor + flush padding  
3. `demo_tx_elec_dfw_panel_03` — DFW 200A panel overcharge  
4. `demo_wa_elec_seattle_evse_04` — Seattle EVSE + phantom panel  
5. `demo_fl_hvac_orlando_flush_05` — Florida nitrogen-flush gouge  
6. `demo_ny_elec_nyc_spd_bundle_06` — NYC/NJ SPD bundle gouge  

## Fair-price formulas

- Fair_Equipment = Wholesale_BOM × 1.35  
- Fair_Labor = crew × hours × Batch1 regional burdened rate  
- Fair_Total_Range = (Equip+Labor+Permit) × [0.92, 1.12]  
- Wholesale_Estimate = Retail × 0.80 when only retail is public  

## Caveats

- Batch 3 will append Plumbing / Roofing / Smart Home blueprints and more demos.  
- Flagship communicating HVAC complete-system sticker prices are family-level where full matched BOM pages were not all fetched.  
- Demos are evidence-anchored composites for product UX — not claims about a named contractor.  
- Always re-verify live distributor prices before production quoting.
