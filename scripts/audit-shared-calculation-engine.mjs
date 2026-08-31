import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const reels = JSON.parse(read("data/reels.json"));
const lines = JSON.parse(read("data/lines.json"));
const sandbox = { window: {}, Map, Set, Array, Number, String, Math };
vm.createContext(sandbox);
vm.runInContext(read("js/calculator-core.js"), sandbox, { filename: "calculator-core.js" });
const core = sandbox.window.ReelCalcCore;

assert.match(core.ENGINE_VERSION, /dual-anchor/);

const readyReels = reels.filter(core.isReelReady);
const usableLines = lines.filter(core.isLineReady);
const materials = ["Monofilament", "Fluorocarbon", "Copolymer", "Braid"];
const mainLines = materials.flatMap((material) => {
  const matches = usableLines.filter((line) => String(line.type) === material);
  if (!matches.length) return [];
  const indexes = [0, Math.floor(matches.length * 0.2), Math.floor(matches.length * 0.5), Math.floor(matches.length * 0.8), matches.length - 1];
  return [...new Set(indexes)].map((index) => matches[index]);
});
const backingLines = materials.map((material) => usableLines.find((line) => String(line.type) === material)).filter(Boolean);

function closeEnough(actual, expected, tolerance = 1e-9) {
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected));
  return Math.abs(actual - expected) <= scale * tolerance;
}

function ratingFromBasis(basis, line) {
  return {
    capacityYards: Number(basis.capacityYards),
    referenceDiameterIn: Number(line.dia_in),
    type: /braid/i.test(String(line.type)) ? "braid" : "mono"
  };
}

let capacityParityChecks = 0;
let backingParityChecks = 0;
let overCapacityChecks = 0;
let monotonicChecks = 0;
let fallbackChecks = 0;

for (const reel of readyReels) {
  for (const mainLine of mainLines) {
    const mainBasis = core.capacityBasisForActualLine(reel, mainLine, lines);
    if (!mainBasis) continue;
    const capacityOnly = core.estimateSetup({
      workingRating: ratingFromBasis(mainBasis, mainLine),
      workingDiameterIn: Number(mainLine.dia_in),
      capacityOnly: true
    });
    assert.ok(closeEnough(capacityOnly.fullWorkingCapacityYards, mainBasis.capacityYards));
    assert.equal(capacityOnly.engineVersion, core.ENGINE_VERSION);
    capacityParityChecks += 1;

    for (const backingLine of backingLines) {
      const backingBasis = core.capacityBasisForActualLine(reel, backingLine, lines);
      if (!backingBasis) continue;
      let previousBacking = Infinity;
      for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
        const desired = Number(mainBasis.capacityYards) * fraction;
        const shared = core.estimateSetup({
          workingRating: ratingFromBasis(mainBasis, mainLine),
          backingRating: ratingFromBasis(backingBasis, backingLine),
          workingYards: desired,
          workingDiameterIn: Number(mainLine.dia_in),
          backingDiameterIn: Number(backingLine.dia_in),
          capacityOnly: false
        });
        const surface = core.calculateActualLineCalibratedBacking(
          reel,
          mainLine,
          desired,
          backingLine,
          lines
        );
        assert.ok(surface && !surface.overCapacity);
        assert.ok(closeEnough(surface.backingYards, shared.backingYards));
        assert.ok(closeEnough(surface.backingYards, backingBasis.capacityYards * (1 - fraction)));
        assert.ok(surface.backingYards <= previousBacking + 1e-9);
        assert.ok(closeEnough(surface.mainPercent + surface.backingPercent, 100));
        assert.equal(surface.calculationMethod, "dual-anchor-fraction");
        assert.equal(surface.engineVersion, core.ENGINE_VERSION);
        previousBacking = surface.backingYards;
        backingParityChecks += 1;
        monotonicChecks += 1;
      }

      const overCapacity = core.calculateActualLineCalibratedBacking(
        reel,
        mainLine,
        Number(mainBasis.capacityYards) * 1.01,
        backingLine,
        lines
      );
      assert.ok(overCapacity && overCapacity.overCapacity && overCapacity.backingYards === 0);
      overCapacityChecks += 1;
      if (mainBasis.fallback || backingBasis.fallback) fallbackChecks += 1;
    }
  }
}

const integrations = [
  ["homepage", read("js/homepage-calculator-v2.js"), /sharedEngine\.estimateSetup\(options\)/],
  ["wizard", read("js/wizard.js"), /calculateActualLineCalibratedBacking\(/],
  ["reel pages", read("js/reel-page-calculator.js"), /calculateActualLineCalibratedBacking\(/],
  ["comparison", read("examples/reel-comparison.js"), /calculateActualLineCalibratedBacking\(/]
];
if (fs.existsSync(path.join(root, "js", "line-page-engine.js"))) {
  integrations.push(["line pages", read("js/line-page-engine.js"), /calculateActualLineCalibratedBacking\(/]);
}
for (const [name, source, pattern] of integrations) {
  assert.match(source, pattern, `${name} is not routed through the shared engine`);
}
assert.match(read("js/homepage-calculator-v2-loader.js"), /js\/calculator-core\.js/);
assert.match(read("js/reel-page-calculator.js"), /js\/calculator-core\.js\?v=8/);
assert.match(read("index.html"), /js\/calculator-core\.js\?v=8/);
assert.match(read("examples/reel-comparison-loader.js"), /shared-engine-8/);

console.log("Shared ReelCalc calculation engine audit passed.");
console.log(`- Engine: ${core.ENGINE_VERSION}`);
console.log(`- ${readyReels.length.toLocaleString()} calculation-ready reels checked`);
console.log(`- ${capacityParityChecks.toLocaleString()} capacity-only parity checks`);
console.log(`- ${backingParityChecks.toLocaleString()} dual-anchor backing parity checks`);
console.log(`- ${overCapacityChecks.toLocaleString()} over-capacity safeguards`);
console.log(`- ${monotonicChecks.toLocaleString()} monotonic fill checks`);
console.log(`- ${fallbackChecks.toLocaleString()} scenarios exercised a documented rating fallback`);
console.log(`- ${integrations.map(([name]) => name).join(", ")} all route through the shared core`);
