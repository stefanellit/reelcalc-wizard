import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadLinePackModels } from '../../scripts/line-pack-sources.mjs';
import { resolutionScopeLabel } from '../../scripts/line-resolution-scope.mjs';
import { evaluateOverlay, setPath } from '../../research/line-pages/full-catalog/resolution-independent-review/original80-copy-cleanup/apply-overlay.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(root);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const hash = file => sha(fs.readFileSync(file));
const objectHash = value => sha(JSON.stringify(value));
const manifestPath = 'reports/resolution-integration/deployment-files.json';
const manifest = read(manifestPath);
const source = read(manifest.sourceSummary.file);
assert.equal(new Set(manifest.deliveryPaths).size, manifest.deliveryPaths.length);
assert.deepEqual([...manifest.files.map(entry => entry.file)].sort(), manifest.deliveryPaths);
for (const entry of manifest.files) {
  const absolute = path.resolve(root, entry.file);
  assert(absolute.startsWith(root + path.sep), `Path escapes repository: ${entry.file}`);
  assert(fs.existsSync(absolute), `Missing delivery file: ${entry.file}`);
  if (entry.sha256) assert.equal(hash(entry.file), entry.sha256, `Manifest stale: ${entry.file}`);
  else assert.equal(entry.file, manifestPath, 'Only self-manifest may omit its hash');
}
assert.equal(manifest.runtimePaths.length, 109);
assert.equal(manifest.runtimePaths.filter(file => file.startsWith('assets/')).length, 14);
assert.equal(manifest.runtimePaths.filter(file => file.includes('/pline-resolutions/')).length, 7);
assert(manifest.deliveryPaths.every(file => !/\.pdf$|node_modules|baseline-files|\/sources\/|\/evidence\//.test(file)));
const finalGate = read('reports/resolution-integration/final-browser-gate.json');
for (const file of manifest.deliveryPaths.filter(file => file.endsWith('.csv'))) {
  assert.equal(finalGate.actualImportBuilt, true);
  assert.equal(file, 'generated/line-pages/UPLOAD-THIS-14-new-line-guides.csv');
  assert.equal(hash(file), finalGate.import.sha256);
}
for (const entry of manifest.localOnlyChangedFiles) assert(!manifest.deliveryPaths.includes(entry.file));
const packs = loadLinePackModels();
const products = read('data/line-page-products.json');
const lines = read('data/lines.json');
const rowMap = new Map(lines.map(row => [row.id, row]));
assert.equal(rowMap.size, lines.length);
let checkedRows = 0;
for (const candidate of source.models) {
  const signed = packs.find(entry => entry.model.id === candidate.id);
  assert(signed?.resolution);
  assert.equal(objectHash(signed.model), candidate.modelSha256);
  assert.equal(objectHash(products.products[candidate.id]), candidate.productSha256);
  assert.equal(hash(candidate.image.file), candidate.image.sha256);
  assert.deepEqual(products.products[candidate.id].exampleSetups, signed.model.product.exampleSetups);
  assert.deepEqual(products.products[candidate.id].excludedLineIds, candidate.excludedLineIds);
  for (const evidence of signed.model.rows) {
    const row = rowMap.get(evidence.lineId || evidence.id);
    assert(row, `Missing exact row: ${candidate.id}/${evidence.lb}`);
    for (const [field, expected] of Object.entries({ brand: signed.model.brand, model: signed.model.model,
      type: signed.model.lineType, role: signed.model.role, lb: evidence.lb, dia_in: evidence.dia_in,
      dia_mm: evidence.dia_mm, diameter_basis: evidence.diameterBasis })) assert.equal(row[field], expected);
    assert.deepEqual(row.spool_sizes_yd, [...new Set(evidence.spool_sizes_yd)].sort((a, b) => a - b));
    assert.deepEqual(row.source_evidence, evidence);
    assert.equal(row.source_scope_label, resolutionScopeLabel(signed.model, evidence));
    assert.deepEqual(row, candidate.rows.find(entry => entry.id === row.id));
    checkedRows++;
  }
}
assert.equal(checkedRows, 42);
for (const entry of source.originalSourcePacks) assert.equal(hash(entry.file), entry.sha256);
const overlay = read(source.originalCopyOverlay.file);
const result = evaluateOverlay(products, overlay);
assert.equal(result.pending.length, 0);
assert.equal(result.alreadyApplied.length, 53);
const beforeOverlay = structuredClone(products);
for (const change of overlay.changes) setPath(beforeOverlay, change, change.before);
const phase = read('reports/resolution-integration/phase-one-verification.json');
for (const original of phase.frozenProducts) assert.equal(objectHash(beforeOverlay.products[original.id]), original.sha256, `Original product changed beyond overlay: ${original.id}`);
const numerical = read('reports/resolution-integration/deployment-scope-baseline.json');
for (const [file, expected] of Object.entries(numerical.files)) assert.equal(hash(file), expected);
const release = read('data/line-page-release.json');
const imported = read('generated/line-pages/imported-products.json').importedProducts;
assert.deepEqual([...release.products].sort(), [...source.original100ProductIds, ...source.newProductIds].sort());
assert(imported.every(id => release.products.includes(id)));
assert(source.original100ProductIds.every(id => imported.includes(id)));
assert(release.publishedProducts.every(id => imported.includes(id)));
for (const id of source.heldAndExcluded) assert(!release.products.includes(id));
if (finalGate.actualImportBuilt) {
  assert.equal(finalGate.verdict, 'pass-proof-gates');
  assert.deepEqual(finalGate.errors, []);
  assert.deepEqual(finalGate.browserRecords, { exactRating: 14, copy: 28, viewport: 126, requiredViewports: 126 });
  for (const [file, expected] of Object.entries(finalGate.proofHashes)) assert.equal(hash(file), expected, `Stale final proof: ${file}`);
  const reviews = read('research/line-pages/review-status.json');
  for (const id of [...source.newProductIds, ...source.copy28ProductIds]) {
    assert.equal(reviews[id].browserAudit, true);
    assert.equal(reviews[id].status, source.newProductIds.includes(id) ? 'audited-awaiting-bulk-release' : 'published');
    assert.equal(reviews[id].browserEvidence.productSha256, objectHash(products.products[id]));
  }
  for (const file of ['data/line-page-release.json', 'data/lines.json', 'data/line-page-products.json',
    'generated/line-pages/imported-products.json', 'generated/line-pages/UPLOAD-THIS-80-new-line-guides.csv']) {
    assert.equal(hash(file), finalGate.beforeHashes[file], `Finalization changed protected file: ${file}`);
  }
  assert.equal(hash(finalGate.import.original80InventoryBackup), finalGate.beforeHashes['generated/line-pages/import-inventory.json']);
  assert.equal(hash(finalGate.import.inventory), finalGate.import.inventorySha256);
  const inventory = read(finalGate.import.inventory);
  assert.equal(inventory.count, 14);
  assert.deepEqual([...inventory.includedProducts].sort(), [...source.newProductIds].sort());
  assert.deepEqual([...inventory.excludedImported].sort(), [...source.original100ProductIds].sort());
  assert.deepEqual([...release.publishedProducts].sort(), [...source.original100ProductIds].sort());
  assert.deepEqual([...imported].sort(), [...source.original100ProductIds].sort());
}
console.log(JSON.stringify({ integrity: 'pass', manifestSha256: hash(manifestPath), files: manifest.files.length,
  runtimeFiles: manifest.runtimePaths.length, signedModels: source.models.length, exactRows: checkedRows,
  preservedOriginalPacks: source.originalSourcePacks.length, original100MatchBeforeOverlay: true,
  copyFields: result.alreadyApplied.length, browserApprovedModels: finalGate.actualImportBuilt ? 42 : 0,
  actualImportRows: finalGate.actualImportBuilt ? 14 : 0, publishedProducts: release.publishedProducts.length,
  importedProducts: imported.length, nativeCopy28Complete: false, publicationApproval: false,
  remainingGates: manifest.readiness.remaining }, null, 2));
