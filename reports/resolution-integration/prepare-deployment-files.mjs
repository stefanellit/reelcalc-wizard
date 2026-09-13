import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(root);
const dir = 'reports/resolution-integration';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const hash = file => sha(fs.readFileSync(file));
const objectHash = value => sha(JSON.stringify(value));
const save = (name, value) => {
  assert(/^[a-z0-9.-]+$/i.test(name), 'Report output must stay in the integration directory.');
  const target = `${dir}/${name}`;
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(temporary, target);
};
const metadata = file => ({ file, sha256: hash(file), bytes: fs.statSync(file).size });
const git = JSON.parse(fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
assert(Array.isArray(git.status) && Array.isArray(git.tracked) && /^[a-f0-9]{40}$/.test(git.head.trim()), 'Supply a fresh structured git snapshot on stdin.');
const tracked = new Set(git.tracked);
const status = new Map(git.status.map(line => {
  assert(!line.includes(' -> '), 'Resolve renamed-path ownership explicitly before refreshing this allowlist.');
  return [line.slice(3).replace(/^"|"$/g, ''), line.slice(0, 2)];
}));
const handoff = read(`${dir}/handoff.json`);
const originalChanges = read(`${dir}/changed-files.json`).files;
const originalChangesByPath = new Map(originalChanges.map(entry => [entry.file, entry]));
const phase = read(`${dir}/phase-one-verification.json`);
const products = read('data/line-page-products.json').products;
const lines = read('data/lines.json');
const release = read('data/line-page-release.json');
const registry = read('data/line-page-imports.json');
const imported = read('generated/line-pages/imported-products.json').importedProducts;
const finalGate = read(`${dir}/final-browser-gate.json`);
const original100 = phase.frozenProducts.map(entry => entry.id);
const new14 = handoff.newProductIds;
const copy28 = handoff.copyCleanup.models;
assert.equal(new14.length, 14);
assert.equal(copy28.length, 28);
assert.equal(original100.length, 100);
assert.equal(Object.keys(products).length, 114);
assert.deepEqual([...release.products].sort(), [...original100, ...new14].sort());
assert(new14.every(id => !original100.includes(id)));
assert(original100.every(id => imported.includes(id)));
assert(imported.every(id => release.products.includes(id)));
assert(release.publishedProducts.every(id => release.products.includes(id)));

const numericalFiles = ['js/calculator-core.js', 'js/recommendation-engine.js', 'data/reels.json', 'data/reel-affiliates.json'];
const compactBaselinePath = `${dir}/deployment-scope-baseline.json`;
const sourceBaseline = fs.existsSync(`${dir}/baseline.json`) ? read(`${dir}/baseline.json`) : read(compactBaselinePath);
const compactBaseline = { purpose: 'Pre-integration hashes only; sufficient for the cross-tool scope test. Not the full historical integration snapshot.',
  files: Object.fromEntries(numericalFiles.map(file => [file, sourceBaseline.files[file]])) };
for (const file of numericalFiles) assert.equal(hash(file), compactBaseline.files[file], `Numerical dependency changed: ${file}`);
save('deployment-scope-baseline.json', compactBaseline);

const packSources = handoff.sourcePacks.map(source => {
  assert.equal(hash(source.file), source.sha256, `Signed pack changed: ${source.file}`);
  assert.equal(hash(source.reviewFile), source.reviewSha256, `Signed review changed: ${source.reviewFile}`);
  return { ...source, bytes: fs.statSync(source.file).size };
});
const originalPacks = handoff.originalSourcePacks.map(source => {
  assert.equal(hash(source.file), source.sha256, `Original source pack changed: ${source.file}`);
  return { ...source, bytes: fs.statSync(source.file).size };
});
const models = handoff.candidates.map(candidate => {
  const model = read(candidate.sourcePack).models.find(entry => entry.id === candidate.id);
  assert.equal(objectHash(model), candidate.modelSha256, `Source model changed: ${candidate.id}`);
  assert.equal(objectHash(products[candidate.id]), candidate.productSha256, `Product changed: ${candidate.id}`);
  assert.equal(hash(candidate.image), candidate.imageSha256, `Image changed: ${candidate.id}`);
  const rows = candidate.lineIds.map(id => {
    const row = lines.find(entry => entry.id === id);
    assert(row && row.source_pack?.sha256 === candidate.sourcePackSha256);
    return row;
  });
  const qualifications = Object.fromEntries(Object.entries(model).filter(([key]) =>
    /scope|coverage|conflict|hold|held|exclu|unverified|unresolved|integration|priorHold/i.test(key)));
  return { ...candidate, brand: model.brand, model: model.model, lineType: model.lineType, role: model.role,
    reason: model.reason, qualifications, sourceUrls: model.sourceUrls, rows,
    sourceEvidenceReferences: model.sourceFiles || [],
    editorial: Object.fromEntries(['quickSummary', 'chartNote', 'chartCaption', 'sourceNote', 'reviewNote', 'sources', 'faqs'].map(key => [key, products[candidate.id][key]])),
    exampleSetups: products[candidate.id].exampleSetups,
    image: { ...metadata(candidate.image), url: products[candidate.id].imageUrl, alt: products[candidate.id].imageAlt } };
});
assert.equal(models.flatMap(model => model.rows).length, 42);
const overlayFile = 'research/line-pages/full-catalog/resolution-independent-review/original80-copy-cleanup/overlay.json';
const overlay = read(overlayFile);
assert.equal(hash(overlayFile), handoff.copyCleanup.overlaySha256);
assert.equal(overlay.changes.length, 53);
for (const change of overlay.changes) {
  const value = change.path.slice(1).split('/').reduce((node, key) => node[key], { products });
  assert.equal(value, change.after, `Overlay changed: ${change.path}`);
}
save('deployment-source-summary.json', {
  schemaVersion: 1, purpose: 'Compact exact source, identity and qualification index. Raw source captures remain in the local research archive.',
  originalSourcePacks: originalPacks, selectedSourcePacks: packSources, newProductIds: new14,
  original100ProductIds: original100, copy28ProductIds: copy28, models,
  originalCopyOverlay: { ...metadata(overlayFile), fields: 53, products: 28, report: metadata(`${dir}/original80-copy-cleanup.json`),
    restrictions: ['No SEO, image, identity, numeric or source qualification changes', 'Original source packs remain frozen', 'Existing native descriptions need a separate existing-product refresh'] },
  heldAndExcluded: ['daiwa-j-braid-x8', 'shimano-kairiki-g5'],
  reproductionBoundary: { possibleWithoutRawResearch: ['Build all14 from authoritative configs', 'Compare exact signed pack/model/row identities, exclusions and images', 'Replay overlay field checks', 'Run numerical, publishing and cross-tool scope tests'],
    requiresLocalResearchArchive: ['Replay manufacturer fetch or visual chart inspections', 'Run full sourceFiles preflight', 'Restage historical integration or replay phase-one byte snapshots'],
    note: 'Hashes bind reviewed evidence; they are not a new independent source review. Do not download current pages and assume their contents equal archived signed sources.' }
});

// Inclusion is explicit. Git discovery supplies status only, never candidates.
const localReasons = new Map([
  ['research/line-pages/full-catalog/staging-ledger.json', 'Large historical staging snapshot; not required to build accepted configs.'],
  ['reports/full-line-pack-preflight.json', 'Historical raw-evidence preflight, not a post-publication gate.'],
  ['generated/line-pages/DRAFT-NOT-FOR-UPLOAD-14-new-line-guides.csv', 'Operational draft only; never upload or deploy as a live artifact.'],
  ['generated/line-pages/original80-copy-cleanup-native-content.json', 'Regenerable existing-description refresh packet; local handoff, not native-ID update CSV.'],
  ['scripts/snapshot-line-resolution-baseline.mjs', 'One-time historical baseline creator; do not recreate the frozen baseline.'],
  ['scripts/test-line-resolution-integration.mjs', 'Phase-one-only snapshot test; its pre-overlay conditions intentionally no longer hold.'],
  ['scripts/finalize-line-resolution-integration.mjs', 'Historical finalizer depends on local snapshots; do not use for promotion.'],
  ['scripts/apply-original80-copy-cleanup.mjs', 'One-time phase-gated wrapper; overlay already applied and verified.'],
  ['scripts/review-e-resolution-correction.mjs', 'Historical correction verifier needs old raw evidence; retain signed final review instead.']
]);
const included = new Map();
function include(file, category, reason) {
  assert(!localReasons.has(file));
  if (!included.has(file)) included.set(file, { file, category, reason });
}
function categoryFor(file) {
  if (file.startsWith('js/') || file === 'examples/reel-comparison.js' || file.startsWith('data/') ||
      file.startsWith('assets/') || file.startsWith('components/') || file.startsWith('examples/line-pages/')) return 'runtime';
  if (file.startsWith('scripts/')) return 'build-and-test-source';
  if (file.startsWith('previews/') || file.endsWith('-squarespace-snippet.html')) return 'generated-qa';
  return 'build-and-review-metadata';
}
for (const entry of originalChanges) if (!localReasons.has(entry.file)) include(entry.file, categoryFor(entry.file), 'Integration changed-files allowlist.');
for (const asset of handoff.requiredAssets) include(asset.file, 'runtime', asset.existedAtBaseline ? 'Required accepted image existed before integration, but still needs Git inclusion.' : 'New accepted resolution image.');
for (const source of [...packSources, ...originalPacks]) include(source.file, 'signed-source-pack', 'Explicit pack-discovery dependency; compact JSON only, not sourceFiles captures.');
for (const source of packSources) include(source.reviewFile, 'signed-review', 'Exact review used by staging source-signature guard.');
include('research/line-pages/full-catalog/resolution-independent-review/group-e-resolutions-review.json', 'signed-review', 'Prior E source review; final signed FAQ correction review supersedes its pack hash.');
include(overlayFile, 'copy-overlay', 'Exact immutable 53-field copy overlay.');
include(overlayFile.replace('overlay.json', 'apply-overlay.mjs'), 'copy-overlay', 'Structured, field-constrained overlay validator and applier.');
include('previews/line-pages/responsive-check.html', 'generated-qa', 'Main-coordinated exact114 responsive helper allowlist; helper-fix.md records scope.');
include('previews/line-pages/viewport-check.html', 'generated-qa', 'True iframe viewport wrapper paired with the hosted-widget responsive audit helper.');
include('scripts/test-line-page-affiliate-scope.mjs', 'build-and-test-source', 'RINT-01 remediation regression test: display qualification versus plain retailer query.');
include('reports/full-catalog-publication-ledger.json', 'compact-integration-evidence', 'Main-owned original80 native/public/live proof; validation never assumes completeness.');
for (const name of ['actual-browser-checks.json', 'actual-copy-browser-checks.json', 'actual-viewport-checks.json']) {
  if (fs.existsSync(`${dir}/${name}`)) include(`${dir}/${name}`, 'compact-integration-evidence', 'Main-owned browser observations required by the fail-closed final gate; inclusion does not imply passing.');
}
include(`${dir}/final-full-catalog-trust.json`, 'compact-integration-evidence', 'Full825-strength/1320-reel calculation audit: 1089000 pairings, zero failures.');
if (finalGate.actualImportBuilt) {
  assert.equal(finalGate.verdict, 'pass-proof-gates');
  assert.equal(finalGate.import.file, 'generated/line-pages/UPLOAD-THIS-14-new-line-guides.csv');
  assert.equal(hash(finalGate.import.file), finalGate.import.sha256);
  assert.equal(hash(finalGate.import.inventory), finalGate.import.inventorySha256);
  assert.equal(hash(finalGate.import.original80InventoryBackup), finalGate.import.original80InventorySha256);
  for (const [file, expected] of Object.entries(finalGate.proofHashes)) assert.equal(hash(file), expected, `Final browser/audit proof drift: ${file}`);
  include(finalGate.import.file, 'native-import-artifact', 'Approved exact14 hidden create-only CSV; local file generation is not native import. Main submits once after deployment verification.');
  include(finalGate.import.inventory, 'build-and-review-metadata', 'Current exact14 import inventory; excludes original100.');
  include(finalGate.import.original80InventoryBackup, 'compact-integration-evidence', 'Exact preserved original80 inventory before the existing production builder wrote new14 inventory.');
}
for (const file of ['generated/line-pages/catalog-progress.json', 'generated/line-pages/CATALOG-PROGRESS.md']) {
  if (release.publishedProducts.length === 100) include(file, 'build-and-review-metadata', 'Regenerated original100 publication progress metadata.');
}
for (const name of ['handoff.json', 'HANDOFF.md', 'changed-files.json', 'phase-one-verification.json', 'staged.json', 'tests.json', 'trust.json',
  'cross-tool-scope-tests.json', 'original80-copy-cleanup.json', 'copy-cleanup-validation.json', 'independent-integration-review.json',
  'helper-fix.md', 'deployment-source-summary.json', 'deployment-scope-baseline.json', 'deployment-handoff.md',
  'rint-01-remediation.json', 'original100-publication-validation.json', 'promote-original100.mjs',
  'finalize-reviewed-candidates.mjs', 'final-browser-gate.json',
  'prepare-deployment-files.mjs', 'verify-deployment-files.mjs']) include(`${dir}/${name}`, 'compact-integration-evidence', 'Bounded integration evidence or reproducible packaging tool.');

const before = new Map(originalChanges.map(entry => [entry.file, entry.beforeSha256]));
const entries = [...included.values()].sort((a, b) => a.file.localeCompare(b.file)).map(entry => ({ ...entry, ...metadata(entry.file),
  gitTracked: tracked.has(entry.file), gitStatus: status.get(entry.file) || 'clean',
  integrationBeforeSha256: before.get(entry.file) ?? null,
  integrationAfterSha256: originalChangesByPath.get(entry.file)?.afterSha256 ?? null,
  changedSinceIntegrationHandoff: originalChangesByPath.has(entry.file) && hash(entry.file) !== originalChangesByPath.get(entry.file).afterSha256 }));
const indexChanges = [...status].filter(([, code]) => code[0] !== ' ' && code !== '??').map(([file, code]) => ({ file, code }));
const unselectedTrackedChanges = [...status].filter(([file]) => tracked.has(file) && !included.has(file)).map(([file, code]) => ({ file, code }));
const runtimeEntries = entries.filter(entry => entry.category === 'runtime');
assert.equal(runtimeEntries.length, 109);
assert.equal(runtimeEntries.filter(entry => entry.file.startsWith('assets/')).length, 14);
const independent = read(`${dir}/independent-integration-review.json`);
const remediation = read(`${dir}/rint-01-remediation.json`);
assert.equal(remediation.status, 'fixed-locally-regression-tests-pass');
for (const file of remediation.changedFiles) assert.equal(hash(file.file), file.afterSha256, `RINT-01 remediation drift: ${file.file}`);
const publication = read(`${dir}/original100-publication-validation.json`);
const staticQa = fs.existsSync(`${dir}/browser-qa.json`) ? read(`${dir}/browser-qa.json`) : null;
const reportPath = `${dir}/deployment-files.json`;
const manifest = {
  schemaVersion: 1, generatedAt: new Date().toISOString(), repositoryRoot: root.replaceAll('\\', '/'),
  headCommit: git.head.trim(), scope: 'Additional14 + original28 copy cleanup + necessary runtime/source changes. Explicit allowlist, not deployment approval.',
  gitSnapshot: { statusEntries: status.size, trackedPaths: tracked.size, stagedChanges: indexChanges,
    unselectedTrackedChanges, unselectedUntrackedCount: [...status].filter(([file, code]) => code === '??' && !included.has(file) && file !== reportPath).length },
  releaseSnapshot: { ...metadata('data/line-page-release.json'), version: release.version, prepared: release.products.length,
    published: release.publishedProducts.length, imported: imported.length, registryPrepared: Object.keys(registry.pages).length },
  cohorts: { new14, copy28, original100, held: ['daiwa-j-braid-x8', 'shimano-kairiki-g5'] },
  counts: { files: entries.length + 1, hashedFiles: entries.length, runtime: runtimeEntries.length,
    categories: Object.fromEntries([...new Set(entries.map(entry => entry.category))].map(category => [category, entries.filter(entry => entry.category === category).length])),
    bytesExcludingManifest: entries.reduce((sum, entry) => sum + entry.bytes, 0) },
  deliveryPaths: [...entries.map(entry => entry.file), reportPath].sort(),
  runtimePaths: runtimeEntries.map(entry => entry.file),
  files: [...entries, { file: reportPath, category: 'compact-integration-evidence', sha256: null, reason: 'Self manifest: exact file hash is printed by generator/verifier; cannot contain its own SHA-256.' }],
  localOnlyChangedFiles: [...localReasons].map(([file, reason]) => ({ ...metadata(file), reason })),
  exclusions: ['All raw research HTML/PDF/JSON responses, catalog images and unused product images; original and signed pack JSONs are explicit exceptions.',
    'Large baseline.json, baseline-files, products-before-copy-overlay.json, staging-ledger and old exports remain local.',
    'Original80 create-only CSV, native manual-publish packet and original import inventory are preserved and never reimported.',
    'Other agents research, group-A held resolution packs, unrelated historical files, temporary tools, browser output and all unspecified Git paths are excluded.',
    'No node_modules, native CSV export, credentials, browser profiles, or bulk-directory Git addition.'],
  postHandoffChanges: entries.filter(entry => entry.changedSinceIntegrationHandoff).map(entry => ({ file: entry.file, before: entry.integrationAfterSha256, after: entry.sha256 })),
  sourceSummary: metadata(`${dir}/deployment-source-summary.json`),
  readiness: { publicationReady: false, readyForMainDeploymentReview: finalGate.actualImportBuilt === true && finalGate.verdict === 'pass-proof-gates',
    browserEvidencePassed: finalGate.verdict === 'pass-proof-gates', browserAccessed: false, deployed: false,
    nativeCopyStatus: { complete: false, pilot: 'User reports successful existing-ID update with native SEO/images preserved.',
      remaining27: 'User reports submitted once through existing-ID update and still processing. Not independently marked complete here.',
      new14: 'Not imported; actual14 file prepared locally only.' },
    independentReview: { ...metadata(`${dir}/independent-integration-review.json`), verdict: independent.verdict, findings: independent.findings },
    runtimeRemediation: { ...metadata(`${dir}/rint-01-remediation.json`), status: remediation.status, signedRuntimeHashesMatch: true },
    publicationProof: { ...metadata(`${dir}/original100-publication-validation.json`), verdict: publication.verdict,
      mode: publication.mode, ledgerSha256: publication.ledger.sha256, ledgerCurrent: hash(publication.ledger.file) === publication.ledger.sha256,
      failures: publication.failures },
    finalBrowserGate: { ...metadata(`${dir}/final-browser-gate.json`), verdict: finalGate.verdict, mode: finalGate.mode,
      actualImportBuilt: finalGate.actualImportBuilt, nativeCopy28Complete: false },
    fullCatalogAudit: { ...metadata(`${dir}/final-full-catalog-trust.json`), ...read(`${dir}/final-full-catalog-trust.json`) },
    mainBrowserProgress: ['actual-browser-checks.json', 'actual-copy-browser-checks.json', 'actual-viewport-checks.json'].filter(name => fs.existsSync(`${dir}/${name}`)).map(name => ({
      ...metadata(`${dir}/${name}`), note: 'Main-owned completed browser observations; gate checks identity, hashes and all required records. Not native new14 publication proof.' })),
    staticQaReference: staticQa ? { ...metadata(`${dir}/browser-qa.json`), note: 'Static checks only. Browser unavailable to that reviewer; raw large report excluded from delivery. Helper BQA-002 separately fixed.' } : null,
    remaining: finalGate.actualImportBuilt ? ['Main verification of final file list/checksums, staging/push/deployment and deployed asset checks.',
      'Main imports exact14 hidden create-only CSV once, reconciles import, then completes native settings and actual live checks.',
      'Keep publishedProducts/importedProducts at original100 until their separate real events; published114 requires all new14 live.',
      'Native copy28 is not marked complete: remaining27 existing-ID update submitted once and processing per user; final reconciliation remains main-owned.'] :
      ['Complete final browser gate before actual14 import generation; no native import or new14 publication implied.'] },
  publicationTransitions: { original100: { requiredLiveIds: original100, keepPreparedProducts: 114, expectedPublished: 100 },
    final114: { requiredNewLiveIds: new14, expectedPublished: 114 },
    metadataGenerator: 'node scripts/line-page-catalog.mjs',
    note: 'No existing build/staging generator promotes publishedProducts. Directory reads release + registry dynamically. Do not infer live state from prepared or imported counts.' }
};
save('deployment-files.json', manifest);
console.log(JSON.stringify({ file: reportPath, sha256: hash(reportPath), ...manifest.counts, indexChanges, unselectedTrackedChanges,
  drift: manifest.postHandoffChanges, release: manifest.releaseSnapshot, publicationReady: false }, null, 2));
