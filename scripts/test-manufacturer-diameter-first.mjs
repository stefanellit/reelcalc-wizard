import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = '0af1318bbdc0fbfd3f124b0d4f57af8c6eec7f48';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const git = file => execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root, maxBuffer: 40e6 }).toString();
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const load = source => { const context = { window: {} }; vm.runInNewContext(source, context); return context.window.ReelCalcCore; };
const core = load(read('js/calculator-core.js'));
const old = load(git('js/calculator-core.js'));
const reels = JSON.parse(read('data/reels.json'));
const original = JSON.parse(git('data/reels.json'));
const evidence = JSON.parse(read('data/reel-diameter-evidence.json'));
const lines = JSON.parse(read('data/lines.json'));
const workspace = path.resolve(root, '../..');
const plain = value => JSON.parse(JSON.stringify(value));
const stripVersion = value => {
  if (!value) return value;
  const result = plain(value);
  delete result.engineVersion;
  return result;
};
let checks = 0;
function close(a, b, label) {
  assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= Math.max(1, Math.abs(b)) * 1e-10, `${label}: ${a} vs ${b}`);
  checks++;
}
assert.deepEqual(reels.map(({ manufacturer_capacity_ratings, ...legacy }) => legacy), original, 'Original reel fields changed');
for (const file of ['data/lines.json', 'js/capacity-config.js', 'js/capacity-resolver.js', 'js/capacity-service.js', 'data/capacity-production/capacity-runtime.json', 'js/homepage-calculator-v2.js']) {
  assert.equal(digest(read(file).replaceAll('\r\n', '\n')), digest(git(file).replaceAll('\r\n', '\n')), 'Protected file changed: ' + file);
}
assert.match(read('js/capacity-config.js'), /capacityOnlyEnabled:false/);
assert.match(read('index.html'), /calculator-core\.js\?v=11/);
assert.match(read('index.html'), /wizard\.js\?v=25/);
assert.match(read('js/wizard.js'), /data\/reels\.json\?v=10/);
assert.match(read('js/reel-page-calculator.js'), /calculator-core\.js\?v=11/);
assert.match(read('js/squarespace-reel-page-loader.js'), /reel-page-calculator\.js\?v=14/);
assert.match(read('examples/reel-comparison-loader.js'), /diameter-first-1/);
assert.match(read('examples/reel-comparison.js'), /data\/reels\.json\?v=10/);
assert.equal(JSON.parse(read('data/line-page-release.json')).version, '21');
const inputs = new Map();
for (const item of evidence.input_manifest) {
  const content = fs.readFileSync(path.join(workspace, item.file));
  assert.equal(digest(content), item.sha256, 'Original research changed: ' + item.file);
  inputs.set(item.file, JSON.parse(content));
}
const at = (object, pointer) => pointer.slice(1).split('/').reduce((value, key) => value[key], object);
let rows = 0, eligible = 0;
for (const reel of reels) for (const row of reel.manufacturer_capacity_ratings || []) {
  rows++;
  const source = evidence.sources[row.id];
  assert.ok(source && source.reel_id === reel.id && row.reel_id === reel.id, 'Rating transferred to another reel');
  assert.deepEqual(source.raw, at(inputs.get(source.origin.file), source.origin.pointer), 'Raw provenance changed');
  if (row.normalized) {
    close(row.normalized.diameter_mm, row.original.diameter.value * (row.original.diameter.unit === 'mm' ? 1 : 25.4), 'Diameter units');
    close(row.normalized.capacity_meters, row.original.capacity.value * (row.original.capacity.unit === 'm' ? 1 : 0.9144), 'Length units');
  }
  if (!row.calculation_eligible) continue;
  eligible++;
  assert.ok(['mono', 'braid'].includes(row.material));
  assert.ok(row.normalized && !row.conflicting_rating_ids);
  if (row.verification_status === 'verified_source') {
    assert.equal(source.raw.exact_model_verified, true);
    assert.equal(source.inherited_source_decision.state, 'eligible_verified');
    assert.equal(source.inherited_evidence.raw.record_sha256, digest(JSON.stringify(source.raw)));
  } else {
    assert.equal(row.verification_status, 'reviewed_physical_source');
    assert.ok(source.release_review.materials.includes(row.material));
    assert.equal(evidence.photo_records[source.photo_id].assessment_active, true);
    assert.equal(evidence.photo_records[source.photo_id].sku, reel.sku);
  }
}
assert.equal(rows, evidence.summary.stored_evidence_rows);
assert.equal(eligible, evidence.summary.eligible_rows);

const rating = (material, mm, m, id = material) => ({ id, reel_id: 'test-reel', material,
  normalized: { diameter_mm: mm, capacity_meters: m }, calculation_eligible: true, verification_status: 'verified_source' });
const testReel = { id: 'test-reel', capacity_yards: 100, rated_line_diameter_in: 0.01,
  braid_capacity_note: '10-160', manufacturer_capacity_ratings: [rating('braid', 0.18, 300), rating('mono', 0.33, 150)] };
const line = (type, mm, lb = 20) => ({ type, lb, dia_in: mm / 25.4, custom_line: true });
for (const mm of [0.01, 0.12, 0.18, 0.21, 0.37, 1, 3]) {
  const braid = line('Braid', mm);
  const expected = 300 / 0.9144 * (0.18 / mm) ** 2;
  close(core.calculateFullSpoolCapacity(testReel, braid), expected, 'Any diameter, including outside printed range');
  close(core.capacityBasisForActualLine(testReel, braid, lines).capacityYards, expected, 'Basis parity');
  close(core.actualLineBraidCapacityEstimate(testReel, braid, lines).centerYards, expected, 'Braid range parity');
  for (const type of ['Mono', 'Monofilament', 'Fluorocarbon', 'Copolymer']) {
    close(core.calculateFullSpoolCapacity(testReel, line(type, mm)), 150 / 0.9144 * (0.33 / mm) ** 2, 'Mono-family mapping');
  }
}
close(core.calculateFullSpoolCapacity(testReel, line('Braid', 0.21, 999)), (300 * 0.18 ** 2 / 0.21 ** 2) / 0.9144, 'Pounds cannot override diameter');
const nearest = { ...testReel, manufacturer_capacity_ratings: [rating('braid', 0.16, 430, 'a'), rating('braid', 0.18, 300, 'b'), rating('braid', 0.20, 230, 'c')] };
assert.equal(core.manufacturerDiameterBasis(nearest, line('Braid', 0.21)).anchor.id, 'c');
assert.deepEqual(plain(core.manufacturerDiameterBasis(nearest, line('Braid', 0.21))), plain(core.manufacturerDiameterBasis({ ...nearest, manufacturer_capacity_ratings: [...nearest.manufacturer_capacity_ratings].reverse() }, line('Braid', 0.21))));
const monoOnly = { ...testReel, manufacturer_capacity_ratings: [rating('mono', 0.33, 150)] };
assert.equal(core.manufacturerDiameterBasis(monoOnly, line('Braid', 0.21)), null, 'No new cross-material substitution');
assert.equal(core.manufacturerDiameterBasis({ ...testReel, id: 'another-reel' }, line('Braid', 0.21)), null, 'No SKU transfer');
assert.equal(core.manufacturerDiameterBasis({ ...testReel, manualRating: {} }, line('Braid', 0.21)), null, 'Manual ratings preserved');
assert.equal(core.manufacturerDiameterBasis({ ...testReel, manufacturer_capacity_ratings: [{ ...rating('braid', 0.18, 300), calculation_eligible: false }] }, line('Braid', 0.21)), null, 'Held evidence ignored');

for (const mainType of ['Mono', 'Braid']) for (const backingType of ['Mono', 'Braid']) {
  const main = line(mainType, 0.21), backing = line(backingType, 0.30);
  const fullMain = core.capacityBasisForActualLine(testReel, main, lines).capacityYards;
  const fullBacking = core.capacityBasisForActualLine(testReel, backing, lines).capacityYards;
  for (const fraction of [0, 0.5, 1, 1.01]) {
    const result = core.calculateActualLineCalibratedBacking(testReel, main, fullMain * fraction, backing, lines);
    close(result.backingYards, fullBacking * Math.max(0, 1 - fraction), 'Material-specific backing fraction');
    assert.equal(result.overCapacity, fraction > 1);
    close(result.totalSpoolSpace, fullMain * main.dia_in ** 2, 'Correct selected reference in diagnostic fields');
  }
}

let fallbackChecks = 0, catalogueChecks = 0;
const sampleLines = ['Mono', 'Fluorocarbon', 'Copolymer', 'Braid'].flatMap(type => [0.10, 0.21, 0.40].map(mm => line(type, mm)));
for (const [index, reel] of reels.entries()) {
  for (const selected of sampleLines) {
    const basis = core.manufacturerDiameterBasis(reel, selected);
    const capacity = core.calculateFullSpoolCapacity(reel, selected, { lineCatalog: lines });
    if (basis) {
      close(capacity, basis.capacityYards, 'Shared capacity/basis parity');
      close(core.capacityBasisForActualLine(reel, selected, lines).capacityYards, capacity, 'Page/wizard/line/comparison basis parity');
      catalogueChecks++;
    } else {
      assert.equal(capacity, old.calculateFullSpoolCapacity(original[index], selected, { lineCatalog: lines }), 'Legacy capacity changed without same-material evidence: ' + reel.id);
      assert.deepEqual(plain(core.capacityBasisForActualLine(reel, selected, lines)), plain(old.capacityBasisForActualLine(original[index], selected, lines)), 'Fallback basis changed');
      fallbackChecks++;
    }
  }
  if (!reel.manufacturer_capacity_ratings?.some(row => row.calculation_eligible)) {
    const main = line('Braid', 0.21), backing = line('Mono', 0.30);
    assert.deepEqual(stripVersion(core.calculateActualLineCalibratedBacking(reel, main, 30, backing, lines)), stripVersion(old.calculateActualLineCalibratedBacking(original[index], main, 30, backing, lines)), 'Legacy backing changed');
    fallbackChecks++;
  }
}
const result = { checks, catalogueChecks, fallbackChecks, evidenceRowsChecked: rows, eligibleRowsChecked: eligible,
  exactAndNonmatchingDiametersPass: true, experimentalSwitchOff: true, legacyDataPreserved: true };
fs.mkdirSync(path.join(root, 'reports/manufacturer-diameter-first'), { recursive: true });
fs.writeFileSync(path.join(root, 'reports/manufacturer-diameter-first/test-results.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
