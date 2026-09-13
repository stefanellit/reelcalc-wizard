# Ten Line Guides Ready for Review

## Publication Boundary

The seven approved Seaguar guides are public in Squarespace. Commit `5ee92c7` was deployed successfully, and the public line-guide directory now contains ten published guides. The seven-row import must not be repeated.

This next batch is LOCAL PREVIEW ONLY. No new ten-page import or GitHub push has been made. `data/line-page-release.json` still has exactly ten `publishedProducts`. The prepared ten-row CSV starts the new guides Hidden and excludes all published products.

## Pages

| Page | Verified strengths |
| --- | ---: |
| Sunline FC Sniper | 15 |
| Sunline Shooter | 12 |
| Sunline Assassin FC | 7 |
| Sunline Super Natural Mono | 15 |
| Sunline SX1 | 8 |
| Sunline Xplasma Asegai | 10 |
| Sunline Siglon PE X8 | 14 |
| Sunline Shooter Machinegun Cast | 13 |
| Sunline Shooter BMS Azayaka FC | 11 |
| Berkley GINCLEAR | 9 |

Review hub: `http://127.0.0.1:4183/tmp/line-page-launch-candidate/previews/line-pages/batch-two-review.html`. Each guide also has a separate open browser tab.

## Accuracy Work

- Verified 114 strength records against manufacturer charts and product variants. The catalog now contains 1,045 records across 138 models. Exact changes, source snapshots, and exclusions are retained under `research/line-pages/`.
- Kept each strength's actual retail package options instead of assigning every package to every strength. Metric JDM packages remain labeled and linked as meters, with yard equivalents for calculation.
- Matched the current JDM Machinegun Cast nylon and BMS Azayaka fluorocarbon products to their respective sources. BMS uses the current 80/320-meter specification, not the older 300-meter package.
- Unsupported legacy strengths are excluded from these pages and their comparison choices, not presented as verified. A chart-only Asegai 6 lb strength without a matching selectable SKU was not added.
- Preserved independently published inch/mm values. For millimeter-only JDM charts and inch-only GINCLEAR data, converted values are identified as conversions in the sources section. Extra decimal precision prevents the displayed chart from silently disagreeing with the calculator.
- Used actual manufacturer package images and model-specific guidance. Manufacturer performance descriptions are not presented as independent ReelCalc test results.
- Kept the shared calculator mathematics and reel database unchanged. Corrected line diameters can legitimately change capacity estimates when these local changes are eventually deployed.

## Verification

| Audit | Result |
| --- | --- |
| Shared engine and independent volume identities | 2,935,271 checks, 275,880 reel/line pairings, zero failures |
| Native browser previews, all 20 prepared pages | 2,217 checks, zero failures |
| Imported-page browser previews, all 20 prepared pages | 2,217 checks, zero failures |
| New-batch source/package/content checks | 656 checks across 10 models and 114 strengths, passed |
| Affiliate package variants | 450 checked in the calculation audit; existing affiliate tests passed |
| Incremental import safety | 9 checks passed; no previously published guides included |
| Independent CSV parser | 10 valid hidden guides; HTML and URL round-trip passed |
| Publishing components and schema | 20 components passed; 493 CSS selectors isolated |
| Existing line-page engine tests | Passed |

Browser checks cover strength and package changes, no-backing/full-capacity and backing calculations, manual reel specifications, comparisons, selected reel/line wizard links, and widths of 320, 390, 768, and 1280 pixels. The mobile review found long diameter values crowding adjacent table cells; column widths were corrected and explicit text-spill checks added before both final browser audits passed.

All ten direct preview pages were also checked for the correct heading and image, one ready calculator, no visible commerce controls, and no page overflow. Visual spot checks included narrow JDM charts, a braid calculator and comparison section, and the GINCLEAR desktop calculator.

Evidence files: `line-batch-two-native-browser.json`, `line-batch-two-imported-browser.json`, `line-batch-two-preview-load.json`, and `line-page-trust-audit-2026-09-12-evidence.json`.

## Limits and Next Step

These are software, source-comparison, and layout checks, not physical spool tests or a new verification of every reel rating. Actual fill still depends on line packing, tension, manufacturer rounding, and stopping at the reel's recommended fill level. Amazon links preserve tag and selected line/package context; stock and exact search results can change.

Await the user's review of these ten pages. Only after approval should their assets be pushed, their new CSV imported, native Squarespace metadata/images checked, and public URLs added to the published directory. The remaining 118 main-catalog models are tracked for later batches, not silently omitted.
