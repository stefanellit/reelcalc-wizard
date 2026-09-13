import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const args = process.argv.slice(2);
assert(args.length <= 1 && args.every(arg => arg === '--apply'), 'Use optional --apply only after all80 ledger entries pass.');
const apply = args.includes('--apply');
const dir = 'reports/resolution-integration';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const hash = file => sha(fs.readFileSync(file));
const objectHash = value => sha(JSON.stringify(value));
const save = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const files = ['data/line-page-release.json', 'research/line-pages/review-status.json', 'generated/line-pages/imported-products.json',
  'data/lines.json', 'data/line-page-products.json', 'data/line-page-imports.json', 'reports/full-catalog-publication-ledger.json'];
const beforeHashes = Object.fromEntries(files.map(file => [file, hash(file)]));
const phase = read(`${dir}/phase-one-verification.json`);
const handoff = read(`${dir}/handoff.json`);
const original20 = phase.publishedProductsPreserved;
const original100 = phase.frozenProducts.map(entry => entry.id);
const original80 = original100.filter(id => !original20.includes(id));
const ledgerFile = 'reports/full-catalog-publication-ledger.json';
const ledger = read(ledgerFile);
const release = read('data/line-page-release.json');
const products = read('data/line-page-products.json').products;
const reviews = read('research/line-pages/review-status.json');
const imported = read('generated/line-pages/imported-products.json').importedProducts;
const registry = Object.values(read('data/line-page-imports.json').pages);
assert.equal(original20.length, 20);
assert.equal(original80.length, 80);
assert.deepEqual([...release.products].sort(), [...original100, ...handoff.newProductIds].sort());
assert.deepEqual([...imported].sort(), [...original100].sort(), 'Import ledger must remain exact original100 in this promotion.');
assert(release.publishedProducts.length === 20 || release.publishedProducts.length === 100);
assert.deepEqual([...release.publishedProducts].sort(), [...(release.publishedProducts.length === 20 ? original20 : original100)].sort());
for (const id of original20) assert.equal(objectHash(products[id]), phase.frozenProducts.find(entry => entry.id === id).sha256, `Original20 changed: ${id}`);
for (const source of handoff.originalSourcePacks) assert.equal(hash(source.file), source.sha256);
const failures = [];
if (ledger.importedCount !== 80 || Object.keys(ledger.pages).length !== 80 ||
    Object.keys(ledger.pages).some(id => !original80.includes(id))) failures.push('Ledger set is not exact original80.');
const entryChecks = original80.map(id => {
  const entry = ledger.pages[id];
  const expected = registry.find(page => page.id === id);
  const errors = [];
  const check = (valid, reason) => { if (!valid) errors.push(reason); };
  check(!!entry, 'Missing ledger entry');
  check(!!expected, 'Missing registry identity');
  check(entry?.nativeSeoSaved === true, 'Native SEO not recorded saved');
  check(entry?.visibility === 'Public', 'Native visibility not Public');
  check(entry?.liveVerified === true, 'Live verification missing');
  check(entry?.url === expected?.url, 'Saved URL mismatch');
  check(Number.isFinite(Date.parse(entry?.savedAt)), 'Save timestamp missing');
  check(entry?.live?.url === expected?.url, 'Live URL mismatch or absent');
  check(entry?.live?.canonical === expected?.url, 'Live canonical mismatch or absent');
  check(entry?.live?.title === expected?.seoTitle, 'Live SEO title mismatch or absent');
  check(entry?.live?.description === expected?.seoDescription, 'Live SEO description mismatch or absent');
  check(Array.isArray(entry?.live?.broken) && entry.live.broken.length === 0, 'Broken-image evidence failed or absent');
  check(entry?.live?.cartVisible === false, 'Commerce suppression failed or absent');
  check(entry?.live?.overflow === false || entry?.live?.overflow === 0, 'Overflow evidence failed or absent');
  check(entry?.live?.root?.some(node => node.productId === id && node.linePageReady === 'true' &&
    node.assetBase === 'https://stefanellit.github.io/reelcalc-wizard/'), 'Exact hosted guide ready state absent');
  check(entry?.live?.headings?.includes(products[id].h1), 'Expected product heading absent');
  failures.push(...errors.map(error => `${id}: ${error}`));
  return { id, expectedUrl: expected?.url, nativePublic: entry?.visibility === 'Public', liveVerified: entry?.liveVerified === true,
    ledgerEntrySha256: entry ? objectHash(entry) : null, savedAt: entry?.savedAt || null, pass: !errors.length, errors };
});
if (ledger.pendingLiveId) failures.push(`Ledger still has pendingLiveId: ${ledger.pendingLiveId}`);
const result = { checkedAt: new Date().toISOString(), mode: apply ? 'apply-requested' : 'dry-run',
  verdict: failures.length ? 'hold-ledger-incomplete-or-conflicting' : 'pass-exact-original100',
  authorization: 'User confirmed original80 native Public and live and authorized exact-original100 metadata promotion after ledger validation; no new14 promotion.',
  ledger: { file: ledgerFile, sha256: beforeHashes[ledgerFile] }, original20Stable: true,
  original20, original80, original100, candidates14: handoff.newProductIds,
  originalPacksUnchanged: handoff.originalSourcePacks, entryChecks, failures, beforeHashes,
  importedLedgerChanged: false, nativeFallback28StillOld: true, browserAccessed: false,
  releaseChanged: false, reviewStatusChanged: false };
if (failures.length || !apply) {
  save(`${dir}/original100-publication-validation.json`, result);
  console.log(JSON.stringify({ verdict: result.verdict, nativePublic: entryChecks.filter(entry => entry.nativePublic).length,
    liveVerified: entryChecks.filter(entry => entry.liveVerified).length, failures, sharedFilesChanged: false }, null, 2));
  process.exitCode = failures.length ? 1 : 0;
} else {
  const published = { ...release, publishedProducts: original100 };
  // Version9 is the undeployed local resolution cache key. Do not invent or regress a concurrent version.
  assert(Number(release.version) >= 9, 'Choose a new cache version explicitly if the release baseline changed.');
  const updated = structuredClone(reviews);
  for (const id of original100) {
    const prior = updated[id] || {};
    const copyPending = handoff.copyCleanup.models.includes(id);
    const entry = ledger.pages[id];
    const oldProduct = phase.frozenProducts.find(product => product.id === id);
    const superseded = (prior.notes || []).filter(note => note === 'Awaiting hidden Squarespace import, native SEO and live-page verification; not yet published.');
    updated[id] = { ...prior, status: 'published', ...(entry && !prior.publishedAt ? { publishedAt: entry.savedAt } : {}),
      browserAudit: copyPending ? false : prior.browserAudit ?? true,
      notes: (prior.notes || []).filter(note => !superseded.includes(note)),
      ...(superseded.length ? { historicalNotes: [...(prior.historicalNotes || []), ...superseded] } : {}),
      publication: { status: 'live', nativeImported: true, nativePublic: true, liveVerified: true,
        proof: entry ? ledgerFile : `${dir}/phase-one-verification.json`, proofSha256: entry ? beforeHashes[ledgerFile] : hash(`${dir}/phase-one-verification.json`),
        ...(entry ? { ledgerEntrySha256: objectHash(entry) } : {}),
        url: registry.find(page => page.id === id).url,
        basis: entry ? 'Main-owned native/public/live ledger validated locally; no browser access by metadata integrator.' : 'Stable original20 release membership, frozen product hash and explicit user confirmation; not a new live probe.',
        liveProductSha256: oldProduct.sha256,
        currentLocalProductSha256: objectHash(products[id]),
        ...(copyPending ? { nativeFallback: 'original-copy-refresh-pending', localRevision: 'copy-reviewed-awaiting-main-browser-and-deployment' } : {}) } };
  }
  for (const id of handoff.newProductIds) {
    assert(updated[id] && updated[id].status !== 'published');
    updated[id].publication = { status: 'candidate', nativeImported: false, nativePublic: false, liveVerified: false,
      note: 'Not included in original100 publication promotion. Retain separate local/browser signoff; do not infer native state from prepared registry.' };
  }
  for (const file of files) assert.equal(hash(file), beforeHashes[file], `Concurrent edit detected; no metadata write: ${file}`);
  const changedRelease = JSON.stringify(published) !== JSON.stringify(release);
  const changedReviews = JSON.stringify(updated) !== JSON.stringify(reviews);
  if (changedRelease) save('data/line-page-release.json', published);
  if (changedReviews) save('research/line-pages/review-status.json', updated);
  result.mode = 'applied-local-metadata-only';
  result.releaseChanged = changedRelease;
  result.reviewStatusChanged = changedReviews;
  result.afterHashes = Object.fromEntries(files.map(file => [file, hash(file)]));
  result.releaseVersion = published.version;
  result.publishedProducts = published.publishedProducts.length;
  save(`${dir}/original100-publication-validation.json`, result);
  console.log(JSON.stringify({ verdict: result.verdict, published: published.publishedProducts.length, prepared: published.products.length,
    imported: imported.length, version: published.version, changedRelease, changedReviews, nativeFallback28StillOld: true }, null, 2));
}
