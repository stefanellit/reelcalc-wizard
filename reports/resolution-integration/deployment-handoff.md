# Selective Deployment Handoff

Scope: additional14, separate copy cleanup on28 original guides, and necessary display/handoff runtime changes. This is a local file delivery plan, not approval to deploy or import. After the user's explicit authorization and per-entry validation, local publication metadata now includes original100 only. No browser, Git index, commit, push or native product was changed in this packaging pass.

## File Selection

Use `deployment-files.json` as the exact allowlist. `deliveryPaths` is the complete proposed repository delivery; `runtimePaths` is the 109-file web runtime delta. Every included file except the self-referential manifest has an exact SHA-256, byte count, Git status and category. The generator and verifier print the manifest's own SHA-256. Paths are relative to the authoritative candidate repository.

Runtime delta: seven JavaScript files, four data files, 42 standalone guides, 42 hosted components, and14 images. Copy28 and new14 are enumerated separately in `cohorts`; no original20 product content is changed. Existing unchanged loaders, CSS, templates, numerical engines and dependency manifests are already tracked prerequisites, not new files to add.

The list includes all seven P-Line images even though they existed before the integration snapshot and were missing from `changed-files.json`. They are still untracked required assets. `examples/reel-comparison.js` is tracked and modified; its null integration-before hash means the old snapshot omitted that path, not that it is a new file.

The repository delivery also includes the regenerated previews/snippets, build/import safety changes, explicit pack-discovery helpers, imported100 ledger, current review metadata, all six frozen original pack JSONs, four signed resolution pack JSONs, their exact review JSONs, and compact integration/copy evidence. The ten pack JSONs are required by explicit source discovery. Raw source responses are not required by page generation and are excluded.

No blanket `git add`, wildcard pack discovery, or directory-wide inclusion. Unspecified untracked historical research, huge PDFs, raw HTML/JSON responses, unused images, baseline snapshots, old CSVs and other agents' work are excluded. Main's responsive helper change is explicitly included with its bounded helper-fix report. Large browser-QA output remains local; its checksum and incomplete-browser-gate status are recorded in the manifest.

`localOnlyChangedFiles` explains each excluded integration artifact or historical replay script. Keep these locally; exclusion does not mean delete. The native28 packet and draft14 CSV are operational artifacts, not public deployment files. Main may retain them in a private release archive.

Final refresh: the approved `UPLOAD-THIS-14-new-line-guides.csv` is now explicitly listed as a non-runtime native-import artifact, with its exact14 inventory and the preserved original80 inventory. Both viewport helpers, the affiliate-scope regression test, complete main browser proofs, full-catalog calculation audit and applied final gate are included. Native28 export/CSV/pilot work stays outside this deployment allowlist; it has separate ownership and incomplete verification.

## Current Gates

- Current local state is prepared114 / imported100 / published100, release version9, after validated main-owned live proof for original80 plus stable original20. The historical integration reports retain their truthful earlier published20 checkpoint. A registry of114 is not evidence that114 were imported or published.
- RINT-01 in the historical independent review has a signed local remediation in `rint-01-remediation.json`. The engine now separates plain retailer-query identity from visible scope labels, and offer query metadata matches its URL. The remediation's exact runtime/test hashes are verified by the packaging generator; its focused regression passed again during this packaging pass. Main retains final acceptance. The original review and integration manifests are preserved, not rewritten to conceal the earlier failure.
- Main-owned evidence now passes14 exact-rating checks,28 copy checks and126 true iframe viewport/hosted-widget checks at320/390/1280. Current product hashes match every proof. The earlier other-reviewer browser-unavailable report is historical, not the final gate. Both final viewport helpers are included. The825-strength full-catalog audit reports1,089,000 pairings and11,483,423 checks with zero failures.
- Original source packs remain byte-unchanged. Original100 were proven unchanged before the copy overlay. Reversing only the53 approved string substitutions reproduces all100 pre-overlay product hashes. SEO, images, numbers, IDs, exclusions and source qualifications are preserved.

The seven runtime files retain `source_scope_label` across the database, shared selector, Wizard, reel-page calculator, comparison tool and line pages. Grouping and exact row IDs remain plain identity; the numerical engine is unchanged. Source examples retain their original line/reel pairs. In gold capacity mode, cards use the selected strength, so two source pairs sharing one reel would render identical cards; only those rendered reel cards are deduplicated. Working/backing-plan mode retains both source pairs. Stealth's50/65 lb pair is the regression fixture.

## Compact Reproduction

`deployment-source-summary.json` contains the exact14 model identities,42 integrated rows including complete SKU/unit evidence, source URLs, historical/package qualifications, exclusions, image hashes and selected editorial qualifications. Full signed pack JSONs remain the authoritative configs and rows. The summary is a mechanical index, not a replacement independent source review. Re-fetching a URL cannot reproduce a historical response unless its bytes also match the archived evidence.

Build and metadata tests do not need raw research. Full sourceFiles preflight, original-source visual reinspection and historical staging replay still need the retained local evidence archive. Do not run full-pack preflight/staging/reconciliation or phase-one finalizers as a publication promotion step: published models and the already-applied copy overlay intentionally violate some historical preconditions.

From the candidate root, verify the selected delivery:

```powershell
node reports/resolution-integration/verify-deployment-files.mjs
node scripts/test-line-resolution-scopes.mjs --baseline=reports/resolution-integration/deployment-scope-baseline.json
node scripts/line-page-publishing/test.mjs
node scripts/line-page-publishing/test-import-selection.mjs
node scripts/test-line-page-engine.mjs
node scripts/test-line-leader-pages.mjs
node scripts/test-line-database-tools.mjs
node scripts/test-hosted-line-databases.mjs
node scripts/test-line-page-affiliate-scope.mjs
node scripts/test-line-page-seaguar-specs.mjs
```

The scope test now accepts only an optional `--baseline=` file; its test behavior and default historical baseline remain unchanged. `deployment-scope-baseline.json` carries only the four protected numerical dependency hashes, avoiding the large snapshot. The scope test refreshes its own timestamped JSON, so rerun the packaging generator after tests to refresh hashes. Existing unrelated selector-count and Wizard backing-parity failures are documented in `tests.json`; they were reproduced against baseline and are not claimed fixed.

Only when regenerating artifacts, use exact IDs from the summary. These commands generate local files, not native products:

```powershell
$scope = Get-Content -Raw reports/resolution-integration/deployment-source-summary.json | ConvertFrom-Json
$new = @($scope.newProductIds)
$copy = @($scope.copy28ProductIds)
$affected = @($new + $copy)
foreach ($id in $affected) { node scripts/build-line-pages.mjs $id }
node scripts/line-page-publishing/build.mjs "--ids=$($affected -join ',')"
node scripts/line-page-publishing/build-import.mjs "--refresh-previews=$($copy -join ',')"
node scripts/audit-line-page-trust.mjs "--ids=$($new -join ',')"
```

Use the tracked publishing package's pinned `parse5`/`postcss` dependencies. No new dependencies are required. A draft14 rebuild is optional while these14 remain unimported: `build-import.mjs --draft --ids=<exact14>` creates only a separate DRAFT file, but also regenerates registry/inventory metadata. Do not run it to promote a directory. Production `build-import.mjs --ids=<exact14>` requires each page's `browserAudit: true` and exact status `audited-awaiting-bulk-release`. It excludes all imported100 independently of publishedProducts, produces14 hidden create-only rows, and replaces the regular import inventory; preserve the original80 operational inventory before using that production step. Run `test-import.ps1 -InventoryFile generated/line-pages/resolution-import-inventory.json` for a draft, or the regular inventory for the approved production file.

To refresh the allowlist after approved changes and tests, without staging anything:

```powershell
$status = @(git -c core.quotepath=false status --porcelain=v1 --untracked-files=all)
$tracked = @(git ls-files)
$head = git rev-parse HEAD
@{status=$status; tracked=$tracked; head=$head} | ConvertTo-Json -Depth 4 | node reports/resolution-integration/prepare-deployment-files.mjs
node reports/resolution-integration/verify-deployment-files.mjs
```

The generator verifies frozen packs and accepted products before creating reports. It records drift against the immutable integration manifest instead of rewriting that old evidence. Each report is written to a same-directory temporary file and atomically renamed, avoiding empty/partial JSON reads. It writes only deployment reports/compact indexes, never source packs, runtime files or release metadata. Run the verifier only after the generator completes so all referenced hashes represent one completed pass.

## Final Browser Gate

The new bounded `finalize-reviewed-candidates.mjs` has now passed and been applied once. It validated the main-owned `actual-browser-checks.json`, `actual-copy-browser-checks.json`, `actual-viewport-checks.json` and `final-full-catalog-trust.json`, exact signed source/review hashes,42 rows,14 images,84 reviewed HTML artifacts,53 overlay fields and protected numerical hashes. No browser access or source/product-object edits were performed by this helper.

Required browser records:14 unique exact-rating rows with current product hashes;28 unique copy rows proving each changed field's old/new presence and correct leader/calculator role;126 unique viewport rows covering all42 at320/390/1280. Each viewport row needs `id`, `expectedWidth`, observed `viewportWidth` (or `innerWidth`/`actualViewportWidth`), current `productHash`, `ready`, `badText: false`, empty `broken`/`overflows`, and `pass: true`. A requested or container width is not accepted as the observed browser width. Failed or missing records leave flags and import files untouched.

The applied gate sets `browserAudit: true` on42, keeps copy28 published, and marks new14 `audited-awaiting-bulk-release`. The existing builder created exactly14 hidden SERVICE rows with blank native IDs, excluding all original100. `test-import.ps1` passed its independent parser, identity and static-description checks. The original80 inventory was preserved byte-for-byte in `original80-import-inventory-preserved.json`; the original80 CSV, imported100 ledger, published100 list, product configs and numerical rows remain unchanged. No native import or new14 publication occurred. Use `verify-deployment-files.mjs` for final rechecks; do not rerun the applied helper or overwrite its applied report with a check-only run.

Actual import file SHA-256: `b1fbe6d4a519e256c42622d5ac9ab56d895c66e5712a8f109f4ddbf0e5fa1daa`. This matches the earlier draft payload because the reviewed HTML is unchanged; the new filename and passing final gate identify the approved operational artifact. Main still owns verification, staging/push, deployment checks and the one-time native import.

## Publication Transitions

No existing staging/build generator updates `publishedProducts`. `stage-full-line-pages.mjs` explicitly preserves it; publishing build scripts also do not promote it. `js/squarespace-line-page-loader.js` fetches release and registry without cache and filters directory entries using `publishedProducts`. There is no separate static line-directory generator.

The original100 transition is applied locally. The first reconciliation stopped at77 stored live proofs; main then saved the missing in-memory captures. The refreshed ledger passed all80 records with no pending ID. `original100-publication-validation.json` preserves the exact proof hash,80 entry checks, stable original20, and before/after shared-file hashes. Imported100 remains byte-unchanged. Version9 is the undeployed local cache key, newer than deployed8. Review status now records100 live and14 browser-approved candidates; copy28 is locally browser-approved but not claimed fully refreshed natively. Both catalog progress outputs are in the allowlist. Do not rerun this completed promotion or overwrite its applied audit with a dry-run report.

1. After main confirms every original80 native page is publicly saved and live, set `data/line-page-release.json.publishedProducts` to the exact original100 IDs in the immutable cohort. Preserve `products` at114. Do not copy all114 prepared IDs into the published list. Select a fresh release version relative to the current on-disk/deployed version; do not blindly overwrite a concurrent version change.
2. Run `node scripts/line-page-catalog.mjs`, then publishing tests. The catalog command updates only `generated/line-pages/catalog-progress.json` and `CATALOG-PROGRESS.md`; it does not publish. Its legacy `leaderOnly` warning predates the current `role: leader` renderer, so do not treat that warning alone as a new numeric failure. Add those two freshly regenerated metadata files to the next promotion-specific file list. Main verifies the deployed directory has100 entries.
3. After final browser signoff and deployment, import only the new14 hidden rows once. Record their IDs in the imported ledger only after actual import completion and reconciliation. Keep `publishedProducts` at100 while native settings and live checks are unfinished. Do not add new14 to the imported ledger merely because their registry entries exist.
4. Only after all14 native pages are truly public and live, append the exact14 verified IDs to `publishedProducts` for114 and advance the version again. Run the catalog generator and publishing checks; main checks the directory at114. Partial live completion permits only those proven live IDs, never an assumed batch count.

Each promotion changes at least release metadata and generated catalog-progress outputs; import completion also changes the imported ledger. Sync only registry root version if needed, preserving its page objects. A release version is the hosted loader's cache key, so runtime/copy deployment needs a fresh version even when the public directory count does not change. These future changes require a refreshed deployment manifest and main's final review; this report does not make them.

## Native Copy28 Refresh

Deploying the updated hosted components updates enhanced guide copy, but it does not replace the descriptions already stored in Squarespace. `--refresh-previews` creates updated local native HTML and `original80-copy-cleanup-native-content.json`; it does not upload, generate existing-ID updates or change the import ledger. The packet has no Squarespace-native product/variant IDs. `RCL...` is a SKU, not a native product ID.

Two bounded options are appropriate: replace each existing product's description using that packet, or transform a fresh same-site product export into an existing-ID bulk edit. Squarespace supports exporting, editing and reimporting products for updates. Preserve its native product/variant IDs and noneditable fields; required CSV values must remain populated. Do not assume a sparse Description-only file preserves omitted fields. [Squarespace CSV import and bulk-edit guidance](https://support.squarespace.com/hc/en-us/articles/115000378108-Importing-products-from-a-csv).

The create-only builder does not implement existing-ID updates. Separate main-owned tools and exports now exist under `reports/resolution-integration/native-copy-refresh/`. The user reports the Daiwa J-Braid X4 pilot updated the existing ID successfully with native SEO/images unchanged, then submitted the remaining27 once after the1019-record preservation check. That update is still processing; native28 is not marked complete here. These native-update files are deliberately excluded from the deployment allowlist. Main also reports inspected mobile-calculation, desktop-Sufix and leader screenshots; those three local audit images need not ship. Guards for the separate native workflow remain:

- Read CSV with a real parser. Match exactly28 products by registry slug plus exact SKU, with title/collection/type cross-checks; reject missing, duplicate or ambiguous matches and unexpected variant structure.
- Copy all exported headers and non-Description field values unchanged, including existing product/variant IDs, visibility, URLs, titles, prices, stock, tags and hosted-image URLs. Retain full product/variant row structure; never derive native IDs or blank unchanged cells.
- Change only the Description value on the appropriate product row using the packet HTML. Exclude the new14 and every other product. Preserve SEO and images; validate parsed before/after non-Description cells for exact equality.
- Write a separate update artifact and audit with export SHA, target IDs, description before/after hashes and unchanged-field checks. Use an independent CSV round trip and a reviewed single-product pilot before the batch. Reconcile a fresh export with current native state immediately before applying, so stale exported visibility/settings cannot undo main's work.
- Main owns the eventual supported import dialog and can disable inventory updates when offered. This operation edits existing IDs; it is not resubmission of either create-only guide CSV.

Never upload the original80 create-only CSV to refresh copy: its IDs are blank and visibility is Hidden, so it is the wrong artifact. The draft14 is likewise unrelated to native28 updates. No export was fetched and no browser was accessed in this pass.
