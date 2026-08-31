import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const reels = JSON.parse(read("data/reels.json"));
const rawLines = JSON.parse(read("data/lines.json"));
const registry = JSON.parse(read("data/reel-pages.json"));
const sandbox = { window: {}, URL, URLSearchParams, Map, Set, Array, Number, String, Math };
vm.createContext(sandbox);
vm.runInContext(read("js/calculator-core.js"), sandbox);
vm.runInContext(read("js/line-selector.js"), sandbox);

const core = sandbox.window.ReelCalcCore;
const selector = sandbox.window.ReelCalcLineSelector;
const lines = selector.prepareLines(rawLines);
const reelsById = new Map(reels.map((reel) => [reel.id, reel]));
const pageReels = registry.pages.map((page) => {
  const reel = reelsById.get(page.reelId);
  assert.ok(reel, `comparison registry is missing reel ${page.reelId}`);
  return reel;
});

const reelPageSource = read("js/reel-page-calculator.js");
const comparisonSource = read("examples/reel-comparison.js");
const generatorSource = read("scripts/reel-pages/render.mjs");
const validatorSource = read("scripts/reel-pages/validate.mjs");

for (const source of [reelPageSource, comparisonSource]) {
  assert.match(source, /capacityBasisForActualLine\(reel, mainLine, (?:preparedLines|state\.lines)\)/);
  assert.match(source, /calculateActualLineBraidCapacityRange\(reel, mainLine, (?:preparedLines|state\.lines)\)/);
  assert.match(source, /calculateActualLineCalibratedBacking\(reel, mainLine, desiredYards, backingLine, (?:preparedLines|state\.lines)\)/);
  assert.match(source, /calculateActualLineCalibratedBackingRange\(reel, mainLine, desiredYards, backingLine, (?:preparedLines|state\.lines)\)/);
  assert.match(source, /calculateHandleTurns\(/);
}

assert.match(comparisonSource, /registry\.pages\.map\(function\(page\)/);
assert.match(generatorSource, /comparisonUrl = `\$\{registry\.comparisonPath \|\| "\/reel-comparison"\}\?reel1=\$\{encodeURIComponent\(reel\.id\)\}`/);
assert.match(generatorSource, />Compare This Reel<\/a>/);
assert.match(validatorSource, /expectedComparisonUrl/);
assert.match(validatorSource, /Comparison points to correct reel/);
assert.match(validatorSource, /Comparison URL is valid/);
assert.equal(new Set(registry.pages.map((page) => page.reelId)).size, registry.pages.length, "duplicate reel IDs in page registry");
assert.equal(new Set(registry.pages.map((page) => page.path)).size, registry.pages.length, "duplicate paths in page registry");

const closeEnough = (a, b) => {
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= scale * 1e-9;
};

let capacityChecks = 0;
let braidRangeChecks = 0;
let handleTurnChecks = 0;

for (const reel of pageReels) {
  for (const line of lines) {
    const basis = core.capacityBasisForActualLine(reel, line, lines);
    const fullSpool = core.calculateFullSpoolCapacity(reel, line, { lineCatalog: lines });
    assert.equal(Boolean(basis), fullSpool > 0, `${reel.id} / ${line.id} disagreed on capacity availability`);
    if (!basis) continue;
    assert.ok(closeEnough(basis.capacityYards, fullSpool), `${reel.id} / ${line.id} produced different full-spool results`);
    capacityChecks += 1;

    if (line.material === "Braid") {
      const range = core.calculateActualLineBraidCapacityRange(reel, line, lines);
      if (range) {
        assert.ok(closeEnough(range.centerYards, fullSpool), `${reel.id} / ${line.id} range center drifted from capacity`);
        assert.ok(range.minimumYards <= range.centerYards && range.centerYards <= range.maximumYards, `${reel.id} / ${line.id} has an invalid range`);
        braidRangeChecks += 1;
      }
    }

    const retrieve = Number(reel.line_retrieve_in);
    if (retrieve > 0) {
      const turns = core.calculateHandleTurns(fullSpool, retrieve);
      assert.ok(turns && turns.rangeMin <= turns.approximateTurns && turns.approximateTurns <= turns.rangeMax, `${reel.id} / ${line.id} has invalid handle turns`);
      handleTurnChecks += 1;
    }
  }
}

const representativeMainLines = [
  "berkley-trilene-xl-monofilament-6",
  "berkley-trilene-big-game-monofilament-20",
  "seaguar-invizx-fluorocarbon-10",
  "yo-zuri-hybrid-copolymer-10",
  "seaguar-smackdown-braid-10",
  "seaguar-smackdown-braid-20",
  "powerpro-maxcuatro-braid-50",
  "powerpro-spectra-braid-100"
].map((id) => lines.find((line) => line.id === id)).filter(Boolean);

const representativeBackingLines = [
  "berkley-trilene-big-game-monofilament-10",
  "seaguar-invizx-fluorocarbon-10",
  "seaguar-smackdown-braid-20"
].map((id) => lines.find((line) => line.id === id));

assert.equal(representativeMainLines.length, 8, "representative main-line fixtures are incomplete");
assert.ok(representativeBackingLines.every(Boolean), "representative backing-line fixtures are incomplete");

let backingChecks = 0;
let backingRangeChecks = 0;

for (const reel of pageReels) {
  for (const mainLine of representativeMainLines) {
    const basis = core.capacityBasisForActualLine(reel, mainLine, lines);
    if (!basis) continue;
    for (const fraction of [0.25, 0.75]) {
      const desiredYards = basis.capacityYards * fraction;
      for (const backingLine of representativeBackingLines) {
        const backingBasis = core.capacityBasisForActualLine(reel, backingLine, lines);
        assert.ok(backingBasis, `${reel.id} / ${backingLine.id} is missing its backing anchor`);
        const result = core.calculateActualLineCalibratedBacking(reel, mainLine, desiredYards, backingLine, lines);
        assert.ok(result && !result.overCapacity, `${reel.id} / ${mainLine.id} produced invalid backing`);
        const expectedBacking = backingBasis.capacityYards * (1 - fraction);
        assert.ok(closeEnough(result.backingYards, expectedBacking), `${reel.id} / ${mainLine.id} / ${backingLine.id} backing math drifted`);
        assert.equal(result.calculationMethod, "dual-anchor-fraction");
        assert.equal(result.engineVersion, core.ENGINE_VERSION);
        assert.ok(closeEnough(result.mainPercent + result.backingPercent, 100), `${reel.id} / ${mainLine.id} fill percentages drifted`);
        backingChecks += 1;

        const range = core.calculateActualLineCalibratedBackingRange(reel, mainLine, desiredYards, backingLine, lines);
        if (range) {
          assert.ok(closeEnough(range.centerYards, result.backingYards), `${reel.id} / ${mainLine.id} backing range center drifted`);
          assert.ok(range.minimumYards <= range.centerYards && range.centerYards <= range.maximumYards, `${reel.id} / ${mainLine.id} has an invalid backing range`);
          backingRangeChecks += 1;
        }
      }
    }
  }
}

console.log("Reel comparison/reel-page calculation parity passed.");
console.log(`- ${pageReels.length} registered reel pages are comparison-ready`);
console.log(`- ${lines.length} central line records flow into both tools`);
console.log(`- ${capacityChecks.toLocaleString()} full-spool capacity results matched the shared basis`);
console.log(`- ${braidRangeChecks.toLocaleString()} braid ranges had matching centers and valid bounds`);
console.log(`- ${backingChecks.toLocaleString()} backing results matched the shared dual-anchor formula`);
console.log(`- ${backingRangeChecks.toLocaleString()} backing ranges had matching centers and valid bounds`);
console.log(`- ${handleTurnChecks.toLocaleString()} handle-turn estimates had valid bounds`);
console.log("- Future generation requires registry membership and an exact preloaded comparison link");
