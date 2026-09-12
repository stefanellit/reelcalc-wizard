# Line Page Trust Audit

September 12, 2026. PowerPro Spectra, Seaguar InvizX, and Berkley Trilene XL. Local drafts only; nothing published, committed, or pushed.

## Verdict

The three drafts pass the calculation and browser checks described below after the fixes in this audit. They are useful specification-based guides, not measured-fill guarantees. **Do not publish the pages without also releasing the updated shared line catalog and checking the live Wizard handoffs.**

## Findings Fixed

1. **Slight overfills were falsely reassuring.** Catalog plans up to 2% above calculated capacity could be described as a full-mainline success. An amount above calculated capacity now gets an error, subject only to floating-point tolerance. The formula itself is unchanged.
2. **Small remaining volumes were skipped.** Catalog plans within 2% below capacity, and manual plans within 0.5%, could skip backing. The page now calculates the remaining volume instead of calling that a full fill. Suggested working amounts round down to a tenth of a yard so rounding cannot itself create an over-capacity plan.
3. **A tiny working length was treated as a useful fishing fill.** A one-yard working line on a normal reel could produce a green result and hundreds of advertised fills. Plans below 50 working yards now get a limited-reserve caution and no purchase CTA. This is a reminder to check casting distance, runs, and retying, not a claim that every specialty application requires 50 yards. The actual calculated amounts are unchanged.
4. **A comparison link could carry the wrong full-spool quantity.** In capacity-only mode, changing to a thicker replacement line no longer transfers the original line's full-spool amount to the Wizard. It transfers the exact reel and replacement line so capacity can be recalculated. In backing mode, the user's chosen working length is retained.
5. **Clearing a reel could leave a stale full-spool quantity.** The disabled full-spool field now clears until a valid reel or manual rating is supplied.
6. **Very close diameters were called identical.** A few converted Sunline diameters differ slightly from the rounded catalog values. Comparisons now distinguish nearly the same from exactly the same.

The fixes are in the shared line-page renderer, so they apply to all three drafts. No capacity-engine formulas, sitewide safety factors, or live recommendation rules were changed.

## Publication Dependency

Observed in the public Wizard during this audit:

- Trilene XL 17 lb still loads as **0.016 inch**, producing **79.1 yd** on the Shimano SLX A 150. The verified local catalog has **0.015 inch**, producing **90 yd** with the same engine and reel.
- An XL 2 lb link does not select that line in the live Wizard; it falls back to recommendations because the new strength is not in the live catalog.

This is a data-version mismatch, not a different line-page formula. The corrected 17 lb record and added XL strengths already exist in the local catalog. Release the shared data with the line pages, then verify the deployed assets and exact line preselection. No live changes were made during this audit.

## Calculation Checks

- All **34 offered strengths x 1,320 calculation-ready reels = 44,880 pairings** exercised in the local calculation tests.
- **472,142 assertions passed**, including repeated property checks across these pairings. This count describes automated assertions, not independently verified physical reel tests.
- Independently calculated single-rating identity, diameter-squared scaling, and remaining backing volume. A 200-yard rating returns 200 yards when the entered reference diameter matches the selected line; halving that diameter yields four times the capacity.
- Mono/fluorocarbon results checked against `rated yards x (reference diameter / selected diameter)^2`, separately from the production call.
- Tested diameter, not pound-test label, as the driver for exact-line capacity; a half-full main-line plan leaves half the calibrated backing capacity; larger line diameters reduce capacity consistently.
- Catalog and manual plans tested below, at, and just above full capacity. Retail shortages, very short working lengths, full-spool mode, nonnegative backing, and exact package remainders checked.
- Nine existing representative scenarios still pass. For example: Vanford A 2500HGA + XL 8 lb = **172.8 yd** full capacity; 100 yd of that line leaves **50.6 yd** of Big Game 10 lb backing. SLX A 150 + XL 17 lb = **90 yd** full capacity; a 50 yd working fill leaves **62.5 yd** of that backing.

Catalog braid estimates continue to use the shared calibrated braid path. Mono/fluorocarbon and backing use their existing references. Manually entered single ratings use the same diameter-squared path as a single-rating calculator setup. Identical inputs and data agree; different reference ratings can legitimately produce different estimates.

## Product and Source Checks

All 34 strength-specific spool offerings matched current manufacturer variants with assigned SKUs. All nine InvizX inch/mm pairs matched [Seaguar's official product variants](https://seaguar.com/products/invizx).

PowerPro's 14 diameter pairs matched the [Fisherman's Headquarters original PowerPro table](https://fishermansheadquarters.com/products/powerpro-original-spectra-braided-line). Strength and spool availability matched [Shimano's original PowerPro listing](https://fishshop.shimano.com/products/powerpro). The draft identifies this as original Spectra braid, not Super8Slick V2 or Maxcuatro, and identifies the diameter chart as retailer-sourced.

XL spool lengths matched Berkley's [U.S. filler](https://www.berkley-fishing.com/products/trilene-xl-filler-spool) and [bulk](https://www.berkley-fishing.com/products/trilene-xl-bulk-spool) offerings. Diameters at 6-30 lb matched the [official Australian table for the same SKUs](https://berkley-fishing.com.au/product/trilene-xl/). The 2 and 4 lb pairs match [Tackle Haven's published specifications](https://www.tacklehaven.com/berkley-trilene-xl-smooth-casting-bulk-fishing-line-clear-xl30-15-choose-your-line-weight/). Retailer values are labeled as such. The retailer's conflicting 30 lb millimeter entry is not used; the manufacturer table supplies that value.

The mono and braid capacity entries for the four example reels were rechecked against their manufacturer tables: [Vanford A](https://fish.shimano.com/en-US/product/reels/spinning/frontdrag/a075f00003slwfsqac.html), [Stradic FM](https://fish.shimano.com/en-US/product/reels/spinning/frontdrag/a075f00003slvodqas.html), [SLX A](https://fish.shimano.com/en-US/product/reels/baitcast/lowprofile/a075f00003c623mqaa.html), and [Fuego LT](https://daiwa.us/collections/spin-reels/products/23-fuego-lt). They match the local records. This does not mean their reference diameters were physically measured by ReelCalc.

Product copy separates manufacturer positioning from ReelCalc test results, explains backing versus leaders, and warns that fitting by volume is not the same as good handling. No fabricated hands-on tests, prices, or stock guarantees were added. Source-check dates were refreshed.

## Browser and Links

- **261 three-page browser checks and 84 PowerPro regression checks passed.**
- All 34 strengths and 102 example-card reel/line combinations checked for correct capacity and exact Wizard parameters.
- Manual inch/mm and yard/meter equivalence, printed diameter taking precedence, diameter-only entry, invalid values, saved URLs, switching modes, editable working lengths, and stale-result removal checked.
- Same/thinner/thicker comparisons name the selected line and reel and use the correct capacity direction.
- Labels, unique IDs, one H1, internal anchors, image loading, and FAQ structured-data agreement checked. This is not a Google rich-result eligibility guarantee.
- Overflow and control overlap checks passed at **320, 390, 768, and 1280 px**, including expanded comparison groups and warnings. Desktop and mobile screenshots were visually reviewed.
- **128 strength/spool purchase combinations** checked for Amazon domain, selected brand/strength/length, and affiliate tag. Browser checks confirm disclosure and sponsored-link attributes. These are Amazon search links, not guarantees about listings, sellers, stock, or commission attribution.
- All seven distinct internal editorial/tool destinations in the generated pages returned successful responses with relevant page titles.
- Eight of nine listed external source URLs returned HTTP 200. FishUSA denied the automated request with HTTP 403; its secondary cross-check was not relied on for this audit. The manufacturer and primary diameter source were accessible.

## Scope and Limits

This audit validates the three drafts and their interactions with the current local data. It does not independently re-source every one of the 1,320 reels or every alternative line in the wider database. Source checks cover the three featured products and four example reels.

Published diameters, rounded reference conversions, braid packing, winding tension, actual package length, and preferred fill level remain real-world uncertainties. The full-spool number is an estimate; the reel manufacturer's fill level remains the stopping point. The warnings reduce misleading assurances but cannot guarantee against overfill or underfill.

The live Squarespace embeds, final public URLs/canonicals, deployed data, and cross-tool handoffs require a final post-publication check. The public Wizard data mismatch above is a known release dependency, not a passed live consistency test.

## Evidence

- `line-page-trust-audit-2026-09-12-evidence.json`: broad independent/property calculation summary.
- `line-page-trust-audit-2026-09-12-browser.json`: detailed browser assertions.
- `line-page-trust-audit-2026-09-12-sources.json`: manufacturer variant comparisons and internal destination responses.
- Repeatable scripts: `scripts/audit-line-page-trust.mjs`, `scripts/audit-line-page-sources.mjs`, and `scripts/test-line-page-engine.mjs`.
