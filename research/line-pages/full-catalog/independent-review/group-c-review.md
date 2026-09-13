# Independent Group C Review

## Findings

**No outstanding findings. P3 clarification GC-01 resolved:** Stren Original's chart note, caption and row evidence now explicitly restrict the **25 lb / 250 yd and 30 lb / 220 yd fillers to Clear/Blue Fluorescent**. Clear is blank at those strengths in the primary 2016 grid. All numeric values, strengths, diameters, lengths and IDs are unchanged.

Evidence: [original manufacturer chart](https://storage.westernbass.com/brochures/2016_stren/page3/index.html), printed page 2 / archive page 3. The source image was visually checked, including enlarged availability columns and length footnotes. This is a scope clarification, not a reason to hold the otherwise verified numeric union.

## Decisions

| Model ID | Independent Decision | Verified Scope |
| --- | --- | --- |
| spiderwire-ultracast-braid | Pass, single-label scope only | 8 lb Inshore Camo, .0035 in / .09 mm, 164 yd / 150 m |
| spiderwire-ultracast-ultimate-mono | Pass, historical scope only | 2018 US Clear, eight rows, no 2020 merge |
| stren-original | Pass, clarification applied | 2016 US filler, ten rows; high-strength color exception above |
| stren-high-impact | Pass, historical scope only | 2016 US Clear quarter-pound, six rows |
| stren-magnathin | Pass, historical scope only | 2016 US Clear filler, eight rows |
| stren-crappie-mono | Pass, historical scope only | 2016 US Clear/Hi-Vis Gold filler, five rows |

All 38 numeric rows match the visually inspected primary charts or label. All 37 inch-to-mm conversions are exact. Ultracast's independently printed .0035 in / .09 mm pair agrees within rounding. Six defaults, 12 example line/reel/package selections, six original image hashes and 21 source-file hashes passed independent static checks. Post-fix validation also passed all 12 examples through the shared calculation engine and rendered each historical caption through the shared gold template.

## Historical Captions

The following `product.chartCaption` values are applied to the five historical configs and regenerated pack. Each was verified in the rendered caption, with no generic "Retail stock varies" wording. Main's optional shared-template support was used without editing the template:

- **Stren Original:** 2016 US Original filler specifications. Clear and Clear/Blue Fluorescent at the listed 4-20 lb strengths; Clear/Blue Fluorescent only at 25/30 lb. Historical packages, not current availability.
- **Stren High Impact:** 2016 US High Impact Clear quarter-pound specifications. Historical package lengths, not current availability.
- **Stren MagnaThin:** 2016 US MagnaThin Clear filler specifications. Historical package lengths, not current availability; service spools are outside this chart.
- **Stren Crappie Mono:** 2016 US Crappie Mono Clear and Hi-Vis Gold filler specifications. Historical 200-yard packages, not current availability.
- **Ultimate Mono:** 2018 US Ultimate Mono Clear filler specifications. Historical package lengths, not current availability; later catalog editions are not combined.

## Evidence Checks

- **Ultracast Braid:** Independently opened the [current US page](https://www.spiderwire.com/products/ultracast-braid-filler-spool) and followed its image link to the exact saved Inshore Camo artwork. The label, not the selector alone, establishes the combination. Test is 8 lb; 22 lb is maximum break. All six legacy strengths are excluded. Copy discloses the 2019 artwork filename, limits the chart to one row, explains the unusually large capacity estimates and makes no stock claim.
- **Ultimate Mono:** Independently checked the bottom mono panel of the [2018 primary catalog page](https://storage.westernbass.com/brochures/2018_spiderwire/page4/index.html). The .012-inch 12 lb and .014-inch 15 lb rows really appear there. The active image is the correct green/silver Ultimate Mono package, not neighboring Fluoro-Braid. The later saved source identifies itself as 2020 despite its `2021_spiderwire` directory name; no later numeric rows are merged.
- **Stren Original:** Filler footnotes correctly reduce length to 300/250/220 yd at 20/25/30 lb. The purple family artwork is genuine. Pony/economy/service offerings were not imported into the numeric rows. The color clarification above is applied.
- **High Impact:** The Clear quarter-pound chart supports 1275/1000/860/650/490/400 yd at 10/12/15/20/25/30 lb. No 17 lb row is manufactured. Multiple image colors are expressly separated from the Clear-only numeric scope.
- **MagnaThin:** The chart genuinely uses 16 lb, not 14 lb, and 30 lb has the 300-yard exception. The image is a same-family service spool, with that non-default format disclosed in alt text, guidance and FAQ.
- **Crappie Mono:** Both color columns support all five 2-10 lb rows at 200 yd. The yellow package/spool and lifestyle inset are genuine same-edition artwork. No Original dimensions or inferred strength additions were used.

The five archived configs prominently identify year and US market in summary/chart text and disclaim present availability, unchanged formulation or package continuity. Their copy is useful: exact package limits, appropriate strength selection, family distinctions and working reserve are covered, while performance descriptions remain attributed claims rather than purported tests.

## Scope and Limitations

Signed-off post-fix pack SHA256: `cf0a9e30951af9976f33009703ac57308017ee1861847100a02e139e08e80a29`.

The [JSON review](<C:/Users/Tyler/Documents/reelcalc WIZARD/tmp/line-page-launch-candidate/research/line-pages/full-catalog/independent-review/group-c-review.json>) records full post-fix model and product hashes for all six models, their serialization methods and the pre-fix pack hash. Numeric rows, images, defaults, IDs, the single-row Ultracast Braid entry and all 13 held models are unchanged.

Stren archive web-tool requests returned cache misses; the saved original catalog images/HTML and hashes were reviewed locally. No fresh Stren fetch is claimed. Current SpiderWire and the 2018 catalog page were independently opened successfully. Historical manufacturer-authored catalogs remain primary material even though WesternBass preserves them.

Authorized remediation changed five Group C product inputs, Original's `archive-ready.json` context, the regenerated `pack.json`, scoped `validate-pack.mjs` caption checks and `validation.json`, plus the two independent review files. No shared-data/template, P-Line or XT edits; no browser use, commits or publishing. Main owns responsive rendering, interactive integration and final acceptance. Group C is now signed off and will remain unchanged while its 13 holds are investigated separately in `group-c-resolutions`.
