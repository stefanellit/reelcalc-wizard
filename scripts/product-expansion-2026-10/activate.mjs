import assert from 'node:assert/strict';
import { parse } from '../line-page-publishing/node_modules/parse5/dist/index.js';
import { read, write } from './research.mjs';
import { buildLineGuideLinks } from '../build-line-guide-links.mjs';

const output = 'outputs/product-expansion-2026-10-12';
const build = read(`${output}/build-pages.json`);
const staged = read(`${output}/ACTIVATE-AFTER-IMPORT-reel-pages.json`);
const current = read('data/reel-pages.json');
const release = read('data/line-page-release.json');
const line = Object.values(read('data/line-page-imports.json').pages).find(page => page.id === 'fins-bfs-ultralight');
assert.equal(build.files.length, 18);
assert.ok(line);
const pages = build.files.map(page => ({ id: page.id, name: page.name, url: `https://www.reelcalc.com/reel-pages/p/${page.slug}`, reel: true }));
pages.push({ id: line.id, name: 'FINS BFS Ultralight', url: line.url, reel: false });
function flatten(node, nodes = []) {
  nodes.push(node);
  for (const child of node.childNodes || []) flatten(child, nodes);
  return nodes;
}
function text(node) {
  return node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join(' ');
}
const results = [];
for (const page of pages) {
  const response = await fetch(page.url, { signal: AbortSignal.timeout(45000) });
  const html = await response.text();
  const nodes = flatten(parse(html));
  const attrs = node => Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
  const canonical = nodes.find(node => node.tagName === 'link' && attrs(node).rel === 'canonical');
  const headings = nodes.filter(node => node.tagName === 'h1').map(text);
  const result = { ...page, status: response.status, finalUrl: response.url, canonical: canonical ? attrs(canonical).href : null,
    expectedTitle: headings.some(title => title.includes(page.name)), expectedReel: !page.reel || html.includes(`reel=${page.id}`) };
  results.push(result);
  console.log(JSON.stringify(result));
}
write(`${output}/live-import-check.json`, { checkedAt: new Date().toISOString(), results });
for (const result of results) {
  assert.equal(result.status, 200, result.url);
  assert.equal(result.finalUrl, result.url);
  assert.equal(result.canonical, result.url);
  assert.ok(result.expectedTitle && result.expectedReel, result.url);
}
if (process.argv.includes('--apply')) {
  const ids = new Set(build.files.map(page => page.id));
  const additions = staged.pages.filter(page => ids.has(page.reelId));
  assert.equal(additions.length, 18);
  const registry = { ...current, version: current.version + 1, pages: [...current.pages] };
  for (const page of additions) {
    const existing = registry.pages.find(entry => entry.reelId === page.reelId);
    if (existing) assert.deepEqual(existing, { ...page, verifiedLive: true });
    else registry.pages.push({ ...page, verifiedLive: true });
  }
  assert.equal(new Set(registry.pages.map(page => page.path)).size, registry.pages.length);
  assert.equal(new Set(registry.pages.map(page => page.reelId)).size, registry.pages.length);
  assert.deepEqual(registry.pages.filter(page => !ids.has(page.reelId)), current.pages.filter(page => !ids.has(page.reelId)));
  const updatedRelease = { ...release, version: release.version + 1, publishedProducts: [...new Set([...release.publishedProducts, line.id])] };
  assert.ok(updatedRelease.products.includes(line.id));
  write('data/reel-pages.json', registry);
  write('data/line-page-release.json', updatedRelease);
  const links = buildLineGuideLinks();
  assert.equal(links.guides[line.id].url, line.url);
  assert.equal(Object.values(links.lines).filter(item => item.guide === line.id).length, 6);
  write(`${output}/activation.json`, { activatedAt: new Date().toISOString(), reelGuides: 18, lineGuides: 1, totalReelGuides: registry.pages.length, totalLineGuides: updatedRelease.publishedProducts.length });
  console.log('Activated 18 verified reel guides and the FINS line guide.');
}
