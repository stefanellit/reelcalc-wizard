# Post-Import And Publication Gates

Prepared only. No promotion, staged-file edit, packaging regeneration, Git action, browser action or native operation is performed by preparing these files. This is a separate follow-up to the frozen248-file delivery. Do not add these helpers to that staged batch implicitly.

Helper: `post-import-publication.mjs`. Tests: `test-post-import-publication.mjs`. Both live only in this directory and use built-in Node APIs. The helper reads the existing final gate, signed packs, reviewed configs, release, registry and imported ledger. Its exact14 allowlist comes from the signed integration handoff, not from every prepared registry entry.

## Two Distinct Events

1. **Import reconciliation:** only after the exact14 create-only import actually completes, record its observed native IDs. `import --proof=...` validates without changing shared files. Adding `--apply` changes only `generated/line-pages/imported-products.json`, appending the exact14 IDs and an `importBatches` proof/native-ID binding. Original100 order, historical provenance and all existing ledger fields remain intact. This step does not modify release, reviews, registry or catalog outputs; during this interval, the imported ledger is the authority for import completion.
2. **Publication reconciliation:** only after every one of those14 is natively Public and independently checked live, run `publish --proof=... --version=<new version>`. Adding `--apply` updates only new14 review records, appends their IDs to `publishedProducts`, sets release and registry root version to the explicit new version, and runs the existing catalog-progress generator. It preserves all114 prepared product identities, all registry page objects and original100 review records, including native28 work. It never changes source/config/numeric data or submits an import.

Missing, incomplete, duplicate, conflicting, stale or partial proof fails closed. A prepared registry count, submitted/processing dialog, bulk success count without per-guide observations, or local browser test is not import/live evidence. There is no generic "publish all114" operation. Partial14 ledger states are held for explicit reconciliation, not silently completed.

## Import Proof

Supply a JSON file inside repository `reports/`. Do not populate observations from the local registry: it is used only for cross-checking what main actually observed. Required envelope:

```json
{
  "schemaVersion": 1,
  "kind": "resolution14-import",
  "site": "https://www.reelcalc.com",
  "observedBy": "main-agent",
  "observedAt": "ACTUAL_ISO_TIMESTAMP",
  "submission": {
    "status": "complete",
    "file": "generated/line-pages/UPLOAD-THIS-14-new-line-guides.csv",
    "sha256": "b1fbe6d4a519e256c42622d5ac9ab56d895c66e5712a8f109f4ddbf0e5fa1daa",
    "createdCount": 14,
    "updatedCount": 0,
    "failedCount": 0,
    "submittedAt": "ACTUAL_ISO_TIMESTAMP",
    "completedAt": "ACTUAL_ISO_TIMESTAMP"
  },
  "pages": {}
}
```

`pages` must contain exactly the14 handoff IDs, each with `verified: true`, observed `nativeProductId`, `nativeVariantId`, `sku`, `slug`, `url`, `title`, `productType: "SERVICE"`, `productPage: "lines"`, and observed `visibility` (`Hidden` or `Public`). Native IDs must be nonblank and unique across these14. The main UI/export is the source of native IDs; never derive them from a ReelCalc ID or SKU. The initial Hidden import is valid and does not imply publication. Retain supporting UI/export proof separately; this helper signs the supplied proof file's exact bytes with SHA-256, not a cryptographic attestation of the observation.

The27 Updated native-copy operation is a different batch and fails this gate's14 Created / zero Updated check. Example envelope placeholders are intentionally invalid; no actual proof file is generated here.

## Live Proof

Use the same per-ID page-map format as the original80 publication ledger, plus native identity and source bindings. Required top-level fields:

- `schemaVersion: 1`, `kind: "resolution14-publication"`, `site`, `observedBy`, `observedAt`, and `pages` as above.
- `importProofSha256`: exact hash recorded by the completed import step; `pendingLiveId: null` must be explicit.
- `deployment`: `verified: true`, actual40-character deployed commit, the currently deployed prepared `releaseVersion` (for example `"9"`), `assetBase: "https://stefanellit.github.io/reelcalc-wizard/"`, and `assetHashes` for exact deployed `data/lines.json`, `data/line-page-products.json`, and `js/line-page-engine.js`. These must match the files whose reviewed configs are being promoted. Do not infer deployment from local file existence.

Every page repeats the import proof's exact native IDs/SKU/slug/title/URL/type/page, with `visibility: "Public"`, `nativeSeoSaved: true`, `liveVerified: true`, actual `savedAt`, and `productHash` matching the reviewed product object's SHA-256 (`JSON.stringify(product)` bytes). Its `live` object requires exact `url`, `canonical`, SEO `title`, SEO `description`, `headings` containing the expected H1, empty `broken`, `cartVisible: false`, no `overflow` (false or0), and `root` containing the exact `productId`, `linePageReady: "true"`, and deployed `assetBase`. Save time must be after import completion and not after observation time.

No native28 completion claim is made or altered by this helper. Its independent export reconciliation remains separate.

## Commands And Safeguards

Run from the authoritative candidate root. These are examples for main's later authorized use, not commands executed during preparation:

```powershell
node reports/resolution-integration/test-post-import-publication.mjs
node reports/resolution-integration/post-import-publication.mjs import --proof=reports/resolution-integration/ACTUAL-import14-proof.json
# Only after the proof check passes and main authorizes the ledger write:
node reports/resolution-integration/post-import-publication.mjs import --proof=reports/resolution-integration/ACTUAL-import14-proof.json --apply

node reports/resolution-integration/post-import-publication.mjs publish --proof=reports/resolution-integration/ACTUAL-live14-proof.json --version=10
# Choose an explicit version greater than the then-current release, not necessarily10:
node reports/resolution-integration/post-import-publication.mjs publish --proof=reports/resolution-integration/ACTUAL-live14-proof.json --version=10 --apply
```

A successful check writes only a separate `post-import-<proofhash>-check.json` or `post-publish-<proofhash>-check.json`. Application uses a distinct `-applied.json` journal with before/after file hashes. It checks concurrent changes before writing and uses atomic per-file replacement. Multi-file publication is not a filesystem-wide transaction: if a write/generator fails, inspect the partial-application journal and current files before any retry. No automatic rollback or replay is attempted. An identical already-recorded proof is a no-op; a different proof or a partial state requires explicit review. Version selection prevents accidental repeat increments.

After successful import reconciliation, published remains100 while imported becomes114. After successful exact14 live reconciliation, imported and published are114 and the existing generator updates `catalog-progress.json` and `CATALOG-PROGRESS.md`. Main then runs publishing tests, prepares a new promotion-specific file list, reviews/stages/commits/pushes explicitly, and verifies the live114 directory. Neither helper regenerates the earlier deployment package or stages anything.
