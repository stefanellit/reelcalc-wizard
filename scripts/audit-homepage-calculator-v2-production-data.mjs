import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const projectRoot = new URL("../", import.meta.url);
const source = fs.readFileSync(new URL("js/homepage-calculator-v2.js", projectRoot), "utf8");
const coreSource = fs.readFileSync(new URL("js/calculator-core.js", projectRoot), "utf8");
const reels = JSON.parse(fs.readFileSync(new URL("data/reels.json", projectRoot), "utf8"));
const lines = JSON.parse(fs.readFileSync(new URL("data/lines.json", projectRoot), "utf8"));
const context = vm.createContext({ console, window: {}, document: { addEventListener() {} } });
vm.runInContext(coreSource, context, { filename: "calculator-core.js" });
vm.runInContext(source, context, { filename: "homepage-calculator-v2.js" });

const {
  assumedRatingDiameter,
  capacityFromRating,
  estimateSetup
} = context.window.ReelCalcHomepageTest;

function nearlyEqual(actual, expected, tolerance = 1e-8) {
  return Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected));
}

function slashCapacityIsYardsFirst(reel) {
  const brand = String(reel?.brand || "").toLowerCase();
  return brand === "okuma" || brand === "pflueger" || brand === "quantum";
}

function parseFirstCapacityPair(reel) {
  const note = reel?.braid_capacity_note;
  if (typeof note !== "string") return null;
  if (/\bPE\b/i.test(note)) return null;
  const match = note.match(/(?:^|[^0-9.])(\d+(?:\.\d+)?)\s*([-/:])\s*(\d+(?:\.\d+)?)(?=$|[^0-9.])/);
  if (!match) return null;
  const first = Number(match[1]);
  const separator = match[2];
  const second = Number(match[3]);
  const yardsFirst = separator === "/" && slashCapacityIsYardsFirst(reel);
  const strengthLb = yardsFirst ? second : first;
  const capacityYards = yardsFirst ? first : second;
  if (!(strengthLb > 0 && strengthLb <= 1000 && capacityYards > 0 && capacityYards <= 100000)) return null;
  return { strengthLb, capacityYards };
}

function monoRating(reel) {
  if (!(Number(reel.capacity_yards) > 0 && Number(reel.rated_line_diameter_in) > 0)) return null;
  return {
    capacityYards: Number(reel.capacity_yards),
    referenceDiameterIn: Number(reel.rated_line_diameter_in),
    type: "mono"
  };
}

function braidRating(reel) {
  const pair = parseFirstCapacityPair(reel);
  if (!pair) return null;
  return {
    capacityYards: pair.capacityYards,
    referenceDiameterIn: assumedRatingDiameter("braid", pair.strengthLb),
    strengthLb: pair.strengthLb,
    type: "braid"
  };
}

const readyReels = reels.filter((reel) => reel.capacity_status === "ready");
const usableReels = readyReels.filter((reel) => monoRating(reel));
const usableLines = lines.filter((line) => Number(line.dia_in) > 0 && Number.isFinite(Number(line.dia_in)));

assert.equal(readyReels.length, 1320, "Ready-reel count changed; review the audit baseline intentionally.");
assert.equal(usableReels.length, readyReels.length, "Every ready reel must have a positive mono capacity and diameter.");
assert.ok(usableLines.length >= 900, "Expected the current real line database, not a reduced fixture.");

let publishedMonoIdentityChecks = 0;
let oldCalculatorParityChecks = 0;
let publishedBraidIdentityChecks = 0;
let crossMaterialChecks = 0;
let realReelLineChecks = 0;

for (const reel of usableReels) {
  const mono = monoRating(reel);
  const exactPublishedCapacity = capacityFromRating(mono, mono.referenceDiameterIn);
  assert.ok(
    nearlyEqual(exactPublishedCapacity, mono.capacityYards),
    `${reel.id}: its exact published mono diameter did not reproduce its published capacity`
  );
  publishedMonoIdentityChecks += 1;

  for (const selectedDiameterIn of [0.003, 0.006, 0.009, 0.012, 0.018, 0.03, 0.05]) {
    const current = capacityFromRating(mono, selectedDiameterIn);
    const originalFormula = Number(reel.capacity_yards) * Math.pow(
      Number(reel.rated_line_diameter_in) / selectedDiameterIn,
      2
    );
    assert.ok(nearlyEqual(current, originalFormula), `${reel.id}: exact-mono behavior changed from the original calculator`);
    oldCalculatorParityChecks += 1;
  }

  const braid = braidRating(reel);
  if (braid) {
    assert.ok(
      nearlyEqual(capacityFromRating(braid, braid.referenceDiameterIn), braid.capacityYards),
      `${reel.id}: its parsed braid rating did not reproduce its published capacity`
    );
    publishedBraidIdentityChecks += 1;

    const braidMain = estimateSetup({
      workingRating: braid,
      backingRating: mono,
      workingYards: braid.capacityYards * 0.75,
      workingDiameterIn: braid.referenceDiameterIn,
      backingDiameterIn: mono.referenceDiameterIn,
      capacityOnly: false
    });
    assert.equal(braidMain.error, undefined, `${reel.id}: braid-main setup unexpectedly failed`);
    assert.ok(nearlyEqual(braidMain.backingYards, mono.capacityYards * 0.25), `${reel.id}: braid-main/mono-backing space split failed`);

    const monoMain = estimateSetup({
      workingRating: mono,
      backingRating: braid,
      workingYards: mono.capacityYards * 0.75,
      workingDiameterIn: mono.referenceDiameterIn,
      backingDiameterIn: braid.referenceDiameterIn,
      capacityOnly: false
    });
    assert.equal(monoMain.error, undefined, `${reel.id}: mono-main setup unexpectedly failed`);
    assert.ok(nearlyEqual(monoMain.backingYards, braid.capacityYards * 0.25), `${reel.id}: mono-main/braid-backing space split failed`);
    crossMaterialChecks += 2;
  }

  for (const line of usableLines) {
    const isBraid = /braid/i.test(String(line.type));
    const selectedRating = isBraid && braid ? braid : mono;
    const fullCapacity = capacityFromRating(selectedRating, Number(line.dia_in));
    assert.ok(Number.isFinite(fullCapacity) && fullCapacity > 0, `${reel.id} + ${line.id}: invalid capacity`);

    const result = estimateSetup({
      workingRating: selectedRating,
      backingRating: mono,
      workingYards: fullCapacity * 0.6,
      workingDiameterIn: Number(line.dia_in),
      backingDiameterIn: mono.referenceDiameterIn,
      capacityOnly: false
    });
    assert.equal(result.error, undefined, `${reel.id} + ${line.id}: valid 60% fill was rejected`);
    assert.ok(nearlyEqual(result.backingYards, mono.capacityYards * 0.4), `${reel.id} + ${line.id}: remaining spool fraction was not preserved`);
    realReelLineChecks += 1;
  }
}

const matrixDefinitions = [
  ["ultralight", (reel) => reel.id === "abu-garcia-max-x-spinning-750-maxxsp750-1"],
  ["compact freshwater", (reel) => reel.id === "pflueger-president-30-pres30x-542"],
  ["all-around freshwater", (reel) => reel.id === "shimano-vanford-fa-c3000xga-vfc3000xga-692"],
  ["4000 freshwater/inshore", (reel) => reel.id === "daiwa-bg-4000-bg4000-187"],
  ["high braid rating", (reel) => reel.id === "kastking-centron-spinning-4000-51-294"],
  ["nonstandard size label", (reel) => reel.id === "lew-s-kvd-spinning-reel-300-kvd300-340"],
  ["heavy saltwater", (reel) => reel.id === "penn-battle-iv-10000-btliv10000-466"]
];

const matrixResults = matrixDefinitions.map(([role, predicate]) => {
  const reel = reels.find(predicate);
  assert.ok(reel, `Missing real-reel matrix record for ${role}`);
  const mono = monoRating(reel);
  const braid = braidRating(reel);
  assert.ok(mono && braid, `${reel.id}: real-reel matrix requires both capacity systems`);
  const requestedMainYards = Math.min(150, braid.capacityYards * 0.7);
  const result = estimateSetup({
    workingRating: braid,
    backingRating: mono,
    workingYards: requestedMainYards,
    workingDiameterIn: braid.referenceDiameterIn,
    backingDiameterIn: mono.referenceDiameterIn,
    capacityOnly: false
  });
  assert.equal(result.error, undefined);
  assert.ok(Number.isFinite(result.backingYards) && result.backingYards >= 0);
  return {
    role,
    reel: `${reel.brand} ${reel.model} ${reel.size_label}`,
    main: `${requestedMainYards.toFixed(1)} yd at published ${braid.strengthLb} lb braid reference`,
    backing: `${result.backingYards.toFixed(1)} yd at published mono reference`
  };
});

console.log("Homepage Calculator V2 production-data audit passed.");
console.log(`- ${publishedMonoIdentityChecks.toLocaleString()} published mono identity checks`);
console.log(`- ${publishedBraidIdentityChecks.toLocaleString()} published braid identity checks`);
console.log(`- ${oldCalculatorParityChecks.toLocaleString()} original exact-mono parity checks`);
console.log(`- ${crossMaterialChecks.toLocaleString()} cross-material spool-space checks`);
console.log(`- ${realReelLineChecks.toLocaleString()} actual reel x actual line calculations`);
console.log("- Real-reel matrix:");
for (const item of matrixResults) {
  console.log(`  - ${item.role}: ${item.reel}; ${item.main}; ${item.backing}`);
}
