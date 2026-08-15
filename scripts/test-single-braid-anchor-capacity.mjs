import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const sandbox = { window: {}, URL, URLSearchParams, Map, Set, Array, Number, String, Math };
vm.createContext(sandbox);
vm.runInContext(read("js/calculator-core.js"), sandbox);
vm.runInContext(read("js/recommendation-engine.js"), sandbox);

const core = sandbox.window.ReelCalcCore;
const engine = sandbox.window.ReelCalcRecommendations;
const reels = JSON.parse(read("data/reels.json"));
const lines = JSON.parse(read("data/lines.json"));
const kvd300 = reels.find((reel) => reel.id === "lew-s-kvd-spinning-reel-300-kvd300-340");

assert.ok(kvd300, "Lew's KVD Spinning Reel 300 fixture is missing");
assert.deepEqual(
  JSON.parse(JSON.stringify(core.publishedBraidCapacityOptions(kvd300))),
  [{ lb: 40, yards: 180 }],
  "KVD 300 should retain its single published 40 lb / 180 yd braid anchor"
);

const setups = engine.recommendSetups({
  reel: kvd300,
  lines,
  fishingType: "bass",
  priority: "all-around",
  calculateFullSpoolCapacity: core.calculateFullSpoolCapacity
});

function genericBraid(strength) {
  const diameter = engine.typicalDiameter(lines, "Braid", strength);
  assert.ok(diameter && diameter.dia_in > 0, `Missing typical ${strength} lb braid diameter`);
  return {
    id: `generic-braid-${strength}-typical`,
    brand: "Generic",
    model: "Typical diameter",
    type: "Braid",
    lb: strength,
    dia_in: diameter.dia_in,
    generic_recommendation: true
  };
}

const tenLine = genericBraid(10);
const fifteenLine = genericBraid(15);
const thirtyLine = genericBraid(30);
const tenEstimate = core.actualLineBraidCapacityEstimate(kvd300, tenLine, lines);
const fifteenEstimate = core.actualLineBraidCapacityEstimate(kvd300, fifteenLine, lines);
const thirtyEstimate = core.actualLineBraidCapacityEstimate(kvd300, thirtyLine, lines);
const ten = { line: tenLine, capacityYards: tenEstimate.centerYards };
const fifteen = { line: fifteenLine, capacityYards: fifteenEstimate.centerYards };
const thirty = { line: thirtyLine, capacityYards: thirtyEstimate.centerYards };
assert.ok(
  ten.capacityYards > fifteen.capacityYards && fifteen.capacityYards > thirty.capacityYards,
  "Thinner KVD 300 braid recommendations must hold progressively more line"
);

const inferredSpaces = [ten, fifteen, thirty].map((setup) => (
  Number(setup.capacityYards) * Number(setup.line.dia_in) ** 2
));
const minimumSpace = Math.min(...inferredSpaces);
const maximumSpace = Math.max(...inferredSpaces);
assert.ok(
  maximumSpace / minimumSpace <= 1.000001,
  "Changing recommended braid strength must not change the KVD 300's inferred spool size"
);

for (const setup of [ten, fifteen, thirty]) {
  const range = core.calculateBraidCapacityRange(kvd300, setup.line, lines);
  assert.ok(range, `${setup.line.lb} lb KVD 300 braid should have a calibrated range`);
  assert.equal(range.centerYards, setup.capacityYards, `${setup.line.lb} lb card and range centers should agree`);
  assert.ok(range.minimumYards < range.centerYards && range.maximumYards > range.centerYards);
}

const visibleBraidSetups = setups.filter((setup) => /braid/i.test(String(setup.line.type)));
assert.ok(visibleBraidSetups.length > 0, "KVD 300 should retain realistic bass braid recommendations");
assert.ok(
  visibleBraidSetups.every((setup) => Number(setup.line.lb) >= 20),
  "KVD 300 recommendations must not fall below half of its lightest published braid rating"
);
assert.equal(Number(setups[0].line.lb), 20, "KVD 300 Best Pick should use 20 lb braid after the published-rating guard");

const legacyTen = core.publishedBraidCapacityEstimate(kvd300, ten.line);
assert.ok(legacyTen.yards > 180, "The no-catalog fallback must not freeze 10 lb braid at 180 yards");

console.log("Single braid-anchor regression passed.");
console.log(
  `Lew's KVD 300 estimates: 10 lb ${Math.round(ten.capacityYards)} yd, ` +
  `15 lb ${Math.round(fifteen.capacityYards)} yd, 30 lb ${Math.round(thirty.capacityYards)} yd.`
);
