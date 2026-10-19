import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { braidFaqAdvice, isLegacyBraidFaq } from './reel-pages/braid-faq.mjs';
import { root, patchFaq, previousDefault } from './reel-pages/refresh-braid-faqs.mjs';
import { normalizeReel } from './reel-pages/lookup.mjs';
import { buildRecommendationModel } from './reel-pages/recommendations.mjs';
import { generateReelPage } from './generate-reel-page.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const reels = new Map(read(path.join(root, 'data/reels.json')).map(row => [row.id, normalizeReel(row)]));
const manifest = read(path.join(root, 'data/reel-page-embeds.json'));
const advice = slug => {
  const reel = reels.get(manifest.pages[slug].reelId);
  return braidFaqAdvice(reel, buildRecommendationModel(reel));
};
for (const slug of ['penn-battle-iv-5000', 'penn-fierce-iv-5000', 'daiwa-bg-5000']) {
  const result = advice(slug);
  assert.equal(result.profile, 'surf-pier-inshore', slug);
  assert.match(result.text, /surf/);
  assert.doesNotMatch(result.text, /finesse|trout|panfish|\bbass\b/i);
}
assert.match(advice('penn-battle-iv-5000').text, /^20-40 lb braid /);
assert.match(advice('shimano-sedona-fj-1000').text, /trout|panfish/);
assert.doesNotMatch(advice('shimano-sedona-fj-1000').text, /offshore|surf|heavy cover/);
assert.match(advice('daiwa-bg-2500').text, /speckled trout/);
assert.match(advice('daiwa-bg-2500').text, /redfish/);
const bfs = advice('shimano-curado-bfs-cubfsxgl');
assert.equal(bfs.profile, 'bait-finesse');
assert.match(bfs.text, /small lures/);
assert.doesNotMatch(bfs.text, /frogs|heavy cover|larger baits/);
const synthetic = (useCase, reelType = 'spinning') => braidFaqAdvice({ useCase, reelType }, { braidRange: '20-40 lb braid' });
assert.equal(synthetic('offshore, jigging').profile, 'offshore');
assert.equal(synthetic('offshore, heavy jigging', 'baitcasting').profile, 'offshore');
assert.equal(synthetic('catfish, pike').profile, 'heavier-freshwater');
assert.equal(synthetic('trolling, line deployment', 'baitcasting').profile, 'trolling');
assert.doesNotMatch(synthetic('trolling, line deployment', 'baitcasting').text, /frogs|casting distance/);
assert.equal(synthetic('inshore, redfish, speckled trout').profile, 'inshore');
assert.equal(synthetic('sea trout').profile, 'inshore');
assert.equal(synthetic('finesse, bass, light inshore').profile, 'freshwater-inshore');
assert.equal(synthetic('bass, frogs, vegetation', 'baitcasting').profile, 'casting');
assert.match(synthetic('bass, frogs, vegetation', 'baitcasting').text, /cover/);

for (const slug of ['penn-battle-iv-5000', 'shimano-sedona-fj-1000', 'daiwa-bg-2500', 'shimano-curado-bfs-cubfsxgl']) {
  const result = generateReelPage(manifest.pages[slug].reelId);
  assert.equal(result.status, 'generated', slug);
  assert.equal(result.model.faqBraid, advice(slug).text, `Authoritative generator: ${slug}`);
}
for (const recommendation of [{ braidRange: '20-40 lb braid' }, { braidRange: '50-80 lb braid', heavyDuty: true }, { braidRange: '6-15 lb braid', baitcaster: true }]) {
  const before = previousDefault(recommendation);
  assert(isLegacyBraidFaq(before));
  const source = `<div data-track="keep"><h3>What Size Braid Is Best for This Reel?</h3>\n<p>${before}</p><h3>Other question</h3><p>Disclosure stays.</p></div>`;
  const result = patchFaq(source, "Reel's correct context.");
  assert.equal(result.replacements.length, 1);
  assert.equal(result.updated, source.replace(before, 'Reel&#039;s correct context.'));
  assert.equal(patchFaq(result.updated, "Reel's correct context.").replacements.length, 0);
}
assert.equal(patchFaq('<h3>What Size Braid Is Best for This Reel?</h3><p>No published braid capacity; keep this disclosure.</p>', 'New default').replacements.length, 0);
assert.equal(patchFaq('<h3>Unrelated FAQ</h3><p>Keep</p>', 'New default').replacements.length, 0);
for (const [slug, entry] of Object.entries(manifest.pages)) {
  assert(entry.content.faqBraid, `${slug}: no FAQ in live manifest`);
  assert(!isLegacyBraidFaq(entry.content.faqBraid), `${slug}: legacy generic FAQ`);
}

if (process.argv[2]) {
  const out = path.resolve(process.argv[2]);
  const original = read(path.join(out, 'original-manifest.json'));
  const report = read(path.join(out, 'changes.json'));
  for (const change of report.changes) assert.equal(change.after, advice(change.slug).text, `${change.slug}: stale generated FAQ`);
  const stripped = structuredClone(manifest);
  stripped.version = original.version;
  for (const slug of Object.keys(stripped.pages)) {
    const old = original.pages[slug].content;
    if (Object.hasOwn(old, 'faqBraid')) stripped.pages[slug].content.faqBraid = old.faqBraid;
    else delete stripped.pages[slug].content.faqBraid;
  }
  assert.deepEqual(stripped, original, 'Manifest changes outside braid FAQ/version');
  for (const custom of report.retained) assert.equal(manifest.pages[custom.slug].content.faqBraid, original.pages[custom.slug].content.faqBraid);
  const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const protectedFiles = ['data/reels.json', 'data/reel-pages.json', 'data/reel-affiliates.json', 'js/calculator-core.js', 'js/reel-page-calculator.js', 'scripts/reel-pages/recommendations.mjs'];
  for (const file of protectedFiles) assert.equal(hash(path.join(root, file)), hash(path.join(out, 'originals', file)), `${file} changed`);
  for (const row of report.files) {
    const before = fs.readFileSync(path.join(out, 'originals', row.file), 'utf8');
    const slug = path.basename(row.file).replace(/-(preview|squarespace)\.html$/, '');
    const expected = patchFaq(before, manifest.pages[slug].content.faqBraid);
    assert.equal(fs.readFileSync(path.join(root, row.file), 'utf8'), expected.updated, `${row.file}: unrelated HTML changes`);
  }
  const products = read(path.join(out, 'originals/squarespace-products.json'));
  const updated = read(path.join(out, 'squarespace-updated-products.json'));
  const byId = new Map(products.map(row => [row['Product ID [Non Editable]'], row]));
  for (const next of updated) {
    const old = byId.get(next['Product ID [Non Editable]']);
    assert(old);
    const expected = patchFaq(old.Description, manifest.pages[next['Product URL']].content.faqBraid);
    assert.equal(expected.replacements.length, 1);
    assert.deepEqual(next, { ...old, Description: expected.updated });
  }
  const validation = { passed: true, reviewed: Object.keys(manifest.pages).length, changed: updated.length, customRetained: report.retained.length, htmlFiles: report.files.length, protectedFiles, onlyDescriptionParagraphChanged: true };
  fs.writeFileSync(path.join(out, 'validation.json'), JSON.stringify(validation, null, 2) + '\n');
  console.log(JSON.stringify(validation, null, 2));
}
console.log('Context-specific braid FAQ regression checks passed.');
