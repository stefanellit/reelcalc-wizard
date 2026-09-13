# Line Page Expansion Status

The full catalog expansion is not finished. No remaining model has been silently dropped.

- Main database: 138 models, now 1,009 strength records after two source-verified additions.
- Published: ten guides, including the original PowerPro Spectra, Seaguar InvizX, and Berkley Trilene XL guides plus the seven Seaguar guides below.
- Newly published: seven Seaguar guides covering 61 strength records; public pages verified after import.
- Remaining models without a completed page: 128, including BasiX, which has conflicting manufacturer specifications.
- Additional PE-only names: 39, tracked separately until product identity, regional ratings, and diameter sources are reconciled.
- Nine leader-only models need leader-specific pages, not the full-spool main-line flow.

## Prepared Batch

Tatsu, AbrazX, Red Label, Smackdown, BRAWLR, JDM R18 Mainline, and JDM PEX8 Micro Braid.

Each has the approved layout, actual package image, model-specific guidance, diameter chart, exact selection links, and shared calculator. BRAWLR's launch status is disclosed. Smackdown uses the current Stealth Gray chart and notes that older package diameters may differ. The JDM pages preserve metric retail lengths and unusual pound-test labels.

`UPLOAD-THIS-7-new-line-guides.csv` has been imported successfully. DO NOT import it again: it is create-only and would duplicate the seven published guides. The next requested batch is ten preview-only guides for review, not the entire catalog.

Keep `publishedProducts` restricted to guides that actually exist publicly in Squarespace. Hosted assets and generated CSV files alone do not publish a page.

## Checks Completed

- 815 browser checks passed on ten prepared guides at widths of 320, 390, 768, and 1280 pixels.
- 125,400 reel/line pairings passed the shared-engine consistency audit, including independent squared-diameter and backing-volume checks.
- 219 purchase-link variants checked for affiliate tagging and selected strength/package context.
- Independent PowerShell CSV round-trip passed on all seven new hidden service-guide rows.
- Fifteen collection checks passed, including keeping the seven unpublished guides out of the directory and retaining cart/price hiding.
- Manufacturer source snapshots and the exact catalog changes are retained under `research/line-pages/`.

These checks validate calculations, interactions, and the recorded source comparison. They are not physical spool tests or proof that every underlying reel specification is correct. The seven imported pages have also passed public desktop checks for images, calculator loading, metadata, and removal of commerce controls.

The source-backed catalog changes include Tatsu 4 lb (.007 to .006 inch), Red Label 6 lb (.008 to .007 inch), and newly added 4 lb AbrazX and Red Label entries. Both current manufacturer charts and selectors support those changes. BasiX was deliberately left unchanged because its sources conflict.

## Next Work

Continue the model-by-model list in `CATALOG-PROGRESS.md`, verify missing diameters and retail lengths, write product-specific content, handle leaders separately, then run the expanded audits before inclusion in the final bulk file. Do not use generic PE estimates as claimed manufacturer diameter measurements.
