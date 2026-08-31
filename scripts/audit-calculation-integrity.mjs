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

loadBrowserScript("js/calculator-core.js");
loadBrowserScript("js/recommendation-engine.js");

const reels = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "reels.json"), "utf8"));
const lines = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "lines.json"), "utf8"));
const pageRegistry = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "reel-pages.json"), "utf8"));
const core = globalThis.ReelCalcCore;
const engine = globalThis.ReelCalcRecommendations;
const readyReels = reels.filter(core.isReelReady);
const braidLines = lines.filter((line) => /braid/i.test(String(line.type)) && core.isLineReady(line));
const monoLines = lines.filter((line) => /mono/i.test(String(line.type)) && core.isLineReady(line));
const backingLine = monoLines.find((line) => line.brand === "Berkley" && line.model === "Trilene Big Game" && Number(line.lb) === 10) || monoLines[0];
const fishingTypes = ["trout", "bass", "walleye", "freshwater", "inshore", "surf"];
const priorities = ["all-around", "distance", "sensitivity", "simplicity", "abrasion"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function duplicateValues(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return Array.from(counts.entries()).filter((entry) => entry[1] > 1);
}

function reelLabel(reel) {
  return [reel.brand, reel.model, reel.size_label || reel.size_class].filter(Boolean).join(" ");
}

function practicalBraidMinimum(reel) {
  const match = String(reel.reelcalc_recommended_braid || "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function matchesPublishedBraidAnchor(reel, strength) {
  return core.publishedBraidCapacityOptions(reel).some((option) =>
    Math.abs(Number(option.lb) - Number(strength)) < 0.001
  );
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

assert(duplicateValues(reels.map((reel) => reel.id)).length === 0, "Duplicate reel IDs found");
assert(duplicateValues(lines.map((line) => line.id)).length === 0, "Duplicate line IDs found");
assert(duplicateValues(pageRegistry.pages.map((page) => page.path)).length === 0, "Duplicate reel-page paths found");
assert(backingLine && Number(backingLine.dia_in) > 0, "No valid backing test line found");

const calculationFailures = [];
const rangeFailures = [];
const spoolSpaceSpreads = [];
let backingCases = 0;
let exactAnchorCases = 0;

for (const reel of readyReels) {
  const inferredSpaces = [];
  const expectsBraidRange = core.publishedBraidCapacityOptions(reel).length > 0 || /\bPE\b/i.test(String(reel.braid_capacity_note || ""));
  for (const line of braidLines) {
    const basis = core.capacityBasisForActualLine(reel, line, lines);
    if (!basis || !(Number(basis.capacityYards) > 0)) {
      calculationFailures.push(`${reelLabel(reel)} / ${line.brand} ${line.model} ${line.lb}: missing capacity basis`);
      continue;
    }

    const capacity = Number(basis.capacityYards);
    const inferredSpace = capacity * Number(line.dia_in) ** 2;
    inferredSpaces.push(inferredSpace);
    const desired = Math.min(150, capacity * 0.5);
    const result = core.calculateActualLineCalibratedBacking(reel, line, desired, backingLine, lines);
    const range = core.calculateActualLineCalibratedBackingRange(reel, line, desired, backingLine, lines);
    backingCases += 1;

    if (!result || result.overCapacity || !(result.backingYards >= 0)) {
      calculationFailures.push(`${reelLabel(reel)} / ${line.brand} ${line.model} ${line.lb}: invalid backing result`);
      continue;
    }

    const backingBasis = core.capacityBasisForActualLine(reel, backingLine, lines);
    const expectedBacking = backingBasis.capacityYards * Math.max(0, 1 - desired / basis.capacityYards);
    const relativeError = Math.abs(result.backingYards - expectedBacking) / Math.max(1, expectedBacking);
    if (
      relativeError > 1e-9 ||
      result.calculationMethod !== "dual-anchor-fraction" ||
      result.engineVersion !== core.ENGINE_VERSION
    ) {
      calculationFailures.push(`${reelLabel(reel)} / ${line.brand} ${line.model} ${line.lb}: shared dual-anchor backing calculation failed`);
    }

    if (expectsBraidRange && (!range || !(range.minimumYards <= range.centerYards && range.centerYards <= range.maximumYards))) {
      rangeFailures.push(`${reelLabel(reel)} / ${line.brand} ${line.model} ${line.lb}: invalid backing range`);
    }
  }

  if (inferredSpaces.length) {
    const minimum = Math.min(...inferredSpaces);
    const maximum = Math.max(...inferredSpaces);
    spoolSpaceSpreads.push({
      reel: reelLabel(reel),
      ratio: maximum / minimum,
      minimum,
      maximum
    });
  }

  for (const anchor of core.publishedBraidCapacityOptions(reel)) {
    const line = braidLines.find((candidate) => Math.abs(Number(candidate.lb) - Number(anchor.lb)) < 0.001);
    if (!line) continue;
    const estimate = core.actualLineBraidCapacityEstimate(reel, line, lines);
    exactAnchorCases += 1;
    if (!estimate || !(estimate.centerYards > 0)) {
      calculationFailures.push(`${reelLabel(reel)} / ${anchor.lb} lb published anchor did not calculate`);
    }
  }
}

const recommendationFailures = [];
const specialtyBelowMinimum = [];
let recommendationCases = 0;
for (const reel of readyReels) {
  const practicalMinimum = practicalBraidMinimum(reel);
  for (const fishingType of fishingTypes) {
    for (const priority of priorities) {
      const compatibility = engine.recommendationCompatibility(reel, fishingType);
      const setups = engine.recommendSetups({
        reel,
        lines,
        fishingType,
        priority,
        calculateFullSpoolCapacity: core.calculateFullSpoolCapacity
      });
      recommendationCases += 1;
      if (compatibility.recommend === false) {
        if (setups.length) recommendationFailures.push(`${reelLabel(reel)} / ${fishingType} / ${priority}: blocked but returned cards`);
        continue;
      }
      if (!setups.length) {
        recommendationFailures.push(`${reelLabel(reel)} / ${fishingType} / ${priority}: no setup cards`);
        continue;
      }
      const bestOverall = setups.find((setup) => setup.useCase === "best-overall");
      if (bestOverall && /braid/i.test(String(bestOverall.line.type)) && practicalMinimum > 0 &&
          Number(bestOverall.line.lb) < practicalMinimum &&
          !matchesPublishedBraidAnchor(reel, bestOverall.line.lb)) {
        recommendationFailures.push(`${reelLabel(reel)} / ${fishingType} / ${priority}: Best Overall ${bestOverall.line.lb} lb is below ${practicalMinimum} lb practical minimum`);
      }
      for (const setup of setups) {
        if (/braid/i.test(String(setup.line.type)) && practicalMinimum > 0 &&
            Number(setup.line.lb) < practicalMinimum &&
            !matchesPublishedBraidAnchor(reel, setup.line.lb)) {
          specialtyBelowMinimum.push(`${reelLabel(reel)} / ${fishingType} / ${priority} / ${setup.title}: ${setup.line.lb} lb below ${practicalMinimum} lb`);
        }
      }
    }
  }
}

spoolSpaceSpreads.sort((a, b) => b.ratio - a.ratio);
const spreadRatios = spoolSpaceSpreads.map((item) => item.ratio);

console.log("ReelCalc calculation integrity audit");
console.log(`- ${reels.length} reel records; ${readyReels.length} calculation-ready`);
console.log(`- ${lines.length} line records; ${braidLines.length} braid and ${monoLines.length} mono tested`);
console.log(`- ${pageRegistry.pages.length} registered reel pages`);
console.log(`- ${backingCases.toLocaleString()} actual-line backing calculations checked`);
console.log(`- ${exactAnchorCases.toLocaleString()} published braid anchors checked`);
console.log(`- ${recommendationCases.toLocaleString()} reel/fishing-type/priority recommendation cases checked`);
console.log(`- Inferred braid spool-space spread: median ${percentile(spreadRatios, 0.5).toFixed(2)}x, p95 ${percentile(spreadRatios, 0.95).toFixed(2)}x, max ${percentile(spreadRatios, 1).toFixed(2)}x`);
console.log(`- Visible specialty braid cards below reel-specific practical minimum: ${specialtyBelowMinimum.length.toLocaleString()}`);
if (spoolSpaceSpreads.length) {
  console.log("- Largest inferred spool-space spreads:");
  spoolSpaceSpreads.slice(0, 8).forEach((item) => console.log(`  ${item.ratio.toFixed(2)}x | ${item.reel}`));
}

assert(calculationFailures.length === 0, `Calculation failures (${calculationFailures.length}):\n- ${calculationFailures.slice(0, 30).join("\n- ")}`);
assert(rangeFailures.length === 0, `Range failures (${rangeFailures.length}):\n- ${rangeFailures.slice(0, 30).join("\n- ")}`);
assert(recommendationFailures.length === 0, `Recommendation failures (${recommendationFailures.length}):\n- ${recommendationFailures.slice(0, 30).join("\n- ")}`);
assert(percentile(spreadRatios, 1) <= 1.000001, "Selected braid changed the inferred physical spool space");
console.log("Core backing conservation, range ordering, and Best Overall recommendation checks passed.");
