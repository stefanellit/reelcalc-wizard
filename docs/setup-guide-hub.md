# Setup Guide Hub

The `/fishing-line-setup-guides` page is enhanced by `js/setup-guide-hub.js` and
`css/setup-guide-hub.css`, loaded by `js/reel-guide-list.js`. Other directory
consumers retain the existing UI.

## Sources

- Reel entries use the existing published/legacy directory merge. Extra model
  and size metadata is display-only; `data/reels.json` is not modified.
- Line entries join `line-page-imports.json`, `line-page-products.json`, and
  `line-page-release.json`. Only published products appear.
- Reel families are grouped by exact model and category, then ordered by numeric
  size and natural model label. Generations and handedness are not merged.
- Line material and leader filters use product metadata, not guesses from names.
- Editorial topic links and featured physical-test links are maintained in
  `buildHub()`. All original destinations are retained in the regression fixture.

## Squarespace Integration

`enhanceLayout()` targets the known hub section and its original content blocks.
It does not select the outer header, footer, disclosures, ads, or new blocks.
Original text blocks are hidden only after the new directory and stylesheet
load successfully. The original directory remains available on loading failure.
The legacy line loader and a narrow sibling observer prevent duplicate line
directories during mixed-cache rollouts. The existing line-directory anchor is
preserved.

## Tests

The DOM tests use jsdom 30.1.3 as a test-only dependency. Install it locally:

```powershell
pnpm add --dir outputs/setup-guides-hub-2026-10-24/test-deps jsdom@30.1.3
node scripts/test-setup-guide-hub.mjs
node scripts/test-line-guide-links.mjs
node scripts/test-shopping-tracking.mjs
node scripts/test-wizard-navigation.mjs
```

The 2026-10-24 snapshot contains 1,257 reel guides and 121 line guides. When
publishing future guide batches, review and update the snapshot assertions
deliberately. The production directory reads the current registries each load.

Visual checks must include the actual Squarespace page, search and combined
filters, expand/collapse, 320px and 390px widths, and the test image. The local
preview script requires the saved public HTML in the dated outputs folder and
omits ads/tracking. It is not a substitute for live verification.

## Rollback

Revert the hub release commit to restore the original loader/UI. The pre-release
main archive and original live DOM/link snapshots are retained locally in
`outputs/setup-guides-hub-2026-10-24/`. No Squarespace navigation, page URL,
calculator formula, recommendation, product data, or tracking ID changes are
required by this release.
