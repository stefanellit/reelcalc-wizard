import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const reels = JSON.parse(read("data/reels.json"));
const lines = JSON.parse(read("data/lines.json"));
const context = vm.createContext({
  window: {}, document: { addEventListener() {} }, console,
  URL, URLSearchParams, Map, Set, Number, Math, String, Array, Object, JSON
});
vm.runInContext(read("js/calculator-core.js"), context);
vm.runInContext(read("js/recommendation-engine.js"), context);
const core = context.window.ReelCalcCore;
const calls = [];
const instrumentedCore = { ...core };
for (const name of ["calculateActualLineCalibratedBacking", "calculateCalibratedBacking"]) {
  instrumentedCore[name] = (...args) => {
    const result = core[name](...args);
    calls.push({ name, result });
    return result;
  };
}
context.window.ReelCalcCore = instrumentedCore;
vm.runInContext(read("js/wizard.js"), context, { filename: "wizard.js" });
context.catalog = lines;
vm.runInContext(`
  state.lines = catalog;
  el.backingResult = { innerHTML: "", textContent: "", className: "" };
  el.mainLineSlider = { max: "", value: "" };
  el.mainLineYards = { value: "" };
  document.activeElement = el.mainLineYards;
`, context);

const findLine = (id) => {
  const line = lines.find((item) => item.id === id);
  assert.ok(line && core.isLineReady(line), `Missing usable line: ${id}`);
  return line;
};
const vanford = reels.find((reel) => reel.id === "shimano-vanford-fa-2500hga-vf2500hga-691");
const invizx = findLine("seaguar-invizx-fluorocarbon-8");
const ande = findLine("ande-braid-braid-10");
const bigGame = findLine("berkley-trilene-big-game-monofilament-10");
const powerPro = findLine("powerpro-spectra-braid-15");
let checks = 0;
let unchangedChecks = 0;

function close(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-9,
    `${label}: expected ${expected}, received ${actual}`);
}

// Run the real Wizard renderer, including its exact/recommended/manual selection paths.
function check(reel, main, backing, yards, options = {}) {
  const expected = core.calculateActualLineCalibratedBacking(reel, main, yards, backing, lines);
  assert.ok(expected, `${reel.id}: expected a usable shared result`);
  context.scenario = { reel, main, backing, yards, ...options };
  calls.length = 0;
  vm.runInContext(`
    state.selectedReel = scenario.reel;
    state.selectedLine = scenario.main;
    state.selectedSetup = { line: scenario.main };
    state.path = scenario.recommended ? "recommend" : "exact";
    state.useManualLine = Boolean(scenario.manual);
    state.manualLine = scenario.main;
    state.useManualBacking = Boolean(scenario.manual);
    state.manualBacking = scenario.backing;
    state.backingLine = scenario.useDefaultBacking ? null : scenario.backing;
    state.backingMode = scenario.capacityOnly ? "none" : "yes";
    state.desiredMainYards = scenario.yards;
    state.unitSystem = scenario.metric ? "metric" : "standard";
    el.backingResult.innerHTML = "";
    el.backingResult.textContent = "";
    renderBackingResult();
  `, context);
  const html = vm.runInContext("el.backingResult.innerHTML", context);
  const wizardCapacity = vm.runInContext("calculateFullSpoolCapacity(getActiveReel(), getActiveMainLine())", context);
  close(wizardCapacity, expected.fullMainCapacityYards, "Full main-line capacity");
  if (options.capacityOnly) {
    assert.equal(calls.length, 0, "Capacity-only mode must not calculate backing");
    assert.match(html, /No backing:/);
  } else {
    assert.equal(calls.length, 1, "Wizard must calculate one backing result");
    assert.equal(calls[0].name, "calculateActualLineCalibratedBacking",
      "Wizard must use diameter-aware references for BOTH lines, regardless of main-line material");
    close(calls[0].result.backingYards, expected.backingYards, "Backing parity");
    assert.equal(calls[0].result.overCapacity, expected.overCapacity);
    assert.equal(calls[0].result.backingBasis.type, expected.backingBasis.type);
    assert.ok(Number.isFinite(expected.backingYards) && expected.backingYards >= 0);
    if (expected.overCapacity) {
      assert.match(html, /more line than this reel is estimated to hold/);
    } else {
      assert.match(html, /Best backing estimate:/);
      const formatted = vm.runInContext("formatLength(" + expected.backingYards + ", 1, true)", context);
      assert.ok(html.includes("Best backing estimate:</strong> " + formatted), "Rendered amount differs from shared result");
    }
  }
  if (/braid/i.test(main.type) || !/braid/i.test(backing.type)) {
    const previous = /braid/i.test(main.type)
      ? core.calculateActualLineCalibratedBacking(reel, main, yards, backing, lines)
      : core.calculateCalibratedBacking(reel, main, yards, backing);
    close(expected.backingYards, previous.backingYards, "Unaffected setup changed");
    unchangedChecks += 1;
  }
  checks += 1;
  return expected;
}

const oldResult = core.calculateCalibratedBacking(vanford, invizx, 120, ande);
close(oldResult.backingYards, 65.625, "Reproduce the previous mismatch");
const regression = check(vanford, invizx, ande, 120);
close(regression.backingYards, 112.77777777777777, "Corrected diameter-aware backing");

const sampleReels = [vanford,
  reels.find((reel) => reel.id === "shimano-slx-a-150-6-3-rh-slx150a"),
  reels.find((reel) => /penn-fierce-iv-8000/.test(reel.id)),
  reels.find((reel) => core.isReelReady(reel) && /baitcast/i.test(reel.reel_type) && /steez.*light/i.test(reel.id)),
  reels.find((reel) => core.isReelReady(reel) && /\bPE\b/i.test(reel.braid_capacity_note)),
  { ...vanford, id: "mono-reference-fallback", braid_capacity_note: "", pe_capacity_note: "" }
].filter(Boolean);
const materials = [bigGame, invizx, lines.find((line) => line.type === "Copolymer" && core.isLineReady(line)), powerPro];
for (const reel of sampleReels) {
  for (const main of materials) {
    const capacity = core.capacityBasisForActualLine(reel, main, lines).capacityYards;
    for (const backing of materials) {
      for (const fraction of [0.25, 0.75, 1, 1.01]) {
        check(reel, main, backing, capacity * fraction);
      }
      check(reel, main, backing, capacity * 0.5, { capacityOnly: true });
    }
  }
}

// One catalog braid happened to mask the bug. Exercise every usable braid backing.
for (const backing of lines.filter((line) => /braid/i.test(line.type) && core.isLineReady(line))) {
  check(vanford, invizx, backing, 120);
}
const readyReels = reels.filter(core.isReelReady);
for (const reel of readyReels) {
  for (const main of [bigGame, invizx]) {
    const capacity = core.capacityBasisForActualLine(reel, main, lines).capacityYards;
    check(reel, main, ande, capacity * 0.5);
  }
}
const recommendations = context.window.ReelCalcRecommendations.recommendSetups({ reel: vanford, lines });
assert.ok(recommendations.length > 0);
for (const { line: main } of recommendations) {
  assert.equal(main.generic_recommendation, true);
  for (const backing of [bigGame, ande]) {
    check(vanford, main, backing, 50, { recommended: true });
  }
}
check(vanford, invizx, ande, 120, { metric: true });
check(vanford, invizx, ande, 120, { manual: true });
check(vanford, powerPro, vm.runInContext("DEFAULT_BACKING", context), 70, { useDefaultBacking: true });

console.log(`Wizard backing parity passed: ${checks} actual-renderer scenarios; ${unchangedChecks} unaffected-result checks.`);
console.log(`Mono and fluorocarbon main line over braid backing checked on all ${readyReels.length} calculation-ready local reels.`);
console.log(`Known regression: ${oldResult.backingYards.toFixed(1)} yd previously, ${regression.backingYards.toFixed(1)} yd using the reel-page/comparison method.`);
console.log("Exact, recommended, manual, default backing, metric, capacity-only, full-fill, and over-capacity paths passed.");
