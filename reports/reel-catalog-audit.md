# ReelCalc Full Reel Catalog Audit

Generated: 2026-08-15T12:58:36.292Z

## Scope

This is a non-destructive audit of `data/reels.json`. "Calculator-ready" means the wizard has a valid published capacity basis. "Strict page-ready" additionally requires the specifications, recommendations, source references, and warning-free status used by the reel-page generator. It does not mean every specification has been independently re-researched during this pass.

## Summary

- Total reel records: **836**
- Brands: **11**
- Model families: **183**
- Page identity-complete records (including SKU): **818**
- Calculator-ready records: **820**
- Strict page-ready records: **437**
- Records needing calculator data: **16**
- Records needing page data or warning resolution: **399**
- Records with data warnings: **286**
- Records containing placeholder/verification wording: **16**
- Records whose capacity options disagree by more than 10%: **319**
- Records whose capacity options disagree by more than 20%: **103**
- Records whose capacity options disagree by more than 35%: **11**
- Duplicate ID groups: **0**
- Duplicate SKU groups: **7**
- Duplicate display-name groups: **16**
- Registered reel pages: **421**

## Coverage By Brand

| Brand | Records | Calculator-ready | Strict page-ready | Warnings | Placeholders |
| --- | --- | --- | --- | --- | --- |
| Shimano | 183 | 183 | 164 | 19 | 0 |
| Daiwa | 172 | 172 | 37 | 135 | 0 |
| Okuma | 96 | 96 | 83 | 1 | 0 |
| PENN | 91 | 91 | 55 | 0 | 0 |
| KastKing | 67 | 52 | 52 | 15 | 15 |
| Quantum | 61 | 61 | 1 | 60 | 0 |
| Lew's | 49 | 49 | 4 | 44 | 0 |
| Abu Garcia | 45 | 45 | 0 | 5 | 0 |
| Pflueger | 29 | 29 | 5 | 0 | 0 |
| Bass Pro Shops | 24 | 23 | 20 | 4 | 1 |
| Offshore Angler | 19 | 19 | 16 | 3 | 0 |

## Missing Fields

| Field | Missing records |
| --- | --- |
| weight_oz | 160 |
| line_retrieve_in | 88 |
| max_drag_lb | 63 |
| gear_ratio | 57 |
| bearings | 54 |
| capacity_yards | 16 |
| rated_line_lb | 16 |
| rated_line_diameter_in | 16 |
| capacity_options | 16 |
| id | 0 |
| brand | 0 |
| model | 0 |
| size_label | 0 |
| reelcalc_recommended_braid | 0 |
| reelcalc_recommended_mono_fluoro | 0 |
| reelcalc_use_case | 0 |
| source_url | 0 |
| source_file | 0 |

## Calculator Blockers

| Reel | SKU | ID | Missing | Warnings |
| --- | --- | --- | --- | --- |
| Bass Pro Shops Pro Qualifier Spinning Reel various | PQS-VERIFY | `bass-pro-shops-pro-qualifier-spinning-reel-various-pqs-verify-52` | capacity_yards, rated_line_lb, rated_line_diameter_in, capacity_options | Missing mono capacity; manual entry required for calculations.; Source/spec should be verified before public use. |
| KastKing Centron Spinning 1000 |  | `kastking-centron-spinning-1000-48-291` | capacity_yards, rated_line_lb, rated_line_diameter_in, capacity_options | Missing mono capacity; manual entry required for calculations.; Source/spec should be verified before public use. |
| KastKing Brutus Spinning 2000 |  | `kastking-brutus-spinning-2000-53-296` | capacity_yards, rated_line_lb, rated_line_diameter_in, capacity_options | Missing mono capacity; manual entry required for calculations.; Source/spec should be verified before public use. |
| KastKing Brutus Spinning 3000 |  | `kastking-brutus-spinning-3000-54-297` | capacity_yards, rated_line_lb, rated_line_diameter_in, capacity_options | Missing mono capacity; manual entry required for calculations.; Source/spec should be verified before public use. |
| KastKing Brutus Spinning 4000 |  | `kastking-brutus-spinning-4000-55-298` | capacity_yards, rated_line_lb, rated_line_diameter_in, capacity_options | Missing mono capacity; manual entry required for calculations.; Source/spec should be verified before public use. |
| KastKing Brutus Spinning 5000 |  | `kastking-brutus-spinning-5000-56-299` | capacity_yards, rated_line_lb, rated_line_diameter_in, capacity_options | Missing mono capacity; manual entry required for calculations.; Source/spec should be verified before public use. |
| KastKing Valiant Eagle Spinning 1000 |  | `kastking-valiant-eagle-spinning-1000-57-300` | capacity_yards, rated_line_lb, rated_line_diameter_in, capacity_options | Missing mono capacity; manual entry required for calculations.; Source/spec should be verified before public use. |
| KastKing Valiant Eagle Spinning 2000 |  | `kastking-valiant-eagle-spinning-2000-58-301` | capacity_yards, rated_line_lb, rated_line_diameter_in, capacity_options | Missing mono capacity; manual entry required for calculations.; Source/spec should be verified before public use. |
| KastKing Valiant Eagle Spinning 3000 |  | `kastking-valiant-eagle-spinning-3000-59-302` | capacity_yards, rated_line_lb, rated_line_diameter_in, capacity_options | Missing mono capacity; manual entry required for calculations.; Source/spec should be verified before public use. |
| KastKing Valiant Eagle Spinning 4000 |  | `kastking-valiant-eagle-spinning-4000-60-303` | capacity_yards, rated_line_lb, rated_line_diameter_in, capacity_options | Missing mono capacity; manual entry required for calculations.; Source/spec should be verified before public use. |
| KastKing Crixus Spinning 2000 |  | `kastking-crixus-spinning-2000-61-304` | capacity_yards, rated_line_lb, rated_line_diameter_in, capacity_options | Missing mono capacity; manual entry required for calculations.; Source/spec should be verified before public use. |
| KastKing Crixus Spinning 3000 |  | `kastking-crixus-spinning-3000-62-305` | capacity_yards, rated_line_lb, rated_line_diameter_in, capacity_options | Missing mono capacity; manual entry required for calculations.; Source/spec should be verified before public use. |
| KastKing Crixus Spinning 4000 |  | `kastking-crixus-spinning-4000-63-306` | capacity_yards, rated_line_lb, rated_line_diameter_in, capacity_options | Missing mono capacity; manual entry required for calculations.; Source/spec should be verified before public use. |
| KastKing Pontus Baitfeeder 3000 |  | `kastking-pontus-baitfeeder-3000-64-307` | capacity_yards, rated_line_lb, rated_line_diameter_in, capacity_options | Missing mono capacity; manual entry required for calculations.; Source/spec should be verified before public use. |
| KastKing Pontus Baitfeeder 4000 |  | `kastking-pontus-baitfeeder-4000-65-308` | capacity_yards, rated_line_lb, rated_line_diameter_in, capacity_options | Missing mono capacity; manual entry required for calculations.; Source/spec should be verified before public use. |
| KastKing Pontus Baitfeeder 5000 |  | `kastking-pontus-baitfeeder-5000-66-309` | capacity_yards, rated_line_lb, rated_line_diameter_in, capacity_options | Missing mono capacity; manual entry required for calculations.; Source/spec should be verified before public use. |

## Capacity-Basis Disagreement

This check does not dispute the published yardage. It identifies cases where ReelCalc's generic pound-test diameter assumptions make the same reel's published capacity options imply spool volumes that differ by more than 20%. Those records can still calculate, but they should be reviewed before being presented as the highest-confidence page calculations. The largest 30 are shown below.

| Reel | SKU | ID | Spread | Published options and assumed diameters |
| --- | --- | --- | --- | --- |
| Shimano Spheros SW A 14000XG | SPSW14000XGA | `shimano-spheros-sw-a-14000xg-spsw14000xga-740` | 57% | 16-360 @ 0.018 in; 20-260 @ 0.018 in; 25-190 @ 0.019 in |
| Shimano Saragosa SW A 14000XG | SRG14000SWAXG | `shimano-saragosa-sw-a-14000xg-srg14000swaxg-747` | 57% | 16-360 @ 0.018 in; 20-260 @ 0.018 in; 25-190 @ 0.019 in |
| Shimano Stella SW D 14000XG | STLSW14000XGD | `shimano-stella-sw-d-14000xg-stlsw14000xgd-776` | 57% | 16-360 @ 0.018 in; 20-260 @ 0.018 in; 25-190 @ 0.019 in |
| Shimano Spheros SW A 10000PG | SPSW10000PGA | `shimano-spheros-sw-a-10000pg-spsw10000pga-739` | 56.8% | 16-320 @ 0.018 in; 20-220 @ 0.018 in; 25-175 @ 0.019 in |
| Shimano Saragosa SW A 10000PG | SRG10000SWAPG | `shimano-saragosa-sw-a-10000pg-srg10000swapg-746` | 56.8% | 16-320 @ 0.018 in; 20-220 @ 0.018 in; 25-175 @ 0.019 in |
| Shimano Stella SW D 10000PG | STLSW10000PGD | `shimano-stella-sw-d-10000pg-stlsw10000pgd-775` | 56.8% | 16-320 @ 0.018 in; 20-220 @ 0.018 in; 25-175 @ 0.019 in |
| Shimano IX 4000R | IX4000R | `shimano-ix-4000r-ix4000r-732` | 54.1% | 15-265 @ 0.008 in; 30-175 @ 0.011 in; 50-145 @ 0.014 in |
| Okuma Makaira 30000 | MK-30000LS/RS | `okuma-makaira-30000-mk-30000ls-rs-419` | 52.8% | 40-490 @ 0.025 in; 50-360 @ 0.025 in; 60-300 @ 0.025 in |
| Abu Garcia Zenon X Spinning 2000 | ZENON X SP2000 | `abu-garcia-zenon-x-spinning-2000-zenon-x-sp2000-33` | 40.3% | 4-140 @ 0.008 in; 6-110 @ 0.0095 in; 10-90 @ 0.012 in |
| Shimano Stella SW D 30000PG | STLSW30000PGD | `shimano-stella-sw-d-30000pg-stlsw30000pgd-780` | 40% | 40-370 @ 0.025 in; 50-300 @ 0.025 in; 60-250 @ 0.025 in |
| Offshore Angler Sea Lion Spinning Reel 8000 | SLS80 | `offshore-angler-sea-lion-spinning-reel-8000-sls80-82` | 38.4% | 30-270 @ 0.022 in; 40-180 @ 0.025 in; 50-140 @ 0.025 in |
| Shimano Socorro SW 10000 | SOC10000SW | `shimano-socorro-sw-10000-soc10000sw-754` | 33.1% | 12-500 @ 0.014 in; 16-320 @ 0.018 in; 20-220 @ 0.018 in |
| PENN Battle IV 10000 | BTLIV10000 | `penn-battle-iv-10000-btliv10000-466` | 32.7% | 30-395 @ 0.022 in; 40-330 @ 0.025 in; 50-230 @ 0.025 in |
| Okuma Safyre C2000 | SF-C2000A | `okuma-safyre-c2000-sf-c2000a-399` | 31.2% | 4-220 @ 0.008 in; 6-165 @ 0.0095 in; 10-130 @ 0.012 in |
| Okuma Tesoro 6000 | TSR-6000XA | `okuma-tesoro-6000-tsr-6000xa-421` | 31.2% | 12-265 @ 0.014 in; 16-170 @ 0.018 in; 20-120 @ 0.018 in |
| PENN Spinfisher VII 10500 | SSVII10500 | `penn-spinfisher-vii-10500-ssvii10500-504` | 31.2% | 30-435 @ 0.022 in; 40-360 @ 0.025 in; 50-255 @ 0.025 in |
| PENN Slammer IV 10500 | SLAIV10500 | `penn-slammer-iv-10500-slaiv10500-523` | 31.2% | 30-435 @ 0.022 in; 40-360 @ 0.025 in; 50-255 @ 0.025 in |
| PENN Authority 10500 | ATH10500 | `penn-authority-10500-ath10500-534` | 31.2% | 30-435 @ 0.022 in; 40-360 @ 0.025 in; 50-255 @ 0.025 in |
| Shimano Spheros SW A 6000HG | SPSW6000HGA | `shimano-spheros-sw-a-6000hg-spsw6000hga-737` | 31.2% | 12-265 @ 0.014 in; 16-170 @ 0.018 in; 20-120 @ 0.018 in |
| Shimano Spheros SW A 8000HG | SPSW8000HGA | `shimano-spheros-sw-a-8000hg-spsw8000hga-738` | 31.2% | 14-300 @ 0.015 in; 16-250 @ 0.018 in; 20-185 @ 0.018 in |
| Shimano Saragosa SW A 6000HG | SRG6000SWAHG | `shimano-saragosa-sw-a-6000hg-srg6000swahg-744` | 31.2% | 12-265 @ 0.014 in; 16-170 @ 0.018 in; 20-120 @ 0.018 in |
| Shimano Saragosa SW A 8000HG | SRG8000SWAHG | `shimano-saragosa-sw-a-8000hg-srg8000swahg-745` | 31.2% | 14-300 @ 0.015 in; 16-250 @ 0.018 in; 20-185 @ 0.018 in |
| Shimano Socorro SW 6000 | SOC6000SW | `shimano-socorro-sw-6000-soc6000sw-752` | 31.2% | 12-265 @ 0.014 in; 16-170 @ 0.018 in; 20-120 @ 0.018 in |
| Shimano Thunnus CI4 6000 | TU6000CI4 | `shimano-thunnus-ci4-6000-tu6000ci4-756` | 31.2% | 12-265 @ 0.014 in; 16-170 @ 0.018 in; 20-120 @ 0.018 in |
| Shimano Twin Power SW C 6000HG | TPSW6000HGC | `shimano-twin-power-sw-c-6000hg-tpsw6000hgc-768` | 31.2% | 12-265 @ 0.014 in; 16-170 @ 0.018 in; 20-120 @ 0.018 in |
| Shimano Stella SW D 6000HG | STLSW6000HGD | `shimano-stella-sw-d-6000hg-stlsw6000hgd-771` | 31.2% | 12-265 @ 0.014 in; 16-170 @ 0.018 in; 20-120 @ 0.018 in |
| Shimano Stella SW D 6000XG | STLSW6000XGD | `shimano-stella-sw-d-6000xg-stlsw6000xgd-772` | 31.2% | 12-265 @ 0.014 in; 16-170 @ 0.018 in; 20-120 @ 0.018 in |
| Shimano Socorro SW 8000 | SOC8000SW | `shimano-socorro-sw-8000-soc8000sw-753` | 31.1% | 12-345 @ 0.014 in; 16-250 @ 0.018 in; 20-185 @ 0.018 in |
| Daiwa Eliminator Spinning Reel 5000 | ELT5000 | `daiwa-eliminator-spinning-reel-5000-elt5000-216` | 30.6% | 14-470 @ 0.015 in; 17-380 @ 0.018 in; 20-280 @ 0.018 in |
| Daiwa Eliminator Spinning Reel 4500 | ELT4500 | `daiwa-eliminator-spinning-reel-4500-elt4500-215` | 28.8% | 14-350 @ 0.015 in; 17-280 @ 0.018 in; 20-210 @ 0.018 in |

## Duplicate Display Labels

These are not automatically errors. Different retrieve speeds, colors, handle sides, or other exact SKUs can legitimately share a displayed family and size. They do require exact-SKU page naming and selection.

| Normalized display label | Records | Exact records |
| --- | --- | --- |
| okuma cat slayer custom 6000 | 2 | CSC-6000NG (okuma-cat-slayer-custom-6000-csc-6000ng-447); CSC-6000NO (okuma-cat-slayer-custom-6000-csc-6000no-448) |
| okuma cat slayer custom 6000 baitfeeder | 2 | CSCF-6000NG (okuma-cat-slayer-custom-6000-baitfeeder-cscf-6000ng-449); CSCF-6000NO (okuma-cat-slayer-custom-6000-baitfeeder-cscf-6000no-450) |
| penn battle iv 4000 | 2 | BTLIV4000HS (penn-battle-iv-4000-btliv4000hs-459); BTLIV4000 (penn-battle-iv-4000-btliv4000-460) |
| penn battle iv 6000 | 2 | BTLIV6000HS (penn-battle-iv-6000-btliv6000hs-462); BTLIV6000 (penn-battle-iv-6000-btliv6000-463) |
| penn battle iv 8000 | 2 | BTLIV8000HS (penn-battle-iv-8000-btliv8000hs-464); BTLIV8000 (penn-battle-iv-8000-btliv8000-465) |
| penn clash ii 3000 | 2 | CLAII3000 (penn-clash-ii-3000-claii3000-489); CLAII3000HS (penn-clash-ii-3000-claii3000hs-490) |
| penn clash ii 4000 | 2 | CLAII4000 (penn-clash-ii-4000-claii4000-491); CLAII4000HS (penn-clash-ii-4000-claii4000hs-492) |
| penn spinfisher vii 4500 | 2 | SSVII4500BLS (penn-spinfisher-vii-4500-ssvii4500bls-496); SSVII4500 (penn-spinfisher-vii-4500-ssvii4500-497) |
| penn spinfisher vii 6500 | 2 | SSVII6500BLS (penn-spinfisher-vii-6500-ssvii6500bls-499); SSVII6500 (penn-spinfisher-vii-6500-ssvii6500-500) |
| penn slammer iv 4500 | 2 | SLAIV4500 (penn-slammer-iv-4500-slaiv4500-514); SLAIV4500HS (penn-slammer-iv-4500-slaiv4500hs-515) |
| penn slammer iv 5500 | 2 | SLAIV5500BLS (penn-slammer-iv-5500-slaiv5500bls-516); SLAIV5500 (penn-slammer-iv-5500-slaiv5500-517) |
| penn slammer iv 6500 | 2 | SLAIV6500 (penn-slammer-iv-6500-slaiv6500-518); SLAIV6500HS (penn-slammer-iv-6500-slaiv6500hs-519) |
| penn slammer iv 8500 | 2 | SLAIV8500 (penn-slammer-iv-8500-slaiv8500-521); SLAIV8500HS (penn-slammer-iv-8500-slaiv8500hs-522) |
| penn authority 4500 | 2 | ATH4500 (penn-authority-4500-ath4500-526); ATH4500HS (penn-authority-4500-ath4500hs-527) |
| penn authority 6500 | 2 | ATH6500 (penn-authority-6500-ath6500-529); ATH6500HS (penn-authority-6500-ath6500hs-530) |
| penn authority 8500 | 2 | ATH8500 (penn-authority-8500-ath8500-532); ATH8500HS (penn-authority-8500-ath8500hs-533) |

## Registry Integrity

- Page registry references missing from the reel database: **0**
- Affiliate mappings referencing missing reel IDs: **0**

## Interpretation

1. Existing IDs must remain stable; duplicate display labels should be disambiguated using SKU and variant information rather than merged automatically.
2. Reels missing calculator capacity must not receive generated pages until a reliable capacity basis is verified.
3. Strict page readiness is intentionally conservative. A reel can work in the wizard while still lacking the complete sourced specification set required for a high-quality public page.
4. Current-generation and legacy additions should be researched as exact model/SKU sets before insertion, then this audit and the existing tests must be rerun.
