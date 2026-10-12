import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from '../line-page-publishing/node_modules/parse5/dist/index.js';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const directory = 'research/product-expansion-2026-10-12';
export const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
export function write(file, value) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n');
}
export async function cache(url) {
  const manifestPath = `${directory}/sources.json`;
  const manifest = fs.existsSync(path.join(root, manifestPath)) ? read(manifestPath) : {};
  if (manifest[url]?.ok) return fs.readFileSync(path.join(root, manifest[url].file), 'utf8');
  const response = await fetch(url, { signal: AbortSignal.timeout(60000), headers: {
    'User-Agent': 'Mozilla/5.0 ReelCalc manufacturer specification verification',
    ...(url.includes('daiwa-us-sheets-proxy') ? { Origin: 'https://daiwa.us', Referer: 'https://daiwa.us/' } : {})
  } });
  const buffer = Buffer.from(await response.arrayBuffer());
  const stem = crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
  const file = `${directory}/sources/${stem}.txt`;
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), buffer);
  manifest[url] = { ok: response.ok, status: response.status, finalUrl: response.url, file,
    checkedAt: new Date().toISOString(), sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
  write(manifestPath, manifest);
  console.log(`${response.status} ${buffer.length} ${url}`);
  if (!response.ok) throw new Error(`Source returned ${response.status}: ${url}`);
  return buffer.toString('utf8');
}

const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join(' ');
const clean = node => text(node).replace(/\s+/g, ' ').trim();
function walk(node, predicate, results = []) {
  if (predicate(node)) results.push(node);
  for (const child of node.childNodes || []) walk(child, predicate, results);
  return results;
}
export function extract(html, url) {
  const document = parse(html);
  const scripts = walk(document, n => n.tagName === 'script');
  const result = {
    url,
    tables: walk(document, n => n.tagName === 'table').map(table =>
      walk(table, n => n.tagName === 'tr').map(row =>
        (row.childNodes || []).filter(n => ['td', 'th'].includes(n.tagName)).map(clean))),
    images: walk(document, n => n.tagName === 'meta' && attr(n, 'property') === 'og:image').map(n => attr(n, 'content')),
    imageCandidates: walk(document, n => n.tagName === 'img').map(n => ({src:attr(n,'src'),alt:attr(n,'alt'),srcset:attr(n,'srcset')})),
  };
  for (const [id, key] of [['ProductVariantsMetafields', 'variants'], ['ProductJSON', 'product']]) {
    const node = scripts.find(n => attr(n, 'id') === id);
    if (node) result[key] = JSON.parse(text(node));
  }
  const lews = walk(document, n => attr(n,'data-component') === 'FilteredItemsLoader')[0];
  if (lews) result.catalog = JSON.parse(attr(lews, 'data-initial-state'));
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const url of process.argv.slice(2)) {
    try {
      const html = await cache(url);
      const key = crypto.createHash('sha256').update(url).digest('hex').slice(0,16);
      const data = html.trim().startsWith('{') || html.trim().startsWith('[') ? JSON.parse(html) : extract(html,url);
      write(`${directory}/extracted/${key}.json`, data);
      console.log(`Extracted ${key}: ${Object.keys(data).join(', ')}`);
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
