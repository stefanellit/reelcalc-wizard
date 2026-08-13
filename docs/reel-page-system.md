# ReelCalc Reel-Page Generation System

## Audit Summary

- `data/reels.json` is the authoritative normalized reel source.
- `data/lines.json` is the authoritative normalized line source.
- `js/calculator-core.js` contains the shared capacity, backing, unit-conversion, and handle-turn calculations.
- `js/wizard.js` reads the `reel` URL parameter and resolves an exact reel ID or SKU.
- The current public wizard path is `/reelcalc-wizard`.
- Existing reel records have unique IDs. Those IDs are already used by the wizard and are treated as canonical.
- Reel-page URLs were not stored in the reel data. Verified page URLs now live in `data/reel-pages.json`.
- Reel and line affiliate behavior is centralized through `data/reel-affiliates.json` and `js/affiliate-links.js`.
- Reel pages now use one shared calculator component rather than maintaining an inline calculator copy per page.
- Reel-page templates and generation utilities live under `scripts/reel-pages/`.

## Gold-Standard Finding

The live page at `/shimano-miravel-4000` is for `MIR4000XGA`, the newer Miravel A model. The current reel database contains `MIR4000XG`, which is a different exact SKU. The generator does not merge or substitute those records. The live page remains the visual reference, but generating that exact Miravel A page is blocked until a verified `MIR4000XGA` reel record is added.

## Architecture

```text
data/reels.json + data/lines.json
             |
             v
scripts/reel-pages/lookup.mjs
             |
             v
scripts/reel-pages/recommendations.mjs
             |
             v
scripts/reel-pages/render.mjs
             |
             v
scripts/reel-pages/validate.mjs
             |
             v
generated Squarespace block + local preview + validation report
```

Shared live-page files:

- `css/reel-page.css`: Miravel-based page presentation.
- `js/reel-page-calculator.js`: one maintained calculator component.
- `js/line-selector.js`: shared line validation, filtering, sorting, and preload helpers.
- `js/affiliate-links.js`: shared Amazon search, tagging, and retail-spool sizing.
- `js/calculator-core.js`: existing shared formulas.
- `js/reel-page-runtime.js`: data-driven affiliate rendering and privacy-safe interaction analytics.
- `data/reel-affiliates.json`: centralized optional affiliate mapping.
- `data/reel-pages.json`: verified page URLs, resource URLs, and family relationships.

## Actual-Line Calculator Flow

Both `Capacity Only` and `Backing + Main Line` load their choices from `data/lines.json`. The user chooses Mono, Fluorocarbon, or Braid, then an actual brand/product and strength. A custom-line option remains available when a product is not listed.

Capacity basis is automatic:

- Mono and fluorocarbon use the reel's published mono capacity and the selected line's stored diameter.
- Braid uses a usable manufacturer-published braid rating for the selected strength. Exact ratings are preferred; nearby published ratings use the shared interpolation logic.
- Braid without a usable reel rating falls back to the mono capacity and selected diameter, is shown as a wider range, and is explicitly labeled as a fallback.
- In mixed-line setups, the main working line selects the reel calibration. The actual main and backing diameters then divide the calibrated spool space.

The result is shown before retailer links. An exact mapping in `lines` or `lineProducts` inside `data/reel-affiliates.json` wins when available. Otherwise, product-aware Amazon searches include the selected brand, model, strength, line type, and smallest common spool size that covers the calculated amount. The affiliate tag and retailer priority remain centralized, so a future retailer can replace Amazon without editing hundreds of Squarespace pages.

## Standard New Reel-Page Workflow

Every future reel page follows a database-first process:

1. Search `data/reels.json` for the exact model, generation, size, and manufacturer SKU.
2. If the exact reel is missing, research it before creating the page. Use the manufacturer's current U.S. product page or U.S. specification chart first. Use an archived manufacturer page or reputable retailer only when an official source is unavailable.
3. Add one canonical record to `data/reels.json` with a stable unique ID. Do not create a separate page-only copy of the reel specs.
4. Record only verified specifications, including published capacity, line diameter, retrieve/IPT, gear ratio, weight, drag, bearings, and supported mono/braid capacities when available. Never infer missing values from a similar reel.
5. Confirm that the reel appears in the wizard and that `/reelcalc-wizard?reel=REEL-ID` preselects the exact record.
6. Verify an exact Amazon listing for that model and size when possible. If no exact listing can be confirmed, use a tagged Amazon search for the exact brand, family, size, and SKU and label it as a search. Never substitute a nearby size or generation.
7. Add the offer under the reel's canonical ID in `data/reel-affiliates.json`. Confirm that the reel page and the preloaded wizard resolve the same preferred retailer offer. The wizard must hide the link for manual reel entries and reels without a usable mapping.
8. Generate the reel page from that same canonical record, then run the page validator and desktop/mobile browser tests.
9. If the exact identity or required capacity data cannot be verified, keep the record clearly marked as needing verification and do not publish a calculator page for it.

This makes adding a reel page an opportunity to expand the wizard safely. The page, wizard, calculator, and future updates all continue to use the same specifications and stable reel ID.

## Savings Estimate

The backing calculator shows a conservative line-cost savings range instead of a precise brand-specific claim:

- Premium line: `$0.10-$0.16` per yard
- Monofilament backing: `$0.01-$0.03` per yard

The low estimate uses the lower premium-line price and higher backing price. The high estimate uses the higher premium-line price and lower backing price. The result is rounded to whole dollars and disclosed as a typical retail estimate because actual prices vary by line, strength, spool size, retailer, and sale pricing.

## Generate a Page

From the project folder:

```powershell
node scripts/generate-reel-page.mjs --reel "Shimano Sedona FJ 2500"
```

The generator stops with `AMBIGUOUS REEL` when more than one record matches. It stops with `NEEDS DATA` when required trusted fields or a verified page URL are missing.

## Deployment Order

Before pasting a generated block into Squarespace, upload these shared files to the same GitHub Pages paths:

1. `css/reel-page.css`
2. `js/reel-page-calculator.js`
3. `js/line-selector.js`
4. `js/calculator-core.js`
5. `js/affiliate-links.js`
6. `js/reel-page-runtime.js`
7. `js/squarespace-reel-page-loader.js`
8. `data/lines.json`
9. `data/reel-affiliates.json`

The existing `data/reels.json` must remain at its current path.

Existing direct-embed reel pages and Squarespace-imported reel pages both load `js/reel-page-calculator.js`. Updating these shared files upgrades current pages automatically. The generator already emits the same shared calculator mount and script, so future pages inherit the same behavior without regenerating old page HTML.

After the shared files are live, replace the content on the registered existing Squarespace URL with the generated `*-squarespace.html` block. Do not create a second URL for an existing reel.

## Reel Affiliate Protocol

Every newly generated reel page must have a usable retailer offer under its exact canonical reel ID in `data/reel-affiliates.json`. That one registry supplies both the reel page and the wizard. Affiliate availability never changes recommendations or calculator results.

The registry is retailer-neutral:

- `retailerPriority` controls which retailer wins. It is currently `["amazon"]`.
- `retailers` stores each retailer's name, allowed domains, button labels, tracking configuration, and required disclosure.
- `reels[REEL_ID].offers[RETAILER_ID].reel` stores the URL and whether it is an `exact` product or a `search` fallback.
- A URL is rendered only when it uses HTTPS and matches an allowed domain for that retailer.
- Verified exact links are preserved. Generated Amazon searches must contain the exact reel identity and affiliate tag and must use the search-specific button label.

Run `node scripts/sync-reel-affiliates.mjs` after registering new reel pages. It migrates legacy Amazon entries, preserves verified direct links, adds clearly labeled Amazon search fallbacks for registered pages without a direct listing, and stops if any registered page remains uncovered.

To introduce a future tackle-retailer partner, add its configuration and exact per-reel offers, then place its retailer ID before `amazon` in `retailerPriority`. Both the reel pages and wizard will choose the partner where an allowed offer exists and fall back to Amazon elsewhere. Existing Squarespace page HTML does not need to be replaced.
