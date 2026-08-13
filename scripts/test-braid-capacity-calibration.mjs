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

const reels = JSON.parse(fs.readFileSync(path.join(rootDir, "data/reels.json"), "utf8"));
const lines = JSON.parse(fs.readFileSync(path.join(rootDir, "data/lines.json"), "utf8"));
const core = globalThis.ReelCalcCore;
const engine = globalThis.ReelCalcRecommendations;

function findReel(id) {
  const reel = reels.find((item) => item.id === id);
  assert(reel, `Missing test reel ${id}`);
  return reel;
}

function genericBraid(lb, diameter = 0.008) {
  return {
    id: `generic-braid-${lb}-typical`,
    type: "Braid",
    lb,
    dia_in: diameter,
    generic_recommendation: true
  };
}

const daiwa3000 = findReel("daiwa-revros-lt-3000d-c-rvslt3000d-c-104");
const exactPublished = core.publishedBraidCapacityEstimate(daiwa3000, genericBraid(15));
assert(exactPublished && exactPublished.method === "exact", "Daiwa 15 lb braid should use an exact published rating");
assert(exactPublished.yards === 250, "Daiwa 15 lb braid should calculate to the published 250 yd rating");
assert(core.calculateFullSpoolCapacity(daiwa3000, genericBraid(15)) === 250, "Generic recommendation should use published braid capacity");
assert(
  core.calculateFullSpoolCapacity(daiwa3000, genericBraid(10, 0.006)) === 250,
  "A lighter generic recommendation should not exceed the nearest published braid capacity"
);

const exactProduct = { type: "Braid", lb: 15, dia_in: 0.008 };
assert(
  core.calculateFullSpoolCapacity(daiwa3000, exactProduct) === core.calculateMainLineCapacity(daiwa3000, exactProduct),
  "Core callers must opt into selected-line braid calibration"
);
const thickerSelectedBraid = core.calculatePublishedBraidCapacity(
  daiwa3000,
  { type: "Braid", lb: 15, dia_in: 0.009 },
  0.008
);
assert(thickerSelectedBraid.yards === 198, "A thicker selected 15 lb braid should adjust the 250 yd rating downward");
const thinnerSelectedBraid = core.calculatePublishedBraidCapacity(
  daiwa3000,
  { type: "Braid", lb: 15, dia_in: 0.006 },
  0.008
);
assert(thinnerSelectedBraid.yards === 313, "A thin selected braid should be limited to a 25% upward adjustment");

for (const line of [
  { type: "Monofilament", lb: 10, dia_in: 0.012, generic_recommendation: true },
  { type: "Fluorocarbon", lb: 10, dia_in: 0.011, generic_recommendation: true }
]) {
  assert(
    core.calculateFullSpoolCapacity(daiwa3000, line) === core.calculateMainLineCapacity(daiwa3000, line),
    `${line.type} capacity should remain on the existing mono-rated diameter model`
  );
}

const slashCases = [
  ["bass-pro-shops-johnny-morris-carbonlite-2-0-spinning-reel-1000-jct1000-57", 8, 220],
  ["okuma-ceymar-a-500-c-500a-359", 10, 90],
  ["pflueger-trion-20-trion20x-535", 4, 180],
  ["quantum-accurist-15-at15spta-564", 20, 130]
];

for (const [id, lb, yards] of slashCases) {
  const reel = findReel(id);
  const option = core.publishedBraidCapacityOptions(reel).find((item) => item.lb === lb);
  assert(option && option.yards === yards, `${id} should parse ${lb} lb / ${yards} yd correctly`);
}

let parsedReels = 0;
let exactRatingsChecked = 0;
for (const reel of reels) {
  const options = core.publishedBraidCapacityOptions(reel);
  if (!options.length) continue;
  parsedReels += 1;
  for (const option of options) {
    const estimate = core.publishedBraidCapacityEstimate(reel, genericBraid(option.lb));
    assert(estimate && estimate.method === "exact", `${reel.id} should recognize its exact ${option.lb} lb braid rating`);
    assert(estimate.yards === option.yards, `${reel.id} should preserve its published ${option.yards} yd capacity`);
    exactRatingsChecked += 1;
  }
}

assert(parsedReels >= 800, `Expected at least 800 reels with parsed braid ratings, found ${parsedReels}`);

const revrosSetups = engine.recommendSetups({
  reel: daiwa3000,
  lines,
  fishingType: "bass",
  priority: "all-around",
  calculateFullSpoolCapacity: core.calculateFullSpoolCapacity
});
const revrosFifteen = revrosSetups.find((setup) => setup.line.type === "Braid" && setup.line.lb === 15);
assert(revrosFifteen, "Daiwa Revros 3000 should include a 15 lb braid recommendation");
assert(revrosFifteen.capacityYards === 250, "Daiwa Revros 15 lb recommendation should show 250 yd");
assert(revrosFifteen.capacityBasis === "published-braid", "Recommendation should identify the published braid basis");

console.log(`Published braid calibration test passed: ${parsedReels} reels and ${exactRatingsChecked} exact ratings checked.`);
console.log(`Daiwa Revros LT 3000D-C: 15 lb braid = ${revrosFifteen.capacityYards} yd (published rating).`);
