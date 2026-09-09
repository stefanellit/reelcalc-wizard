# Line Database Tool Links

The sitewide `js/squarespace-reel-page-loader.js` loads `js/line-database-tools.js`
only on either line database or a calculator URL with `rcSource`. Existing
Squarespace database blocks and their data stay unchanged.

## Selection and Destinations

- The action panel uses the selected visible database row. Filtering, sorting,
  Find Matches, and Clear selection continue to use the existing database UI.
- Wizard links require an unambiguous catalog match: brand, model, material,
  strength, and both displayed diameters. Reference PE entries do not acquire
  an invented strength or catalog ID. If no exact match exists, only the
  calculator action appears.
- The wizard accepts `line` (or `mainLine`) and optional `lb`, opens Choose my
  line, and preserves the line while the visitor chooses a reel. Invalid IDs
  and conflicting strengths leave the normal wizard available.
- Standard database calculator links preload only main-line material and
  diameter, not reel specifications, backing, or main-line length.
- Supported PE sizes open the existing PE calculator with working PE selected
  and unrelated default inputs cleared. A visible note distinguishes the PE
  reference estimate from the product's listed diameter. The visitor can use
  the linked diameter-based homepage calculator instead.
- Unsupported PE sizes open the homepage calculator with the database's mm
  diameter. Source notes remain visible.
- Manually changing the loaded main line removes its name label.

No calculator formulas, catalog specifications, recommendations, or affiliate
destinations are changed by this release.

## Analytics

Events: `line_database_line_selected`, `line_database_use_wizard`, and
`line_database_use_calculator`. Parameters include source database, line brand,
model, material, lb when known, diameter, PE size when known, exact catalog ID
when matched, and destination tool. Existing consent/tracking behavior applies.

## Verification

Run `node scripts/test-line-database-tools.mjs`. An optional JSON path tests an
export of the PE database as well. The release was checked against all 1,000
live catalog rows and 586 PE rows. Of those PE entries, 53 match the wizard
catalog exactly; 11 use a diameter route because their PE size is unsupported.

Browser checks covered actual wizard selection, calculator input events and
unit conversion, invalid/blank inputs, model-row picking, Clear selection,
Find Matches, shared-loader-only installation, desktop layout, and 360/390px
phone layouts. The existing homepage calculator and loader tests also passed.
