# Hosted Line Databases

## One-time Squarespace replacement

1. Open the Line Database page in Squarespace and edit its existing database Code block.
2. Replace the entire old database code inside that block with `generated/line-database-squarespace-snippet.html`.
3. Use HTML mode with Display Source turned off. Save the block and page.
4. Repeat on the PE Line Database page with `generated/pe-line-database-squarespace-snippet.html`.
5. Check each saved public page outside the editor. Search, select a line, and try its calculator/wizard actions.

Keep the existing URL, surrounding page text, SEO settings, and sitewide code injection. Do not add a second database block alongside the old one. The old large blocks can be retained outside Squarespace as rollback copies.

## Future updates

- The regular database reads `data/lines.json`, the same catalog used by the wizard and line selectors.
- The PE database reads `data/pe-lines.json`. Its separate PE sizes, labeled/estimated diameters, missing strengths, and notes are preserved. Adding a regular line does not invent a PE version of it.
- Add verified records to the appropriate catalog, validate and publish to GitHub Pages. On the next page load, the small snippet reads the published catalog. No replacement Squarespace code is needed.
- New records need stable unique IDs. Never change an existing ID just to change its display name: saved links depend on IDs.
- UI changes live in `components/`, `css/`, and `js/`. Increment `data/line-database-release.json` for a template/style/renderer change. Catalog-only changes do not need that version bump.
- The common loader URL remains stable. After a change to the loader itself, normal browser/CDN caching may delay its appearance; already-open pages must be reloaded.
- Publishing is deliberate, not automatic research: new specifications still need verification and release review.

## Behavior and dependencies

Both snippets use `js/line-database-loader.js`. It loads public catalogs without credentials, preserves a blank initial selection, and shows a Retry button when required assets fail. A data-load failure does not silently substitute stale or sample records. Analytics is optional and does not block the database.

The calculator and wizard actions use `js/line-database-tools.js`. Only exact catalog matches receive wizard links. PE sizes unsupported by the PE calculator retain the diameter-based homepage route. This migration does not change calculator formulas, reel specifications, or the regular line catalog.

Previews: `examples/line-database.html` and `examples/pe-line-database.html` use exactly the same loader as Squarespace. They are marked noindex.

## Release checks

Run:

```sh
node scripts/test-hosted-line-databases.mjs
node scripts/test-line-database-tools.mjs data/pe-lines.json
```

Browser checks: both database counts; blank selection; search/filter/sort/reset; comparison matches; exact wizard and calculator destinations; no duplicate action panels; narrow mobile layout; blocked asset Retry; catalog-only addition visible without a snippet change. Do not publish synthetic QA records.
