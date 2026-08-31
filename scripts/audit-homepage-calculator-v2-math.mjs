import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/homepage-calculator-v2.js", import.meta.url), "utf8");
const coreSource = fs.readFileSync(new URL("../js/calculator-core.js", import.meta.url), "utf8");
const context = vm.createContext({ console, window: {}, document: { addEventListener() {} } });
vm.runInContext(coreSource, context, { filename: "calculator-core.js" });
vm.runInContext(source, context, { filename: "homepage-calculator-v2.js" });

const {
  assumedRatingDiameter,
  capacityFromRating,
  estimateSetup,
  resolveRating
} = context.window.ReelCalcHomepageTest;

const strengths = [2, 3, 4, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 65, 80, 100, 120];
for (const type of ["mono", "braid"]) {
  let previous = 0;
  for (let lb = 1; lb <= 200; lb += 0.25) {
    const diameter = assumedRatingDiameter(type, lb);
    assert.ok(Number.isFinite(diameter) && diameter > 0, `${type} ${lb} lb assumption is invalid`);
    assert.ok(diameter + 1e-12 >= previous, `${type} assumption decreases at ${lb} lb`);
    previous = diameter;
  }
}

strengths.forEach((lb) => {
  assert.ok(
    assumedRatingDiameter("mono", lb) >= assumedRatingDiameter("braid", lb),
    `${lb} lb mono assumption should not be thinner than braid`
  );
});

let gridCases = 0;
for (const capacityYards of [50, 100, 150, 300, 500, 1000, 5000]) {
  for (const ratingType of ["mono", "braid"]) {
    for (const ratingLb of strengths) {
      const rating = {
        capacityYards,
        referenceDiameterIn: assumedRatingDiameter(ratingType, ratingLb),
        type: ratingType
      };
      for (const mainDiameterIn of [0.003, 0.005, 0.008, 0.012, 0.02, 0.04]) {
        const fullCapacity = capacityFromRating(rating, mainDiameterIn);
        assert.ok(Number.isFinite(fullCapacity) && fullCapacity > 0);
        let priorBacking = Infinity;
        for (const fraction of [0, 0.1, 0.25, 0.5, 0.75, 0.995, 1]) {
          const backingRating = {
            capacityYards: capacityYards * 1.1,
            referenceDiameterIn: assumedRatingDiameter(ratingType === "mono" ? "braid" : "mono", ratingLb),
            type: ratingType === "mono" ? "braid" : "mono"
          };
          const result = estimateSetup({
            workingRating: rating,
            backingRating,
            workingYards: fullCapacity * fraction,
            workingDiameterIn: mainDiameterIn,
            backingDiameterIn: 0.012,
            capacityOnly: false
          });
          assert.equal(result.error, undefined);
          assert.ok(Number.isFinite(result.backingYards) && result.backingYards >= -1e-9);
          assert.ok(result.backingYards <= priorBacking + 1e-9, "backing must decrease as main line increases");
          priorBacking = result.backingYards;
          if (fraction === 1) assert.ok(Math.abs(result.backingYards) <= 1e-8);
          gridCases += 1;
        }
      }
    }
  }
}

let seed = 0x5eed1234;
function random() {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 0x100000000;
}

let randomCases = 0;
for (let index = 0; index < 50000; index += 1) {
  const workingRating = {
    capacityYards: 10 + random() * 4990,
    referenceDiameterIn: 0.003 + random() * 0.047
  };
  const backingRating = {
    capacityYards: 10 + random() * 4990,
    referenceDiameterIn: 0.003 + random() * 0.047
  };
  const workingDiameterIn = 0.003 + random() * 0.047;
  const backingDiameterIn = 0.003 + random() * 0.047;
  const fullCapacity = capacityFromRating(workingRating, workingDiameterIn);
  const fraction = random() * 1.2;
  const result = estimateSetup({
    workingRating,
    backingRating,
    workingYards: fullCapacity * fraction,
    workingDiameterIn,
    backingDiameterIn,
    capacityOnly: false
  });

  if (fraction > 1 + 1e-10) {
    assert.equal(result.error, "working_exceeds_capacity");
  } else {
    assert.equal(result.error, undefined);
    assert.ok(Number.isFinite(result.fullWorkingCapacityYards) && result.fullWorkingCapacityYards > 0);
    assert.ok(Number.isFinite(result.fullBackingCapacityYards) && result.fullBackingCapacityYards > 0);
    assert.ok(Number.isFinite(result.backingYards) && result.backingYards >= 0);
    assert.ok(result.workingFraction >= 0 && result.workingFraction <= 1 + 1e-10);
  }
  randomCases += 1;
}

const mono = { capacityYards: 150, referenceDiameterIn: 0.012, type: "mono" };
const braid = { capacityYards: 200, referenceDiameterIn: 0.008, type: "braid" };
assert.equal(resolveRating("mono", { mono, braid }).fallback, false);
assert.equal(resolveRating("braid", { mono, braid }).fallback, false);
assert.equal(resolveRating("braid", { mono, braid: null }).anchorType, "mono");
assert.equal(resolveRating("mono", { mono: null, braid }).anchorType, "braid");
assert.equal(resolveRating("mono", { mono: null, braid: null }), null);

const crossfire = estimateSetup({
  workingRating: { capacityYards: 200 / 0.9144, referenceDiameterIn: 0.18 / 25.4 },
  backingRating: { capacityYards: 150 / 0.9144, referenceDiameterIn: 0.28 / 25.4 },
  workingYards: 150 / 0.9144,
  workingDiameterIn: 0.16 / 25.4,
  backingDiameterIn: 0.3 / 25.4,
  capacityOnly: false
});
assert.ok(Math.abs(crossfire.backingYards * 0.9144 - 53.23456790123457) < 1e-9);

console.log("Homepage Calculator V2 mathematical audit passed.");
console.log(`- ${gridCases} structured material/capacity/fill combinations`);
console.log(`- ${randomCases} deterministic randomized backing calculations`);
console.log("- Rating assumptions stayed positive and monotonic from 1-200 lb");
console.log("- Fallback routing, over-capacity blocking, monotonic backing, and Crossfire regression passed");
