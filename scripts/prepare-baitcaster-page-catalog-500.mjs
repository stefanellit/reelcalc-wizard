import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAmazonSearchOffer, normalizeAffiliateRegistry } from "./reel-pages/affiliates.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const writeJson = (relativePath, value) => fs.writeFileSync(
  path.join(root, relativePath),
  `${JSON.stringify(value, null, 2)}\n`,
  "utf8"
);

const modelCorrections = new Map([
  ["Best Baitcasting Reel for Saltwater Fishing - Smooth Casting Design | KastKing", "MegaJaws Elite Baitcasting Reel"],
  ["KastKing Mg-Ti Elite Baitcasting Reel | KastKing MGTI Baitcaster Reel | Magnesium Baitcaster Reel", "Mg-Ti Elite Magnesium Baitcasting Reel"],
  ["KastKing Mg12 Elite Magnesium Baitcasting Reel", "Mg12 Elite Magnesium Baitcasting Reel"],
  ["KastKing Skeet Reese Icon Baitcasting Reels", "Skeet Reese Icon Baitcasting Reel"]
]);

const aliasToCanonical = new Map([
  ["mach-lew-s-mach-crush-slp-mcr1sha", "lew-s-mach-crush-slp-mcr1sha"],
  ["mach-lew-s-mach-crush-slp-mcr1shla", "lew-s-mach-crush-slp-mcr1shla"]
]);

const technologyClauses = new Map(Object.entries({
  "HAGANE Body": "uses a rigid metal body to limit flex and keep the gears aligned under load",
  "SilentTune": "applies light pressure to the spool bearing to reduce vibration while casting",
  "Silent Tune": "applies light pressure to the spool bearing to reduce vibration while casting",
  "S3D Spool": "uses a balanced thin-wall aluminum spool to reduce vibration during casting and retrieval",
  "MGL Spool": "uses a low-inertia spool to improve startup and control with lighter presentations",
  "MGL Spool III": "uses a low-inertia spool to improve startup and casting control",
  "MGL Spool IV": "reduces spool inertia to improve startup and control across changing lure weights",
  "FTB": "moves the braking magnets off the spool to preserve low spool inertia for bait-finesse casting",
  "Exciting Drag Sound": "adds an audible signal when a fish pulls line against the drag",
  "I-DC5": "uses electronic spool-speed control with selectable modes to manage braking during a cast",
  "4x8 DC MD Tune": "uses digitally controlled braking tuned for heavier lures and changing casting conditions",
  "MicroModule Gear and X-SHIP": "combines fine gear teeth with supported pinion alignment for smoother power transfer under load",
  "MicroModule Gear": "uses fine gear teeth to increase contact and smooth the retrieve",
  "X-Ship": "supports the pinion gear at both ends to maintain alignment under load",
  "CoreSolid Body": "integrates key frame and side-plate structure to improve rigidity under load",
  "SVS Infinity": "provides externally adjustable centrifugal braking for changing lure weights and conditions",
  "Cross Carbon Drag": "uses carbon drag washers to provide a broad and durable range of pressure",
  "VBS": "uses centrifugal brake weights to control spool speed during a cast",
  "SV Boost": "uses two-stage spool braking to balance control early in the cast with freer rotation later",
  "Hyperdrive Design": "coordinates the gear, housing, clutch, and pinion support to improve smoothness and durability",
  "34 mm G1 duralumin spool": "uses a light, rigid spool material to reduce rotational inertia",
  "T-Wing System": "opens the line path during a cast to reduce line angle and friction",
  "Magforce-Z Boost": "uses magnetic braking with a two-stage response to control spool speed through the cast",
  "G1 duralumin spool": "uses a light, rigid spool material to reduce rotational inertia",
  "32 mm SV Boost spool": "combines a compact spool with two-stage braking for controlled startup and casting",
  "Tapered T-Wing System": "widens the line path during a cast to reduce line angle and friction",
  "SS Magforce": "uses a compact magnetic braking layout designed for controlled bait-finesse spool response",
  "30 mm G1 duralumin BF spool": "uses a small, light spool to reduce startup inertia with lighter lures",
  "Full aluminum housing": "uses a rigid metal frame to support gear alignment under load",
  "Full-aluminum Hyper Armed Housing": "uses a rigid aluminum frame and side structure to support the drive train",
  "Hyperdrive Digigear": "uses larger precision-cut gear teeth to improve contact and power transfer",
  "Hyper Tough Clutch": "uses a reinforced clutch mechanism intended for repeated, positive engagement",
  "ATD": "is designed to apply smooth, progressive drag pressure as a fish accelerates",
  "Reinforced composite one-piece frame": "uses a one-piece structure to support alignment while keeping weight controlled",
  "Micro-adjustable magnetic cast control": "provides fine external braking adjustments as lure weight and wind change",
  "Precision-hobbed brass gears": "uses cut brass gearing for durable power transfer",
  "One-piece aluminum frame": "uses a rigid metal frame to support spool and gear alignment under load",
  "Dual magnetic and centrifugal braking": "combines two braking methods for a wider range of casting adjustments",
  "Model-optimized spool depth": "matches spool depth to the intended line capacity and casting role",
  "One-piece aluminum frame and gear-side cover": "uses rigid connected metal structure to support the drive train under load",
  "Variable-depth forged aluminum spool": "matches spool depth to each model's intended line capacity and presentation range"
}));

function correctedModel(model) {
  return modelCorrections.get(String(model || "")) || model;
}

function refreshSearchText(reel) {
  return [
    reel.brand,
    reel.model,
    reel.generation,
    reel.sku,
    reel.size_label,
    reel.retrieve_hand,
    "baitcaster baitcasting",
    reel.reelcalc_use_case
  ].filter(Boolean).join(" ").toLowerCase();
}

function updateModels(records) {
  let changed = 0;
  for (const record of records) {
    const nextModel = correctedModel(record.model);
    if (nextModel !== record.model) {
      record.model = nextModel;
      if (record.generation && modelCorrections.has(record.generation)) record.generation = nextModel;
      if (record.search_text != null) record.search_text = refreshSearchText(record);
      changed += 1;
    }
  }
  return changed;
}

function sourceForResearchRecord(record) {
  return (record.source_evidence || []).find((source) =>
    source.exact_sku && /^official_manufacturer/.test(String(source.source_type || ""))
  ) || (record.source_evidence || [])[0] || {};
}

const priority = readJson("research/baitcaster-database/recommended-first-500.json");
const reels = readJson("data/reels.json");
const baitcasterMaster = readJson("data/baitcaster_reel_database_master.json");
const features = readJson("data/reel-family-features.json");
const affiliates = normalizeAffiliateRegistry(readJson("data/reel-affiliates.json"));

const priorityModelChanges = updateModels(priority.records);
const reelModelChanges = updateModels(reels.filter((reel) => /baitcast|casting/i.test(String(reel.reel_type || ""))));
const masterModelChanges = updateModels(baitcasterMaster);

for (const reel of reels) {
  if (!/baitcast|casting/i.test(String(reel.reel_type || ""))) continue;
  if (!modelCorrections.has(reel.model) && ![...modelCorrections.values()].includes(reel.model)) continue;
  const current = affiliates.reels?.[reel.id]?.offers?.amazon?.reel;
  if (current?.matchType === "search") {
    affiliates.reels[reel.id].offers.amazon.reel = buildAmazonSearchOffer(reel, affiliates.retailers.amazon);
  }
}

const dataReelById = new Map(reels.map((reel) => [reel.id, reel]));
const researchByFamily = new Map();
for (const record of priority.records) {
  const key = `${record.brand}|${record.model}`;
  if (!researchByFamily.has(key)) researchByFamily.set(key, []);
  researchByFamily.get(key).push(record);
}

let featureFamilies = 0;
let fallbackFamilies = 0;
for (const [key, records] of researchByFamily) {
  const reel = records.map((record) => dataReelById.get(record.id)).find(Boolean);
  if (!reel) throw new Error(`${key}: no activated reel record.`);
  const existing = features.families[key];
  if (existing?.terms?.length && existing.sourceUrl === reel.source_url) {
    featureFamilies += 1;
    continue;
  }

  const verifiedTerms = [];
  const seen = new Set();
  for (const record of records) {
    for (const term of record.technology_features || []) {
      if (seen.has(term.name) || !technologyClauses.has(term.name)) continue;
      if (term.source_url && reel.source_url && term.source_url !== reel.source_url) continue;
      seen.add(term.name);
      verifiedTerms.push({ name: term.name, clause: technologyClauses.get(term.name) });
      if (verifiedTerms.length >= 3) break;
    }
    if (verifiedTerms.length >= 3) break;
  }

  features.families[key] = {
    brand: reel.brand,
    model: reel.model,
    sourceUrl: reel.source_url,
    sourceStatus: "verified",
    verification: verifiedTerms.length ? "exact-family-source" : "exact-specification-fallback",
    terms: verifiedTerms,
    excludedBySize: {},
    notes: verifiedTerms.length
      ? "Terms are present on the cited exact-family manufacturer source and are explained conservatively for angler-facing copy."
      : "No distinctive technology with a completed plain-English verification was approved; introductions use exact published specifications instead."
  };
  if (verifiedTerms.length) featureFamilies += 1;
  else fallbackFamilies += 1;
}

features.generatedAt = new Date().toISOString();
features.version = Math.max(Number(features.version) || 1, 2);
writeJson("research/baitcaster-database/recommended-first-500.json", priority);
writeJson("data/reels.json", reels);
writeJson("data/baitcaster_reel_database_master.json", baitcasterMaster);
writeJson("data/reel-family-features.json", features);
writeJson("data/reel-affiliates.json", affiliates);

const pageRecords = priority.records.filter((record) => !aliasToCanonical.has(record.id));
const exactSkuKeys = new Set(pageRecords.map((record) => String(record.sku).toLowerCase()));
if (pageRecords.length !== 498 || exactSkuKeys.size !== 498) {
  throw new Error(`Expected 498 canonical physical variants, found ${pageRecords.length} rows and ${exactSkuKeys.size} unique SKUs.`);
}

const report = {
  generatedAt: new Date().toISOString(),
  inputRows: priority.records.length,
  canonicalPhysicalVariants: pageRecords.length,
  duplicateAliasRows: [...aliasToCanonical].map(([aliasId, canonicalId]) => ({ aliasId, canonicalId })),
  modelCorrections: Object.fromEntries(modelCorrections),
  modelRowsChanged: {
    research: priorityModelChanges,
    publicReels: reelModelChanges,
    baitcasterMaster: masterModelChanges
  },
  families: researchByFamily.size,
  familiesWithVerifiedTechnologyCopy: featureFamilies,
  familiesUsingExactSpecificationFallback: fallbackFamilies,
  officialSourceFamilies: [...researchByFamily].filter(([, records]) =>
    /^official_manufacturer/.test(String(sourceForResearchRecord(records[0]).source_type || ""))
  ).length,
  pageReelIds: pageRecords.map((record) => record.id)
};
writeJson("reports/baitcaster-page-catalog-readiness-500.json", report);
console.log(JSON.stringify(report, null, 2));
