# Contextual line-guide links

## Scope

Adds quiet, normal-flow guide links beside exact line selections in the main and PE line databases, Setup Wizard, reel-page calculators, reel comparison, and line-page backing/comparison selectors. Database-to-calculator handoffs retain a verified line identity and show its guide in the homepage or PE calculator. Manual/generic entries do not imply a product match.

Links open a separate tab, preserve the selected catalog strength, and preserve the reel where a single catalog reel is known. Affiliate controls remain unchanged. No calculation formulas or calibration policies changed.

## Matching and maintenance

- 120 published guides; 972 eligible catalog strength records.
- Only published products with exact verified catalog specifications are linked. Excluded regional rows and unresolved identities remain unlinked.
- PE matching requires an exact, unambiguous named-product/strength/diameter match; a PE number alone never selects a guide.
- `scripts/line-page-catalog.mjs` rebuilds `data/line-guide-links.json`. Publish that manifest with future catalog/page releases.
- `line_guide_click` records the line ID, strength, product ID, tool, role, and destination through the existing analytics layer. GA4 receipt is not established by local tests.

## Verification

- `test-line-guide-links.mjs`: passed all catalog matches, rejection cases, delayed-load/clear races, duplicate-link prevention, and click event checks.
- `test-line-database-tools.mjs data/pe-lines.json`: passed existing handoff checks.
- `test-hosted-line-databases.mjs`: passed both hosted databases and short snippets.
- `test-reel-comparison-parity.mjs`: passed 1,009,981 full-capacity checks, 44,112 backing checks, and associated range/handle-turn checks.
- In-app browser: desktop and 320px tool frames, selection/strength changes, clear, manual overrides, and no-backing mode. Recorded checks are in `browser-qa.json`. No horizontal overflow or out-of-parent guide links in those checks.
- An actual guide click opened the exact Daiwa J-Braid Grand X8 page with 30 lb selected.
- The legacy standalone comparison-selector browser test could not start (browser spawn EPERM); comparison behavior was checked through the supported in-app browser instead.

These tests do not imply every possible viewport or every catalog selection received a separate visual inspection. The exhaustive matching test and focused browser checks cover different risks.
