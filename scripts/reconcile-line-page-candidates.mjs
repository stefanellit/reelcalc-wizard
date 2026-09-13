import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { loadLinePackModels } from './line-pack-sources.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const save = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const base = 'research/line-pages/full-catalog';
const packs = loadLinePackModels().map(entry => entry.model);
const imported = new Set(read('generated/line-pages/imported-products.json').importedProducts);
const ledger = read(`${base}/staging-ledger.json`);
const products = read('data/line-page-products.json');
const release = read('data/line-page-release.json');
const reviews = read('research/line-pages/review-status.json');
const original = JSON.parse(execFileSync('git', ['show', '8d15fd1:data/lines.json'], { encoding: 'utf8', maxBuffer: 20e6 }));
let lines = read('data/lines.json');
const held = packs.filter(model => model.status !== 'source-verified' && ledger.models[model.id] && !ledger.models[model.id].withdrawnAt);
for (const model of held) {
  assert(!imported.has(model.id), `Cannot withdraw an already imported page: ${model.id}`);
  assert(!release.publishedProducts.includes(model.id), `Cannot withdraw a published page: ${model.id}`);
  const staged = ledger.models[model.id];
  for (const update of staged.updates) {
    const index = lines.findIndex(line => line.id === update.id);
    if (index < 0) continue;
    assert.deepEqual(lines[index], update.updated, `Unrelated edit on held row ${update.id}; inspect before restoring`);
    const old = original.find(line => line.id === update.id);
    if (old) lines[index] = old;
    else lines.splice(index, 1);
  }
  delete products.products[model.id];
  release.products = release.products.filter(id => id !== model.id);
  reviews[model.id] = { status: 'source-hold', browserAudit: false, notes: [model.reason || 'Source evidence unresolved.'] };
  staged.withdrawnAt = new Date().toISOString();
  staged.withdrawalReason = model.reason;
  // Remove only generated, untracked artifacts belonging to this withdrawn candidate.
  for (const file of [`components/line-pages/${model.id}.html`, `examples/line-pages/${model.id}.html`,
    `generated/line-pages/${model.id}-squarespace-snippet.html`, `previews/line-pages/${model.id}-hosted.html`]) {
    const absolute = path.resolve(file);
    assert(absolute.startsWith(process.cwd() + path.sep));
    if (fs.existsSync(file)) {
      assert(!execFileSync('git', ['ls-files', '--', file], { encoding: 'utf8' }).trim(), `Tracked artifact ${file}`);
      fs.unlinkSync(file);
    }
  }
}
save('data/lines.json', lines);
save('data/line-page-products.json', products);
save('data/line-page-release.json', release);
save('research/line-pages/review-status.json', reviews);
save(`${base}/staging-ledger.json`, ledger);
console.log(JSON.stringify({ withdrawn: held.map(model => model.id), candidates: release.products.length - release.publishedProducts.length, published: release.publishedProducts.length }));
