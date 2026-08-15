import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reelsPath = path.join(rootDir, "data", "reels.json");
const reels = JSON.parse(fs.readFileSync(reelsPath, "utf8"));
const byId = new Map(reels.map((reel) => [reel.id, reel]));
const checkedDate = "2026-08-15";

const sources = {
  lewsKvdCatalog: "https://www.lews.com/contentassets/2666016ab56e4b5483bec74eb26b0aca/lews_2023_fnl.pdf",
  lewsKvdEliteCurrent: "https://www.lews.com/en/shop/reels/kvdes",
  lewsKvdElite2026: "https://core-prod.lews.com/globalassets/media---lews/resources/2026_lews_mach_newproducts.pdf",
  formulaManual: "https://assets.basspro.com/image/upload/v1660148766/PDFs/productmanual/productmanual_Bass_Pro_Shops_Formula_Spinning_Reel.pdf",
  seaLionManual: "https://assets.basspro.com/image/upload/v1659716639/PDFs/productmanual/productmanual_Offshore_Angler_Sea_Lion_Spinning_Reel.pdf",
  okumaMakaira: "https://okumafishingusa.com/products/makaira-spinning",
  okumaRox: "https://okumafishingusa.com/products/rox-spinning-reels",
  quantum2023: "https://www.quantumfishing.com/contentassets/c199c43376d34f1188bb60458a395dfe/quantum_2023_fnl.pdf",
  quantum2024: "https://www.quantumfishing.com/contentassets/c199c43376d34f1188bb60458a395dfe/quantum_2024.pdf",
};

function requireReel(id) {
  const reel = byId.get(id);
  if (!reel) throw new Error(`Missing expected reel: ${id}`);
  return reel;
}

function monoDiameter(lb) {
  if (lb <= 2) return 0.006;
  if (lb <= 4) return 0.008;
  if (lb <= 6) return 0.0095;
  if (lb <= 8) return 0.011;
  if (lb <= 10) return 0.012;
  if (lb <= 12) return 0.014;
  if (lb <= 15) return 0.015;
  if (lb <= 20) return 0.018;
  if (lb <= 25) return 0.019;
  if (lb <= 30) return 0.022;
  return 0.025;
}

function capacityOption(lb, yards, raw = `${lb}-${yards}`) {
  const diameter = monoDiameter(lb);
  return {
    lb,
    yards,
    diameter_in: diameter,
    spool_space: Number((yards * diameter * diameter).toFixed(6)),
    raw,
  };
}

function setMonoCapacity(reel, pairs, anchorLb) {
  reel.capacity_options = pairs.map(([lb, yards]) => capacityOption(lb, yards));
  const anchor = reel.capacity_options.find((option) => option.lb === anchorLb);
  if (!anchor) throw new Error(`${reel.id}: anchor ${anchorLb} lb not found`);
  reel.capacity_yards = anchor.yards;
  reel.rated_line_lb = anchor.lb;
  reel.rated_line_diameter_in = anchor.diameter_in;
  reel.spool_space = anchor.spool_space;
  reel.capacity_note = reel.capacity_options.map((option) => `${option.lb}-${option.yards}`).join(", ");
  reel.capacity_status = "ready";
}

function setManufacturerListed(reel, sourceUrl, sourceLabel, sourceNote) {
  reel.source_url = sourceUrl;
  reel.capacity_data_source = sourceLabel;
  reel.spec_verification_status = "manufacturer_listed";
  reel.spec_checked_date = checkedDate;
  reel.spec_source_note = sourceNote;
  reel.source_conflicts = [];
  reel.data_warnings = [];
}

function setIptSource(reel, sourceUrl, sourceLabel) {
  if (!(Number(reel.line_retrieve_in) > 0)) return;
  reel.ipt_verification_status = "verified";
  reel.ipt_original_value = Number(reel.line_retrieve_in);
  reel.ipt_original_unit = "in/turn";
  reel.ipt_source_name = sourceLabel;
  reel.ipt_source_url = sourceUrl;
  reel.ipt_date_checked = checkedDate;
  reel.ipt_confidence = "high";
  reel.ipt_notes = "Exact model value is listed in the manufacturer or owner-manual specification table.";
}

function setConflict(reel, warning, conflicts, sourceNote) {
  reel.spec_verification_status = "source_conflict";
  reel.spec_checked_date = checkedDate;
  reel.spec_source_note = sourceNote;
  reel.source_conflicts = conflicts;
  reel.data_warnings = [warning];
}

const changed = [];
function mark(reel, fields) {
  changed.push({ id: reel.id, name: [reel.brand, reel.model, reel.size_label].join(" "), fields });
}

// Lew's original KVD series: the archived manufacturer catalog lists one mono
// and one braid capacity per exact SKU. The older extra rows in ReelCalc were
// not present in that table and are intentionally removed.
for (const correction of [
  ["lew-s-kvd-spinning-reel-200-kvd200-339", [[8, 120]], 8, "10-180"],
  ["lew-s-kvd-spinning-reel-300-kvd300-340", [[10, 180]], 10, "15-250"],
  ["lew-s-kvd-spinning-reel-400-kvd400-341", [[12, 190]], 12, "20-300"],
]) {
  const [id, monoPairs, anchorLb, braidNote] = correction;
  const reel = requireReel(id);
  setMonoCapacity(reel, monoPairs, anchorLb);
  reel.braid_capacity_note = braidNote;
  setManufacturerListed(
    reel,
    sources.lewsKvdCatalog,
    "Official Lew's 2023 catalog",
    "Exact KVD200/KVD300/KVD400 mono and braid capacities are listed in the Lew's 2023 catalog."
  );
  setIptSource(reel, sources.lewsKvdCatalog, "Official Lew's 2023 catalog");
  reel.notes = "Exact manufacturer-listed KVD series specifications; ReelCalc ID preserved.";
  mark(reel, ["mono_capacity", "braid_capacity", "source", "verification"]);
}

// KVD Elite current page and 2026 manufacturer guide disagree on two mono
// values. Keep the current product-page value, but make the conflict explicit.
const kvdElite100 = requireReel("lew-s-kvd-elite-spinning-reel-100-kvd100g2-335");
setManufacturerListed(
  kvdElite100,
  sources.lewsKvdEliteCurrent,
  "Official current Lew's product table",
  "Current product table and 2026 manufacturer guide agree on the exact model specifications."
);
setIptSource(kvdElite100, sources.lewsKvdEliteCurrent, "Official current Lew's product table");
mark(kvdElite100, ["source", "verification"]);

for (const conflict of [
  ["lew-s-kvd-elite-spinning-reel-200-kvd200g2-336", "mono_capacity", "6 lb / 230 yd", "6 lb / 190 yd"],
  ["lew-s-kvd-elite-spinning-reel-300-kvd300g2-337", "mono_capacity", "8 lb / 200 yd", "8 lb / 205 yd"],
]) {
  const [id, field, currentValue, guideValue] = conflict;
  const reel = requireReel(id);
  reel.source_url = sources.lewsKvdEliteCurrent;
  reel.capacity_data_source = "Official current Lew's product table";
  setConflict(
    reel,
    `Lew's current product table and 2026 manufacturer guide disagree on ${field.replace("_", " ")}; current product-page value retained pending manufacturer clarification.`,
    [{
      field,
      selected_value: currentValue,
      selected_source: sources.lewsKvdEliteCurrent,
      conflicting_value: guideValue,
      conflicting_source: sources.lewsKvdElite2026,
    }],
    "The exact SKU is confirmed, but two current Lew's sources publish different mono capacities."
  );
  setIptSource(reel, sources.lewsKvdEliteCurrent, "Official current Lew's product table");
  mark(reel, ["source_conflict", "verification"]);
}

const kvdEliteShallow = requireReel("lew-s-kvd-elite-spinning-reel-300-shallow-kvd300ssg2-338");
kvdEliteShallow.sku = "KVDSS300G2";
kvdEliteShallow.aliases = [...new Set([...(kvdEliteShallow.aliases || []), "KVD300SSG2"])];
setMonoCapacity(kvdEliteShallow, [[8, 120]], 8);
kvdEliteShallow.braid_capacity_note = "10-180";
kvdEliteShallow.gear_ratio = "6.2:1";
kvdEliteShallow.line_retrieve_in = 32;
kvdEliteShallow.weight_oz = 7.7;
kvdEliteShallow.max_drag_lb = 18;
kvdEliteShallow.bearings = "6+1";
kvdEliteShallow.source_url = sources.lewsKvdElite2026;
kvdEliteShallow.capacity_data_source = "Official Lew's 2026 new-product guide";
kvdEliteShallow.search_text = `${kvdEliteShallow.brand} ${kvdEliteShallow.model} ${kvdEliteShallow.sku} KVD300SSG2 ${kvdEliteShallow.size_label} ${kvdEliteShallow.size_class} ${kvdEliteShallow.reelcalc_use_case}`.toLowerCase();
setConflict(
  kvdEliteShallow,
  "Lew's 2026 manufacturer guide and current retailer tables disagree on shallow-spool mono capacity; manufacturer-guide value retained.",
  [{
    field: "mono_capacity",
    selected_value: "8 lb / 120 yd",
    selected_source: sources.lewsKvdElite2026,
    conflicting_value: "8 lb / 160 yd",
    conflicting_source: "https://www.basspro.com/shop/en/lews-kvd-elite-spinning-reel-62%3A1-300-size-4488157",
  }],
  "The 2026 Lew's guide confirms SKU KVDSS300G2, 8/120 mono, 10/180 braid, and the mechanical specifications."
);
setIptSource(kvdEliteShallow, sources.lewsKvdElite2026, "Official Lew's 2026 new-product guide");
mark(kvdEliteShallow, ["sku", "mono_capacity", "braid_capacity", "mechanical_specs", "source_conflict"]);

// Bass Pro Shops Formula exact owner manual supplies the complete family table.
for (const correction of [
  ["bass-pro-shops-formula-spinning-reel-10-fma10-47", [[4, 200], [6, 140], [8, 110]], 6, "15-200, 20-140, 30-110", "5.1:1", 18, 8.2],
  ["bass-pro-shops-formula-spinning-reel-20-fma20-48", [[6, 160], [8, 125], [10, 105]], 8, "20-160, 30-125, 40-105", "5.1:1", 21, 8.2],
  ["bass-pro-shops-formula-spinning-reel-30-fma30-49", [[8, 150], [10, 115], [12, 100]], 10, "30-150, 40-115, 50-100", "5.0:1", 22, 9.3],
  ["bass-pro-shops-formula-spinning-reel-40-fma40-50", [[10, 170], [12, 130], [14, 115]], 12, "40-170, 50-130, 65-80", "5.0:1", 24, 9.5],
]) {
  const [id, monoPairs, anchorLb, braidNote, ratio, ipt, weight] = correction;
  const reel = requireReel(id);
  setMonoCapacity(reel, monoPairs, anchorLb);
  reel.braid_capacity_note = braidNote;
  reel.gear_ratio = ratio;
  reel.line_retrieve_in = ipt;
  reel.weight_oz = weight;
  reel.max_drag_lb = 11;
  reel.bearings = "9+1";
  setManufacturerListed(
    reel,
    sources.formulaManual,
    "Official Bass Pro Shops Formula owner manual",
    "The exact FMA10/FMA20/FMA30/FMA40 family table lists complete mono, braid, retrieve, weight, drag, ratio, and bearing specifications."
  );
  setIptSource(reel, sources.formulaManual, "Official Bass Pro Shops Formula owner manual");
  mark(reel, ["mono_capacity", "braid_capacity", "mechanical_specs", "source", "verification"]);
}

// Offshore Angler Sea Lion exact owner manual supplies the complete family table.
for (const correction of [
  ["offshore-angler-sea-lion-spinning-reel-5000-sls50-79", [[12, 240], [14, 220], [17, 170]], 14, "50-210, 65-170, 80-130", "4.9:1", 34, 14.5, 35],
  ["offshore-angler-sea-lion-spinning-reel-6000-sls60-80", [[14, 255], [17, 230], [20, 190]], 17, "65-230, 80-190, 100-150", "4.9:1", 37, 14.5, 35],
  ["offshore-angler-sea-lion-spinning-reel-7000-sls70-81", [[25, 240], [30, 210], [40, 135]], 30, "80-260, 100-230, 150-195", "4.6:1", 37, 25, 40],
  ["offshore-angler-sea-lion-spinning-reel-8000-sls80-82", [[30, 270], [40, 180], [50, 140]], 40, "80-305, 100-250, 150-230", "4.6:1", 41, 25.5, 40],
]) {
  const [id, monoPairs, anchorLb, braidNote, ratio, ipt, weight, drag] = correction;
  const reel = requireReel(id);
  setMonoCapacity(reel, monoPairs, anchorLb);
  reel.braid_capacity_note = braidNote;
  reel.gear_ratio = ratio;
  reel.line_retrieve_in = ipt;
  reel.weight_oz = weight;
  reel.max_drag_lb = drag;
  reel.bearings = "4+1";
  setManufacturerListed(
    reel,
    sources.seaLionManual,
    "Official Offshore Angler owner manual",
    "The exact SLS50/SLS60/SLS70/SLS80 family table lists mono, braid, retrieve, weight, drag, ratio, and bearings."
  );
  setIptSource(reel, sources.seaLionManual, "Official Offshore Angler owner manual");
  mark(reel, ["mono_capacity", "braid_capacity", "mechanical_specs", "source", "verification"]);
}

// Replace a retired Okuma collection URL without changing verified specs.
for (const id of [
  "okuma-makaira-10000-mk-10000l-r-417",
  "okuma-makaira-20000-mk-20000ls-rs-418",
  "okuma-makaira-30000-mk-30000ls-rs-419",
]) {
  const reel = requireReel(id);
  reel.source_url = sources.okumaMakaira;
  reel.spec_checked_date = checkedDate;
  reel.spec_source_note = "Current official Okuma Makaira specification table; retired collection URL replaced.";
  mark(reel, ["source_url"]);
}

// Okuma publishes an internally contradictory second ROX 4000 braid row
// (190/12). Retain only the unambiguous 30 lb / 210 yd anchor.
const rox4000 = requireReel("okuma-rox-4000-rox-4000a-397");
rox4000.braid_capacity_note = "30-210";
rox4000.source_url = sources.okumaRox;
setConflict(
  rox4000,
  "Official Okuma ROX 4000 braid table contains an internally inconsistent 190/12 row; that row is excluded until Okuma clarifies it.",
  [{
    field: "braid_capacity",
    selected_value: "30 lb / 210 yd",
    selected_source: sources.okumaRox,
    conflicting_value: "12 lb / 190 yd",
    conflicting_source: sources.okumaRox,
  }],
  "The official table itself is contradictory. ReelCalc uses only its unambiguous 30/210 braid anchor."
);
mark(rox4000, ["braid_capacity", "source_conflict"]);

// An empty braid field is clearer and safer than a TBD placeholder. Mono
// capacity remains available for these exact Avenger B records.
for (const id of [
  "okuma-avenger-b-6000-av-6000b-382",
  "okuma-avenger-b-8000-av-8000b-383",
  "okuma-avenger-b-10000-av-10000b-384",
  "okuma-avenger-b-14000-av-14000b-385",
]) {
  const reel = requireReel(id);
  reel.braid_capacity_note = "";
  reel.spec_verification_status = "manufacturer_mono_only";
  reel.spec_checked_date = checkedDate;
  reel.spec_source_note = "No dependable braid-capacity row is stored; mono capacity remains the calculator fallback.";
  reel.notes = `${String(reel.notes || "").replace(/\s*Braid capacity[^.]*\.?/gi, "").trim()} Braid capacity is not available from the stored manufacturer table.`.trim();
  mark(reel, ["placeholder_cleanup", "verification"]);
}

// Replace weak marketplace/community URLs with the official catalog that
// supports the capacity values, while retaining an exact-suffix identity note.
for (const correction of [
  ["quantum-optix-20-op20-594", "OP20D"],
  ["quantum-optix-40-op40-596", "OP40D"],
]) {
  const [id, catalogSku] = correction;
  const reel = requireReel(id);
  reel.source_url = sources.quantum2023;
  reel.capacity_data_source = "Official Quantum 2023 catalog; identity suffix review";
  reel.spec_verification_status = "identity_review";
  reel.spec_checked_date = checkedDate;
  reel.spec_source_note = `Stored values match catalog model ${catalogSku}; existing ReelCalc ID and shorter SKU are preserved pending suffix confirmation.`;
  reel.source_conflicts = [{
    field: "sku",
    selected_value: reel.sku,
    selected_source: "Existing ReelCalc identity",
    conflicting_value: catalogSku,
    conflicting_source: sources.quantum2023,
  }];
  reel.data_warnings = [`Exact Quantum model suffix requires confirmation; calculations use the manufacturer-listed ${catalogSku} capacity values.`];
  mark(reel, ["source", "identity_review"]);
}

const smokeX25 = requireReel("quantum-smoke-x-25-smx25xpt-bx3-608");
smokeX25.source_url = sources.quantum2024;
smokeX25.capacity_data_source = "Official Quantum 2024 catalog";
smokeX25.weight_oz = 8.3;
smokeX25.spec_verification_status = "manufacturer_listed";
smokeX25.spec_checked_date = checkedDate;
smokeX25.spec_source_note = "Official Quantum catalog exact base model SMX25XPT; .BX3 is the stored packaging suffix.";
smokeX25.source_conflicts = [];
smokeX25.data_warnings = [];
setIptSource(smokeX25, sources.quantum2024, "Official Quantum 2024 catalog");
mark(smokeX25, ["source", "weight", "verification"]);

fs.writeFileSync(reelsPath, `${JSON.stringify(reels, null, 2)}\n`, "utf8");
const reportPath = path.join(rootDir, "reports", "reel-data-corrections-2026-08-15.json");
fs.writeFileSync(reportPath, `${JSON.stringify({
  applied_at: new Date().toISOString(),
  checked_date: checkedDate,
  changed_records: changed.length,
  changes: changed,
}, null, 2)}\n`, "utf8");

console.log(`Applied source-backed corrections to ${changed.length} reel records.`);
console.log(`Preserved ${reels.length} total records and every existing ReelCalc ID.`);
