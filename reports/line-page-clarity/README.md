# Line Page Clarity Release

Reviewed September 13, 2026. Release 15; baseline 8436241.

## Changes

- All 110 main-line guides: explicit "My reel isn't listed" tab, with mono/braid-specific instructions for the existing manual calculator.
- Full-spool capacity is a dark, bold output on a pale green background, instead of a disabled-looking input. The editable working-line input remains available in backing mode.
- An Amazon affiliate button appears beside the selected strength and retail spool before choosing a reel. It updates with both selections and retains disclosure and click tracking.
- Plainer package/diameter wording on 87 guides, including all six Maxima pages. Historical versions, missing sizes and specification conflicts remain documented. Leader-only guides retain their separate workflow.

## Automated Checks

- `test-line-page-engine.mjs`: passed nine capacity/backing cases and template/preload checks.
- `test-line-page-clarity.mjs`: passed five output states and 1,797 affiliate line/strength/package cases, with the reelcalc-20 tag, exact strength/package queries and click tracking without a reel.
- `test-line-page-affiliate-scope.mjs`: passed package-scope and affiliate eligibility regressions.
- `test-line-page-multifill-remainder.mjs`: passed exact fill, floating-point roundoff and genuine remainder cases.
- `line-page-publishing/test.mjs`: all 120 components/snippets/schema checked; 506 CSS selectors isolated from host styling.
- `audit-line-page-clarity-scope.mjs`: all 240 example/component specification table copies unchanged. Reel and line data, shared calculation core, recommendation engine, guide map and affiliate mappings unchanged. Calculation functions within the page engine are unchanged; modifications are display/event/shopping functions only. Source URLs unchanged.

## Browser Checks

- Ultragreen manual mono rating: 200 yd at .012 in, using 10 lb Ultragreen at .012 in, returns 200 yd.
- Switching to 8 lb Ultragreen at .010 in returns 288 yd, matching squared-diameter scaling.
- Invalid zero capacity removes the previous result and disables calculation.
- 100 yd of 8 lb Ultragreen plus .012 in Big Game backing returns 131 yd backing (rounded display of 130.56 yd).
- Capacity/backing mode toggles show the correct output/input. Shopping query follows the selected strength.
- Ultragreen at 320px and 1200px frame widths; Grand X8 and InvizX at 390px: no horizontal page overflow or broken images.
- Screenshots reviewed for shopping-button wrapping and output legibility. A floated-heading overlap found during QA was fixed with explicit clearance. Final output sits below the heading.
- Hosted Ultragreen preview loaded release-15 CSS, displayed 28px dark capacity text, and had no page overflow or heading overlap.
- Braid pages recommend the braid rating when available; mono and fluorocarbon pages recommend the mono rating.

These checks validate link construction, UI behavior and regression scope. Amazon stock and exact search-result availability are not guaranteed. No live Amazon clicks were generated during testing. This release does not remeasure line diameters or physically validate every reel fill.
