# Native14 Import Reconciliation

Result: PASS for import identity and content reconciliation. Publication remains a separate gate.

- Actual native export: `C:/Users/Tyler/Downloads/products_Sep-13_01-55-08PM.csv`, 9,194,054 bytes, SHA-256 `960772b933d1e344449f025b7c6f9dccc14dfe5740e72fa10cca1f850b54dfd5`.
- Baseline: `C:/Users/Tyler/Downloads/products_Sep-13_01-33-37PM.csv`, SHA-256 `bb710b57391973672eaa5654c2e2d56aa276173076a784eefe2aa637338932a8`.
- 1,033 actual records: all 1,019 original records preserved, plus exactly14 new native products/variants. All 34,646 original field values are unchanged, including Description, images, visibility, categories, URLs and identifiers.
- The14 native product and variant IDs come directly from the actual export. Exact SKU/title/slug/collection/type matches to the submitted CSV; no duplicate native IDs, new SKUs, collection/slugs or native image URLs.
- Submitted CSV SHA-256: `b1fbe6d4a519e256c42622d5ac9ab56d895c66e5712a8f109f4ddbf0e5fa1daa`. Main's receipt records14 Added, zero Updated. Ledger times: submitted 2026-09-13T17:44:50.207Z; completed 2026-09-13T17:46:15.055Z.
- Export snapshot: **4 Public, 10 Hidden**, as observed at 2026-09-13T17:55:09.579686+00:00. Main's later eight-Public progress is not substituted into this proof.

## Description And Image Differences

Ten descriptions are byte-exact to the submitted approved CSV. The first four Public rows (Sufix Invisiline, Sufix Calibr8, SpiderWire Stealth and Stren Super Knot) have native-editor serialization changes: outer semantic wrappers and details/summary wrappers are removed while their contents remain; class, id, ARIA labeling, fallback marker and loading attributes are stripped, and rel is present on all anchors. All14 retain identical decoded text after whitespace normalization, ordered headings, complete table data, links/anchor text and inline-image attributes.

These four descriptions are **not byte-identical**. Removed wrappers/hooks may alter standalone fallback presentation or disclosure behavior. This is not live-rendering or SEO evidence; main owns those checks.

All14 Hosted Image URLs were rehosted to unique native CDN URLs and returned HTTP200. Every decoded image has its original dimensions and uniquely matches its expected approved asset. Three PNGs have exactly identical displayed RGB pixels. The other11 pass the documented re-encoding comparison (maximum 64x64 RGB mean absolute error 1.5947 on0-255; closest wrong source error at least 45.6798). CDN raw bytes/hashes are not equal to original files, and can vary across fetches. Both fetch evidence sets and precise comparisons are retained in the JSON report.

All other new-record changes are expected server-assigned IDs, zero-price formatting, blank sale-price normalization, and the first four visibility changes. All14 are zero-price SERVICE guides in lines, /line-guides, tagged reelcalc-line-guide, with no options.

## Gate Handoff

Proof: `reports/resolution-integration/actual-import14-proof.json`.

Proof SHA-256: `6c76abd686e74ce755e858b50cd02bd462689d81aecc7cefc02e2a6a95193302`.

Read-only helper validation passed at 2026-09-13T18:05:05.711Z: `loadState()` and `planImport()`, **no apply**. The only planned write is `generated/line-pages/imported-products.json`; no public/review/version promotion is included.

Main can validate the exact proof from the candidate root:

```powershell
node reports/resolution-integration/post-import-publication.mjs import --proof=reports/resolution-integration/actual-import14-proof.json
```

The required `observedBy: main-agent` identifies main's native export/receipt observations. The provenance identifies this independent preparer. Main's ledger snapshot is hash-bound but may continue changing during publication. The CSV has no SEO title/description columns.

No browser use, native import, production-file change, stage, commit or push was performed. Full per-guide identities, field differences, description hashes and image evidence: `new14-import-reconciliation.json`.
