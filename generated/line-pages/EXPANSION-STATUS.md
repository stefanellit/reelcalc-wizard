# Line Page Expansion Status

The full catalog expansion is not finished. No remaining model has been silently dropped.

- Main database: 138 models, now 1,045 strength records after source-verified corrections and additions.
- Published: ten guides, including the original PowerPro Spectra, Seaguar InvizX, and Berkley Trilene XL guides plus the seven Seaguar guides below.
- Newly published: seven Seaguar guides covering 61 strength records; public pages verified after import.
- Prepared for review only: ten additional guides covering 114 verified strength records.
- Remaining models without a completed page: 118, including BasiX, which has conflicting manufacturer specifications. There are 128 unpublished models including the ten prepared previews.
- Additional PE-only names: 39, tracked separately until product identity, regional ratings, and diameter sources are reconciled.
- Nine leader-only models need leader-specific pages, not the full-spool main-line flow.

## Published Seven

Tatsu, AbrazX, Red Label, Smackdown, BRAWLR, JDM R18 Mainline, and JDM PEX8 Micro Braid.

Each has the approved layout, actual package image, model-specific guidance, diameter chart, exact selection links, and shared calculator. BRAWLR's launch status is disclosed. Smackdown uses the current Stealth Gray chart and notes that older package diameters may differ. The JDM pages preserve metric retail lengths and unusual pound-test labels.

`UPLOAD-THIS-7-new-line-guides.csv` has been imported successfully. DO NOT import it again: it is create-only and would duplicate the seven published guides. GitHub release commit `5ee92c7` was pushed and its deployment completed successfully. The public line-guide directory contains all ten published guides.

## Ten New Review Pages

Sunline FC Sniper, Shooter, Assassin FC, Super Natural Mono, SX1, Xplasma Asegai, Siglon PE X8, Shooter Machinegun Cast, Shooter BMS Azayaka FC, and Berkley GINCLEAR.

The review hub is `previews/line-pages/batch-two-review.html`. All ten individual previews are open in the in-app browser. These changes are local: they have NOT been imported into Squarespace or pushed to GitHub. `UPLOAD-THIS-10-new-line-guides.csv` contains only the ten new guides, initially Hidden. Wait for the user's review before publication.

Keep `publishedProducts` restricted to guides that actually exist publicly in Squarespace. Hosted assets and generated CSV files alone do not publish a page.

## Checks Completed

- 2,217 browser checks passed in each of the native and imported-page previews, covering all twenty prepared guides at widths of 320, 390, 768, and 1280 pixels. This includes numeric chart text staying inside its cells.
- 275,880 reel/line pairings passed the shared-engine consistency audit, including independent squared-diameter and backing-volume checks. The audit recorded 2,935,271 checks with no failures.
- 450 purchase-link variants checked for affiliate tagging and selected strength/package context.
- 656 batch-specific specification, package, content, and release-boundary checks passed for the ten new models and 114 strengths.
- Independent PowerShell CSV round-trip passed on all ten new hidden service-guide rows. Nine incremental-import safety checks passed; already published guides are excluded.
- Twenty component/schema checks and isolation of 493 CSS selectors passed. Existing affiliate and line-page engine tests also passed.
- Manufacturer source snapshots and the exact catalog changes are retained under `research/line-pages/`.

These checks validate calculations, interactions, and the recorded source comparison. They are not physical spool tests or proof that every underlying reel specification is correct. The seven imported pages have also passed public desktop checks for images, calculator loading, metadata, and removal of commerce controls. Details for the new batch are in `reports/line-batch-two-review-2026-09-12.md`.

The source-backed catalog changes include Tatsu 4 lb (.007 to .006 inch), Red Label 6 lb (.008 to .007 inch), and newly added 4 lb AbrazX and Red Label entries. Both current manufacturer charts and selectors support those changes. BasiX was deliberately left unchanged because its sources conflict.

## Next Work

Wait for review of the ten new previews. After approval, deploy their assets and import only the new ten, verify native metadata/images and public rendering, then update `publishedProducts`. Continue in batches from `CATALOG-PROGRESS.md`; handle leaders separately and do not use generic PE estimates as claimed manufacturer diameter measurements.
