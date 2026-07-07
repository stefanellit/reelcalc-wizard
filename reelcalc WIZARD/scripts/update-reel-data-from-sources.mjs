import fs from "node:fs";
import path from "node:path";

const workspace = process.cwd();
const appReelsPath = path.join(workspace, "data", "reels.json");
const reportPath = path.join(workspace, "data", "data-quality-report.json");
const kastKingMasterPath = "C:\\Users\\Tyler\\Documents\\Creelcalc-wizard\\kastking_reel_database_master.json";
const shimanoMasterPath = "C:\\Users\\Tyler\\Documents\\Creelcalc-wizard\\shimano_reel_database_master.json";

const KASTKING_SOURCE = "Official KastKing product spec table";
const SHIMANO_SOURCE = "Official Shimano Singapore spec chart";
const METER_TO_YARD = 1.0936132983;
const KG_TO_LB = 2.2046226218;
const GRAM_TO_OZ = 0.03527396195;
const CM_TO_IN = 0.3937007874;

const monoDiameterTable = new Map([
  [2, 0.006],
  [4, 0.008],
  [6, 0.0095],
  [8, 0.011],
  [10, 0.012],
  [12, 0.014],
  [15, 0.015],
  [20, 0.018],
  [25, 0.019],
  [30, 0.022],
]);

const shimanoProducts = [
  {
    model: "Vanquish",
    url: "https://fish.shimano.com/en-SG/product/reels/spinning/a075f00003slvm7qac.html",
  },
  {
    model: "Vanquish CE",
    url: "https://fish.shimano.com/en-SG/product/reels/spinning/a07f900004dgfhriar.html",
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function round(value, places = 3) {
  return Number(Number(value).toFixed(places));
}

function diameterForMonoLb(lb) {
  const numeric = Number(lb);
  if (monoDiameterTable.has(numeric)) return monoDiameterTable.get(numeric);

  const known = [...monoDiameterTable.keys()].sort((a, b) => a - b);
  const lower = known.filter((value) => value < numeric).pop();
  const upper = known.find((value) => value > numeric);
  if (lower && upper) {
    const lowerDia = monoDiameterTable.get(lower);
    const upperDia = monoDiameterTable.get(upper);
    const ratio = (numeric - lower) / (upper - lower);
    return round(lowerDia + (upperDia - lowerDia) * ratio, 6);
  }

  return numeric < known[0] ? monoDiameterTable.get(known[0]) : monoDiameterTable.get(known.at(-1));
}

function parseLbYdCapacity(value) {
  if (!value || value === "-") return [];
  return String(value)
    .split(",")
    .map((piece) => piece.trim())
    .map((piece) => {
      const match = piece.match(/^(\d+(?:\.\d+)?)\s*[/-]\s*(\d+(?:\.\d+)?)$/);
      if (!match) return null;
      return {
        lb: Number(match[1]),
        yards: Math.round(Number(match[2])),
        raw: `${Number(match[1])}-${Math.round(Number(match[2]))}`,
      };
    })
    .filter(Boolean);
}

function parseLbMeterCapacity(value) {
  if (!value || value === "-") return [];
  return String(value)
    .split(",")
    .map((piece) => piece.trim())
    .map((piece) => {
      const match = piece.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
      if (!match) return null;
      const meters = Number(match[2]);
      const yards = Math.round(meters * METER_TO_YARD);
      return {
        lb: Number(match[1]),
        yards,
        raw: `${Number(match[1])}-${meters}m`,
      };
    })
    .filter(Boolean);
}

function normalizeCapacityNote(options) {
  return options.map((option) => `${option.lb}-${option.yards}`).join(", ");
}

function capacityOptions(options) {
  return options.map((option) => {
    const diameter = diameterForMonoLb(option.lb);
    return {
      lb: option.lb,
      yards: option.yards,
      diameter_in: diameter,
      spool_space: round(option.yards * diameter * diameter, 6),
      raw: option.raw,
    };
  });
}

function applyCapacityToAppReel(reel, options, source) {
  const parsedOptions = capacityOptions(options);
  const rated = parsedOptions.at(-1);

  reel.capacity_yards = rated.yards;
  reel.rated_line_lb = rated.lb;
  reel.rated_line_diameter_in = rated.diameter_in;
  reel.spool_space = rated.spool_space;
  reel.capacity_options = parsedOptions;
  reel.capacity_note = normalizeCapacityNote(options);
  reel.capacity_status = "ready";
  reel.capacity_data_source = source;
  reel.data_warnings = [];
}

function setSearchText(reel) {
  reel.search_text = [
    reel.brand,
    reel.model,
    reel.sku,
    reel.size_label,
    reel.size_class,
    reel.reelcalc_use_case,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function sizeClassFromLabel(label) {
  const digits = String(label || "").match(/\d+/)?.[0] || "";
  if (!digits) return "";
  if (digits.length <= 2) return digits;
  return digits;
}

function recommendations(sizeClass) {
  const size = Number(sizeClass);
  if (size <= 1000) {
    return {
      braid: "4-8 lb braid",
      mono: "2-6 lb mono/fluoro",
      use: "ultralight trout, panfish, finesse freshwater",
    };
  }
  if (size <= 2500) {
    return {
      braid: "6-15 lb braid",
      mono: "4-8 lb mono/fluoro",
      use: "trout, panfish, finesse bass, light freshwater",
    };
  }
  if (size <= 3000) {
    return {
      braid: "10-20 lb braid",
      mono: "6-12 lb mono/fluoro",
      use: "bass, walleye, light inshore, general freshwater",
    };
  }
  return {
    braid: "15-40 lb braid",
    mono: "8-14 lb mono/fluoro",
    use: "inshore, heavier freshwater, light surf",
  };
}

function cleanNumber(value, places = 1) {
  const rounded = round(value, places);
  return String(rounded).replace(/\.0$/, "");
}

function warningRows() {
  return [
    "Missing mono capacity; manual entry required for calculations.",
    "Source/spec should be verified before public use.",
  ];
}

async function fetchKastKingSpecs() {
  const productFeed = await fetch("https://kastking.com/products.json?limit=250").then((response) => response.json());
  const products = productFeed.products || [];
  const cache = new Map();

  async function specsForHandle(handle) {
    if (cache.has(handle)) return cache.get(handle);
    const product = products.find((item) => item.handle === handle);
    if (!product) {
      cache.set(handle, []);
      return [];
    }

    const api = await fetch(`https://kast.vip/api/publicApi/productid/${product.id}`).then((response) => response.json());
    const rows = (api.data || []).map((item) => {
      const customData = JSON.parse(item.custom_data || "[]");
      const spec = Object.fromEntries(customData.map((entry) => [entry.key, entry.value]));
      return {
        sku: item.sku,
        size: String(spec.Size || "").trim(),
        gearRatio: spec["Gear Ratio"] || "",
        mono: spec["Mono Line Capacity (LBS/YDS)"] || "",
        braid: spec["Braid Line Capacity (LBS/YDS)"] || "",
        maxDrag: spec["Max Drag (LBS)"] || "",
        weight: spec["Weight (OZ)"] || "",
        lineRetrieve: spec.IPT || "",
        bearings: spec.BB || "",
      };
    });

    cache.set(handle, rows);
    return rows;
  }

  return specsForHandle;
}

function handleFromSourceUrl(sourceUrl) {
  const marker = "/products/";
  const index = String(sourceUrl || "").indexOf(marker);
  if (index < 0) return "";
  return String(sourceUrl).slice(index + marker.length).split(/[?#/]/)[0];
}

async function updateKastKing(appReels, masterRows) {
  const specsForHandle = await fetchKastKingSpecs();
  let updated = 0;

  for (const reel of appReels.filter((item) => item.brand === "KastKing")) {
    const handle = handleFromSourceUrl(reel.source_url);
    if (!handle) continue;

    const specs = await specsForHandle(handle);
    const spec = specs.find((row) => row.size === String(reel.size_label));
    const monoOptions = parseLbYdCapacity(spec?.mono);
    if (!spec || monoOptions.length === 0) continue;

    applyCapacityToAppReel(reel, monoOptions, KASTKING_SOURCE);
    reel.sku = spec.sku || reel.sku;
    reel.braid_capacity_note = normalizeCapacityNote(parseLbYdCapacity(spec.braid));
    reel.gear_ratio = spec.gearRatio || reel.gear_ratio;
    reel.max_drag_lb = Number(spec.maxDrag) || reel.max_drag_lb;
    reel.weight_oz = Number(spec.weight) || reel.weight_oz;
    reel.line_retrieve_in = Number(spec.lineRetrieve) || reel.line_retrieve_in;
    reel.bearings = spec.bearings || reel.bearings;
    reel.notes = "";
    setSearchText(reel);
    updated += 1;

    const master = masterRows.find(
      (row) =>
        row.brand === "KastKing" &&
        row.model === reel.model &&
        String(row.size_label) === String(reel.size_label) &&
        row.source_url === reel.source_url,
    );
    if (master) {
      master.sku = spec.sku || master.sku;
      master.gear_ratio = spec.gearRatio || master.gear_ratio;
      master.max_drag_lb = String(spec.maxDrag || master.max_drag_lb);
      master.weight_oz = String(spec.weight || master.weight_oz);
      master.mono_capacity_lb_yd = normalizeCapacityNote(monoOptions);
      master.braid_capacity_lb_yd = normalizeCapacityNote(parseLbYdCapacity(spec.braid));
      master.line_retrieve_in = String(spec.lineRetrieve || master.line_retrieve_in);
      master.bearings = spec.bearings || master.bearings;
      master.spec_status = "official_current";
      master.notes = "";
    }
  }

  return updated;
}

function parseShimanoTable(html) {
  const tableIndex = html.toLowerCase().indexOf("sku number");
  if (tableIndex < 0) return [];
  const tableStart = html.lastIndexOf("<table", tableIndex);
  const tableEnd = html.indexOf("</table>", tableIndex) + "</table>".length;
  const table = html.slice(tableStart, tableEnd);
  const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
  const cells = rows.map((row) =>
    [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((match) => stripHtml(match[1])),
  );
  const headers = cells.shift() || [];
  return cells.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

async function fetchShimanoRows() {
  const rows = [];
  for (const product of shimanoProducts) {
    const html = await fetch(product.url, { headers: { "user-agent": "Mozilla/5.0" } }).then((response) => response.text());
    for (const row of parseShimanoTable(html)) {
      rows.push({ model: product.model, sourceUrl: product.url, ...row });
    }
  }
  return rows;
}

function appRowFromShimano(row, idNumber) {
  const sku = row["SKU NUMBER"];
  const sizeClass = sizeClassFromLabel(sku);
  const recs = recommendations(sizeClass);
  const monoRaw = row["NYLON MONO (LB-M)"];
  const monoOptions = parseLbMeterCapacity(monoRaw);
  const braidNote = row["POWER PRO (LB-YD)"] && row["POWER PRO (LB-YD)"] !== "-"
    ? row["POWER PRO (LB-YD)"].replace(/\s*-\s*/g, "-")
    : row["PE BRAIDED (NO.-M)"]
      ? `PE ${row["PE BRAIDED (NO.-M)"]}`
      : "";

  const reel = {
    id: `shimano-${slug(row.model)}-${slug(sku)}-${idNumber}`,
    brand: "Shimano",
    model: row.model,
    sku,
    size_label: sku,
    size_class: sizeClass,
    reel_type: "front_drag_freshwater",
    capacity_yards: null,
    rated_line_lb: null,
    rated_line_diameter_in: null,
    spool_space: null,
    capacity_options: [],
    capacity_note: "",
    braid_capacity_note: braidNote,
    capacity_status: "manual_required",
    capacity_data_source: "official_current_partial",
    source_url: row.sourceUrl,
    source_file: "shimano_reel_database_master.json",
    data_warnings: warningRows(),
    gear_ratio: row["GEAR RATIO"] || "",
    max_drag_lb: row["MAXIMUM DRAG FORCE(KG)"] ? round(Number(row["MAXIMUM DRAG FORCE(KG)"]) * KG_TO_LB, 1) : null,
    weight_oz: row["WEIGHT (G)"] ? round(Number(row["WEIGHT (G)"]) * GRAM_TO_OZ, 1) : null,
    line_retrieve_in: row["LINE RETRIEVE / CRANK (CM)"] ? round(Number(row["LINE RETRIEVE / CRANK (CM)"]) * CM_TO_IN, 1) : null,
    bearings: row.BEARINGS || "",
    msrp_usd: null,
    reelcalc_recommended_braid: recs.braid,
    reelcalc_recommended_mono_fluoro: recs.mono,
    reelcalc_use_case: recs.use,
    notes: "",
    search_text: "",
  };

  if (monoOptions.length > 0) {
    applyCapacityToAppReel(reel, monoOptions, SHIMANO_SOURCE);
    reel.notes = "Mono yards converted from Shimano lb-m regional spec.";
  } else {
    reel.notes = "Official Shimano regional page does not list mono lb-yd capacity for this size.";
  }

  setSearchText(reel);
  return reel;
}

function masterRowFromShimano(row) {
  const sku = row["SKU NUMBER"];
  const sizeClass = sizeClassFromLabel(sku);
  const recs = recommendations(sizeClass);
  const monoOptions = parseLbMeterCapacity(row["NYLON MONO (LB-M)"]);
  const powerPro = row["POWER PRO (LB-YD)"] && row["POWER PRO (LB-YD)"] !== "-"
    ? row["POWER PRO (LB-YD)"].replace(/\s*-\s*/g, "-")
    : "";

  return {
    brand: "Shimano",
    model: row.model,
    sku,
    size_label: sku,
    size_class: sizeClass,
    reel_type: "front_drag_freshwater",
    gear_ratio: row["GEAR RATIO"] || "",
    max_drag_lb: row["MAXIMUM DRAG FORCE(KG)"] ? cleanNumber(Number(row["MAXIMUM DRAG FORCE(KG)"]) * KG_TO_LB) : "",
    weight_oz: row["WEIGHT (G)"] ? cleanNumber(Number(row["WEIGHT (G)"]) * GRAM_TO_OZ) : "",
    mono_capacity_lb_yd: normalizeCapacityNote(monoOptions),
    powerpro_capacity_lb_yd: powerPro,
    line_retrieve_in: row["LINE RETRIEVE / CRANK (CM)"] ? cleanNumber(Number(row["LINE RETRIEVE / CRANK (CM)"]) * CM_TO_IN) : "",
    bearings: row.BEARINGS || "",
    msrp_usd: "",
    reelcalc_recommended_braid: recs.braid,
    reelcalc_recommended_mono_fluoro: recs.mono,
    reelcalc_use_case: recs.use,
    capacity_data_source: monoOptions.length > 0 ? SHIMANO_SOURCE : "official_current_partial",
    source_url: row.sourceUrl,
    notes: monoOptions.length > 0
      ? "Mono yards converted from Shimano lb-m regional spec."
      : "Official Shimano regional page lists nylon no.-m and/or braid capacity, but no mono lb-yd capacity; manual entry still required for calculator use.",
  };
}

async function addShimanoVanquish(appReels, shimanoMaster) {
  const sourceRows = await fetchShimanoRows();
  const maxId = Math.max(
    ...appReels.map((reel) => Number(String(reel.id || "").match(/-(\d+)$/)?.[1] || 0)),
    0,
  );
  let nextId = maxId + 1;
  let addedApp = 0;
  let addedMaster = 0;

  for (const row of sourceRows) {
    const existsInApp = appReels.some(
      (reel) => reel.brand === "Shimano" && reel.model === row.model && reel.sku === row["SKU NUMBER"],
    );
    if (!existsInApp) {
      appReels.push(appRowFromShimano(row, nextId));
      nextId += 1;
      addedApp += 1;
    }

    const existsInMaster = shimanoMaster.some(
      (reel) => reel.brand === "Shimano" && reel.model === row.model && reel.sku === row["SKU NUMBER"],
    );
    if (!existsInMaster) {
      shimanoMaster.push(masterRowFromShimano(row));
      addedMaster += 1;
    }
  }

  return { addedApp, addedMaster };
}

function updateQualityReport(report, appReels) {
  report.generated_at = new Date().toISOString();
  report.reel_data.total_rows = appReels.length;
  report.reel_data.missing_mono_capacity = appReels.filter((reel) => !Number(reel.capacity_yards)).length;
  report.reel_data.source_or_spec_needs_verification = appReels.filter((reel) =>
    String(reel.capacity_data_source || "").includes("partial") ||
    String(reel.capacity_data_source || "").includes("needs") ||
    (reel.data_warnings || []).length > 0,
  ).length;

  for (const item of report.inventory || []) {
    if (item.file === "shimano_reel_database_master.json") {
      item.count = appReels.filter((reel) => reel.source_file === item.file).length;
    }
    if (item.file === "kastking_reel_database_master.json") {
      item.count = appReels.filter((reel) => reel.source_file === item.file).length;
    }
  }
}

const appReels = readJson(appReelsPath);
const report = readJson(reportPath);
const kastKingMaster = readJson(kastKingMasterPath);
const shimanoMaster = readJson(shimanoMasterPath);

const kastKingUpdated = await updateKastKing(appReels, kastKingMaster);
const shimanoAdded = await addShimanoVanquish(appReels, shimanoMaster);
updateQualityReport(report, appReels);

writeJson(appReelsPath, appReels);
writeJson(reportPath, report);
writeJson(kastKingMasterPath, kastKingMaster);
writeJson(shimanoMasterPath, shimanoMaster);

console.log(JSON.stringify({
  kastKingUpdated,
  shimanoVanquishAddedToApp: shimanoAdded.addedApp,
  shimanoVanquishAddedToMaster: shimanoAdded.addedMaster,
  totalAppReels: appReels.length,
  missingMonoCapacity: report.reel_data.missing_mono_capacity,
}, null, 2));
