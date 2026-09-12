# Three Line Guides: Launch Readiness

Status: ready for publishing approval; not published. The production-derived candidate passed its local checks.

Scope: PowerPro Spectra, Seaguar InvizX, Berkley Trilene XL.

The launch now uses one three-page Squarespace service-product CSV, following the reel-page bulk workflow. The existing sitewide loader detects these new line guides and loads the approved native components. This supersedes the earlier proposal for three blog posts with separate snippets. The existing calculation core is unchanged. Unrelated local Wizard tracking and reel affiliate edits are excluded.

Completed checks: 44,880 line/reel pairings and 472,142 independent assertions, rerun against the production-derived candidate; 270 embedded calculation/behavior/layout checks including narrow blog columns; 84 additional PowerPro behavior/analytics checks; 22 loader and failure-recovery checks; 483 CSS selectors checked for host isolation; source/component/schema validation; regular and PE database validation; affiliate helper regression tests. All passed.

Candidate Wizard browser checks confirmed XL 17 lb at 0.015 in / 90 yd on the SLX A 150, XL 2 lb recognized on the Vanford A 2500HGA (691.2 yd), PowerPro 30 lb / 135 yd on the SLX, and InvizX 8 lb / 213.3 yd on the Vanford. These are calculated capacities, not recommendations for every strength/reel pairing.

The manufacturer's four current product feeds were fetched again: all 34 strength-specific retail-spool configurations matched, and seven internal destination URLs returned the expected pages. Source provenance for diameters and product wording remains in the prior trust-audit report and product configuration.

The create-only CSV is `generated/line-pages/UPLOAD-THIS-three-line-guides.csv`. Its three rows are hidden, use unique SKUs, and contain static guide text and diameter tables rather than executable scripts. The collection is `lines`, the category is `/line-guides`, and canonical addresses now use `/lines/p/{slug}`. Installation instructions are in `generated/line-pages/START-HERE.md`.

Additional bulk checks: independent PowerShell CSV parsing confirms the exact imported HTML matches the product-wrapper fixtures. The imported wrappers passed 261 calculation/behavior/layout checks and 44 routing/metadata/commerce-isolation/failure-recovery checks. The original full calculation audit was rerun with 44,880 pairings and no failures. The new packaging does not alter calculation formulas.

Publishing requires approval. Actual Squarespace importer sanitization, native SEO/social settings, collection thumbnails, saved desktop/mobile layouts, rendered indexing, and live Wizard data propagation must be checked after the approved release and hidden import. None of these pages is represented as already live or indexed. The imported fallback and Squarespace settings remain saved snapshots; GitHub updates the rendered guide, not those native fields.
