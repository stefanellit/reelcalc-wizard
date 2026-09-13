import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const reportDir = 'reports/resolution-integration';
const ledgerFile = 'generated/line-pages/imported-products.json';
const releaseFile = 'data/line-page-release.json';
const reviewsFile = 'research/line-pages/review-status.json';
const registryFile = 'data/line-page-imports.json';
const batchId = 'independently-reviewed-resolution14';
export const sha = value => createHash('sha256').update(value).digest('hex');
export const objectHash = value => sha(JSON.stringify(value));
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const fileHash = file => sha(fs.readFileSync(path.join(root, file)));
const setEquals = (actual, expected, label) => {
  assert(Array.isArray(actual) && new Set(actual).size === actual.length, `${label}: missing/duplicate list`);
  assert.deepEqual([...actual].sort(), [...expected].sort(), `${label}: exact identities required`);
};
const timestamp = (value, label) => {
  assert(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)), `${label}: ISO timestamp required`);
  assert(Date.parse(value) <= Date.now() + 300000, `${label}: timestamp is in the future`);
};
const nativeId = value => typeof value === 'string' && /^[A-Za-z0-9-]{8,128}$/.test(value) && !/placeholder|unknown|pending|example/i.test(value);

export function loadState() {
  const handoff = read(`${reportDir}/handoff.json`);
  const gate = read(`${reportDir}/final-browser-gate.json`);
  const phase = read(`${reportDir}/phase-one-verification.json`);
  const products = read('data/line-page-products.json').products;
  const release = read(releaseFile), ledger = read(ledgerFile), reviews = read(reviewsFile), registry = read(registryFile);
  const ids = handoff.newProductIds, original100 = phase.frozenProducts.map(entry => entry.id);
  assert.equal(ids.length, 14);
  assert.equal(original100.length, 100);
  assert(ids.every(id => !original100.includes(id)));
  setEquals(release.products, [...original100, ...ids], 'Prepared catalog');
  setEquals(Object.keys(products), release.products, 'Product configurations');
  assert.equal(gate.verdict, 'pass-proof-gates');
  assert.equal(gate.actualImportBuilt, true);
  assert.equal(gate.import.rows, 14);
  assert.equal(fileHash(gate.import.file), gate.import.sha256, 'Approved14 CSV changed');
  for (const source of [...handoff.originalSourcePacks, ...handoff.sourcePacks]) assert.equal(fileHash(source.file), source.sha256);
  for (const source of handoff.sourcePacks) assert.equal(fileHash(source.reviewFile), source.reviewSha256);
  for (const candidate of handoff.candidates) {
    assert.equal(objectHash(products[candidate.id]), candidate.productSha256, `Reviewed product changed: ${candidate.id}`);
    assert.equal(fileHash(candidate.image), candidate.imageSha256);
    assert.equal(reviews[candidate.id].browserAudit, true);
    assert.equal(reviews[candidate.id].browserEvidence.productSha256, candidate.productSha256);
  }
  const paths = [ledgerFile, releaseFile, reviewsFile, registryFile, 'data/lines.json', 'data/line-page-products.json',
    'js/line-page-engine.js', 'generated/line-pages/catalog-progress.json', 'generated/line-pages/CATALOG-PROGRESS.md',
    `${reportDir}/handoff.json`, `${reportDir}/final-browser-gate.json`, gate.import.file,
    ...handoff.originalSourcePacks.map(entry => entry.file), ...handoff.sourcePacks.flatMap(entry => [entry.file, entry.reviewFile])];
  return { ids, original100, products, release, ledger, reviews, registry, gate,
    hashes: Object.fromEntries(paths.map(file => [file, fileHash(file)])) };
}

function commonProof(state, proof, kind, reference) {
  assert.equal(proof.schemaVersion, 1);
  assert.equal(proof.kind, kind);
  assert.equal(proof.site, 'https://www.reelcalc.com');
  assert.equal(proof.observedBy, 'main-agent');
  timestamp(proof.observedAt, 'observedAt');
  assert(reference?.file && /^[a-f0-9]{64}$/.test(reference.sha256), 'Exact proof file/hash binding required');
  assert(proof.pages && typeof proof.pages === 'object' && !Array.isArray(proof.pages), 'Per-ID page map required');
  setEquals(Object.keys(proof.pages), state.ids, 'Proof pages');
  const products = new Set(), variants = new Set();
  for (const id of state.ids) {
    const page = proof.pages[id];
    const entries = Object.entries(state.registry.pages).filter(([, entry]) => entry.id === id);
    assert.equal(entries.length, 1, `Registry identity not unique: ${id}`);
    const [slug, expected] = entries[0];
    assert.equal(page.verified, true, `Per-page observation missing: ${id}`);
    assert(nativeId(page.nativeProductId) && nativeId(page.nativeVariantId), `Observed native IDs required: ${id}`);
    assert(!products.has(page.nativeProductId) && !variants.has(page.nativeVariantId), `Duplicate native IDs: ${id}`);
    products.add(page.nativeProductId); variants.add(page.nativeVariantId);
    assert.equal(page.sku, expected.sku, `SKU mismatch: ${id}`);
    assert.equal(page.slug, slug, `Slug mismatch: ${id}`);
    assert.equal(page.url, expected.url, `URL mismatch: ${id}`);
    assert.equal(page.title, expected.title, `Native title mismatch: ${id}`);
    assert.equal(page.productType, 'SERVICE');
    assert.equal(page.productPage, 'lines');
    assert(['Hidden', 'Public'].includes(page.visibility), `Observed visibility missing: ${id}`);
  }
}

export function planImport(state, proof, reference) {
  commonProof(state, proof, 'resolution14-import', reference);
  const submission = proof.submission;
  assert(submission && submission.status === 'complete', 'Import must be complete, not submitted/processing');
  assert.equal(submission.file, state.gate.import.file);
  assert.equal(submission.sha256, state.gate.import.sha256);
  assert.equal(submission.createdCount, 14);
  assert.equal(submission.updatedCount, 0, 'Do not confuse native28 updates with the new14 import');
  assert.equal(submission.failedCount, 0);
  timestamp(submission.submittedAt, 'submittedAt'); timestamp(submission.completedAt, 'completedAt');
  assert(Date.parse(submission.submittedAt) <= Date.parse(submission.completedAt));
  assert(Date.parse(submission.completedAt) <= Date.parse(proof.observedAt));
  const present = state.ids.filter(id => state.ledger.importedProducts.includes(id));
  const existing = (state.ledger.importBatches || []).filter(batch => batch.id === batchId);
  if (present.length === 14) {
    setEquals(state.ledger.importedProducts, [...state.original100, ...state.ids], 'Already-imported ledger');
    assert.equal(existing.length, 1);
    assert.equal(existing[0].proofSha256, reference.sha256, 'Already imported with a different proof; reconcile explicitly');
    return { action: 'import', alreadyApplied: true, writes: {} };
  }
  assert.equal(present.length, 0, 'Partial imported14 ledger requires explicit reconciliation');
  assert.equal(existing.length, 0, 'Prior batch record conflicts with imported ledger');
  setEquals(state.ledger.importedProducts, state.original100, 'Original100 imported ledger');
  setEquals(state.release.publishedProducts, state.original100, 'Original100 public list');
  const updated = structuredClone(state.ledger);
  updated.importedProducts.push(...state.ids);
  updated.importBatches = [...(updated.importBatches || []), { id: batchId, ids: state.ids,
    proofFile: reference.file, proofSha256: reference.sha256, importedAt: submission.completedAt, observedAt: proof.observedAt,
    importFile: submission.file, importFileSha256: submission.sha256,
    nativeProducts: Object.fromEntries(state.ids.map(id => [id, { nativeProductId: proof.pages[id].nativeProductId,
      nativeVariantId: proof.pages[id].nativeVariantId, sku: proof.pages[id].sku, url: proof.pages[id].url }])) }];
  return { action: 'import', alreadyApplied: false, writes: { [ledgerFile]: updated },
    note: 'Only imported-products.json changes. Existing registry provenance and original100 order are retained. No public/review/version/catalog promotion.' };
}

export function planPublication(state, proof, reference, version) {
  commonProof(state, proof, 'resolution14-publication', reference);
  assert(typeof version === 'string' && /^[1-9]\d*$/.test(version), 'Explicit --version=<new integer> required');
  setEquals(state.ledger.importedProducts, [...state.original100, ...state.ids], 'Import must be reconciled before publication');
  const batches = (state.ledger.importBatches || []).filter(batch => batch.id === batchId);
  assert.equal(batches.length, 1, 'Missing exact14 import proof binding');
  const batch = batches[0];
  assert.equal(proof.importProofSha256, batch.proofSha256, 'Publication proof must bind the recorded import proof');
  assert.equal(proof.pendingLiveId, null, 'Explicit pendingLiveId:null required');
  assert.equal(proof.deployment?.verified, true);
  assert(/^[a-f0-9]{40}$/.test(proof.deployment.commit), 'Deployed commit ID required');
  assert.equal(proof.deployment.assetBase, 'https://stefanellit.github.io/reelcalc-wizard/');
  for (const file of ['data/lines.json', 'data/line-page-products.json', 'js/line-page-engine.js']) {
    assert.equal(proof.deployment.assetHashes?.[file], state.hashes[file], `Live proof asset binding missing/stale: ${file}`);
  }
  const already = state.ids.filter(id => state.release.publishedProducts.includes(id));
  assert(already.length === 0 || already.length === 14, 'Partial published14 requires explicit reconciliation');
  setEquals(state.release.publishedProducts, already.length ? [...state.original100, ...state.ids] : state.original100, 'Existing published scope');
  if (!already.length) {
    assert.equal(proof.deployment.releaseVersion, state.release.version, 'Proof is not for the currently deployed prepared release');
    assert(Number(version) > Number(state.release.version), 'New version must advance the current release');
  }
  const reviews = structuredClone(state.reviews);
  for (const id of state.ids) {
    const page = proof.pages[id], current = state.products[id];
    const expected = Object.values(state.registry.pages).find(entry => entry.id === id);
    assert.equal(page.nativeProductId, batch.nativeProducts[id].nativeProductId);
    assert.equal(page.nativeVariantId, batch.nativeProducts[id].nativeVariantId);
    assert.equal(page.productHash, objectHash(current), `Live proof product hash stale: ${id}`);
    assert.equal(page.visibility, 'Public'); assert.equal(page.nativeSeoSaved, true); assert.equal(page.liveVerified, true);
    timestamp(page.savedAt, `${id}.savedAt`);
    assert(Date.parse(page.savedAt) >= Date.parse(batch.importedAt) && Date.parse(page.savedAt) <= Date.parse(proof.observedAt));
    const live = page.live;
    assert(live && live.url === expected.url && live.canonical === expected.url, `Live URL/canonical mismatch: ${id}`);
    assert.equal(live.title, expected.seoTitle); assert.equal(live.description, expected.seoDescription);
    assert(Array.isArray(live.broken) && live.broken.length === 0, `Image check missing/failed: ${id}`);
    assert.equal(live.cartVisible, false); assert(live.overflow === false || live.overflow === 0);
    assert(Array.isArray(live.headings) && live.headings.includes(current.h1), `Live heading mismatch: ${id}`);
    assert(Array.isArray(live.root) && live.root.some(node => node.productId === id && node.linePageReady === 'true' &&
      node.assetBase === proof.deployment.assetBase), `Exact hosted ready state missing: ${id}`);
    assert.equal(reviews[id].browserAudit, true);
    if (already.length) {
      assert.equal(reviews[id].status, 'published');
      assert.equal(reviews[id].publication.proofSha256, reference.sha256, `Different prior publication proof: ${id}`);
      continue;
    }
    reviews[id] = { ...reviews[id], status: 'published', publishedAt: page.savedAt,
      publication: { ...(reviews[id].publication || {}), status: 'live', nativeImported: true, nativePublic: true, liveVerified: true,
        proof: reference.file, proofSha256: reference.sha256, ledgerEntrySha256: objectHash(page), importProofSha256: batch.proofSha256,
        url: page.url, nativeProductId: page.nativeProductId, nativeVariantId: page.nativeVariantId,
        liveProductSha256: page.productHash, currentLocalProductSha256: page.productHash,
        basis: 'Main-owned exact14 native/live proof, locally identity/hash-validated. No browser action by this helper.' } };
    delete reviews[id].publication.note;
  }
  if (already.length) {
    assert.equal(state.release.version, version); assert.equal(state.registry.version, version);
    return { action: 'publish', alreadyApplied: true, writes: {} };
  }
  for (const id of state.original100) assert.deepEqual(reviews[id], state.reviews[id], `Original100 review changed: ${id}`);
  return { action: 'publish', alreadyApplied: false, writes: {
    [reviewsFile]: reviews, [registryFile]: { ...state.registry, version },
    [releaseFile]: { ...state.release, version, publishedProducts: [...state.release.publishedProducts, ...state.ids] } },
    generateCatalog: true, note: 'Only exact proven14 appended. Registry page objects, prepared product list, source configs and original100 reviews stay intact.' };
}

function atomicWrite(file, value) {
  const target = path.resolve(root, file);
  assert(target.startsWith(root + path.sep));
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(temp, target);
}

async function cli() {
  const [action, ...args] = process.argv.slice(2);
  assert(['import', 'publish'].includes(action), 'Use import|publish --proof=reports/...json [--version=10 for publish] [--apply]');
  const options = {};
  for (const arg of args) {
    const match = /^(--proof|--version)=(.+)$/.exec(arg);
    const key = match?.[1] || arg;
    assert(key === '--apply' || match, `Unknown option: ${arg}`);
    assert(!Object.hasOwn(options, key), `Duplicate option: ${key}`);
    options[key] = match ? match[2] : true;
  }
  assert(options['--proof'], 'Main-owned actual proof file required');
  assert(action === 'publish' || !options['--version'], '--version is only valid for publication');
  const absolute = path.resolve(root, options['--proof']);
  assert(absolute.startsWith(path.join(root, 'reports') + path.sep) && absolute.endsWith('.json'), 'Proof must be a JSON file inside repository reports/');
  const proofFile = path.relative(root, absolute).replaceAll('\\', '/');
  const state = loadState();
  const reference = { file: proofFile, sha256: fileHash(proofFile) };
  const proof = read(proofFile);
  const plan = action === 'import' ? planImport(state, proof, reference) : planPublication(state, proof, reference, options['--version']);
  const report = { checkedAt: new Date().toISOString(), action, mode: options['--apply'] ? 'apply-requested' : 'check-only',
    proof: reference, ids: state.ids, alreadyApplied: plan.alreadyApplied, plannedFiles: Object.keys(plan.writes),
    catalogOutputs: plan.generateCatalog ? ['generated/line-pages/catalog-progress.json', 'generated/line-pages/CATALOG-PROGRESS.md'] : [],
    beforeHashes: state.hashes, writtenFiles: [], browserAccessed: false, importedNatively: false, publishedNatively: false,
    nativeCopy28StatusChanged: false, note: plan.note };
  const reportFile = `${reportDir}/post-${action}-${reference.sha256.slice(0,12)}-${options['--apply'] ? 'applied' : 'check'}.json`;
  if (options['--apply'] && !plan.alreadyApplied) {
    assert(!fs.existsSync(path.join(root, reportFile)), 'An apply journal exists: inspect it rather than replaying a possibly partial operation');
    for (const [file, expected] of Object.entries(state.hashes)) assert.equal(fileHash(file), expected, `Concurrent edit; no writes: ${file}`);
    assert.equal(fileHash(proofFile), reference.sha256, 'Concurrent proof edit; no writes');
    atomicWrite(reportFile, report);
    try {
      for (const [file, value] of Object.entries(plan.writes)) { atomicWrite(file, value); report.writtenFiles.push(file); }
      if (plan.generateCatalog) {
        await import('../../scripts/line-page-catalog.mjs');
        assert.equal(read('generated/line-pages/catalog-progress.json').published, 114);
        report.writtenFiles.push(...report.catalogOutputs);
      }
      for (const [file, expected] of Object.entries(state.hashes)) {
        if (!report.writtenFiles.includes(file)) assert.equal(fileHash(file), expected, `Protected file changed: ${file}`);
      }
      report.mode = 'applied-local-metadata-only';
      report.afterHashes = Object.fromEntries(report.writtenFiles.map(file => [file, fileHash(file)]));
    } catch (error) {
      report.mode = 'partial-application-requires-reconciliation'; report.error = error.message;
      atomicWrite(reportFile, report); throw error;
    }
  }
  if (!options['--apply'] || !plan.alreadyApplied) atomicWrite(reportFile, report);
  console.log(JSON.stringify({ action, mode: plan.alreadyApplied ? 'already-recorded-no-writes' : report.mode,
    plannedFiles: report.plannedFiles, catalogOutputs: report.catalogOutputs, report: reportFile,
    note: 'No Git, deployment, browser, native import or native publication action.' }, null, 2));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  cli().catch(error => { console.error(`HOLD: ${error.message}`); process.exitCode = 1; });
}
