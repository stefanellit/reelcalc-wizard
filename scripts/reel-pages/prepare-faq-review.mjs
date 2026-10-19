import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root, patchFaq, escape } from './refresh-braid-faqs.mjs';

const out = path.resolve(process.argv[2] || path.join(root, '../../outputs/reel-faq-context-2026-10-18'));
const read = file => JSON.parse(fs.readFileSync(path.join(out, file), 'utf8').replace(/^\uFEFF/, ''));
const report = read('changes.json');
const products = read('originals/squarespace-products.json');
const changes = new Map(report.changes.map(row => [row.slug, row]));
const updated = [], unchanged = [], review = [];
for (const product of products) {
  if (product['Product Page'] !== 'reel-pages') continue;
  const slug = product['Product URL'];
  const change = changes.get(slug);
  if (!change) { unchanged.push({ slug, reason: 'Customized FAQ retained' }); continue; }
  assert(product['Product ID [Non Editable]'] && product['Variant ID [Non Editable]'], `Missing existing IDs: ${slug}`);
  const result = patchFaq(product.Description, change.after);
  assert.equal(result.replacements.length, 1, `Expected one legacy FAQ: ${slug}`);
  const next = { ...product, Description: result.updated };
  for (const key of Object.keys(product)) if (key !== 'Description') assert.equal(next[key], product[key], `${slug}: ${key}`);
  updated.push(next);
  review.push({ ...change, rawBefore: result.replacements[0].before });
}
assert.equal(updated.length, report.changes.length);
assert.equal(unchanged.length, report.retained.length);
assert.equal(new Set(updated.map(row => row['Product ID [Non Editable]'])).size, updated.length);
fs.writeFileSync(path.join(out, 'squarespace-updated-products.json'), JSON.stringify(updated, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'squarespace-verification.json'), JSON.stringify({ originalProducts: products.length, reelPages: updated.length + unchanged.length, changed: updated.length, unchanged, onlyChangedField: 'Description', onlyChangedContent: 'Braid FAQ answer', preservedExistingProductIds: true, preservedExistingVariantIds: true }, null, 2) + '\n');
const examples = ['penn-battle-iv-5000', 'penn-fierce-iv-5000', 'daiwa-bg-5000', 'shimano-sedona-fj-1000', 'daiwa-bg-2500', ...review.filter(row => row.profile === 'bait-finesse').slice(0, 1).map(row => row.slug)];
const exampleSet = new Set(examples);
const rows = [...examples.map(slug => review.find(row => row.slug === slug)).filter(Boolean), ...review.filter(row => !exampleSet.has(row.slug))];
const content = rows.map(row => `<section><h2>${escape(products.find(product => product['Product URL'] === row.slug).Title)}</h2><p><a href="/before/${row.slug}#faqs">Original page</a> | <a href="/after/${row.slug}#faqs">Proposed page</a></p><p class="context">Stored uses: ${escape(row.useCase)}. Existing range: ${escape(row.braidRange)}.</p><div class="comparison"><div><h3>Before</h3><p>${row.rawBefore}</p></div><div><h3>Proposed</h3><p>${escape(row.after)}</p></div></div></section>`).join('\n');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Reel FAQ wording review</title><style>body{margin:0;background:#f6f8f7;color:#18221d;font:16px/1.6 system-ui}main{max-width:1150px;margin:auto;padding:28px}h1{font-size:28px}h2{font-size:22px}h3{font-size:18px}.context{color:#48594e}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:24px}.comparison>div{border-left:3px solid #a4bbaa;padding-left:18px}section{padding:24px 0;border-top:1px solid #becbc2}a{color:#11603f}@media(max-width:650px){main{padding:18px}.comparison{grid-template-columns:1fr;gap:8px}h1{font-size:24px}}</style></head><body><main><h1>Reel-page braid FAQ review</h1><p>${report.reviewed.toLocaleString()} pages reviewed. ${updated.length.toLocaleString()} generic answers revised; ${unchanged.length} customized answers retained. Nothing in the calculator or reel specifications is changed.</p>${content}</main></body></html>`;
fs.writeFileSync(path.join(out, 'review.html'), html);
console.log(JSON.stringify({ updated: updated.length, retained: unchanged.length, out }, null, 2));
