# Bulk-Imported Gold-Standard Line Guides

## Release Scope

PowerPro Spectra, Seaguar InvizX, and Berkley Trilene XL only. Use a single Squarespace service-product CSV, matching the existing reel-page workflow. This supersedes the previous plan of individual blog posts with Code blocks. Do not scale unreviewed families yet.

The verified catalog changes remain part of the release: XL 17 lb is 0.015 in, plus the reviewed additional XL and PowerPro strengths. The calculation core is unchanged from production f44e855. Keep unrelated Wizard tracking edits and reel affiliate corrections out of this release.

## Build

1. Edit `data/line-page-products.json` and verified records in `data/lines.json`.
2. Run `node scripts/build-line-pages.mjs`.
3. Install the locked publishing dependencies and run `node scripts/line-page-publishing/build.mjs`.
4. Run `node scripts/line-page-publishing/build-import.mjs`.
5. Run the existing calculation/trust/publishing tests and `scripts/line-page-publishing/test-import.ps1`.
6. Run `previews/line-pages/materials-audit.html?imported` and `previews/line-pages/import-loader-audit.html`, plus the existing hosted-loader audit.

The CSV has three create-only SERVICE records, unique deterministic RCL-prefixed SKUs, blank Squarespace IDs, collection `lines`, category `/line-guides`, tag `reelcalc-line-guide`, and visibility `No`. It imports real static guide text/tables, without executable scripts or fake calculator controls. The approved interactive component replaces that static description after loading.

## Runtime Contract

The already-installed `squarespace-reel-page-loader.js` routes tagged line-guide detail pages to `squarespace-line-page-loader.js`. Existing reel tags still use the original reel renderer. The line adapter reads `data/line-page-imports.json`, matches the exact slug, applies metadata, normalizes desktop/mobile duplicate descriptions to one host, and mounts the existing native line component through `line-page-loader.js`.

The final canonical paths are `/lines/p/{slug}`. The adapter removes imported Product offer schema and uses the component's guide schema. Native Squarespace SEO/social settings still require review: JavaScript metadata updates are not a substitute for server-rendered social previews. The fallback description is an import-time snapshot, not a live-synced server-rendered document.

`css/squarespace-line-page.css` changes only marked guide wrappers and marked collection cards. It removes commerce UI and expands the description to the approved guide width. `css/line-page-embed.css` remains fully scoped to `.rc-line-page`. After a successful mount, the product wrapper's duplicate title is removed and the component title becomes the single H1. Ordinary products and reel pages are not mounted as line guides.

No per-page snippets or iframe are required. Old standalone snippet files remain useful for isolated test pages, but are not part of this bulk installation. Only mount one guide per detail page; never embed full calculators across a collection listing.

## Updates and Failure Handling

The import registry and release manifest are fetched fresh. Bump `data/line-page-release.json` for component/style/renderer changes; rebuild and publish all related files together. Existing open tabs need a reload, and the stable sitewide loader can have normal browser/CDN cache delays. GitHub changes update loaded content without replacing the CSV or snippets.

Manifest/component failures retain the imported static guide with a retry control. Core/catalog failures retain the loaded chart and do not fabricate results. Optional analytics never blocks calculation. An adapter-script outage retains the static description; refresh after the asset recovers. JavaScript-disabled browsers receive the imported static HTML but cannot run the calculator or JavaScript-based product-wrapper cleanup.

Do not reimport the create-only CSV for corrections. Native product title/slug/SEO settings, collection thumbnails, visibility, and fallback text are still Squarespace-owned. For later batches, separate the cumulative hosted registry from the new-pages-only import set, using a verified published inventory before generating another CSV. Stable SKUs alone are not protection against duplicate imports with blank product IDs.

## Publishing Gate

Obtain approval for the final release, publish shared assets first, and import the three records hidden. Verify the actual saved Squarespace detail pages and collection listing, desktop/mobile, full-spool/backing/manual workflows, exact Wizard handoffs, metadata and affiliate links. Then make the three pages visible together and check sitemap/rendered Search Console output. Local wrapper simulations cannot prove how the real importer or current theme sanitizes and renders the content.

If a live regression occurs, keep the new products hidden and revert only the relevant release commits, without overwriting later unrelated work. New families require their own verified specifications, retail spool matching, product guidance, images, and calculation/layout checks.
