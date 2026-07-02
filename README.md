# ReelCalc Reel Setup Wizard

A static, data-driven reel setup wizard for ReelCalc.

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
