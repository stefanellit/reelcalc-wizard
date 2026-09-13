import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFragment } from './line-page-publishing/node_modules/parse5/dist/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'research/line-pages/sources/sunline');
const products = [
  ['sunline-fc-sniper', 'super-fc-sniper-1'],
  ['sunline-shooter', 'shooter-flurocarbon-line'],
  ['sunline-assassin-fc', 'sunline-assassin-fc'],
  ['sunline-super-natural-330', 'copy-of-copy-of-super-natural-monofilament'],
  ['sunline-super-natural-660', 'copy-of-super-natural-monofilament'],
  ['sunline-super-natural-3300', 'super-natural-monofilament'],
  ['sunline-sx1', 'sx1-braided-line'],
  ['sunline-xplasma-asegai', 'xplasma-asegai-braided-line'],
  ['sunline-siglon-pe-x8', 'siglon-pex8-line'],
];
const walk = (node, action) => { action(node); for (const child of node.childNodes || []) walk(child, action); };
fs.mkdirSync(output, { recursive: true });
for (const [id, handle] of products) {
  const url = `https://sunlineamerica.com/products/${handle}`;
  const response = await fetch(url + '.js', { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
  const p = await response.json();
  if (!p.variants?.length) throw new Error(`${id}: no variants`);
  const images = []; const text = [];
  walk(parseFragment(p.description || ''), node => {
    if (node.nodeName === '#text') text.push(node.value);
    if (node.tagName === 'img') images.push(Object.fromEntries(node.attrs.map(a => [a.name, a.value])));
  });
  const record = { id, url, retrievedAt: new Date().toISOString(), title: p.title,
    description: p.description, descriptionText: text.join(' ').replace(/\s+/g, ' ').trim(),
    descriptionImages: images, images: p.images, options: p.options,
    variants: p.variants.map(v => ({ id: v.id, sku: v.sku, title: v.title, options: v.options, available: v.available })) };
  fs.writeFileSync(path.join(output, id + '.json'), JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify({ id, title: p.title, variants: record.variants.length, descriptionImages: images }));
}
