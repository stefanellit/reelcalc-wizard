# Hosted Gold-Standard Line Guides

## Release Scope

PowerPro Spectra, Seaguar InvizX, and Berkley Trilene XL only. Their Squarespace wrappers use small snippets; guide components, scoped styles, product configuration, catalog, affiliate helpers, and the existing shared calculation engine are served from GitHub Pages.

The launch includes verified catalog changes for these three families. In particular, Trilene XL 17 lb is 0.015 in and the supported family includes 2, 20, 25, and 30 lb. Do not release the page components without the shared catalog. The calculation core is unchanged from production commit f44e855.

## Authoring and Builds

1. Edit product-specific content and source provenance in `data/line-page-products.json`, and verified specifications in `data/lines.json`.
2. Run `node scripts/build-line-pages.mjs` for standalone guide documents.
3. Install the pinned publishing dependencies in `scripts/line-page-publishing` using its lockfile, then run `node scripts/line-page-publishing/build.mjs`.
4. Run `node scripts/test-line-page-engine.mjs`, `node scripts/audit-line-page-trust.mjs`, and `node scripts/line-page-publishing/test.mjs`.
5. Run both browser harnesses: `previews/line-pages/materials-audit.html?hosted` and `previews/line-pages/hosted-loader-audit.html`.

Generated components and styles must not be edited by hand. Rebuild them from their templates. Keep all these sources and generated files in the release repository.

## Squarespace Contract

One snippet per individual blog post, with the blog collection slug `lines`. Use excerpts on the collection listing instead of embedding several complete calculators on that listing. Keep Squarespace's post title as the page H1; the embedded article has an H2 product title. Squarespace owns each page's slug, SEO title, description, social image, publication state and canonical URL. The snippet does not change those settings.

These are native article elements, not iframes. Their content is fetched with JavaScript; JavaScript-disabled visitors get a link to the standalone guide, whose chart and editorial text are static HTML. After publication, inspect the rendered live URL in Search Console before scaling. Do not promise indexing or rich-result eligibility from a successful local test.

## Caching and Updates

The loader fetches `data/line-page-release.json` fresh and versions guide components, CSS and JS. Bump its version for component/style/renderer changes. Rebuild the static charts whenever a supported product's specifications change, and release the charts, configuration and catalog together. Other catalog additions are read on the next visit without replacing the snippet. Existing open tabs need a reload. The loader's own stable URL remains subject to normal browser/CDN caching.

Published catalog updates also reach the Wizard, databases, reel pages and comparison pages through their existing `data/lines.json` requests. Their current caches may delay an update; confirm the live Wizard actually shows the new XL strength and diameter before announcing the guides.

## Resilience and Isolation

Every generated CSS selector is scoped to `.rc-line-page`. Rem sizes are normalized during generation, and container queries handle narrow content columns inside wide desktop viewports. The loader supports late insertion and idempotent mounting. Request failures have bounded timeouts and retry controls; a catalog failure does not substitute sample results. Analytics is optional and cannot block the calculator.

## Deployment and Rollback

Prepare a release based on the verified current main commit. Publish new line-page files plus the reviewed shared catalog and the backward-compatible explicit-retail-spool affiliate helper. Do not copy unrelated local Wizard tracking edits or reel affiliate corrections into this release. Review the final Git diff and obtain publishing approval.

After publication, verify hosted files, each real Squarespace page, all three line-to-Wizard handoffs, and XL 17 lb on SLX A 150 (90 yd full capacity). Then add public internal links. If the release fails, revert the release commit and temporarily leave the three Squarespace posts in draft. Never overwrite unrelated later commits while rolling back.

## Scaling Gate

Do not generate the rest of the catalog yet. First pass live Squarespace desktop/mobile checks, confirm the exact Wizard handoffs, and inspect rendered crawlable content. Each future family needs its own source-backed specifications, correctly matched retail spools, product-specific guidance and image, compatible-material manual entry, and the same calculation and layout tests. A passing template is not verification of another product's specifications.
