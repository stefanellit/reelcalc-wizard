# Three Line Guides: Live Launch

Date: September 12, 2026

## Published

- https://www.reelcalc.com/lines/p/powerpro-spectra-braid-diameter-capacity-guide
- https://www.reelcalc.com/lines/p/seaguar-invizx-fluorocarbon-diameter-capacity-guide
- https://www.reelcalc.com/lines/p/berkley-trilene-xl-monofilament-diameter-capacity-guide

All three products are Public and the Line Guides collection at `/lines` is enabled. Native Squarespace SEO titles, descriptions, and listing images were saved. The starter collection heading and paragraph were replaced; the unused template inquiry form section was removed. The directory SEO title no longer says "Store 2."

The existing `/fishing-line-setup-guides` page now includes a Fishing Line Model Guides section above its reel directory, with links to all three guides and `/lines`. This section reads the shared manifest but exposes only `publishedProducts`, preventing future prepared-but-unpublished models from appearing prematurely.

## Code Release

Commit `22dfd0c` was pushed to main. GitHub Pages deployment run `34721438517` completed successfully.

- Extend line-guide styling to category routes, including `/lines/line-guides`.
- Add the published-guide links to the existing directory without replacing its reel content.
- Point imported guide breadcrumbs to `/lines`.
- When entering backing mode for the first time from capacity-only mode, recalculate a valid working amount rather than reusing rounded full-capacity display text.
- Shared calculator mathematics, reel data, and Wizard engine are unchanged.

## Tests Run

- 261 material/page checks passed on the three imported-page fixtures: capacities, backing parity, all supported strengths, manual inputs, comparisons, handoffs, metadata, and responsive layouts.
- 47 import-loader checks passed, including outage/fallback behavior, commerce removal, canonical metadata, unrelated-product isolation, and the backing-mode regression.
- 15 collection/directory checks passed, including nested category paths, published links, repeated initialization, and 320/390/768/1280-pixel layouts.
- Total: 323 passing checks. These exercise the implemented behavior; they are not physical spooling tests or a promise that every external service will remain available.

## Live Browser Checks

- Public guide pages load their product image, editorial content, diameter chart, and a single calculator without visible price/cart controls.
- Fresh public category-page visit loads the version-3 adapter and hides all checked shopping controls.
- The live directory contains all three correct guide URLs and leaves the existing reel list intact. Its section ends above the reel list with no overlap at the inspected desktop width.
- PowerPro was inspected in Squarespace's 428-pixel phone preview; the stacked calculator controls fit. Its manual-entry guidance correctly prefers braid ratings when available and permits mono as a fallback.
- InvizX manual capacity-only test: 200 yd at 0.010 in, with InvizX 10 lb at 0.010 in, returns a 200 yd full spool. Manual-entry guidance requests a mono rating for this fluorocarbon page.
- Trilene XL 8 lb on Shimano Vanford A 2500HGA: full capacity is 172.8 yd (displayed as 173). With 100 yd of main line and Big Game 10 lb backing at 0.012 in, backing is 50.6 yd. The result agrees with the displayed capacity basis and diameter-squared volume calculation.
- After deployment, switching XL from capacity-only to backing no longer produces the false over-capacity warning. User working-length preservation and URL state also pass the regression tests.
- Result links include the selected reel/line/strength/working amount for the Wizard. Amazon links retain the ReelCalc affiliate tag; no purchase or affiliate click was submitted during this check.

## Boundaries

- Existing visitor tabs may retain an older script until reloaded or their cache refreshes. A fresh visitor tab was used to verify the deployment.
- Existing sitewide advertising overlays remain; this release does not change the ad provider or its placements.
- Native Squarespace metadata and the imported static fallback are separate from rendered GitHub content. Future changes to those saved fields require a native update when relevant.
- Indexing and search click-through performance have not been established by these launch checks. No ranking or traffic increase is guaranteed.
- Later line-model batches are not published by this first-three launch. Do not repeat the create-only CSV import.

## Reel SEO Question

The current reel import manifest has 919 entries, each with an SEO title and meta description. The shared reel-page loader applies these to the rendered page. Therefore a blank native Squarespace SEO field does not mean the reel page lacks metadata.

The recommended next SEO task is a targeted Search Console review of high-impression, low-CTR pages, actual displayed titles/snippets, query intent, and position. This task did not bulk-rewrite reel metadata or verify all 919 pages in Google's index.
