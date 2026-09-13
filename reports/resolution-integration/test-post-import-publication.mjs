import assert from 'node:assert/strict';
import { loadState, planImport, planPublication, objectHash } from './post-import-publication.mjs';

// Synthetic observations stay in memory. These are validator tests, not actual import/live proof.
const state = loadState();
const untouched = JSON.stringify(state);
const reference = { file: 'reports/resolution-integration/TEST-ONLY-NOT-ACTUAL-PROOF.json', sha256: 'a'.repeat(64) };
const now = Date.now();
const at = offset => new Date(now + offset).toISOString();
const proof = { schemaVersion: 1, kind: 'resolution14-import', site: 'https://www.reelcalc.com',
  observedBy: 'main-agent', observedAt: at(0), submission: { status: 'complete',
    file: state.gate.import.file, sha256: state.gate.import.sha256,
    createdCount: 14, updatedCount: 0, failedCount: 0, submittedAt: at(-120000), completedAt: at(-60000) },
  pages: Object.fromEntries(state.ids.map((id, index) => {
    const [slug, entry] = Object.entries(state.registry.pages).find(([, entry]) => entry.id === id);
    return [id, { verified: true, nativeProductId: 'aa' + index.toString(16).padStart(22, '0'),
      nativeVariantId: '00000000-0000-4000-8000-' + String(index).padStart(12, '0'),
      sku: entry.sku, slug, url: entry.url, title: entry.title, productType: 'SERVICE', productPage: 'lines', visibility: 'Hidden' }];
  })) };
let checks = 0;
function reject(change, target = 'import', current = state) {
  const next = structuredClone(target === 'import' ? proof : liveProof);
  change(next);
  assert.throws(() => target === 'import' ? planImport(current, next, reference) : planPublication(current, next, liveReference, newVersion));
  checks++;
}
const importPlan = planImport(state, proof, reference);
assert.deepEqual(Object.keys(importPlan.writes), ['generated/line-pages/imported-products.json']); checks++;
const imported = importPlan.writes['generated/line-pages/imported-products.json'];
assert.deepEqual(imported.importedProducts.slice(0,100), state.ledger.importedProducts); checks++;
assert.equal(imported.sourceRegistrySha256, state.ledger.sourceRegistrySha256); checks++;
const id = state.ids[0], other = state.ids[1];
reject(p => delete p.pages[id]);
reject(p => p.pages[id].nativeProductId = p.pages[other].nativeProductId);
reject(p => p.pages[id].nativeVariantId = '');
reject(p => p.pages[id].sku = 'wrong-sku');
reject(p => p.pages[id].url = 'https://www.reelcalc.com/lines/p/wrong');
reject(p => p.submission.status = 'processing');
reject(p => p.submission.createdCount = 13);
reject(p => p.submission.updatedCount = 27);
reject(p => delete p.submission.failedCount);
reject(p => p.submission.sha256 = 'b'.repeat(64));
reject(p => p.observedBy = 'inferred-from-registry');
reject(p => p.pages[id].verified = false);
const importedState = { ...state, ledger: imported };
assert.equal(planImport(importedState, proof, reference).alreadyApplied, true); checks++;
assert.throws(() => planImport({ ...state, ledger: { ...state.ledger, importedProducts: [...state.ledger.importedProducts, id] } }, proof, reference)); checks++;
const liveReference = { file: 'reports/resolution-integration/TEST-ONLY-NOT-LIVE.json', sha256: 'c'.repeat(64) };
const newVersion = String(Number(state.release.version) + 1);
const liveProof = { ...structuredClone(proof), kind: 'resolution14-publication', importProofSha256: reference.sha256,
  pendingLiveId: null, deployment: { verified: true, commit: 'd'.repeat(40), releaseVersion: state.release.version,
    assetBase: 'https://stefanellit.github.io/reelcalc-wizard/', assetHashes: Object.fromEntries(
      ['data/lines.json', 'data/line-page-products.json', 'js/line-page-engine.js'].map(file => [file, state.hashes[file]])) } };
delete liveProof.submission;
for (const [id, page] of Object.entries(liveProof.pages)) {
  const expected = Object.values(state.registry.pages).find(entry => entry.id === id);
  Object.assign(page, { visibility: 'Public', productHash: objectHash(state.products[id]), nativeSeoSaved: true,
    savedAt: at(-30000), liveVerified: true, live: { url: expected.url, canonical: expected.url,
      title: expected.seoTitle, description: expected.seoDescription, broken: [], cartVisible: false, overflow: false,
      headings: [state.products[id].h1], root: [{ productId: id, linePageReady: 'true', assetBase: liveProof.deployment.assetBase }] } });
}
assert.throws(() => planPublication(state, liveProof, liveReference, newVersion)); checks++;
const publication = planPublication(importedState, liveProof, liveReference, newVersion);
assert.equal(publication.generateCatalog, true); checks++;
assert.equal(publication.writes['data/line-page-release.json'].publishedProducts.length, 114); checks++;
assert.deepEqual(publication.writes['data/line-page-release.json'].products, state.release.products); checks++;
assert.deepEqual(publication.writes['data/line-page-imports.json'].pages, state.registry.pages); checks++;
for (const id of state.original100) assert.deepEqual(publication.writes['research/line-pages/review-status.json'][id], state.reviews[id]); checks++;
reject(p => delete p.pages[id], 'publish', importedState);
reject(p => p.pages[id].nativeProductId = 'deadbeefdeadbeefdeadbeef', 'publish', importedState);
reject(p => p.pages[id].productHash = '0'.repeat(64), 'publish', importedState);
reject(p => p.pages[id].liveVerified = false, 'publish', importedState);
reject(p => p.pages[id].live.canonical += '-wrong', 'publish', importedState);
reject(p => p.pages[id].live.cartVisible = true, 'publish', importedState);
reject(p => p.pages[id].live.broken = ['image'], 'publish', importedState);
reject(p => p.pages[id].live.root[0].productId = other, 'publish', importedState);
reject(p => p.pages[id].visibility = 'Hidden', 'publish', importedState);
reject(p => p.pages[id].savedAt = at(-180000), 'publish', importedState);
reject(p => p.importProofSha256 = '0'.repeat(64), 'publish', importedState);
reject(p => p.pendingLiveId = id, 'publish', importedState);
reject(p => delete p.deployment.assetHashes['data/lines.json'], 'publish', importedState);
assert.throws(() => planPublication(importedState, liveProof, liveReference, state.release.version)); checks++;
const publishedState = { ...importedState, release: publication.writes['data/line-page-release.json'],
  reviews: publication.writes['research/line-pages/review-status.json'], registry: publication.writes['data/line-page-imports.json'] };
assert.equal(planPublication(publishedState, liveProof, liveReference, newVersion).alreadyApplied, true); checks++;
assert.equal(JSON.stringify(state), untouched); checks++;
console.log(JSON.stringify({ pass: true, syntheticChecks: checks, original100ReviewsPreserved: true,
  sharedFilesWritten: 0, proofWritten: false, actualImportVerified: false, actualLiveVerified: false }));
