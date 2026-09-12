# Bulk Upload the Three Line Guides

This replaces the earlier instructions to create three blog posts and paste snippets.

## Before Importing

1. Have Codex publish the reviewed GitHub release first. The existing sitewide reel-page loader now recognizes line guides too. Do not install a second copy of that loader. Nothing has been pushed or imported yet.
2. In Squarespace **Pages**, create a **Store** page named **Line Guides**, under **Not Linked**. Set its URL slug to **lines**. This is the same product-import method used for the reel pages; shared code makes the detail pages look like guides instead of a shop.
3. If `/lines` already belongs to a blog or another page, stop and tell Codex. Do not delete an existing page or change its address without checking links first.
4. In that store's product categories, add **Line Guides** with category slug **line-guides**. The CSV category is `/line-guides`. The collection and category must exist before importing.

## One Upload

5. Open **Products & Services > Products > Import**. Choose the CSV upload option.
6. Upload **UPLOAD-THIS-three-line-guides.csv** from this folder. It contains exactly three pages: PowerPro Spectra, Seaguar InvizX, and Berkley Trilene XL. Each page includes all its supported strengths, not a separate product variant for each lb test.
7. Confirm that all **3 imported** and **0 failed**. They import as **Hidden** on purpose. Do not re-upload the entire file if only some rows fail; send Codex the error details so a failed-rows-only file can be prepared without duplicating successful pages.
8. Leave them hidden and tell Codex **"the three line pages are imported."** We will check the actual Squarespace pages before making them visible together. Not Linked by itself does not make a page private.

There is **no individual Code block to paste**. Ignore the older per-page snippet files for this bulk workflow. Future guide content, calculator behavior, charts, and data updates come from GitHub. The CSV creates the Squarespace pages once; it is not the update mechanism.

## Expected Addresses

- `https://www.reelcalc.com/lines/p/powerpro-spectra-braid-diameter-capacity-guide`
- `https://www.reelcalc.com/lines/p/seaguar-invizx-fluorocarbon-diameter-capacity-guide`
- `https://www.reelcalc.com/lines/p/berkley-trilene-xl-monofilament-diameter-capacity-guide`

The `/p/` is normal for Squarespace product pages. Do not use the earlier proposed blog URLs without `/p/`.

## Final Squarespace Checks

- Correct guide, photo, title, diameter chart, and exactly one calculator at phone and desktop widths. No price, product gallery, Add to Cart, or duplicate mobile content.
- Backing and full-spool modes, manual reel entry, comparisons, Amazon links, and exact line/reel Wizard handoffs work. XL 17 lb shows 0.015 in and 90 yd full capacity on the SLX A 150 6.3 RH.
- Confirm native Squarespace SEO/social settings before publication. The import does not have dedicated SEO columns; the shared loader updates rendered metadata, but social crawlers may only read the original page HTML. Desired settings are in `launch-settings.json`.
- The imported HTML contains readable product guidance and diameter tables even if the interactive component cannot load. It is an import-time fallback snapshot; later GitHub edits update the rendered guide, not that saved fallback or native Squarespace settings.
- Check the actual collection listing for shopping controls and thumbnails before linking it publicly. The CSV intentionally imports no Squarespace gallery images, matching the reel-page method; the guide loads its own product photo.
- Once visible, verify public URLs and sitemap, and inspect the rendered pages in Search Console. Passing local tests does not guarantee indexing.

## Later Batches

Each additional family still needs verified data and product-specific content. Future CSVs must contain **new pages only**, while the shared registry retains all published pages. Do not reimport this create-only file as an update: it has blank Squarespace product IDs, and repeated imports may create duplicates.

Squarespace's official [CSV import instructions](https://support.squarespace.com/hc/en-us/articles/115000378108-Importing-products-from-a-csv) describe supported product types, required collection/category matches, hidden visibility, and the one-time nature of imports.
