import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { parse } from '../line-page-publishing/node_modules/parse5/dist/index.js';

const out = 'outputs/reel-page-completion-2026-10-18/post-import-2026-10-19';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};
const batch = read('research/reel-page-completion-2026-10-18/new-page-records.json');
const build = read('outputs/reel-page-completion-2026-10-18/build-pages.json');
const current = read('data/reel-pages.json');
assert.equal(batch.pages.length, 22);
const ids = new Set(batch.pages.map(page => page.reelId));
const results = [];
const flatten = node => [node, ...(node.childNodes || []).flatMap(flatten)];
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join(' ');
const attrs = node => Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));

for (const page of batch.pages) {
  const item = build.files.find(file => file.id === page.reelId);
  assert(item);
  const url = 'https://www.reelcalc.com' + page.path;
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  const html = await response.text();
  const nodes = flatten(parse(html));
  const canonical = nodes.find(node => node.tagName === 'link' && attrs(node).rel === 'canonical');
  const robots = nodes.filter(node => node.tagName === 'meta' && attrs(node).name === 'robots').map(node => attrs(node).content);
  const result = { reelId: page.reelId, url, status: response.status, finalUrl: response.url,
    canonical: canonical ? attrs(canonical).href : null,
    correctHeading: nodes.some(node => node.tagName === 'h1' && text(node).includes(item.name)),
    correctCalculator: html.includes(`reel=${page.reelId}`), robots };
  results.push(result);
  console.log(JSON.stringify(result));
}
write(`${out}/live-import-check.json`, { checkedAt: new Date().toISOString(), results });
for (const result of results) {
  assert.equal(result.status, 200, result.url);
  assert.equal(result.finalUrl, result.url);
  assert.equal(result.canonical, result.url);
  assert(result.correctHeading && result.correctCalculator, result.url);
  assert(!result.robots.some(value => /noindex/i.test(value)), result.url);
}

if (process.argv.includes('--apply')) {
  fs.mkdirSync(`${out}/originals`, { recursive: true });
  const backup = `${out}/originals/reel-pages.json`;
  if (!fs.existsSync(backup)) fs.copyFileSync('data/reel-pages.json', backup);
  const pages = [...current.pages];
  let added = 0;
  for (const entry of batch.pages) {
    const existing = pages.find(page => page.reelId === entry.reelId);
    if (existing) assert.deepEqual(existing, { ...entry, verifiedLive: true });
    else { pages.push({ ...entry, verifiedLive: true }); added++; }
  }
  assert.equal(new Set(pages.map(page => page.path)).size, pages.length);
  assert.equal(new Set(pages.map(page => page.reelId)).size, pages.length);
  assert.deepEqual(pages.filter(page => !ids.has(page.reelId)), current.pages.filter(page => !ids.has(page.reelId)));
  const registry = { ...current, version: current.version + (added ? 1 : 0), pages };
  if (added) write('data/reel-pages.json', registry);
  write(`${out}/activation.json`, { activatedAt: new Date().toISOString(), added, total: pages.length,
    version: registry.version, liveChecked: results.length, preservedExistingEntries: true });
  console.log(`Activated ${added} pages; registry total ${pages.length}.`);
}
