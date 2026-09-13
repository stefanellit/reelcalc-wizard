# Deployed v9 Proof

**PASS.** Ordinary public HTTP verified the required hosted release against exact commit `4a8ce4a1bcd10b58e8365ff47cb76aa6a07006ba`.

- Verified at: 2026-09-13T17:47:38.780Z
- Public base: [GitHub Pages](https://stefanellit.github.io/reelcalc-wizard/)
- Reported Pages run: `34772286978`, success, supplied by main. No Actions, private API or browser was queried.
- Full bounded per-file hashes and results: `deployed-v9-proof.json`.

## Coverage

| Check | Result |
| --- | --- |
| Required deployed files | **139 / 139 passed** |
| Manifest runtime delta | 109 files |
| Additional unchanged runtime dependencies | 30 files |
| Loader-versioned URLs | **51 / 51 passed**, all equal their canonical response bytes |
| HTTP failures or missing files | **0** |
| Committed-content mismatches | **0** |
| Canonical byte-identical local/public files | 111 |
| Canonical files differing only by LF/CRLF | 28 |
| Public JSON files parsed | **10 / 10** |
| JavaScript syntax / CSS parses | **18 / 18**, **8 / 8** |
| HTML documents/fragments parsed | **89 / 89**, including embedded JSON-LD |
| New14 components / examples / images | **14 / 14 / 14**, exact committed content |
| Copy28 components / examples | **28 / 28**, exact committed/local text |
| New14 guide references to verified image assets | **All passed** |

The recorded sweep made 190 public GETs: 139 canonical file URLs and 51 actual loader-versioned URLs. An initial identical sweep also passed; 380 total GETs across two bounded sweeps. No HTTP failures required retries.

## Release and Data

[Public release metadata](https://stefanellit.github.io/reelcalc-wizard/data/line-page-release.json) is **version9, prepared114, published100**. The published list is exactly the original100 cohort; none of the new14 appear in it. Product configuration and import registry each contain114 products, and registry version is9.

The public data parses with **1,229 unique line IDs**, **1,336 unique reel IDs**, and **586 PE rows**. These are dataset row counts, not a claim that every reel is calculation-ready. Affiliate, reel-page, quality and database-release JSON also parse successfully. All data bodies match the supplied commit.

## Comparison Method

The deployment allowlist itself matches the target commit. Each public response was checked against its local file and the target commit's Git blob ID from read-only `git ls-tree`. SHA-256 body hashes are recorded per file; Git blob hashes bind those contents to the exact commit.

Text permits **only CRLF-to-LF normalization**. No trimming, HTML normalization, JSON reserialization or content substitution was accepted. The28 line-ending-only differences are recorded individually in JSON. All84 affected guide components/examples match local bytes exactly. Images match exact committed/local bytes and their expected file signatures.

Requests were unauthenticated public GitHub Pages GETs with credentials omitted. Canonical requests and versioned component/renderer/loader requests were checked. Public Last-Modified headers were September13 at17:40:58-17:40:59 UTC. Local reference files remained stable during verification.

## Boundary

This establishes hosted file availability, exact committed content and parseability, not browser rendering, interaction or native Squarespace state. Main is handling the new14 native import separately. Prepared114/published100 does not imply native114 imported or published.

Only this report and its JSON proof were written. No production files, Git index, commit, push, deployment or native import were changed.

```text
deployed-v9-proof.json SHA-256
2a518a2f1e3dca2971a30b00088ba1f0bb246ac88893ab8d8fa8edddf3b2e599
```
