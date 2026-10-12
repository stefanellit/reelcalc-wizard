import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const context = vm.createContext({ window: {}, document: { addEventListener() {} }, URL, URLSearchParams, console });
vm.runInContext(read("js/calculator-core.js"), context);
vm.runInContext(read("js/line-selector.js"), context);
const core = context.window.ReelCalcCore;
const reels = JSON.parse(read("data/reels.json"));
const lines = JSON.parse(read("data/lines.json"));
const prepared = context.window.ReelCalcLineSelector.prepareLines(lines);
const assess = (reel, line, catalog = lines) => core.assessLineCapacityRatings(reel, line, catalog);
const supreme = reels.find(r => r.id === "pflueger-supreme-xt-35-supxtsp35x-559");
const smackdown = lines.find(l => l.id === "seaguar-smackdown-braid-15");
const bigGame = lines.find(l => l.id === "berkley-trilene-big-game-monofilament-10");
const bg = reels.find(r => r.id === "daiwa-bg-lt-3000d-xh");
const jbraid = lines.find(l => l.id === "daiwa-j-braid-x4-braid-20");
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

const low = assess(supreme, smackdown);
assert.equal(core.assessReelCapacityRatings(supreme, lines).warning, false, "Reproduce the old blanket-check blind spot");
assert.equal(low.warning, true);
assert.equal(low.direction, "uncertain");
assert.equal(low.relativeDirection, "low");
assert.equal(low.material, "braid");
assert.equal(low.comparisonVerified, true);
close(low.selectedCapacityYards, 97.77777777777779);
assert.ok(low.comparisonMinimumYards > 222 && low.comparisonMaximumYards < 233);
assert.equal(low.title, "Keep an eye on your spool");
assert.match(low.message, /Use this braid yardage as a guide/);
assert.match(low.message, /recommended fill level/);
assert.match(low.backingMessage, /backing/);
for (const type of ["Mono", "Nylon", "Fluorocarbon", "Copolymer"]) {
  const result = assess(supreme, { ...smackdown, type });
  assert.equal(result.warning, false, type + " must not inherit a braid warning");
  assert.equal(result.reason, "verified_same_material");
}
assert.equal(assess(bg, jbraid).warning, false, "No blanket cross-material alarm on verified braid");
assert.equal(assess(bg, bigGame).warning, false, "No blanket cross-material alarm on verified mono");

const fixture = { id: "fixture", brand: "Test", capacity_yards: 400, rated_line_diameter_in: 0.01,
  capacity_options: [], braid_capacity_note: "20-100" };
const braid = { id: "test-braid", type: "Braid", lb: 20, dia_in: 0.01 };
const mono = { ...braid, id: "test-mono", type: "Mono" };
const catalog = [braid];
const rating = (material, yards, suffix = "a") => ({ id: material + suffix, reel_id: fixture.id, material,
  calculation_eligible: true, verification_status: "verified_source",
  normalized: { diameter_mm: 0.254, capacity_meters: yards * 0.9144 } });
const monoReference = { ...fixture, manufacturer_capacity_ratings: [rating("mono", 200)] };
assert.equal(assess(monoReference, braid, catalog).warning, true, "Exact 2x boundary");
assert.equal(assess({ ...monoReference, manufacturer_capacity_ratings: [rating("mono", 199)] }, braid, catalog).warning, false);
const high = assess({ ...fixture, manufacturer_capacity_ratings: [rating("braid", 100)] }, mono, catalog);
assert.equal(high.warning, true);
assert.equal(high.direction, "uncertain");
assert.equal(high.relativeDirection, "high");
assert.equal(high.title, "Keep an eye on your spool");
assert.match(high.message, /Use this mono yardage as a guide/);
for (const [type, name] of [["Fluorocarbon", "fluorocarbon"], ["Copolymer", "copolymer"]]) {
  const result = assess({ ...fixture, manufacturer_capacity_ratings: [rating("braid", 100)] }, { ...mono, type }, catalog);
  assert.equal(result.warning, true);
  assert.ok(result.message.includes("Use this " + name + " yardage as a guide"));
}
const uncertain = assess(fixture, braid, catalog);
assert.equal(uncertain.warning, true);
assert.equal(uncertain.direction, "uncertain", "Guessed references cannot establish a probable error direction");
assert.match(uncertain.message, /ratings give different estimates/);
assert.equal(assess({ ...monoReference, manufacturer_capacity_ratings: [rating("mono", 400), rating("mono", 120, "b")] }, braid, catalog).warning, false,
  "All usable opposite-material references must support the separation");
for (const invalidRating of [
  { ...rating("mono", 400), calculation_eligible: false },
  { ...rating("mono", 400), reel_id: "different-model" },
  { ...rating("mono", 400), verification_status: "unreviewed" },
  { ...rating("mono", 400), normalized: { diameter_mm: NaN, capacity_meters: 100 } }
]) {
  const result = assess({ ...fixture, manufacturer_capacity_ratings: [invalidRating] }, braid, catalog);
  assert.equal(result.comparisonVerified, false);
  assert.equal(result.direction, "uncertain");
}
for (const reel of [null, {}, { ...supreme, id: "manual-reel" }, { ...supreme, manualRating: {} },
  { ...supreme, manual_reel_entry_mode: "mono" }, { ...fixture, braid_capacity_note: "" }]) {
  assert.equal(assess(reel, smackdown), null);
}
for (const line of [null, {}, { ...smackdown, type: "Unknown" }, { ...smackdown, dia_in: NaN }, { ...smackdown, dia_in: Infinity }]) {
  assert.equal(assess(supreme, line), null);
}
assert.equal(assess(supreme, smackdown, []), null);
for (const diameter of [0.003, 0.009, 0.02]) {
  const custom = { type: "Braid", lb: 15, dia_in: diameter, custom_line: true };
  const result = assess(supreme, custom);
  close(result.selectedCapacityYards, core.calculateFullSpoolCapacity(supreme, custom, { lineCatalog: lines }));
}

const before = JSON.stringify({ reels, lines });
let checks = 0;
let warningCount = 0;
const selections = [smackdown, jbraid, bigGame, { ...smackdown, type: "Fluorocarbon" },
  { type: "Braid", lb: 20, dia_in: 0.008, custom_line: true }];
let baseline;
if (process.argv.includes("--check-published-baseline")) {
  const oldContext = { window: {} };
  vm.runInNewContext(execFileSync("git", ["show", "cb2b9ef:js/calculator-core.js"], { cwd: root, encoding: "utf8" }), oldContext);
  baseline = oldContext.window.ReelCalcCore;
}
for (const reel of reels) {
  for (const line of selections) {
    const result = assess(reel, line);
    assert.deepEqual(result, assess(reel, line, prepared), `Prepared catalog parity: ${reel.id}`);
    if (result && result.warning) {
      warningCount++;
      assert.ok(result.separatedRatio >= 2);
      assert.equal(result.direction, "uncertain", "Cross-material comparisons cannot establish a real-world error direction");
      assert.doesNotMatch(result.title + result.message + result.backingMessage, /may be (?:low|high)|more line could fit|less line could fit/i);
      close(result.selectedCapacityYards, core.calculateFullSpoolCapacity(reel, line, { lineCatalog: lines }));
    }
    if (baseline) {
      assert.equal(core.calculateFullSpoolCapacity(reel, line, { lineCatalog: lines }), baseline.calculateFullSpoolCapacity(reel, line, { lineCatalog: lines }), "Capacity must not change");
      assert.equal(JSON.stringify(core.calculateActualLineCalibratedBacking(reel, line, 50, bigGame, lines)),
        JSON.stringify(baseline.calculateActualLineCalibratedBacking(reel, line, 50, bigGame, lines)), "Backing must not change");
    }
    checks++;
  }
}
assert.equal(JSON.stringify({ reels, lines }), before, "Warnings must not mutate catalog data");

// Exercise the real Wizard warning renderer for capacity, backing roles and a material switch.
vm.runInContext(read("js/wizard.js"), context);
Object.assign(context, { catalog: lines, supreme, smackdown, bigGame });
vm.runInContext("state.lines = catalog", context);
const render = expression => vm.runInContext(expression, context);
assert.match(render("capacityRatingWarningHtml(supreme, smackdown)"), /Keep an eye on your spool/);
assert.match(render("capacityRatingWarningHtml(supreme, smackdown)"), /Use this braid yardage as a guide/);
assert.equal(render("capacityRatingWarningHtml(supreme, bigGame)"), "");
assert.match(render("capacityRatingWarningHtml(supreme, smackdown, 'Backing line')"), /Backing line: Keep an eye on your spool/);
assert.match(render("capacityRatingWarningHtml(supreme, smackdown, 'Backing line')"), /The backing amount is an estimate too/);
assert.match(render("capacityRatingWarningHtml(supreme, smackdown, null, true)"), /<details[^>]*><summary>Keep an eye on your spool/);
assert.match(read("js/wizard.js"), /capacityRatingWarningHtml\(reel, item, null, true\)/, "Similar-line cards need their own compact assessment");
assert.match(read("examples/reel-comparison.js"), /reel: state.reelB, line: secondLine/, "Compare each reel's own selected line");
for (const file of ["js/wizard.js", "js/reel-page-calculator.js", "js/line-page-engine.js", "examples/reel-comparison.js"]) {
  new vm.Script(read(file), { filename: file });
  assert.match(read(file), /assessLineCapacityRatings/);
  assert.doesNotMatch(read(file), /assessReelCapacityRatings\(/);
  assert.match(read(file), /Backing line/);
}
console.log(`PASS: ${checks} reel/line checks; ${warningCount} cautions; selected-line/material and backing-role coverage, neutral material-specific copy, verified-source controls, raw/prepared parity and non-mutation${baseline ? "; all capacity/backing outputs identical to published cb2b9ef" : ""}.`);
