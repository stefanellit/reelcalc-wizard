import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const reels = JSON.parse(read("data/reels.json"));
const rawLines = JSON.parse(read("data/lines.json"));
const pageRegistry = JSON.parse(read("data/reel-pages.json"));
const sandbox = { window: {}, URL, URLSearchParams, Map, Set, Array, Number, String, Math };
vm.createContext(sandbox);
vm.runInContext(read("js/calculator-core.js"), sandbox);
vm.runInContext(read("js/line-selector.js"), sandbox);

const core = sandbox.window.ReelCalcCore;
const selector = sandbox.window.ReelCalcLineSelector;
const lines = selector.prepareLines(rawLines);
const reelsById = new Map(reels.map((reel) => [reel.id, reel]));
const braidLines = lines.filter((line) => line.material === "Braid");
const backingLine = lines.find((line) => line.id === "berkley-trilene-big-game-monofilament-12");
assert.ok(backingLine, "backing-line fixture is missing");

let auditedPages = 0;
let exactAnchors = 0;
let nonExactSelections = 0;
const largestCapacities = [];

for (const page of pageRegistry.pages) {
  const reel = reelsById.get(page.reelId);
  assert.ok(reel, `missing reel for page ${page.path}`);
  const peRated = /\bPE\b/i.test(String(reel.braid_capacity_note || ""));
  const options = peRated ? [] : core.publishedBraidCapacityOptions(reel);
  if (!options.length && !peRated) continue;
  auditedPages += 1;

  for (const option of options) {
    const exactLine = braidLines.find((line) => Math.abs(line.lb - option.lb) < 0.001);
    if (!exactLine) continue;
    const exact = core.capacityBasisForActualLine(reel, exactLine, lines);
    assert.equal(exact.type, "published-braid-diameter", `${page.path} did not use its braid rating`);
    assert.equal(exact.actualLineEstimate.method, "exact", `${page.path} lost an exact braid match`);
    assert.equal(exact.capacityYards, option.yards, `${page.path} changed an exact published braid capacity`);
    exactAnchors += 1;
  }

  const publishedStrengths = new Set(options.map((option) => option.lb));
  const recommendationStrength = Number(String(reel.reelcalc_recommended_braid || "").match(/\d+(?:\.\d+)?/)?.[0]);
  const selected = braidLines.find((line) =>
    line.lb === recommendationStrength && !publishedStrengths.has(line.lb)
  ) || braidLines.find((line) => !publishedStrengths.has(line.lb));
  if (!selected) continue;

  const basis = core.capacityBasisForActualLine(reel, selected, lines);
  const range = core.calculateActualLineBraidCapacityRange(reel, selected, lines);
  assert.equal(basis.type, "published-braid-diameter", `${page.path} missed diameter calibration`);
  assert.equal(
    range.method,
    peRated ? "pe-diameter-calibrated" : "diameter-calibrated",
    `${page.path} used pound-test interpolation`
  );
  assert.ok(Number.isFinite(range.centerYards) && range.centerYards > 0, `${page.path} produced an invalid center`);
  assert.ok(range.minimumYards < range.centerYards, `${page.path} produced an invalid lower range`);
  assert.ok(range.maximumYards > range.centerYards, `${page.path} produced an invalid upper range`);
  assert.ok(range.maximumYards <= 50000, `${page.path} produced an implausibly large capacity`);

  const desired = Math.min(150, range.centerYards * 0.5);
  const backing = core.calculateActualLineCalibratedBacking(reel, selected, desired, backingLine, lines);
  const backingRange = core.calculateActualLineCalibratedBackingRange(reel, selected, desired, backingLine, lines);
  assert.ok(backing && !backing.overCapacity && Number.isFinite(backing.backingYards), `${page.path} produced invalid backing`);
  assert.ok(backingRange && backingRange.minimumYards <= backing.backingYards, `${page.path} produced an invalid backing range`);
  assert.ok(backingRange.maximumYards >= backing.backingYards, `${page.path} produced an invalid backing range`);

  nonExactSelections += 1;
  largestCapacities.push({
    page: page.path,
    line: `${selected.brand} ${selected.model} ${selected.lb} lb`,
    centerYards: Math.round(range.centerYards)
  });
}

largestCapacities.sort((a, b) => b.centerYards - a.centerYards);
assert.ok(auditedPages > 300, "too few published reel pages were audited");
assert.ok(exactAnchors > 500, "too few exact braid anchors were checked");
assert.ok(nonExactSelections > 300, "too few non-exact braid selections were checked");

console.log(`Reel-page braid calibration passed for ${auditedPages} published pages.`);
console.log(`- ${exactAnchors} exact manufacturer braid ratings remained unchanged`);
console.log(`- ${nonExactSelections} non-exact strengths used diameter calibration`);
console.log("- Largest audited capacity estimates:");
largestCapacities.slice(0, 5).forEach((entry) => {
  console.log(`  ${entry.centerYards} yd | ${entry.line} | ${entry.page}`);
});
