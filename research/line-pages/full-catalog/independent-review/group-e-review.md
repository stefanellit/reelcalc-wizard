# Independent Group E Review

Final post-fix review completed 2026-09-13. **Independent signoff: PASS for the exact final pack below, 19 retained candidates / 119 source-reviewed rows, with zero open remediation advisories.** E-001, E-004 and E-005 are resolved. The five model holds and four Quattro strength exclusions remain active.

Final pack SHA-256: `a36b2c21104b8c21b308ab3b2debd60eb4793cf6f991ad85761edd2ede8edd42`.

The original independent reviewer also applied the authorized remediation and verified the result; this does not imply an additional separate reviewer. Main retains browser, staging and publication ownership.

All 24 assigned models are accounted for in the companion JSON. The four other pre-existing holds were inventoried, not independently resolved. This is a source review, not publication approval.

## Findings

### E-002 | P1 | Confirmed Existing Hold: Hi-Seas Fluorocarbon

The exact CFC-F200 mainline SKU titles and the same SKU's official package photos disagree on diameter. Each title was fetched afresh and each saved original photo was visually inspected.

| Test | Official title: in / mm | Official package: in / mm |
|---|---|---|
| 10 lb | .013 / .32 | .011 / .28 |
| 12 lb | .014 / .35 | .012 / .30 |
| 15 lb | .016 / .40 | .014 / .35 |
| 20 lb | .017 / .42 | .016 / .40 |

Sources: [CFC-F200-10](https://www.afwfishing.com/hi-seas_products/CFC-F200-10.asp), [CFC-F200-12](https://www.afwfishing.com/hi-seas_products/CFC-F200-12.asp), [CFC-F200-15](https://www.afwfishing.com/hi-seas_products/CFC-F200-15.asp), [CFC-F200-20](https://www.afwfishing.com/hi-seas_products/CFC-F200-20.asp).

The 200-yard package agrees, but that does not settle formulation or diameter. At 10 lb, .011 versus .013 inch changes the diameter-squared capacity estimate by approximately 39.7%. There is no supported tiebreaker. **Keep all four rows excluded and product null. Do not restore an earlier four-row pack or substitute leader diameters.**

Photo files are individually identified in JSON finding E-002.

### E-003 | P1 | Confirmed Existing Exclusions: Hi-Seas Quattro

Exact CFQ-B25 titles explicitly identify **Fluorocarbon Leader**, not a mainline. The latest pack correctly retains only 8, 10 and 25 lb, each at 25 yards. The 25 lb photo confirms .018 inch / .45 mm; 8 and 10 lb have exact-title evidence, not independent photo confirmation of their numeric values. Sources: [8 lb](https://www.afwfishing.com/hi-seas_products/CFQ-B25-08.asp), [10 lb](https://www.afwfishing.com/hi-seas_products/CFQ-B25-10.asp), [25 lb](https://www.afwfishing.com/hi-seas_products/CFQ-B25-25.asp).

The following excluded strengths have independently confirmed title/photo conflicts:

| Test | Official title: in / mm | Official package: in / mm |
|---|---|---|
| 12 lb | .014 / .35 | .012 / .30 |
| 15 lb | .016 / .40 | .014 / .35 |
| 20 lb | .017 / .42 | .016 / .40 |
| 30 lb | .019 / .50 | .020 / .50 |

Sources: [12 lb](https://www.afwfishing.com/hi-seas_products/CFQ-B25-12.asp), [15 lb](https://www.afwfishing.com/hi-seas_products/CFQ-B25-15.asp), [20 lb](https://www.afwfishing.com/hi-seas_products/CFQ-B25-20.asp), [30 lb](https://www.afwfishing.com/hi-seas_products/CFQ-B25-30.asp).

**No blocker for the latest three-row subset.** Block the four excluded strengths and any earlier seven-row import. Keep `role: leader`, 25 lb / 25 yd defaults, and empty example setups. Preserve catalog IDs and the legacy type string; role must control rendering.

### E-001 | P2 | Resolved: Rhino Braid Saved Example

The first saved Vanford FA 2500 / Rhino 15 lb example now uses **100 working yards**, within the existing engine's **114.57-yard** full-capacity estimate. The owned builder also contains 100 yards. All 33 saved mainline examples were checked again and fit their calculated capacities.

The original 125-yard value and evidence are retained in the JSON history. No action remains for this finding against the final hash. The current capacity-only renderer was unaffected by the original defect. [Exact official child](https://www.zebco.com/en/shop/line/rhinobraid/RNB200-15OC).

### E-004 | P3 | Resolved: Reaction Fluorocarbon Image Caption

The genuine Clear 100% Fluorocarbon family photo remains unchanged. A real `product.imageCaption` now says:

> Representative Clear 100% Fluorocarbon package shown: 60 lb, 0.70 mm, 300 yd. The diameter chart covers 6-25 lb; this photo does not change with the selected strength.

The current gold template emits this text in its visible figcaption, and the owned builder retains the field. This resolves the representative-photo advisory without replacing the actual product image. [Official product](https://reactiontackle.com/products/reaction-tackle-100-pure-fluorocarbon-fishing-line).

### E-005 | P3 | Resolved: Customer-Facing Buying Distinctions

Ande Tournament now explains its actual 16 lb offering; Ande Graphite explains the current 60 lb option and exact diameters; Vicious Pro Elite explains its actual 14 lb / .014-inch option and distinction from standard Vicious Fluoro. Internal catalog-ID maintenance wording was removed from the flagged summaries, guidance and FAQs.

Derived gold fields, including recommendationIntro, reelcalcNote and manufacturerFacts where affected, match the owned builder. Numerical rows, IDs, source evidence and exclusions were not changed. No action remains for this finding against the final hash.

## Model-Level Results

"Pass" means source identity, retained numbers, exact package scope, model-specific wording, recommendations and actual product-family photo were reviewed. It does not certify physical diameter, stock, fishing performance or page behavior. Full retained row values, source URLs, evidence files and per-model commentary are in JSON.

| Model | Rows | Result / Distinguishing Evidence |
|---|---:|---|
| Ande Premium Monofilament | 8 | Pass. Original Clear PC-18/PC-14; all 16 retained weight-spool variants match chart and live metadata. Conflicting 8 lb two-pound spool is excluded. |
| Ande Tournament Monofilament | 6 | Pass; E-005 resolved. Yellow TY includes actual 16 lb, not 15 lb. The 30 lb 1/8-pound conflict is excluded; only its verified 450 yd option remains. |
| Ande Fluorocarbon Leader | 6 | Pass. Original FC-25W/FC-50W, not 2.0. Nine exact Clear variants; 10/12/15 lb only 50 yd, 20/25/30 lb 25/50 yd. Leader role and defaults valid. |
| Ande Braid | 7 | Pass; E-005 resolved. Current Graphite AB, not Blue/Web Green. All 35 exact variant combinations checked. 10/15 lb supported by current metadata; 60 lb is not relabeled 65 lb. |
| Hi-Seas Grand Slam Monofilament | 8 | Pass. Exact Clear GSM-Q SKU titles and per-strength quarter-pound yards checked. Official 25/30 lb kg values are swapped but not imported. |
| Hi-Seas Quattro Fluorocarbon | 3 | Pass only for latest 8/10/25 lb leader subset; E-003 exclusions remain mandatory. |
| Hi-Seas Braid | 6 | Pass. Green Grand Slam GSB-F300. Thin 10 lb .004 inch / .10 mm is expressly published, not a mono-equivalent substitution. |
| KastKing FluoroKote | 7 | Pass. Coated copolymer construction, not pure fluorocarbon. Exact current variants all 300 yd. Coarse 6 lb inch/mm pair requires its existing disclosure. |
| Reaction Tackle Braid | 11 | Pass. Original Moss Green four-strand, not X8/Ice/Never Fade. Every cited live variant checked; longer packages are not assumed at 6/8 lb. |
| Reaction Tackle Fluorocarbon | 8 | Pass; E-004 caption resolved. Current 100% Pure Clear explicitly supports mainline or leader. Short 50 yd variants are not assumed at 6/8 lb. |
| Reaction Tackle Monofilament | 6 | Pass. Original Clear bulk listing, not separate 350 yd filler. Individual package yards verified at every strength. |
| Reaction Tackle Ice Braid | 4 | Pass. Dedicated ICE-IC eight-strand Ice Camo, 150 yd. Ice-specific 4/.10, 6/.14, 8/.18, 10/.20 lb/mm, not standard braid dimensions. |
| Vicious Fluorocarbon | 7 | Pass. Standard FLO-family Japanese Fluoro, not Pro Elite. Each current strength endpoint and attached chart checked. |
| Vicious Pro Elite Fluorocarbon | 6 | Pass; E-005 resolved. EFLO-family chart, real 14 lb instead of legacy 15. Official level-wound claim properly attributed. |
| Vicious Braid | 7 | Pass. Standard Green, not No-Fade or Descender. The .009 to .013 inch step from 30 to 40 lb is printed on the official chart. |
| Vicious Panfish Hi-Vis Mono | 4 | Pass. Yellow Panfish nylon copolymer monofilament. Current exact bulk yardages checked; unoffered chart-only 100 yd packages excluded. |
| CAST X12 Frog & Flip Braid | 2 | Pass. Exact US Frog & Flip variants are 65 lb / .26 mm and 80 lb / .30 mm, each 150 yd. Thin claims independently confirmed, not independently measured. |
| Rhino Hide Camo Braid | 5 | Pass; E-001 saved example resolved. Ten RNB200 Green/Orange children and the actual braid photo resolve the erroneous monofilament parent heading. |
| Rhino Hide Camo Monofilament | 8 | Pass. Eight RNMF330 children at 330 yd. Source mm values at 8/25 lb and 10 lb package-label mm are kept distinct from converted mm. |

## Holds Accounted For

| Model | Review Disposition |
|---|---|
| Hi-Seas Fluorocarbon | Independently confirmed hold: all four exact title/photo pairs conflict. See E-002. |
| KastKing SuperPower Braid | Existing hold retained, not newly resolved: original endpoint unavailable in producer research; ColorShield/Silky8 cannot establish original specifications. |
| KastKing Fluorocarbon | Existing identity hold retained, not newly resolved: generic legacy name does not identify which current Kovert formula. |
| KastKing Destron Monofilament | Existing identity hold retained, not newly resolved: no established equivalence between old unqualified Destron and current Essential. |
| Vicious Monofilament | Existing identity hold retained, not newly resolved: generic legacy record cannot be silently mapped to Ultimate; Panfish/Ice/Ultimate are distinguished by the manufacturer. |

## Integration Gates And Numeric Cautions

- Keep the Hi-Seas mainline hold and Quattro exclusions. Quattro and Ande Leader require leader rendering, not Wizard mainline or full-spool recommendations.
- FluoroKote remains `Copolymer`, with coated-core wording and stable legacy IDs. Its published 6 lb .008 inch / .22 mm pair differs by .0168 mm; this fits the combined printed rounding interval of .0177 mm but materially affects precision. Keep the explicit source note rather than silently replacing either value.
- Ande Graphite's 150 m / 165 yd and 300 m / 325 yd labels are nominal package labels, not exact conversions. Keep current yard-only runtime packages; do not insert false metric conversions.
- CAST's .26/.30 mm claims and Hi-Seas Braid's .10 mm at 10 lb are genuinely published, unusually thin specifications. Do not present source confirmation as physical measurement or guaranteed packing performance.
- Rhino's 2027 launch / display-only metadata supports no retail-stock claim. Child-SKU identity and dimensions are source-verified despite the Braid parent-heading error.
- Preserve manufacturer-stated claims as such. Model-specific copy avoids promising ice-free line, guaranteed casting improvements, invisible line or automatic competition compliance.
- Main retains responsibility for integration, browser/responsive testing, runtime selector behavior and publication.

## Review Method And Snapshot

Fresh public HTTP checks approximately 14:32-14:39 UTC on 2026-09-13 covered Ande live per-variant metadata joined to product JSON, all relevant exact Hi-Seas SKU titles, Reaction and CAST product JSON, all retained Vicious strength endpoints, Rhino's embedded product data, and KastKing's exact product JSON. No main-browser manipulation was used.

Eight saved original numeric/package charts were visually inspected: three Ande, four Vicious and one KastKing. All 19 selected product photos and eight additional Hi-Seas conflict photos were inspected for actual identity and label evidence. Exact numbers and packages were compared independently, not presumed accurate because they were already in the pack. One web-text AFW extraction returned unrelated content; only the correct direct-HTTP SKU response was used.

Reviewed pack:
- Path: `research/line-pages/full-catalog/group-e/pack.json`
- `checkedAt`: `2026-09-13T14:30:30.307Z`
- Final post-fix SHA-256: `a36b2c21104b8c21b308ab3b2debd60eb4793cf6f991ad85761edd2ede8edd42`
- Original source-review SHA-256: `825b6958709a3baa98bb60af4c66e83e88ee09fe11907ae9f1a429bc379dd27b`
- Scope: 24 models; 19 source-verified models; 119 retained rows; five holds.

Group E reduced Quattro from seven to three rows during the original source review. This final signoff applies only to the final post-fix hash above. The original source-review hash is retained for traceability.

Post-fix validation passed: 2,221 pack checks, 58 focused checks, four builder syntax checks, all 33 saved examples within estimated capacity, and visible caption output from the current gold template. Full row objects, all non-product model fields, and all fields outside the explicitly authorized remediation have matching before/after hashes in `group-e/review-postfix.json`.

Only the authorized Group E pack, owned builder sources, status/validation/audit files were changed during remediation. This finalization updates only the two independent-review files. No shared data, shared scripts, published pages, release manifests, browser actions, commits or publication changes were made. New held-model resolution research is separate from this final-pack signoff.
