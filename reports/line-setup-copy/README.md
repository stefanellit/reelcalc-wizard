# Line-page practical setup copy review

Date: 2026-09-13
Baseline: 120b20a
Release: 14

## Scope

Reviewed suitability text for all 120 published line guides. Rewrote 62 suitability sections and related copy across 65 product configurations. One configuration-only best-fit change is not displayed by its current static template; 64 rendered pages changed. The exact before/after text is in changes.json.

Replaced research-oriented performance disclaimers and unnecessary color identification with practical choices: mainline versus leader use, reel handling, strength and diameter selection, working length, and backing. Retained genuine edition-specific chart scope, unresolved specification exclusions, and disclosures that these are not hands-on tests. Did not add independently tested performance claims.

## Verification

- Copy-only audit passed for all 120 product configurations.
- All 240 example/component specification tables are byte-identical to the baseline.
- Line catalogs, calculation engines, recommendation engine, and guide-link map are unchanged.
- Publishing checks passed for all 120 components, charts, anchors, images, snippets, and structured data.
- Browser review: Grand X8, Assassin FC, and SPRO Finesse Leader at a 320px frame width; Maxima Chameleon at 1200px. No horizontal page overflow or missing images in those checks. Screenshot inspection found no text overlap in the revised sections.
- Calculator smoke test: Grand X8 30 lb at .011 inch, entered braid rating 200 yd at .011 inch, returned 200 yd full-spool capacity. The preselected strength and Wizard handoff were preserved.

This is an editorial release, not a fresh physical-performance or full numeric-specification audit.

## Sources

Existing product-level source records and verified catalog scope were retained. Additional primary-source checks included:

- Daiwa Grand X8: https://daiwa.us/products/j-braid%E2%84%A2-gray-light
- Sunline Assassin FC: https://sunlineamerica.com/products/sunline-assassin-fc/
- Sunline Xplasma Asegai: https://sunlineamerica.com/products/xplasma-asegai-braided-line/

## Delivery

The live Squarespace line pages load the updated hosted components through the existing shared loader. Release manifests move from 13 to 14. No replacement snippet or product import is required for the normal rendered pages. Existing native Squarespace fallback product descriptions are not rewritten in this release.
