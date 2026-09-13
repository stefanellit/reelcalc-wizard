# Group A Independent Source Review

Completed September 13, 2026. Reviewed the final **13 candidates / 120 accepted rows** only. The nine model-level holds were excluded and not researched toward resolution. The initial review was read-only; the user subsequently authorized the scoped A-01 text correction in Group A.

Original reviewed pack SHA-256: `3a8c253b9a81a5fd03ca62b99583503459e94725a63f111830df711c88ecb0d6`.

Post-fix pack SHA-256: `b6051735d71cac417ceeff379cf632c702d79b2a0eca298d3012fa79771d6d7c`.

## A-01 Resolved

Checked 2026-09-13T15:03:40.535Z. Removed the unsupported version attribution from `pack.json`, `build-mainlines.mjs`, the authored Mastiff reviewed summary, `status.md` and `HANDOFF.md`. Direct Shimano pt-BR MASTIFF FC 90m identity and numeric SKU/japanAdminCode values are retained. Raw primary responses and assets were not edited.

All rows excluding evidence prose, all IDs/roles/statuses/defaults/examples, and every other model match the pre-fix snapshot. The pack still has 22 models, 13 candidates and 120 accepted rows. The authored evidence rows match the pack; the source builder passes `node --check`. No builders or pages were regenerated; main will regenerate. The historical finding below is retained for audit context and is now resolved.

## Finding

### P2: Substantiate Or Remove Mastiff's LB-B41V Attribution

Before the fix, `pack.json:5091` called `LB-B41V` explicitly identified and documented on the Brazilian primary page. The code was repeated in construction, chart note, FAQ, spooling guidance, model reason and all ten row evidence strings.

The saved raw `evidence/mastiff-br.html` verifies **MASTIFF FC 90m**, NANOARMOR fluorocarbon, ten exact lb/mm/90m rows and numeric SKU/japanAdminCode values. The actual product image corroborates 12lb/.285mm/90m. However, neither this primary response nor the inspected image establishes `LB-B41V`. A case-insensitive search for `B41V` across saved evidence finds only the author-generated `shimano-mastiff-fc.reviewed.json`, not a primary source.

**Action before publishing that text:** remove the unsupported code/formulation-attribution assertions while retaining the proven Shimano pt-BR MASTIFF FC 90m scope and numeric SKU codes, or supply exact primary proof of the code mapping. This is not a finding that the ten numeric rows or 90m identity are false. Do not substitute US 200-yard data to address it.

Relevant pack lines: 4887, 4915, 5090, 5091, 5109, 5116, 5127. Primary source: [Shimano MASTIFF FC 90m](https://fish.shimano.com/pt-BR/product/fishingline/monofilamentlines/a155f00000c6djcqan.html).

## Results

No accepted numeric value or package was found to mismatch its saved primary table, variant response or visually reviewed chart. After the A-01 attribution correction, all thirteen candidates pass this source review within their existing scope limits. Both leader roles and complete configs are appropriate.

| Candidate | Rows | Source-review result |
| --- | ---: | --- |
| daiwa-j-braid-x4 | 9 | Pass: exact US Dark Green LINES rows, 27 package combinations; generic correct-family image |
| daiwa-j-braid-grand-x8 | 12 | Pass: exact Gray Light handle/JBGD8U GL rows, 29 package combinations; correct-color bulk image |
| daiwa-j-fluoro-samurai | 3 | Pass: clear JFS 2/4/6lb and 220/1000yd; no Hidden Concept merge |
| seaguar-basix | 6 | Pass: assigned xxBSX variants only; 20lb is 175yd, accepted lower tests 200yd |
| shimano-mastiff-fc | 10 | Pass after A-01 attribution correction; numeric/photo proof unchanged |
| shimano-kairiki-8 | 5 | Pass: Australian SKE3000 G/M bulk only; image reads 20lb/.200mm/3000m |
| shimano-kairiki-4 | 10 | Pass: 28 European meter-package combinations; preserve average-pound semantics |
| shimano-grappler-8 | 7 | Pass: exact NZ average-pound labels and 300m; representative image depicts held strength |
| shimano-ocea-ex-fluorocarbon-leader | 15 | Pass: exact lineup lb labels joined to mm/length SKU table; leader role; 130lb is 20m |
| sunline-crank-fc | 5 | Pass: actual chart image independently read; all ten 200/660yd variants verified |
| xbraid-x9-fulldrag-braid | 11 | Pass: 41 accepted ML combinations match both distributor data and XBraid's own embedded specs |
| sunline-shooter-bms-azayaka-ny | 10 | Pass: product-specific NY table, 80m, complete JAN prefix/suffix proof; nylon image |
| seaguar-jdm-grand-max-leader | 17 | Pass: exact US-import xxGM66 variants, 60m, leader role; composite image caveat retained |

## Evidence Checks

- Independently re-parsed six raw Shimano/Sunline HTML responses. Their raw tables exactly match the supplied parsed tables. Compared accepted rows against those primary table values, not only the agent's reviewed summaries.
- Verified Daiwa's saved page explicitly declares `DAIWA_SHEETS_PROXY` and requests the cited LINES endpoint. The `workers.dev` host is product-linked primary infrastructure, not an unexplained third-party numeric source. Exact product/color handles were checked.
- XBraid's own saved HTML contains a 68-record specifications array. Its 41 accepted ML combinations independently agree with the distributor sheet, providing direct brand-page numeric proof.
- Parsed original Seaguar/Sunline public variant responses; empty-SKU BasiX combinations were not counted as packages. Crank FC's actual five-column diameter image was visually checked against all five rows.
- All 13 active manufacturer images were visually inspected. Readable labels agree with accepted rows except the already documented representative/held-strength situations below.
- All 57 mm-to-inch conversions, 92 metric-package conversion records and 13 default line/package selections passed consistency checks. The 63 published-pair rows retain the source's displayed units rather than being silently converted.
- Both leaders retain model/product `Fluorocarbon Leader`, `role: leader`, empty `exampleSetups`, leader-specific text and verified defaults. Ocea EX's material/construction is explicit in the primary description; Grand Max explicitly identifies leader/tippet material.

## Caveats To Preserve

- **Grappler photo:** it shows 16.8lb/.100mm/300m, which is a held row because its lineup title says 16.4lb. It is valid model-identity imagery, not proof that the row is resolved. The pack records this in `imageReview`; a visible caption/source-note qualification would help the main UI review. No new numeric blocker is asserted.
- **Grand Max composite:** 7lb/.205mm import package and .220mm representative spool must not be interpreted as one SKU. The existing source note already makes this distinction. All 17 numeric rows are independently supported by assigned variants.
- **Regional packages:** Mastiff is proven as pt-BR 90m, Kairiki 8 as Australian 3000m bulk, Kairiki 4 as European metric packages, Grappler as NZ 300m, and the two leaders as their explicitly stated regional/import scopes. Do not broaden them to unverified US/filler variants during staging.
- **Rating semantics:** Kairiki 4's header is average strength; Grappler uses exact average-pound labels; Sunline NY uses reference-strength values. None establishes a guaranteed breaking load or a kg-to-conventional-lb identity conversion.
- Existing held/conflicting rows, absent colors and unverified formulations remain excluded. No held model or row was resolved in this review.

## Limits

This is an independent review of saved primary responses fetched September 13, 2026, not fresh network acquisition or release approval. No shared catalog, reel validation, rendering, calculator engine, browser, staging or publication work was performed. Main owns those gates. Detailed per-model primary files, photo observations and the finding are in `group-a-review.json`.
