# Responsive Helper Allowlist Fix

Checked: 2026-09-13T17:03:47.959Z

## Change

Updated only the explicit `ids` array in [responsive-check.html](<C:/Users/Tyler/Documents/reelcalc WIZARD/tmp/line-page-launch-candidate/previews/line-pages/responsive-check.html:2>) from 100 to the exact **114 current catalog IDs**, in catalog order. The IDs were parsed from `data/line-page-release.json` and cross-checked against all keys in `data/line-page-products.json`; both lists match exactly and contain no duplicates. All 114 hosted components exist.

Preserved the existing compact style, explicit `ids.includes(id)` guard, fixed relative loader path `../../js/line-page-loader.js`, loading/error messages, and supported widths **320, 390, 768, 1280**. No arbitrary ID, URL, path or script source is accepted as a replacement for the catalog or loader. No runtime catalog fetch or new shared helper was introduced.

The original 100 IDs are unchanged. Added:

- `sufix-invisiline-fluorocarbon`
- `sufix-calibr8`
- `spiderwire-stealth-braid`
- `stren-super-knot`
- `stren-fluorocast`
- `stren-sonic-braid`
- `p-line-cxx-x-tra-strong`
- `p-line-floroclear`
- `p-line-cx-premium`
- `p-line-tactical-fluorocarbon`
- `p-line-halo-fluorocarbon`
- `p-line-endurx-braid`
- `p-line-tcb-8-braid`
- `hi-seas-fluorocarbon`

## Verification

Executed the actual inline helper script in isolated Node VM contexts with minimal document stubs. These test the admission branch and exact loader attributes, not browser rendering.

- **2,110 cases passed:** 458 accepted, 1,652 rejected.
- All 114 IDs at all four supported widths: **456 valid matrix cases**.
- Unknown IDs, prototype-like names, case variants, traversal paths, external/protocol-relative URLs, script-like strings and missing IDs rejected.
- Invalid/missing widths, nonnumeric values, negative/zero widths and unsupported numbers rejected.
- Extra URL/source parameters cannot change the fixed loader path. Duplicate ID parameters retain the existing first-value behavior without permitting an unknown ID.
- Valid requests append exactly one script, set the requested supported width, and pass only the exact catalog product ID.
- Normalized before/after comparison confirms that only the allowlist text changed.
- Release catalog, product catalog and loader hashes stayed unchanged.
- Read-only local HTTP GET returned 200 and byte-matched the updated helper.

## Content Hashes

SHA-256 over exact file bytes:

| File | SHA-256 |
| --- | --- |
| Helper before | `86768e2311d821b12b6af170c4299bb94bdcdeb2b4af6744b8b89e4a38c81790` |
| Helper after | `59a13632bdf9457f88477d5d49b1d451d509c2dda25909e9e7f508c9e4c2c427` |
| `data/line-page-release.json` | `f757fafea7bed8b539be2a9b0ca826c9010df3b21d8c2027fe472e9c9babeb21` |
| `data/line-page-products.json` | `d1e5ac8e03427c874d3614fa437f7649942bdbe7b6eb9e10e3bcdc9de1738adc` |
| `js/line-page-loader.js` | `08c3bc5bc0b211f7315a655331ca671b387b27dc9b39f47a9db04d2872a04cdd` |

This resolves **BQA-002** from the earlier static browser-QA report for this helper version. The earlier report's helper hash is intentionally superseded by the after hash above; that report itself was not edited.

## Browser Handoff

Example: [FloroClear at 320 px](http://127.0.0.1:4183/tmp/line-page-launch-candidate/previews/line-pages/responsive-check.html?id=p-line-floroclear&width=320).

Main still owns actual browser QA at 320/390/1280, including ready state, screenshots, images, overlap and live calculator interactions. No browser was used or touched in this fix. No analytics or external requests, shared edits, commits, deployment or publishing were performed.

Only the helper and this report were changed.

