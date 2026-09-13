import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const catalogRoot = 'research/line-pages/full-catalog';
export const originalGroups = ['group-main', 'group-a', 'group-b', 'group-c', 'group-d', 'group-e'];
export const resolutionSources = [
  { group: 'group-c-resolutions', sha256: '7891786aaa7d2c5486a59deb369c98288d3ee063db5f06e31b918504403a6262',
    review: 'group-c-review', verdict: 'pass-four-candidates-only',
    ids: ['spiderwire-stealth-braid', 'stren-super-knot', 'stren-fluorocast', 'stren-sonic-braid'] },
  { group: 'group-e-resolutions', sha256: '952b69d1a3ea76431ea05b4828556689a85942747702b28af822e695df26047d',
    reviewFile: 'reports/resolution-integration/group-e-final-review.json', verdict: 'pass-one-candidate-final-copy',
    ids: ['hi-seas-fluorocarbon'] },
  { group: 'sufix-resolutions', sha256: '43fa7cb8fe338c6f09b4aa0deebf382294dd640ac813a81916abc7f82f2f03b3',
    review: 'sufix-review', verdict: 'pass-with-qualifications',
    ids: ['sufix-invisiline-fluorocarbon', 'sufix-calibr8'] },
  { group: 'pline-resolutions', sha256: '39a53e7e2ed10394271b53eeef694fe68ba57936fe7ff7db2c5038ca80c6b2f1',
    review: 'pline-review', verdict: 'pass-limited-scope',
    ids: ['p-line-cxx-x-tra-strong', 'p-line-floroclear', 'p-line-cx-premium', 'p-line-tactical-fluorocarbon',
      'p-line-halo-fluorocarbon', 'p-line-endurx-braid', 'p-line-tcb-8-braid'] }
];
export const resolutionIds = resolutionSources.flatMap(source => source.ids);
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

// Only named originals and independently signed, per-model overrides can enter staging.
export function loadLinePackModels() {
  const models = new Map();
  for (const group of originalGroups) {
    const file = `${catalogRoot}/${group}/pack.json`;
    const bytes = fs.readFileSync(file);
    const pack = JSON.parse(bytes);
    for (const model of pack.models) {
      assert(!models.has(model.id), `Duplicate original assignment: ${model.id}`);
      models.set(model.id, { model, pack, file, group, sourcePackSha256: sha256(bytes), resolution: false });
    }
  }
  for (const source of resolutionSources) {
    const file = `${catalogRoot}/${source.group}/pack.json`;
    const bytes = fs.readFileSync(file);
    assert.equal(sha256(bytes), source.sha256, `Resolution pack changed; obtain review signoff: ${file}`);
    const reviewFile = source.reviewFile || `${catalogRoot}/resolution-independent-review/${source.review}.json`;
    const review = read(reviewFile);
    assert.equal(review.packSha256 || review.pack?.sha256 || review.signoff?.packSha256, source.sha256, `Stale review: ${reviewFile}`);
    assert.equal(review.verdict || review.decision, source.verdict, `Review decision changed: ${reviewFile}`);
    assert.equal((review.blockers || review.blockingFindings || []).length, 0, `Review blockers: ${reviewFile}`);
    const pack = JSON.parse(bytes);
    for (const id of source.ids) {
      const prior = models.get(id);
      const matches = pack.models.filter(model => model.id === id);
      assert.equal(matches.length, 1, `Missing or duplicate selected resolution: ${id}`);
      const model = matches[0];
      assert(prior && !prior.resolution, `Resolution must override one original assignment: ${id}`);
      assert.equal(model.status, 'source-verified', `Unverified resolution: ${id}`);
      assert(model.product && model.rows.length, `Incomplete resolution: ${id}`);
      assert.equal(model.brand, prior.model.brand);
      assert.equal(model.model, prior.model.model);
      assert.equal(model.lineType, prior.model.lineType);
      models.set(id, { model, pack, file, group: source.group, sourcePackSha256: source.sha256,
        resolution: true, reviewFile, reviewSha256: sha256(fs.readFileSync(reviewFile)) });
    }
  }
  return [...models.values()];
}
