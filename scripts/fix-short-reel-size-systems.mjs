import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reelsPath = path.join(rootDir, "data", "reels.json");
const reportPath = path.join(rootDir, "reports", "reel-size-classification-audit.json");
const reels = JSON.parse(fs.readFileSync(reelsPath, "utf8"));

const pfluegerSizes = new Map([
  [20, 500],
  [25, 1000],
  [30, 2000],
  [35, 2500],
  [40, 3000],
]);

const scaledSizeSystems = new Map([
  ["abu garcia", { maximum: 40, multiplier: 100 }],
  ["bass pro shops", { maximum: 40, multiplier: 100 }],
  ["lew's", { maximum: 400, multiplier: 10 }],
  ["quantum", { maximum: 99, multiplier: 100 }],
]);

const speedSpinProfiles = new Map([
  [2000, {
    braid: "8-15 lb braid",
    mono: "4-8 lb mono/fluoro",
    useCase: "trout, panfish, finesse bass, light freshwater",
  }],
  [3000, {
    braid: "10-20 lb braid",
    mono: "8-10 lb mono/fluoro",
    useCase: "bass, walleye, finesse spinning, all-around freshwater",
  }],
  [4000, {
    braid: "20-30 lb braid",
    mono: "10-12 lb mono/fluoro",
    useCase: "larger bass, walleye, light pike, heavier freshwater",
  }],
]);

function numericSize(value) {
  return Number(String(value || "").match(/\d+/)?.[0] || 0);
}

function normalizedRecommendationSize(reel) {
  const size = numericSize(reel.size_class || reel.size_label);
  const brand = String(reel.brand || "").toLowerCase();
  if (brand === "pflueger") return pfluegerSizes.get(size) || null;

  const system = scaledSizeSystems.get(brand);
  if (!system || size <= 0 || size > system.maximum) return null;
  return size * system.multiplier;
}

const classified = [];
const guidanceCorrections = [];

for (const reel of reels) {
  const normalizedSize = normalizedRecommendationSize(reel);
  if (!normalizedSize) continue;

  reel.recommendation_size_class = normalizedSize;
  classified.push({
    id: reel.id,
    brand: reel.brand,
    model: reel.model,
    displayedSize: reel.size_label,
    recommendationSizeClass: normalizedSize,
  });

  if (reel.brand !== "Lew's" || !["Speed Spin", "Speed Spin CRX"].includes(reel.model)) continue;
  const profile = speedSpinProfiles.get(normalizedSize);
  if (!profile) continue;

  const oldUseCase = String(reel.reelcalc_use_case || "");
  reel.reelcalc_recommended_braid = profile.braid;
  reel.reelcalc_recommended_mono_fluoro = profile.mono;
  reel.reelcalc_use_case = profile.useCase;
  if (oldUseCase && String(reel.search_text || "").includes(oldUseCase.toLowerCase())) {
    reel.search_text = reel.search_text.replace(oldUseCase.toLowerCase(), profile.useCase.toLowerCase());
  }
  guidanceCorrections.push({
    id: reel.id,
    model: reel.model,
    displayedSize: reel.size_label,
    recommendationSizeClass: normalizedSize,
    braid: profile.braid,
    mono: profile.mono,
    useCase: profile.useCase,
  });
}

const expectedCounts = {
  "Abu Garcia": 17,
  "Bass Pro Shops": 9,
  "Lew's": 49,
  Pflueger: 29,
  Quantum: 37,
};

for (const [brand, expected] of Object.entries(expectedCounts)) {
  const actual = classified.filter((item) => item.brand === brand).length;
  if (actual !== expected) {
    throw new Error(`${brand}: expected ${expected} classified records, found ${actual}`);
  }
}
if (classified.length !== 141) throw new Error(`Expected 141 classified records, found ${classified.length}`);
if (guidanceCorrections.length !== 6) throw new Error(`Expected 6 Speed Spin guidance corrections, found ${guidanceCorrections.length}`);

fs.writeFileSync(reelsPath, `${JSON.stringify(reels, null, 2)}\n`);
fs.writeFileSync(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  classifiedCount: classified.length,
  classifiedByBrand: Object.fromEntries(Object.keys(expectedCounts).map((brand) => [
    brand,
    classified.filter((item) => item.brand === brand).length,
  ])),
  guidanceCorrectionCount: guidanceCorrections.length,
  guidanceCorrections,
  classified,
}, null, 2)}\n`);

console.log(`Classified ${classified.length} abbreviated reel sizes.`);
console.log(`Corrected ${guidanceCorrections.length} Speed Spin recommendation records.`);
