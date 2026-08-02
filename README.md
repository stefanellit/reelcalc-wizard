# ReelCalc Reel Setup Wizard

A static, data-driven reel setup wizard for ReelCalc.

## Reel-Page Generator

The reusable individual reel-page system is documented in `docs/reel-page-system.md`.

Generate the validated Sedona test page with:

~~~powershell
node scripts/generate-reel-page.mjs --reel "Shimano Sedona FJ 2500"
~~~

The generator uses the existing reel and line JSON files, stops on ambiguous or incomplete records, and writes a Squarespace block, local preview, and validation report to `generated/`.

## Automatic Reel Guide List

The fishing-line setup guide directory is rendered by `js/reel-guide-list.js` with styles from `css/reel-guide-list.css`.

The component preserves the existing live links from `data/reel-guide-legacy.json`, merges new entries from `data/reel-pages.json`, and uses the Squarespace sitemap to show registry-only pages after they are published. A directly checked page that Squarespace omits from its sitemap can use `"verifiedLive": true`. Draft registry entries therefore do not create broken guide links.

Future reel-page protocol:

1. Add the reel page to `data/reel-pages.json` as part of the normal page build.
2. Publish the Squarespace reel page at the registered path.
3. Publish the registry update to GitHub Pages.
4. The setup-guide directory adds the published page automatically.

The one-time Squarespace embed is saved at `generated/reel-guide-list-squarespace-embed.txt`.

## Files

- index.html - loader HTML and wizard layout. It only links external CSS, JavaScript, and JSON data files.
- css/wizard.css - responsive ReelCalc wizard styling.
- js/calculator-core.js - calculator math, unit conversion helpers, capacity math, and backing math.
- js/wizard.js - page behavior, filters, recommendations, manual-entry UI, and rendering.
- data/reels.json - normalized reel data generated from the provided brand master files.
- data/lines.json - normalized line data generated from the provided line master file.
- data/data-quality-report.json - inventory and data-quality notes from the provided files.
- scripts/serve-static.mjs - tiny local server helper for previewing the static app.

## Run Locally

Because the wizard loads JSON files, open it through a local server rather than double-clicking index.html.

From this folder, run one of these:

~~~bash
python -m http.server 4173
~~~

or:

~~~bash
npx serve .
~~~

Then open:

~~~text
http://127.0.0.1:4173/
~~~

## Replace Or Add Data

The wizard expects normalized arrays in:

- data/reels.json
- data/lines.json

Each reel needs these calculation fields when possible:

- brand
- model
- size_label or size_class
- capacity_yards
- rated_line_lb
- rated_line_diameter_in
- capacity_note

Each line needs:

- brand
- model
- type
- lb
- dia_in
- dia_mm when available

Do not invent missing capacity or diameter values. Leave missing calculation fields blank/null so the wizard can ask for manual entry.

## GitHub Upload Map

The live GitHub repository does not use exactly the same CSS folder layout as this local project. Upload each local file to the destination below and replace the existing file at that location.

| Local file | GitHub destination |
| --- | --- |
| `index.html` | `index.html` |
| `css/wizard.css` | `wizard.css` at the repository root |
| `js/calculator-core.js` | `js/calculator-core.js` |
| `js/recommendation-engine.js` | `js/recommendation-engine.js` |
| `js/wizard.js` | `js/wizard.js` |
| `data/reels.json` | `data/reels.json` |
| `data/lines.json` | `data/lines.json` |
| `data/reel-affiliates.json` | `data/reel-affiliates.json` |

Important: do not create a `css` folder on GitHub unless `index.html` is deliberately changed to load `css/wizard.css`. With the current live repository layout, upload local `css/wizard.css` from the repository's main page so it replaces the root-level `wizard.css`.

## Squarespace Embed Path

For Squarespace, upload these files as hosted assets:

- css/wizard.css
- js/calculator-core.js
- js/wizard.js
- data/reels.json
- data/lines.json
- data/data-quality-report.json

Then place the index.html body markup in a Code Block and update the asset paths in the loader so they point to the hosted Squarespace asset URLs.

## Calculator Math

The wizard reuses the existing ReelCalc formula:

~~~text
totalSpoolSpace = reel.capacity_yards * reel.rated_line_diameter_in^2
selectedLineCapacity = totalSpoolSpace / selectedLine.dia_in^2
~~~

Backing uses:

~~~text
mainLineSpace = desiredMainLineYards * selectedLine.dia_in^2
backingSpace = totalSpoolSpace - mainLineSpace
backingYards = backingSpace / backingLine.dia_in^2
~~~
