import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadLinePackModels } from '../../scripts/line-pack-sources.mjs';
import { resolutionScopeLabel } from '../../scripts/line-resolution-scope.mjs';
import { evaluateOverlay, setPath } from '../../research/line-pages/full-catalog/resolution-independent-review/original80-copy-cleanup/apply-overlay.mjs';

process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const args = process.argv.slice(2);
assert(args.length <= 1 && args.every(arg => arg === '--apply'), 'Default checks proof only; --apply also updates42 review flags and builds exact14 CSV.');
const apply = args.includes('--apply');
const dir = 'reports/resolution-integration';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const hash = file => sha(fs.readFileSync(file));
const objectHash = value => sha(JSON.stringify(value));
const save = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const handoff = read(`${dir}/handoff.json`);
const phase = read(`${dir}/phase-one-verification.json`);
const new14 = handoff.newProductIds;
const copy28 = handoff.copyCleanup.models;
const affected = [...new14, ...copy28];
const productsFile = read('data/line-page-products.json');
const products = productsFile.products;
const rows = read('data/lines.json');
const releases = read('data/line-page-release.json');
const imported = read('generated/line-pages/imported-products.json').importedProducts;
const reviews = read('research/line-pages/review-status.json');
const original100 = phase.frozenProducts.map(entry => entry.id);
const errors = [];
const check = (valid, message) => { if (!valid) errors.push(message); };
const proofFiles = ['actual-browser-checks.json', 'actual-copy-browser-checks.json', 'actual-viewport-checks.json'];
const proofs = Object.fromEntries(proofFiles.map(name => [name, fs.existsSync(`${dir}/${name}`) ? read(`${dir}/${name}`) : []]));
const proofHashes = Object.fromEntries(proofFiles.filter(name => fs.existsSync(`${dir}/${name}`)).map(name => [`${dir}/${name}`, hash(`${dir}/${name}`)]));
const fullAuditFile = `${dir}/final-full-catalog-trust.json`;
const fullAudit = read(fullAuditFile);
assert.equal(fullAudit.strengths, 825);
assert.equal(fullAudit.readyReels, 1320);
assert.equal(fullAudit.pairings, 1089000);
assert.equal(fullAudit.pairings, fullAudit.strengths * fullAudit.readyReels);
assert.equal(fullAudit.checks, 11483423);
assert.equal(fullAudit.failures, 0);
assert.equal(fullAudit.productIds, null, 'Expected unrestricted full-catalog audit.');
assert.deepEqual(fullAudit.examples, []);
proofHashes[fullAuditFile] = hash(fullAuditFile);
for (const name of proofFiles) assert(Array.isArray(proofs[name]), `Expected array of observed browser records: ${name}`);
const beforeFiles = ['research/line-pages/review-status.json', 'data/line-page-release.json', 'data/lines.json',
  'data/line-page-products.json', 'data/line-page-imports.json', 'generated/line-pages/imported-products.json',
  'generated/line-pages/import-inventory.json', 'generated/line-pages/UPLOAD-THIS-80-new-line-guides.csv'];
const beforeHashes = Object.fromEntries(beforeFiles.map(file => [file, hash(file)]));
assert.equal(affected.length, 42);
assert.deepEqual([...imported].sort(), [...original100].sort(), 'Never build create-only14 after any new14 has already been imported.');
check(JSON.stringify([...releases.publishedProducts].sort()) === JSON.stringify([...original100].sort()), 'Complete the proven original100 metadata promotion first.');
assert.deepEqual([...releases.products].sort(), [...original100, ...new14].sort());
const signed = loadLinePackModels().filter(entry => entry.resolution);
for (const candidate of handoff.candidates) {
  const entry = signed.find(entry => entry.model.id === candidate.id);
  assert.equal(objectHash(entry.model), candidate.modelSha256);
  assert.equal(objectHash(products[candidate.id]), candidate.productSha256);
  assert.equal(hash(candidate.image), candidate.imageSha256);
  assert.deepEqual(products[candidate.id].exampleSetups, entry.model.product.exampleSetups);
  assert.deepEqual(products[candidate.id].excludedLineIds, candidate.excludedLineIds);
  for (const evidence of entry.model.rows) {
    const row = rows.find(row => row.id === (evidence.lineId || evidence.id));
    assert(row);
    assert.deepEqual(row.source_evidence, evidence);
    assert.equal(row.source_pack.sha256, candidate.sourcePackSha256);
    assert.equal(row.source_pack.reviewSha256, entry.reviewSha256);
    for (const [key, value] of Object.entries({ brand: entry.model.brand, model: entry.model.model, type: entry.model.lineType,
      role: entry.model.role, diameter_basis: evidence.diameterBasis })) assert.equal(row[key], value);
    for (const key of ['lb', 'dia_in', 'dia_mm']) assert.equal(row[key], evidence[key]);
    assert.deepEqual(row.spool_sizes_yd, [...new Set(evidence.spool_sizes_yd)].sort((a, b) => a - b));
    const metric = [...new Map((evidence.retail_packages || []).filter(pack => Number(pack.meters) > 0)
      .map(pack => [pack.yards, { yards: pack.yards, meters: pack.meters }])).values()];
    assert.deepEqual(row.retail_packages, metric);
    assert.equal(row.source_scope_label, resolutionScopeLabel(entry.model, evidence));
  }
}
for (const pack of handoff.originalSourcePacks) assert.equal(hash(pack.file), pack.sha256);
const artifactManifest = read(`${dir}/changed-files.json`).files;
for (const id of affected) for (const folder of ['examples/line-pages', 'components/line-pages']) {
  const file = `${folder}/${id}.html`;
  const expected = artifactManifest.find(entry => entry.file === file);
  assert(expected, `Missing reviewed artifact hash: ${file}`);
  assert.equal(hash(file), expected.afterSha256, `Reviewed artifact changed: ${file}`);
}
const overlay = read('research/line-pages/full-catalog/resolution-independent-review/original80-copy-cleanup/overlay.json');
assert.equal(evaluateOverlay(productsFile, overlay).alreadyApplied.length, 53);
const beforeOverlay = structuredClone(productsFile);
for (const change of overlay.changes) setPath(beforeOverlay, change, change.before);
for (const original of phase.frozenProducts) assert.equal(objectHash(beforeOverlay.products[original.id]), original.sha256);
const remediation = read(`${dir}/rint-01-remediation.json`);
assert.equal(remediation.status, 'fixed-locally-regression-tests-pass');
for (const file of remediation.changedFiles) assert.equal(hash(file.file), file.afterSha256);
for (const [file, expected] of Object.entries(read(`${dir}/deployment-scope-baseline.json`).files)) assert.equal(hash(file), expected);

function exactProofSet(name, ids) {
  const entries = proofs[name];
  check(entries.length === ids.length, `${name}: expected exactly${ids.length} records, found${entries.length}`);
  check(new Set(entries.map(entry => entry.id)).size === entries.length, `${name}: duplicate IDs`);
  check(entries.every(entry => ids.includes(entry.id)), `${name}: unexpected product ID`);
  return new Map(entries.map(entry => [entry.id, entry]));
}
function basicProof(entry, id, name) {
  check(!!entry, `${name}: missing ${id}`);
  if (!entry) return;
  check(entry.pass === true, `${name}: not passed ${id}`);
  check(entry.productHash === objectHash(products[id]), `${name}: stale/missing product hash ${id}`);
  check(entry.ready === 'true' || entry.ready === true, `${name}: not ready ${id}`);
  check(entry.overflow === 0 || entry.overflow === false, `${name}: overflow evidence failed/missing ${id}`);
  check(Array.isArray(entry.broken) && entry.broken.length === 0, `${name}: image evidence failed/missing ${id}`);
}
const rating = exactProofSet('actual-browser-checks.json', new14);
for (const id of new14) {
  const entry = rating.get(id);
  basicProof(entry, id, 'exact-rating');
  if (!entry) continue;
  check(entry.productId === id && entry.lineId === products[id].defaultLineId, `exact-rating: wrong product/line identity ${id}`);
  check(typeof entry.result === 'string' && entry.result.includes('200 yd'), `exact-rating: expected200 yd result not recorded ${id}`);
}
const copies = exactProofSet('actual-copy-browser-checks.json', copy28);
for (const id of copy28) {
  const entry = copies.get(id);
  basicProof(entry, id, 'copy');
  if (!entry) continue;
  check(entry.h1 === 1, `copy: expected one heading ${id}`);
  check(entry.visibleCalc === (products[id].role !== 'leader'), `copy: wrong leader/calculator role ${id}`);
  const expectedFields = overlay.changes.filter(change => change.productId === id).map(change => change.fieldPath).sort();
  const changes = entry.changes || [];
  check(JSON.stringify(changes.map(change => change.field).sort()) === JSON.stringify(expectedFields), `copy: exact field set missing/duplicate ${id}`);
  check(changes.every(change => change.afterPresent === true && change.beforeAbsent === true), `copy: changed text not verified ${id}`);
}
const viewports = proofs['actual-viewport-checks.json'];
const widths = [320, 390, 1280];
check(viewports.length === affected.length * widths.length, `viewport: expected126 unique product/width records, found${viewports.length}`);
const viewportKeys = new Set();
for (const entry of viewports) {
  const key = `${entry.id}:${entry.expectedWidth}`;
  check(!viewportKeys.has(key), `viewport: duplicate ${key}`);
  viewportKeys.add(key);
  check(affected.includes(entry.id) && widths.includes(entry.expectedWidth), `viewport: unknown product/width ${key}`);
  check(entry.pass === true, `viewport: not passed ${key}`);
  check(entry.productId === entry.id && entry.metrics?.root?.productId === entry.id, `viewport: hosted product identity mismatch ${key}`);
  check(entry.metrics?.viewport?.innerWidth === entry.expectedWidth && entry.metrics?.viewport?.matchesRequestedWidth === true,
    `viewport: iframe viewport metrics mismatch ${key}`);
  check(entry.documentOverflow === false && entry.metrics?.overflow?.documentHorizontal === false && entry.metrics?.overflow?.rootHorizontal === false,
    `viewport: document/root overflow ${key}`);
  check(entry.metrics?.root?.ready === true && entry.metrics?.root?.role === (products[entry.id]?.role || 'mainline'),
    `viewport: hosted readiness/role mismatch ${key}`);
  // A requested/container width alone is not proof of the real browser viewport.
  const actual = entry.viewportWidth ?? entry.innerWidth ?? entry.actualViewportWidth;
  check(actual === entry.expectedWidth, `viewport: actual window width absent/mismatched ${key}`);
  check(entry.productHash === objectHash(products[entry.id]), `viewport: stale/missing product hash ${key}`);
  check(entry.ready === 'true' || entry.ready === true, `viewport: readiness missing ${key}`);
  check(entry.badText === false, `viewport: bad-text check missing/failed ${key}`);
  check(Array.isArray(entry.broken) && !entry.broken.length, `viewport: image check missing/failed ${key}`);
  check(Array.isArray(entry.overflows) && !entry.overflows.length, `viewport: overflow check missing/failed ${key}`);
}
for (const id of affected) for (const width of widths) check(viewportKeys.has(`${id}:${width}`), `viewport: missing ${id}:${width}`);
const report = { checkedAt: new Date().toISOString(), mode: apply ? 'apply-requested' : 'check-only',
  verdict: errors.length ? 'hold-incomplete-or-stale-browser-proof' : 'pass-proof-gates',
  sourceModels: 14, sourceRows: 42, sourcePacksUnchanged: true, copyFields: 53, exactReviewedHtmlHashes: 84,
  browserRecords: { exactRating: rating.size, copy: copies.size, viewport: viewports.length, requiredViewports: 126 },
  proofHashes, beforeHashes, errors, reviewStatusChanged: false, actualImportBuilt: false,
  fullCatalogAudit: { file: fullAuditFile, sha256: hash(fullAuditFile), ...fullAudit },
  nativeCopy28Complete: false,
  nativeCopyStatus: { pilotId: 'daiwa-j-braid-x4', pilot: 'User reports existing-ID update succeeded with native SEO/images unchanged; independent export verification pending.',
    remaining27: 'Not claimed updated by this gate. Main owns remaining native work.' },
  publishedProductsUnchanged: true, browserAccessed: false, nativeImportPerformed: false };
if (errors.length || !apply) {
  save(`${dir}/final-browser-gate.json`, report);
  console.log(JSON.stringify({ verdict: report.verdict, browserRecords: report.browserRecords, errors: errors.slice(0,20), errorCount: errors.length,
    reviewStatusChanged: false, actualImportBuilt: false }, null, 2));
  process.exitCode = errors.length ? 1 : 0;
} else {
  for (const [file, expected] of Object.entries({ ...beforeHashes, ...proofHashes })) assert.equal(hash(file), expected, `Concurrent edit: ${file}`);
  const updated = structuredClone(reviews);
  for (const id of affected) {
    updated[id] = { ...updated[id], browserAudit: true,
      status: new14.includes(id) ? 'audited-awaiting-bulk-release' : 'published',
      browserEvidence: { proofHashes, productSha256: objectHash(products[id]), viewportWidths: widths,
        checkedBy: 'Main-owned browser observations, locally hash-validated', gate: `${dir}/final-browser-gate.json` } };
    if (copy28.includes(id)) updated[id].publication = { ...updated[id].publication,
      nativeFallback: id === 'daiwa-j-braid-x4' ? 'pilot-updated-awaiting-independent-export-verification' : 'original-copy-refresh-pending',
      localRevision: 'browser-reviewed-awaiting-deployment' };
  }
  const backup = `${dir}/original80-import-inventory-preserved.json`;
  if (fs.existsSync(backup)) assert.equal(hash(backup), beforeHashes['generated/line-pages/import-inventory.json'], 'Existing inventory archive differs; reconcile explicitly.');
  else fs.copyFileSync('generated/line-pages/import-inventory.json', backup, fs.constants.COPYFILE_EXCL);
  save('research/line-pages/review-status.json', updated);
  const originalArgv = process.argv;
  try {
    process.argv = [process.execPath, 'scripts/line-page-publishing/build-import.mjs', `--ids=${new14.join(',')}`];
    await import('../../scripts/line-page-publishing/build-import.mjs');
  } catch (error) {
    report.mode = 'review-flags-updated-import-build-failed';
    report.verdict = 'hold-import-build-failed';
    report.reviewStatusChanged = true;
    report.errors.push(String(error.message));
    save(`${dir}/final-browser-gate.json`, report);
    throw error;
  } finally { process.argv = originalArgv; }
  const inventory = read('generated/line-pages/import-inventory.json');
  assert.equal(inventory.count, 14);
  assert.deepEqual([...inventory.includedProducts].sort(), [...new14].sort());
  assert.deepEqual([...inventory.excludedImported].sort(), [...original100].sort());
  assert.equal(inventory.importFile, 'generated/line-pages/UPLOAD-THIS-14-new-line-guides.csv');
  for (const file of ['data/line-page-release.json', 'data/lines.json', 'data/line-page-products.json',
    'generated/line-pages/imported-products.json', 'generated/line-pages/UPLOAD-THIS-80-new-line-guides.csv']) assert.equal(hash(file), beforeHashes[file]);
  report.mode = 'applied-local-review-and-import-build-only';
  report.reviewStatusChanged = true;
  report.actualImportBuilt = true;
  report.import = { file: inventory.importFile, sha256: hash(inventory.importFile), rows: inventory.count,
    inventory: 'generated/line-pages/import-inventory.json', inventorySha256: hash('generated/line-pages/import-inventory.json'),
    original80InventoryBackup: backup, original80InventorySha256: hash(backup), visibility: 'hidden',
    note: 'File built locally only. Main must validate CSV and approve deployment/import. No native import performed.' };
  report.afterHashes = Object.fromEntries(beforeFiles.map(file => [file, hash(file)]));
  save(`${dir}/final-browser-gate.json`, report);
  console.log(JSON.stringify({ verdict: report.verdict, reviewStatusChanged: true, browserAuditTrue: 42, import: report.import,
    publishedProducts: releases.publishedProducts.length, nativeImportPerformed: false }, null, 2));
}
