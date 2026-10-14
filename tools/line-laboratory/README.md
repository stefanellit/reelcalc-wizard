# Line Laboratory separate-source integration

Release configuration: optional measured-line selection enabled, with a daily GitHub Actions updater. The October 14, 2026 initial catalog contains 199 records. Manufacturer data and capacity formulas remain unchanged. See `OPERATIONS.md` for publication, monitoring, update holds and rollback.

User-confirmed scope: **Setup Wizard, reel-page calculators, and reel comparison only.** The homepage, product-specific line-page calculators, Compare Lines, line database and PE calculator are excluded and unchanged. Do not expand the integration to those tools without a new request.

## Architecture

ReelCalc is a static asset site used by Squarespace embeds. `data/lines.json` supplies manufacturer line choices AND reference diameters used in existing calculations. Those roles must remain separate from laboratory choices. The new records are stored in `data/line-laboratory.json`; `js/line-sources.js` validates them and adapts an explicitly selected measurement to the existing line input shape. The third/reference-catalog argument to existing calculation functions remains the original manufacturer catalog.

The shared core, homepage formulas, recommendation engine, manufacturer line/reel records, reel diameter anchors and experimental capacity-engine switch are not changed. Laboratory records are not automatic recommendations, replacement manufacturer records, or new calibration inputs.

`data/line-laboratory-release.json` must have `enabled: true` AND an approved method allowlist AND valid, active records before laboratory choices are usable. Manufacturer selection remains the default. If disabled or unavailable, an explicit laboratory link receives an unavailable message instead of a manufacturer substitute.

## Implemented surfaces

| Surface | Behavior |
| --- | --- |
| Setup Wizard | Separate source and exact-test pickers for main line and backing. Existing manufacturer selection and recommendations remain default. |
| Reel-page calculator | Source pickers for both roles, exact laboratory preloads, retained identity on unit changes, blocked unavailable selections. |
| Reel comparison | Separate source/search pickers for main line and backing; exact selections survive shared URLs and Wizard handoffs. Optional second-reel line selection respects its existing feature gate. |

All pickers display label diameter and measured diameter side by side. Calculations use the selected record's measured `AverageDiameter`, not its quoted label value, and retain the notice that spool capacity is still an estimate. The optional source is labeled "Line Laboratory - measured diameters"; a coverage note lists only materials in the loaded catalog. Attribution always links to the Line Laboratory homepage, even when a record has no test URL. Original source URLs remain preserved as provenance. Laboratory affiliate/product-guide matching is intentionally suppressed. Existing manufacturer affiliate links, ads and internal links are unchanged.

Beside those diameters, the picker reports `(measured - labeled) / labeled * 100` as larger/smaller than the label, using normalized mm values. Missing or invalid diameters suppress the comparison. Absolute gaps of 25% or more show a plain-language caution for capacity and backing estimates. This is a UI review threshold, not a validated error bound, a claim about product consistency, or a correction to the formula. The caution explicitly says the gap does not establish whether estimated yardage is high or low.

## Actual API adapter

The user supplied `https://linelaboratory.com/api/v1/braid/diameters/`. The captured response contains `Brand`, `Name`, `RatedStrength`, `QuotedDiameter`, and `AverageDiameter`. The public braid summary establishes lb and mm units. Rated strength is not tested breaking strength. The raw five fields and snapshot receipt are retained per record. Do not normalize seller-qualified brands or combine variants.

Line Laboratory also publishes mono and fluorocarbon tests, but this supplied endpoint covers braid only (199 records rechecked October 14, 2026). Do not imply those other materials are available in the selector until a verified feed or authorized import supplies them. No individual test-page discovery is required for the homepage attribution link.

This API does not supply stable IDs, test/update dates, or method versions. `prepare-api.mjs` assigns opaque ReelCalc-owned IDs once and retains them in the catalog. These are not Line Laboratory test IDs. Exact unchanged raw brand/name/strength tuples retain their IDs. Duplicate identities reject the batch. Changed measurements reject manual preparation by default; the daily updater retains those records unchanged and flags them while allowing valid new records through. Renamed entries are not guessed or merged, and missing entries are retained and flagged. `updated_at` is explicitly a local import timestamp, not a test date.

The method ID `line-laboratory-api-average` means the average supplied by this API. It does not assert an effective packing diameter, a particular historical microscopy procedure, or guaranteed improvement in capacity accuracy. Optional user choice leaves the current reel anchors and calculation formulas unchanged.

The read-only capture and local preparation commands are:

```text
node tools/line-laboratory/inspect-api.mjs --output <staging-directory-outside-site>
node tools/line-laboratory/prepare-api.mjs <saved-snapshot-directory>
node tools/line-laboratory/prepare-api.mjs <saved-snapshot-directory> --write
```

Preparation validates the saved response against its SHA-256 receipt and performs an atomic, data-only replacement. It neither fetches new data nor changes release settings. The daily workflow uses `sync-api.mjs` to capture, validate and prepare new records, then tests and publishes the checked catalog.

## Identity and links

Use a permanent record ID with namespace `line-laboratory:`. For the current API, this is the persistent local registry ID described above. Original names, rated strengths and supplied variant details are retained. No fuzzy, substring or AI product matching is used. The generic versioned importer below can accept provider IDs if they become available; it is not the current five-field API adapter. Missing rows are never interpreted as deletion.

A permanent partner ID and documented retest/correction policy would improve future sync reliability. Until then, retain the local registry and hold changes for review. Never regenerate IDs from row positions or overwrite previously selected measurements silently.

Partner inbound links use:

```text
https://www.reelcalc.com/reelcalc-wizard?lineSource=line_laboratory&line=line-laboratory%3A<stable-source-id>
```

The placeholder is a format example, not an actual test or working measurement link. Optional `reel`, `mode`, `mainYards`, `backingLine` and `backingLineSource` are retained by the embed. `ReelCalcLineSources.buildLink()` safely generates exact source-aware URLs. Laboratory links ignore any raw `rcDiameter` supplied in the URL and retrieve the stored record instead.

## Feed contract

Prefer an export from the partner's existing maintained sheet or database, not a second manually maintained dataset. JSON supports multiple measurements most cleanly. CSV can be an automatically exported spreadsheet; columns can be explicitly remapped with `columnMap`. This is a proposed contract, not a claim about an existing API.

JSON envelope: `schemaVersion: 1`, `source: "line_laboratory"`, `records: [...]`.

| Record field | Requirement |
| --- | --- |
| `source_record_id` | Permanent ASCII ID, 1-160 characters: letters, digits, period, underscore, colon or hyphen. |
| `original_name` | Partner's original display name, preserved exactly. |
| `brand`, `product` | Explicit partner fields, not parsed from names. |
| `variant` | Exact distinguishing color, coating, generation, market, sample or other variant. Partner must explicitly label standard/unspecified variants; importer will not guess. |
| `material` | `Monofilament`, `Fluorocarbon`, `Copolymer` or `Braid`. Unsupported materials are rejected for review. |
| `rated_strength` | Object: numeric positive `value`, `unit` of `lb` or `kg`, and original `label`. The package rating, never the tested breaking strength. |
| `diameters` | Array of objects with explicit `method_id`, positive numeric `value`, and `unit` of `mm` or `in`. Preserve all supplied methods. |
| `capacity_method_id` | Explicit member of the diameter array and the approved-method allowlist. No automatic selection of the first/minimum/maximum measurement. |
| `tested_breaking_strength` | Optional separate object: numeric `value`, `unit` of `lb` or `kg`. Never used as rated strength. |
| `source_url` | Optional HTTPS original test URL without credentials; omit if unavailable. No invented test URLs. |
| `tested_at` | Optional ISO UTC timestamp. |
| `updated_at` | Required monotonically increasing ISO UTC timestamp for updates. Example format: `YYYY-MM-DDTHH:mm:ssZ`. |
| `status` | `active` or `retired`. |

CSV structure, header only, with no fabricated measurements:

```csv
source_record_id,original_name,brand,product,variant,material,rated_strength_value,rated_strength_unit,rated_strength_label,diameters_json,capacity_method_id,tested_breaking_strength_value,tested_breaking_strength_unit,source_url,tested_at,updated_at,status
```

`diameters_json` contains the JSON diameter array; ordinary CSV quoting escapes its quotes. Both optional breaking-strength columns must be supplied together or left empty. Required numeric cells must contain only the number, with units in their own column. Empty required cells, ambiguous units, malformed CSV/JSON, repeated method IDs and duplicate source IDs reject the batch.

## Choosing a measurement method

Line Laboratory describes multiple diameter measurements in its [testing procedures](https://linelaboratory.com/testing-procedures/). That does not establish that any one number is a validated spool-capacity input for every material. The preview uses only the explicitly supplied average, with clear attribution and a capacity-estimate caveat. Optical diameter, PE quantities, effective packing diameter and breaking strength must not be conflated. No extra packing correction is added.

## Import and synchronization

Install the scoped dependency with `pnpm install --frozen-lockfile --ignore-scripts` in this directory. `csv-parse` is the production parser; `jsdom` is only for tests. There is no site-wide build dependency change.

Create an operator config outside public site files, using `config.example.json` as the field reference. The example is intentionally not runnable: partner authorization, reviewer, receipt/reference, private directory, feed location and approved methods are unset.

```text
node tools/line-laboratory/import.mjs --config <private-config.json> --input <partner-export.csv>
node tools/line-laboratory/import.mjs --config <private-config.json> --input <partner-export.csv> --write
```

The first command validates and reports a dry run; the second writes only validated changes to the separate laboratory data file. Without `--input`, the same importer retrieves the explicitly configured HTTPS feed. Feed hostname must be allowlisted; redirects are rejected. A bearer token, if required, is read from a named server environment variable, never browser code. For Google Sheets, prefer an authorized CSV export endpoint or a private server-side export; do not make a private sheet public solely for this integration. A future API adapter should produce the same JSON contract.

The importer validates the entire batch before writing; one invalid record keeps the entire current catalog unchanged. It prevents overlapping imports with a lock, upserts by stable ID, rejects stale/unversioned changes, retains rows omitted from a feed, and makes an atomic file replacement. Repeated identical imports do not alter the catalog. Large or failed downloads, empty feeds and invalid methods preserve the existing data.

Raw feed, before/after snapshots, SHA-256 receipts and sync logs are saved in `privateDir`, which must be outside the site checkout and excluded from deployment. Logs sanitize parser/network failures rather than exposing tokens, endpoints or raw records. Receipt history supplies provenance without embedding credentials in public data. An approved endpoint/operator receipt establishes the source of an import; software validation alone cannot authenticate that measurements genuinely came from the partner. Keep authorization and supplier verification under review.

For exceptional identity corrections, an operator approval contains `id`, `before`/`after` SHA-256 hashes of `ReelCalcLineSources.identity(record)`, `approvedBy` and `approvedAt`. Approve only after checking the partner's exact record. Normal measurement/display updates use a newer `updated_at`; no identity approval is needed if identity is unchanged.

No recurring job or deployment is enabled. Supplying the API URL does not make future records appear on ReelCalc automatically. A separately approved scheduled runner and deployment policy are still needed. Such a runner should validate new records, hold ambiguous/changed records for review, and retain the last good catalog on errors. Keep the laboratory gate separate from both sync and the experimental capacity-engine switch. Never publish private config, logs or software test fixtures as user-facing data.

## Verified match foundation

`data/line-laboratory-matches.json` is empty. A future approved mapping stores manufacturer ID, laboratory source ID, both exact identity fingerprints, status, reviewer, approval time and evidence URL. `verifiedMatch()` returns a record only for one approved, current, exact fingerprint pair. Changed manufacturer specifications or variant identity invalidate the mapping. No matching button is enabled and no cross-reference has been inferred. Product variant, package strength, material and market/generation must all be checked before creating one.

## Partner handoff checklist

1. Permission to republish measurements and link to tests; attribution and reuse terms.
2. An authentic sample export plus the simplest export/feed from the source he already maintains.
3. Stable record/test IDs and the policy for renamed products, retests, corrections and retired tests.
4. Explicit rated strength, material, variant and diameter units, separate from tested breaking strength.
5. Definitions of every measurement method and agreement on the capacity method, including historical tests and uncertainty.
6. Original test URLs and update timestamps; no fabricated substitutes for missing values.
7. Feed access method, update cadence and server-side credentials only if needed.
8. Review of the first imported batch, real-data browser tests, mobile check and deliberate activation approval.

## Validation and remaining work

Run `node tools/line-laboratory/test.mjs`. It uses clearly labeled synthetic software fixtures in memory/temporary files, not real product claims. Checks include exact 6/60 lb separation, variants, duplicate IDs, units, methods, rated versus tested strength, stable links, disabled gate, import idempotency, name updates, identity holds, stale updates, failed/empty feed preservation, sanitized logs, main/backing source controls, Wizard and reel-page behavior, comparison handoff and unchanged core/reference datasets. It also requires the homepage, line-page and line-database scripts to match their pre-integration versions.

The browser preview server is local-only: `node tools/line-laboratory/preview-server.mjs --api-preview`. This enables the authentic snapshot in memory only, not in the release file. Set `PORT=4195` for the current preview at `http://127.0.0.1:4195/__lab-review`. Its separate `--synthetic-fixtures` mode remains for software-only tests. Do not deploy this server.

Passed existing suites: homepage calculation, selected-line capacity warnings (6,810 checks), line-database handoffs (1,235 lines), line-page engine, and Wizard backing parity (3,616 scenarios plus 401 unaffected-result checks). Older manufacturer-diameter and reel-page selection tests still compare against pre-expansion reel/line counts; the resolution-scope test requires a missing historical baseline. Those three are not counted as passing. Current committed core, homepage formula, manufacturer datasets and selector are separately checked unchanged.

Authentic-data tests cover the initial 199 records and future additions, label-versus-average mapping, stable IDs, changed/duplicate/empty/missing-feed handling, Wizard search and comparison handoffs. Browser checks include actual-data reel-page calculators and reel comparison at phone width. Neither software tests nor these UI checks establish physical capacity accuracy. Automatic product matching is deliberately not part of this feature.

## Files changed by this task

- `index.html`
- `js/wizard.js`
- `js/wizard-embed-loader.js`
- `js/reel-page-calculator.js`
- `js/squarespace-reel-page-loader.js` (calculator asset version only)
- `examples/reel-comparison.js`, `examples/reel-comparison.html`, `examples/reel-comparison-loader.js`
- New `js/line-sources.js`
- New `data/line-laboratory.json`
- New `data/line-laboratory-release.json`
- New `data/line-laboratory-matches.json`
- New `tools/line-laboratory/import.mjs`
- New `tools/line-laboratory/inspect-api.mjs`, `tools/line-laboratory/prepare-api.mjs`
- New `tools/line-laboratory/test.mjs`
- New `tools/line-laboratory/preview-server.mjs`
- New `tools/line-laboratory/config.example.json`
- New `tools/line-laboratory/package.json`, `pnpm-lock.yaml`, `.gitignore`, and this `README.md`

Existing unrelated working-tree changes are excluded from this release. No calculator formula edits or manufacturer-data imports are included. Scheduled synchronization changes only `data/line-laboratory.json`; the feature is served through the existing Squarespace embeds and GitHub Pages assets.
