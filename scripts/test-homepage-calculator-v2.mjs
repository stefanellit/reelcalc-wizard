import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const sourcePath = new URL("../js/homepage-calculator-v2.js", import.meta.url);
const source = fs.readFileSync(sourcePath, "utf8");
const coreSource = fs.readFileSync(new URL("../js/calculator-core.js", import.meta.url), "utf8");
const context = vm.createContext({
  console,
  window: {},
  document: {
    addEventListener() {}
  }
});

vm.runInContext(coreSource, context, { filename: "calculator-core.js" });
vm.runInContext(source, context, { filename: "homepage-calculator-v2.js" });
const estimate = context.window.ReelCalcHomepageTest.estimateSetup;
const resolveRating = context.window.ReelCalcHomepageTest.resolveRating;
const assessDiameter = context.window.ReelCalcHomepageTest.assessDiameter;
const assumedRatingDiameter = context.window.ReelCalcHomepageTest.assumedRatingDiameter;
const likelyDiameterSuggestion = context.window.ReelCalcHomepageTest.likelyDiameterSuggestion;
const ratingPairState = context.window.ReelCalcHomepageTest.ratingPairState;

const yardsPerMeter = 1 / 0.9144;
const inchesPerMillimeter = 1 / 25.4;
const metricRating = (meters, diameterMm) => ({
  capacityYards: meters * yardsPerMeter,
  referenceDiameterIn: diameterMm * inchesPerMillimeter
});
const standardRating = (yards, diameterIn) => ({
  capacityYards: yards,
  referenceDiameterIn: diameterIn
});
const closeTo = (actual, expected, tolerance = 1e-6) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`
  );
};

const crossfire4000 = estimate({
  workingRating: metricRating(200, 0.18),
  backingRating: metricRating(150, 0.28),
  workingYards: 150 * yardsPerMeter,
  workingDiameterIn: 0.16 * inchesPerMillimeter,
  backingDiameterIn: 0.30 * inchesPerMillimeter,
  capacityOnly: false
});
closeTo(crossfire4000.backingYards / yardsPerMeter, 53.23456790123457);

const auditPromptCrossfire = estimate({
  workingRating: metricRating(310, 0.16),
  backingRating: metricRating(130, 0.30),
  workingYards: 150 * yardsPerMeter,
  workingDiameterIn: 0.16 * inchesPerMillimeter,
  backingDiameterIn: 0.30 * inchesPerMillimeter,
  capacityOnly: false
});
closeTo(auditPromptCrossfire.backingYards / yardsPerMeter, 67.0967741935484);

const monoOnly = estimate({
  workingRating: standardRating(200, 0.012),
  backingRating: standardRating(200, 0.012),
  workingYards: 100,
  workingDiameterIn: 0.009,
  backingDiameterIn: 0.012,
  capacityOnly: false
});
closeTo(monoOnly.backingYards, 143.75);

const braidOnly = estimate({
  workingRating: standardRating(240, 0.009),
  backingRating: standardRating(240, 0.009),
  workingYards: 150,
  workingDiameterIn: 0.009,
  backingDiameterIn: 0.012,
  capacityOnly: false
});
closeTo(braidOnly.backingYards, 50.625);

const reverseMixed = estimate({
  workingRating: standardRating(200, 0.012),
  backingRating: standardRating(240, 0.009),
  workingYards: 100,
  workingDiameterIn: 0.009,
  backingDiameterIn: 0.012,
  capacityOnly: false
});
closeTo(reverseMixed.backingYards, 97.03125);

const capacityOnly = estimate({
  workingRating: standardRating(200, 0.012),
  workingYards: 0,
  workingDiameterIn: 0.009,
  capacityOnly: true
});
closeTo(capacityOnly.fullWorkingCapacityYards, 355.55555555555554);

const overCapacity = estimate({
  workingRating: standardRating(200, 0.012),
  backingRating: standardRating(200, 0.012),
  workingYards: 400,
  workingDiameterIn: 0.009,
  backingDiameterIn: 0.012,
  capacityOnly: false
});
assert.equal(overCapacity.error, "working_exceeds_capacity");

const ratingSet = {
  mono: standardRating(200, 0.012),
  braid: standardRating(240, 0.009)
};
const matchingBraid = resolveRating("braid", ratingSet);
assert.equal(matchingBraid.anchorType, "braid");
assert.equal(matchingBraid.fallback, false);

const monoOnlyFallback = resolveRating("braid", {
  mono: ratingSet.mono,
  braid: null
});
assert.equal(monoOnlyFallback.anchorType, "mono");
assert.equal(monoOnlyFallback.fallback, true);

const braidOnlyFallback = resolveRating("mono", {
  mono: null,
  braid: ratingSet.braid
});
assert.equal(braidOnlyFallback.anchorType, "braid");
assert.equal(braidOnlyFallback.fallback, true);

assert.equal(likelyDiameterSuggestion(30, true), 0.3);
assert.equal(likelyDiameterSuggestion(16, true), 0.16);
assert.equal(likelyDiameterSuggestion(12, false), 0.012);
assert.equal(assessDiameter(0, true, false).kind, "error");
assert.equal(assessDiameter(-0.3, true, false).kind, "error");
assert.equal(assessDiameter(30, true, false).suggestion, 0.3);
assert.equal(assessDiameter(1.2, true, false).valid, true);
assert.equal(assessDiameter(5, true, false).kind, "warning");
assert.equal(assessDiameter(5, true, true).valid, true);

assert.equal(ratingPairState(false, false, NaN, false), "blank");
assert.equal(ratingPairState(true, false, 130, false), "partial");
assert.equal(ratingPairState(false, true, NaN, true), "partial");
assert.equal(ratingPairState(true, true, 130, true), "complete");

assert.equal(assumedRatingDiameter("mono", 10), 0.012);
assert.equal(assumedRatingDiameter("braid", 15), 0.008);
assert.equal(assumedRatingDiameter("braid", 20), 0.009);
closeTo(assumedRatingDiameter("braid", 17.5), 0.0085);

console.log("Homepage calculator v2 calculation tests passed.");
