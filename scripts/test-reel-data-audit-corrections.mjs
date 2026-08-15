import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");
const reels = JSON.parse(read("data/reels.json"));
const byId = new Map(reels.map((reel) => [reel.id, reel]));
const sandbox = { window: {}, URL, URLSearchParams, Map, Set, Array, Number, String, Math };
vm.createContext(sandbox);
vm.runInContext(read("js/calculator-core.js"), sandbox);
const core = sandbox.window.ReelCalcCore;

function reel(id) {
  const result = byId.get(id);
  assert.ok(result, `Missing reel ${id}`);
  return result;
}

assert.equal(reels.length, 836, "Audit corrections must not add or remove reel records");
assert.equal(new Set(reels.map((item) => item.id)).size, 836, "Audit corrections must preserve unique stable IDs");

const expectedKvd = new Map([
  ["lew-s-kvd-spinning-reel-200-kvd200-339", { mono: "8-120", braid: "10-180" }],
  ["lew-s-kvd-spinning-reel-300-kvd300-340", { mono: "10-180", braid: "15-250" }],
  ["lew-s-kvd-spinning-reel-400-kvd400-341", { mono: "12-190", braid: "20-300" }],
]);
for (const [id, expected] of expectedKvd) {
  const item = reel(id);
  assert.equal(item.capacity_note, expected.mono, `${id} mono capacity drifted`);
  assert.equal(item.braid_capacity_note, expected.braid, `${id} braid capacity drifted`);
  assert.equal(item.spec_verification_status, "manufacturer_listed", `${id} lost its source status`);
  assert.equal(item.data_warnings.length, 0, `${id} retained a stale warning`);
}

const elite300 = reel("lew-s-kvd-elite-spinning-reel-300-kvd300g2-337");
assert.equal(elite300.capacity_note, "8-200", "Current KVD Elite 300 product-page value should remain selected");
assert.equal(elite300.spec_verification_status, "source_conflict", "KVD Elite 300 source conflict must remain visible in data");
assert.ok(elite300.source_conflicts.some((conflict) => conflict.conflicting_value === "8 lb / 205 yd"));

const eliteShallow = reel("lew-s-kvd-elite-spinning-reel-300-shallow-kvd300ssg2-338");
assert.equal(eliteShallow.sku, "KVDSS300G2", "KVD Elite shallow-spool SKU is incorrect");
assert.equal(eliteShallow.capacity_note, "8-120");
assert.equal(eliteShallow.braid_capacity_note, "10-180");
assert.ok(eliteShallow.aliases.includes("KVD300SSG2"), "Legacy shallow-spool SKU alias was not retained");

const expectedFormula = new Map([
  ["bass-pro-shops-formula-spinning-reel-10-fma10-47", { mono: "4-200, 6-140, 8-110", braid: "15-200, 20-140, 30-110", ipt: 18 }],
  ["bass-pro-shops-formula-spinning-reel-20-fma20-48", { mono: "6-160, 8-125, 10-105", braid: "20-160, 30-125, 40-105", ipt: 21 }],
  ["bass-pro-shops-formula-spinning-reel-30-fma30-49", { mono: "8-150, 10-115, 12-100", braid: "30-150, 40-115, 50-100", ipt: 22 }],
  ["bass-pro-shops-formula-spinning-reel-40-fma40-50", { mono: "10-170, 12-130, 14-115", braid: "40-170, 50-130, 65-80", ipt: 24 }],
]);
for (const [id, expected] of expectedFormula) {
  const item = reel(id);
  assert.equal(item.capacity_note, expected.mono, `${id} mono family table drifted`);
  assert.equal(item.braid_capacity_note, expected.braid, `${id} braid family table drifted`);
  assert.equal(item.line_retrieve_in, expected.ipt, `${id} retrieve drifted`);
  assert.equal(item.spec_verification_status, "manufacturer_listed");
  assert.ok(core.publishedBraidCapacityOptions(item).length === 3, `${id} should expose three braid anchors`);
}

const expectedSeaLion = new Map([
  ["offshore-angler-sea-lion-spinning-reel-5000-sls50-79", { mono: "12-240, 14-220, 17-170", braid: "50-210, 65-170, 80-130", ipt: 34 }],
  ["offshore-angler-sea-lion-spinning-reel-6000-sls60-80", { mono: "14-255, 17-230, 20-190", braid: "65-230, 80-190, 100-150", ipt: 37 }],
  ["offshore-angler-sea-lion-spinning-reel-7000-sls70-81", { mono: "25-240, 30-210, 40-135", braid: "80-260, 100-230, 150-195", ipt: 37 }],
  ["offshore-angler-sea-lion-spinning-reel-8000-sls80-82", { mono: "30-270, 40-180, 50-140", braid: "80-305, 100-250, 150-230", ipt: 41 }],
]);
for (const [id, expected] of expectedSeaLion) {
  const item = reel(id);
  assert.equal(item.capacity_note, expected.mono, `${id} mono family table drifted`);
  assert.equal(item.braid_capacity_note, expected.braid, `${id} braid family table drifted`);
  assert.equal(item.line_retrieve_in, expected.ipt, `${id} retrieve drifted`);
  assert.equal(item.spec_verification_status, "manufacturer_listed");
  assert.ok(core.publishedBraidCapacityOptions(item).length === 3, `${id} should expose three braid anchors`);
}

const rox4000 = reel("okuma-rox-4000-rox-4000a-397");
assert.deepEqual(
  JSON.parse(JSON.stringify(core.publishedBraidCapacityOptions(rox4000))),
  [{ lb: 30, yards: 210 }],
  "Contradictory Okuma ROX 4000 row must not enter calculations"
);
assert.equal(rox4000.spec_verification_status, "source_conflict");

for (const id of [
  "okuma-avenger-b-6000-av-6000b-382",
  "okuma-avenger-b-8000-av-8000b-383",
  "okuma-avenger-b-10000-av-10000b-384",
  "okuma-avenger-b-14000-av-14000b-385",
]) {
  assert.equal(reel(id).braid_capacity_note, "", `${id} retained a TBD braid placeholder`);
}

for (const id of [
  "okuma-makaira-10000-mk-10000l-r-417",
  "okuma-makaira-20000-mk-20000ls-rs-418",
  "okuma-makaira-30000-mk-30000ls-rs-419",
]) {
  assert.equal(reel(id).source_url, "https://okumafishingusa.com/products/makaira-spinning", `${id} uses a retired source URL`);
}

const smokeX = reel("quantum-smoke-x-25-smx25xpt-bx3-608");
assert.equal(smokeX.weight_oz, 8.3);
assert.equal(smokeX.spec_verification_status, "manufacturer_listed");

const blockedReelIds = [
  "bass-pro-shops-pro-qualifier-spinning-reel-various-pqs-verify-52",
  "kastking-centron-spinning-1000-48-291",
  "kastking-brutus-spinning-2000-53-296",
  "kastking-brutus-spinning-3000-54-297",
  "kastking-brutus-spinning-4000-55-298",
  "kastking-brutus-spinning-5000-56-299",
  "kastking-valiant-eagle-spinning-1000-57-300",
  "kastking-valiant-eagle-spinning-2000-58-301",
  "kastking-valiant-eagle-spinning-3000-59-302",
  "kastking-valiant-eagle-spinning-4000-60-303",
  "kastking-crixus-spinning-2000-61-304",
  "kastking-crixus-spinning-3000-62-305",
  "kastking-crixus-spinning-4000-63-306",
  "kastking-pontus-baitfeeder-3000-64-307",
  "kastking-pontus-baitfeeder-4000-65-308",
  "kastking-pontus-baitfeeder-5000-66-309",
];
for (const id of blockedReelIds) {
  const item = reel(id);
  assert.ok(!(Number(item.capacity_yards) > 0), `${id} unexpectedly has an automatic capacity`);
  assert.ok(!(Number(item.rated_line_diameter_in) > 0), `${id} unexpectedly has an automatic rated diameter`);
  assert.equal(core.publishedBraidCapacityOptions(item).length, 0, `${id} unexpectedly exposes a braid anchor`);
  assert.ok(
    !Number.isFinite(core.calculateFullSpoolCapacity(item, { type: "Monofilament", lb: 10, dia_in: 0.012 })),
    `${id} must require manual capacity entry instead of calculating from missing specs`
  );
}

console.log("Reel data audit correction regressions passed for 26 source-reviewed and 16 blocked records.");
