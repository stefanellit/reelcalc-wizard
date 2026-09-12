import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const linesPath = path.join(root, "data", "lines.json");
const lines = JSON.parse(fs.readFileSync(linesPath, "utf8"));

const powerProSource = "https://fishshop.shimano.com/products/powerpro";
const powerProDiameterSource = "https://fishermansheadquarters.com/products/powerpro-original-spectra-braided-line";
const invizxSource = "https://seaguar.com/products/invizx";
const xlSource = "https://www.berkley-fishing.com/products/trilene-xl-filler-spool";
const xlDiameterSource = "https://berkley-fishing.com.au/product/trilene-xl/";

const powerPro = [
  [5, 0.004, 0.10, [100, 150, 300, 500, 1500, 3000]],
  [8, 0.005, 0.13, [100, 150, 300, 500, 1500, 3000]],
  [10, 0.006, 0.15, [100, 150, 300, 500, 1500, 3000]],
  [15, 0.008, 0.19, [100, 150, 300, 500, 1500, 3000]],
  [20, 0.009, 0.23, [100, 150, 300, 500, 1500, 3000]],
  [30, 0.011, 0.28, [100, 150, 300, 500, 1500, 3000]],
  [40, 0.012, 0.32, [100, 150, 300, 500, 1500, 3000]],
  [50, 0.014, 0.36, [100, 150, 300, 500, 1500, 3000]],
  [65, 0.016, 0.41, [100, 150, 300, 500, 1500, 3000]],
  [80, 0.017, 0.43, [150, 300, 500, 1500, 3000]],
  [100, 0.018, 0.46, [150, 300, 500, 1500, 3000]],
  [150, 0.022, 0.56, [300, 500, 1500, 3000]],
  [200, 0.030, 0.76, [500, 1500, 3000]],
  [250, 0.035, 0.89, [1500, 3000]]
];

const invizx = [
  [4, 0.006, 0.165, [200, 1000]],
  [6, 0.008, 0.205, [200, 600, 1000]],
  [8, 0.009, 0.235, [200, 600, 1000]],
  [10, 0.010, 0.260, [200, 600, 1000]],
  [12, 0.011, 0.285, [200, 600, 1000]],
  [15, 0.013, 0.330, [200, 600, 1000]],
  [17, 0.015, 0.370, [200, 600, 1000]],
  [20, 0.016, 0.405, [200, 600, 1000]],
  [25, 0.017, 0.435, [200, 1000]]
];

const trileneXL = [
  [2, 0.005, 0.12, [330, 3000]], [4, 0.008, 0.20, [330, 1000, 3000]],
  [6, 0.009, 0.22, [330, 1000, 3000]], [8, 0.010, 0.25, [330, 1000, 3000]],
  [10, 0.011, 0.27, [300, 1000, 3000]], [12, 0.013, 0.33, [300, 1000, 3000]],
  [14, 0.014, 0.35, [300, 1000, 3000]], [17, 0.015, 0.38, [300, 1000, 3000]],
  [20, 0.016, 0.40, [270, 1000, 3000]], [25, 0.018, 0.45, [270, 2600]],
  [30, 0.020, 0.50, [250, 2300]]
];

function upsertProductRecords(definition) {
  const existingIndexes = lines.reduce((indexes, line, index) => {
    if (line.brand === definition.brand && line.model === definition.model) indexes.push(index);
    return indexes;
  }, []);
  let insertionIndex = existingIndexes.length
    ? Math.max(...existingIndexes) + 1
    : lines.length;

  definition.rows.forEach(([lb, diaIn, diaMm, spoolSizes]) => {
    const id = `${definition.idPrefix}-${lb}`;
    let line = lines.find((item) => item.id === id);
    if (!line) {
      line = {
        id,
        brand: definition.brand,
        model: definition.model,
        type: definition.type,
        lb
      };
      lines.splice(insertionIndex, 0, line);
      insertionIndex += 1;
    }

    Object.assign(line, {
      dia_in: diaIn,
      dia_mm: diaMm,
      spool_sizes_yd: spoolSizes,
      product_source_url: definition.productSource,
      diameter_source_url: definition.diameterSource,
      source_note: definition.sourceNote,
      search_text: `${definition.brand} ${definition.model} ${definition.type} ${lb} lb`.toLowerCase()
    });
  });
}

upsertProductRecords({
  brand: "PowerPro",
  model: "Spectra",
  type: "Braid",
  idPrefix: "powerpro-spectra-braid",
  rows: powerPro,
  productSource: powerProSource,
  diameterSource: powerProDiameterSource,
  sourceNote: "Strengths, colors, construction, and spool offerings verified against Shimano North America's official PowerPro product page and current product variant feed. Diameters verified against Fisherman's Headquarters' published PowerPro Original Spectra chart; 5-80 lb values were cross-checked against FishUSA."
});

upsertProductRecords({
  brand: "Seaguar",
  model: "InvizX",
  type: "Fluorocarbon",
  idPrefix: "seaguar-invizx-fluorocarbon",
  rows: invizx,
  productSource: invizxSource,
  diameterSource: invizxSource,
  sourceNote: "Strengths, diameters, and currently offered spool lengths verified against Seaguar's official InvizX product page and product variant feed. The unavailable 25 lb / 600 yd variant was not included."
});

upsertProductRecords({
  brand: "Berkley", model: "Trilene XL", type: "Monofilament",
  idPrefix: "berkley-trilene-xl-monofilament", rows: trileneXL,
  productSource: xlSource, diameterSource: xlDiameterSource,
  sourceNote: "Checked 2026-09-11. U.S. filler and bulk lengths verified from Berkley's trilene-xl-filler-spool and trilene-xl-bulk-spool product variants. Diameters for 6-30 lb verified against Berkley Australia's matching U.S. manufacturer SKUs. Published millimeter values are independently rounded, not converted from inches. Pony packages are not included."
});
for (const lb of [2, 4]) {
  const line = lines.find(item => item.id === `berkley-trilene-xl-monofilament-${lb}`);
  line.diameter_source_url = "https://www.kitterytradingpost.com/berkley-trilene-xl-fishing-line/";
  line.source_note = "Checked 2026-09-11. U.S. filler and bulk lengths from Berkley's product variants. Inch diameter cross-checked by matching SKU at Kittery Trading Post; inch/mm pair checked against Tackle Haven's Trilene XL chart. Diameter is retailer-sourced, not a ReelCalc measurement. Pony packages are not included.";
}

fs.writeFileSync(linesPath, `${JSON.stringify(lines, null, 2)}\n`);
console.log(`Updated ${powerPro.length} PowerPro, ${invizx.length} InvizX, and ${trileneXL.length} Trilene XL records.`);
