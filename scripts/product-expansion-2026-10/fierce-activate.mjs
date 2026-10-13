import assert from 'node:assert/strict';
import { parse } from '../line-page-publishing/node_modules/parse5/dist/index.js';
import { read, write } from './research.mjs';

const output = 'outputs/fierce-tiger-followup-2026-10-12';
const build = read(`${output}/build-pages.json`);
const staged = read(`${output}/ACTIVATE-AFTER-IMPORT-reel-pages.json`);
const current = read('data/reel-pages.json');
assert.equal(build.files.length, 8);
assert.equal(build.held.length, 0);

function flatten(node, nodes = []) {
  nodes.push(node);
  for (const child of node.childNodes || []) flatten(child, nodes);
  return nodes;
}
function text(node) {
  return node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join(' ');
}
const attrs = node => Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
const results = [];
for (const page of build.files) {
  const url = `https://www.reelcalc.com/reel-pages/p/${page.slug}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  const html = await response.text();
  const nodes = flatten(parse(html));
  const canonical = nodes.find(node => node.tagName === 'link' && attrs(node).rel === 'canonical');
  const headings = nodes.filter(node => node.tagName === 'h1').map(text);
  const result = { id: page.id, name: page.name, url, status: response.status,
    finalUrl: response.url, canonical: canonical ? attrs(canonical).href : null,
    expectedTitle: headings.some(title => title.includes(page.name)),
    expectedReel: html.includes(`reel=${page.id}`) };
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
  assert.equal(additions.length, 8);
  const pages = [...current.pages];
  let added = 0;
  for (const page of additions) {
    const existing = pages.find(entry => entry.reelId === page.reelId);
    if (existing) assert.deepEqual(existing, { ...page, verifiedLive: true });
    else {
      pages.push({ ...page, verifiedLive: true });
      added += 1;
    }
  }
  assert.equal(new Set(pages.map(page => page.path)).size, pages.length);
  assert.equal(new Set(pages.map(page => page.reelId)).size, pages.length);
  assert.deepEqual(pages.filter(page => !ids.has(page.reelId)), current.pages.filter(page => !ids.has(page.reelId)));
  const registry = { ...current, version: current.version + (added ? 1 : 0), pages };
  if (added) write('data/reel-pages.json', registry);
  write(`${output}/activation.json`, { activatedAt: new Date().toISOString(),
    verifiedReelGuides: 8, added, totalReelGuides: pages.length, version: registry.version });
  console.log(`Activated ${added} guides; ${pages.length} total. Existing entries preserved.`);
}
