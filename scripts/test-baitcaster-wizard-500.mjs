import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const reels = read("data/reels.json");
const lines = read("data/lines.json");
const manifest = read("data/baitcaster-wizard-500-2026-08.json");
const baitcasters = manifest.reelIds.map((id) => reels.find((reel) => reel.id === id));
const spinning = reels.filter((reel) => !/baitcast|casting/i.test(String(reel.reel_type || "")));
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "js/calculator-core.js"), "utf8"), sandbox);
vm.runInNewContext(fs.readFileSync(path.join(root, "js/recommendation-engine.js"), "utf8"), sandbox);
const core = sandbox.window.ReelCalcCore;
const engine = sandbox.window.ReelCalcRecommendations;
const fishingTypes = ["trout", "bass", "walleye", "freshwater", "inshore", "surf"];
const priorities = ["all-around", "distance", "sensitivity", "simplicity", "abrasion"];

function material(line) {
  const type = String(line?.type || "").toLowerCase();
  if (type.includes("braid")) return "braid";
  if (type.includes("mono")) return "mono";
  if (type === "fluorocarbon") return "fluorocarbon";
  if (type === "copolymer" || type === "fluorocarbon coated") return "copolymer";
  return "";
}

function range(value) {
  const values = String(value || "").match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  return values.length ? [values[0], values[1] || values[0]] : null;
}

assert.equal(manifest.expectedReelCount, 500);
assert.equal(baitcasters.length, 500);
assert.ok(baitcasters.every(Boolean));
assert.equal(new Set(baitcasters.map((reel) => reel.id)).size, 500);
assert.equal(new Set(baitcasters.map((reel) => `${reel.brand.toLowerCase()}|${reel.sku.toLowerCase()}`)).size, 500);
assert.equal(spinning.length, 836);
assert.equal(
  crypto.createHash("sha256").update(JSON.stringify(spinning)).digest("hex"),
  "4490d5a94c1e21b95ea7b2ec2f7aea9600d1e8debf69e8317d42a166ec213d69",
  "Spinning reel records changed during baitcaster activation."
);

const usableLines = lines.filter((line) => core.isLineReady(line) && material(line));
const braidLines = usableLines.filter((line) => material(line) === "braid");
const solidLines = usableLines.filter((line) => ["mono", "fluorocarbon", "copolymer"].includes(material(line)));
const backingLines = ["mono", "fluorocarbon", "copolymer", "braid"].map((target) => {
  const candidates = usableLines.filter((line) => material(line) === target);
  assert.ok(candidates.length, `No ${target} test line.`);
  return candidates.slice().sort((left, right) => Math.abs(Number(left.lb) - 12) - Math.abs(Number(right.lb) - 12))[0];
});

let fullSpoolCases = 0;
let braidRangeCases = 0;
let backingCases = 0;
let handleTurnCases = 0;
let publishedAnchorCases = 0;
let recommendationScenarios = 0;
let recommendationCards = 0;
let maximumRecommendedBraidYards = 0;
const failures = [];

for (const reel of baitcasters) {
  assert.ok(core.isReelReady(reel), `${reel.id}: not calculator-ready.`);
  assert.match(String(reel.reel_type), /baitcast/i);
  assert.ok(Number(reel.line_retrieve_in) > 0, `${reel.id}: retrieve missing.`);
  assert.ok(Number(reel.weight_oz) > 0, `${reel.id}: weight missing.`);
  assert.ok(Number(reel.max_drag_lb) > 0, `${reel.id}: drag missing.`);
  assert.ok(reel.spec_source_urls?.length, `${reel.id}: source missing.`);

  for (const line of usableLines) {
    const capacity = core.calculateFullSpoolCapacity(reel, line, { lineCatalog: lines });
    assert.ok(Number.isFinite(capacity) && capacity > 0, `${reel.id}/${line.id}: invalid full-spool capacity.`);
    fullSpoolCases += 1;
    const turns = core.calculateHandleTurns(capacity, reel.line_retrieve_in);
    assert.ok(turns && turns.rangeMin <= turns.approximateTurns && turns.approximateTurns <= turns.rangeMax);
    handleTurnCases += 1;

    if (material(line) === "braid") {
      const result = core.calculateActualLineBraidCapacityRange(reel, line, lines);
      if (reel.braid_capacity_note) {
        assert.ok(result, `${reel.id}/${line.id}: published braid note did not produce a range.`);
        assert.ok(result.minimumYards <= result.centerYards && result.centerYards <= result.maximumYards);
        braidRangeCases += 1;
      }
    }
  }

  for (const option of core.publishedBraidCapacityOptions(reel)) {
    const generic = { type: "Braid", lb: option.lb, dia_in: 0.01, generic_recommendation: true };
    const estimate = core.calculatePublishedBraidCapacity(reel, generic);
    assert.equal(estimate.method, "exact", `${reel.id}: exact published braid strength was not exact.`);
    assert.equal(estimate.yards, option.yards, `${reel.id}: published braid yardage changed.`);
    publishedAnchorCases += 1;
  }

  const sampleLines = [
    braidLines[Math.abs(reel.id.length * 7) % braidLines.length],
    solidLines[Math.abs(reel.id.length * 11) % solidLines.length],
  ];
  for (const mainLine of sampleLines) {
    const capacity = core.calculateFullSpoolCapacity(reel, mainLine, { lineCatalog: lines });
    for (const backingLine of backingLines) {
      const lowMain = core.calculateActualLineCalibratedBacking(reel, mainLine, capacity * 0.25, backingLine, lines);
      const highMain = core.calculateActualLineCalibratedBacking(reel, mainLine, capacity * 0.75, backingLine, lines);
      assert.ok(lowMain && highMain, `${reel.id}: backing calculation unavailable.`);
      assert.ok(lowMain.backingYards >= highMain.backingYards, `${reel.id}: backing increased with more main line.`);
      assert.equal(lowMain.overCapacity, false);
      assert.equal(highMain.overCapacity, false);
      backingCases += 2;
    }
  }

  const braidRecommendationRange = range(reel.reelcalc_recommended_braid);
  const solidRecommendationRange = range(reel.reelcalc_recommended_mono_fluoro);
  for (const fishingType of fishingTypes) {
    for (const priority of priorities) {
      recommendationScenarios += 1;
      const compatibility = engine.recommendationCompatibility(reel, fishingType);
      const cards = engine.recommendSetups({
        reel,
        lines,
        fishingType,
        priority,
        calculateFullSpoolCapacity: core.calculateFullSpoolCapacity,
      });
      if (!compatibility.recommend) {
        assert.equal(cards.length, 0, `${reel.id}/${fishingType}: blocked path returned recommendations.`);
        continue;
      }
      assert.ok(cards.length >= 3, `${reel.id}/${fishingType}/${priority}: too few recommendation choices.`);
      for (const card of cards) {
        assert.ok(Number.isFinite(card.capacityYards) && card.capacityYards > 0, `${reel.id}: invalid recommendation capacity.`);
        assert.doesNotMatch(card.explanation, /spinning reel/i, `${reel.id}: spinning wording leaked into baitcaster recommendation.`);
        const cardMaterial = material(card.line);
        if (cardMaterial === "braid") {
          if (card.capacityYards > 325) failures.push(`${reel.id}/${fishingType}/${card.title}: ${Math.round(card.capacityYards)} yd of ${card.line.lb} lb braid`);
          maximumRecommendedBraidYards = Math.max(maximumRecommendedBraidYards, card.capacityYards);
          assert.ok(card.line.lb >= braidRecommendationRange[0], `${reel.id}: braid recommendation below configured minimum.`);
        }
        if (["mono", "fluorocarbon"].includes(cardMaterial)) {
          assert.ok(card.line.lb >= solidRecommendationRange[0] && card.line.lb <= solidRecommendationRange[1], `${reel.id}: solid-line recommendation outside configured range.`);
        }
        recommendationCards += 1;
      }
    }
  }
}

assert.deepEqual(failures, [], `Unrealistic baitcaster braid recommendations:\n${failures.slice(0, 30).join("\n")}`);

const report = {
  status: "PASSED",
  baitcasters: baitcasters.length,
  spinningRecordsPreserved: spinning.length,
  usableLineRecords: usableLines.length,
  fullSpoolCapacityCases: fullSpoolCases,
  braidRangeCases,
  backingCases,
  handleTurnCases,
  publishedAnchorCases,
  recommendationScenarios,
  recommendationCards,
  maximumRecommendedBraidYards: Number(maximumRecommendedBraidYards.toFixed(1)),
};

fs.writeFileSync(path.join(root, "reports", "baitcaster-wizard-500-audit-2026-08-23.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
