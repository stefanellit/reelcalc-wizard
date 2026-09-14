# Line Collection Layout

Scope: `/lines` and its category routes. Individual line guides, reel guides,
calculator logic, catalog data, product addresses, and affiliate links are unchanged.

- Matched the reel directory's three-column desktop / one-column phone cards.
- Matched the 52px / 34px heading and 16px card titles.
- Removed collection pictures, price/cart controls, and redundant category navigation.
- Added the organized-directory link in normal flow to prevent text overlap.
- Text cards no longer wait for hidden product images to fade in.

## Verification

- `node scripts/build-line-collection-preview.mjs` captures public collection HTML
  using the publishing tools' existing parse5 dependency. Generated fixtures are local
  only; third-party scripts and site headers/footers are removed. The production
  header/footer are not modified.
- Open `previews/line-pages/collection-layout-audit.html` through a local server and
  select **Run layout checks**. `browser-checks.json` records 25 passing checks:
  120 cards on root and category routes, 320/390/720/768/1280px frame viewports,
  no overlap/clipping/overflow, unchanged guide addresses, idempotent initialization,
  unrelated stores/detail routes untouched, and the reel card layout preserved.
- Desktop and phone screenshots were visually reviewed.
- `node scripts/test-line-page-engine.mjs`: passed.
- `node scripts/line-page-publishing/test.mjs`: all 120 guide components passed.

## Squarespace Status

Read-only inspection found **Enable Page** checked and **Hide Page from Search
Results** unchecked for Line Guides. Reopening the Pages panel showed both Line
Guides and reel pages with the same black label color. No availability or SEO
settings were changed.
