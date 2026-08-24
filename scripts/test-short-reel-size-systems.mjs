import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = globalThis;

function loadBrowserScript(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  vm.runInThisContext(fs.readFileSync(fullPath, "utf8"), { filename: fullPath });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

loadBrowserScript("js/calculator-core.js");
loadBrowserScript("js/recommendation-engine.js");

const reels = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "reels.json"), "utf8"));
const lines = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "lines.json"), "utf8"));
const core = globalThis.ReelCalcCore;
const engine = globalThis.ReelCalcRecommendations;

function reel(brand, model, size) {
  const match = reels.find((item) => item.brand === brand && item.model === model && String(item.size_label) === String(size));
  assert(match, `Missing ${brand} ${model} ${size}`);
  return match;
}

function compatibility(item, fishingType) {
  return engine.recommendationCompatibility(item, fishingType);
}

function setups(item, fishingType) {
  return engine.recommendSetups({
    reel: item,
    lines,
    fishingType,
    priority: "all-around",
    calculateFullSpoolCapacity: core.calculateFullSpoolCapacity,
  });
}

const expected = [
  ["Abu Garcia", "Revo X Spinning", "10", 1000],
  ["Abu Garcia", "Revo X Spinning", "30", 3000],
  ["Bass Pro Shops", "Micro Lite Elite Spinning Reel", "5", 500],
  ["Bass Pro Shops", "Tourney Special Spinning Reel", "40", 4000],
  ["Lew's", "Laser Lite Spinning Reel", "50", 500],
  ["Lew's", "Laser Lite Spinning Reel", "75", 750],
  ["Lew's", "Laser Lite Spinning Reel", "100", 1000],
  ["Lew's", "Custom Lite Shallow Spool Spinning Reel", "200 SS", 2000],
  ["Lew's", "Custom Pro Spinning Reel", "400", 4000],
  ["Pflueger", "President", "20", 500],
  ["Pflueger", "President", "25", 1000],
  ["Pflueger", "President", "30", 2000],
  ["Pflueger", "President", "35", 2500],
  ["Pflueger", "President", "40", 3000],
  ["Quantum", "Strategy", "05", 500],
  ["Quantum", "Accurist", "15", 1500],
  ["Quantum", "Smoke S3 Inshore", "50", 5000],
  ["Quantum", "Optix", "80", 8000],
];

for (const [brand, model, displayedSize, normalizedSize] of expected) {
  const item = reel(brand, model, displayedSize);
  assert(Number(item.recommendation_size_class) === normalizedSize, `${brand} ${model} ${displayedSize}: stored recommendation class should be ${normalizedSize}`);
  assert(engine.reelSizeClass(item) === normalizedSize, `${brand} ${model} ${displayedSize}: engine class should be ${normalizedSize}`);
}

const isBaitcaster = (item) => /baitcast/i.test(String(item.reel_type || ""));
const classified = reels.filter((item) =>
  !isBaitcaster(item) && Number(item.recommendation_size_class) > 0
);
assert(classified.length === 141, `Expected 141 explicitly classified short-size reels, found ${classified.length}`);
const pfluegerExpected = new Map([[20, 500], [25, 1000], [30, 2000], [35, 2500], [40, 3000]]);
for (const item of classified) {
  const displayedNumber = Number(String(item.size_class || item.size_label || "").match(/\d+/)?.[0] || 0);
  let expectedSize;
  if (item.brand === "Pflueger") expectedSize = pfluegerExpected.get(displayedNumber);
  else if (item.brand === "Lew's") expectedSize = displayedNumber * 10;
  else expectedSize = displayedNumber * 100;

  assert(Number(item.recommendation_size_class) === expectedSize, `${item.id}: stored class should be ${expectedSize}`);
  assert(engine.reelSizeClass(item) === expectedSize, `${item.id}: engine class should be ${expectedSize}`);

  const bassAllowed = compatibility(item, "bass").recommend;
  assert(bassAllowed === (expectedSize >= 1000 && expectedSize < 5000), `${item.id}: bass compatibility does not match normalized size ${expectedSize}`);
}

const abu30 = reel("Abu Garcia", "Revo X Spinning", "30");
assert(compatibility(abu30, "bass").recommend, "Abu Garcia Revo X 30 should allow bass recommendations");
assert(compatibility(abu30, "inshore").recommend, "Abu Garcia Revo X 30 should allow inshore recommendations");
assert(setups(abu30, "bass").length > 0, "Abu Garcia Revo X 30 should produce bass setups");

const abu10 = reel("Abu Garcia", "Revo X Spinning", "10");
assert(!compatibility(abu10, "inshore").recommend, "Abu Garcia Revo X 10 should remain too small for inshore recommendations");

const abu40 = reel("Abu Garcia", "Revo X Spinning", "40");
assert(!compatibility(abu40, "trout").recommend, "Abu Garcia Revo X 40 should be too large for trout recommendations");

const quantum80 = reel("Quantum", "Optix", "80");
assert(compatibility(quantum80, "surf").recommend, "Quantum Optix 80 should allow surf recommendations");
assert(!compatibility(quantum80, "bass").recommend, "Quantum Optix 80 should block bass recommendations");

const pflueger35 = reel("Pflueger", "President", "35");
assert(compatibility(pflueger35, "bass").recommend, "Pflueger President 35 should allow bass recommendations");
assert(compatibility(pflueger35, "inshore").recommend, "Pflueger President 35 should allow light inshore recommendations");

const correctedSpeedSpin = classified.filter((item) =>
  item.brand === "Lew's" &&
  ["Speed Spin", "Speed Spin CRX"].includes(item.model) &&
  Number(item.recommendation_size_class) >= 2000
);
assert(correctedSpeedSpin.length === 6, `Expected 6 corrected Speed Spin records, found ${correctedSpeedSpin.length}`);
for (const item of correctedSpeedSpin) {
  const strengths = String(item.reelcalc_recommended_braid).match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  assert(Math.max(...strengths) >= 15, `${item.id}: recommendation still reflects an ultralight size class`);
  assert(!/ultralight/.test(String(item.reelcalc_use_case).toLowerCase()), `${item.id}: use case still reflects an ultralight size class`);
}

console.log("Short reel size systems: 141 records classified and all regression checks passed.");
