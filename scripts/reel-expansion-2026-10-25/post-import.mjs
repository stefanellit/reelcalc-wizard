import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { root, output, directory, read, write, save, hash } from './common.mjs';

const out = `${output}/post-import`;
const mode = process.argv[2] || 'check';
const pending = read(`${directory}/new-page-records.json`).pages;
const built = read(`${output}/build-pages.json`).files;
const baselineFile = `${out}/originals/manifest.json`;
const require = createRequire(path.join(root, 'outputs/setup-guides-hub-2026-10-24/test-deps/package.json'));
const { JSDOM } = require('jsdom');

if (!fs.existsSync(path.join(root, baselineFile))) {
  const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
  const hashes = Object.fromEntries(files.filter(file => fs.existsSync(path.join(root, file))).map(file => [file, hash(fs.readFileSync(path.join(root, file)))]));
  save(`${out}/originals/reel-pages.json`, fs.readFileSync(path.join(root, 'data/reel-pages.json')));
  save(`${out}/originals/uncommitted-before.patch`, execFileSync('git', ['diff', '--binary'], { cwd: root, maxBuffer: 64e6 }));
  write(baselineFile, { capturedAt: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), hashes });
}

if (mode === 'snapshot') {
  console.log('Original directory and all tracked-file hashes backed up.');
} else if (mode === 'check') {
  const results = [];
  for (const page of built) {
    const url = `https://www.reelcalc.com/reel-pages/p/${page.slug}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      const html = await response.text();
      const dom = new JSDOM(html, { url: response.url });
      const canonical = dom.window.document.querySelector('link[rel="canonical"]')?.href;
      results.push({ id: page.id, slug: page.slug, url, status: response.status,
        finalUrl: response.url, canonical, expectedReel: html.includes(page.id),
        expectedModel: html.includes(page.row.MPN), title: dom.window.document.title,
        noindex: /noindex/i.test(dom.window.document.querySelector('meta[name="robots"]')?.content || '') });
      dom.window.close();
    } catch (error) { results.push({ id: page.id, url, error: error.message }); }
    if (results.length % 25 === 0) console.log(`Checked ${results.length}/${built.length} public URLs`);
  }
  const passed = result => result.status === 200 && result.expectedReel && result.expectedModel && result.canonical === result.url && !result.noindex;
  const summary = { checkedAt: new Date().toISOString(), expected: built.length, passed: results.filter(passed).length, failures: results.filter(result => !passed(result)) };
  write(`${out}/live-url-check.json`, { summary, results });
  console.log(JSON.stringify(summary, null, 2));
  if (summary.passed !== built.length) process.exitCode = 1;
} else if (mode === 'activate') {
  const check = read(`${out}/live-url-check.json`);
  assert.equal(check.summary.passed, 164, 'Every page must pass its live check before directory inclusion');
  assert(Date.now() - Date.parse(check.summary.checkedAt) < 24 * 3600e3, 'Live checks are stale');
  const registry = read('data/reel-pages.json');
  const original = read(`${out}/originals/reel-pages.json`);
  assert.deepEqual(registry, original, 'Directory changed since backup; inspect before merging');
  const oldIds = new Set(registry.pages.map(page => page.reelId));
  const oldPaths = new Set(registry.pages.map(page => page.path));
  for (const page of pending) {
    assert(!oldIds.has(page.reelId) && !oldPaths.has(page.path), `Duplicate registry entry: ${page.reelId}`);
    assert(check.results.some(result => result.id === page.reelId && result.status === 200 && result.expectedReel));
  }
  registry.pages.push(...pending.map(page => ({ ...page, verifiedLive: true })));
  registry.version = original.version + 1;
  registry.generatedAt = new Date().toISOString();
  write('data/reel-pages.json', registry);
  write(`${out}/activation.json`, { activatedAt: new Date().toISOString(), added: pending.length, total: registry.pages.length, version: registry.version, preservedExistingEntries: true });
  console.log(`Registered ${pending.length} checked pages; ${registry.pages.length} total.`);
} else if (mode === 'test') {
  const baseline = read(baselineFile);
  for (const [file, sha] of Object.entries(baseline.hashes)) {
    if (file !== 'data/reel-pages.json') assert.equal(hash(fs.readFileSync(path.join(root, file))), sha, `Unrelated file changed: ${file}`);
  }
  const registry = read('data/reel-pages.json');
  const original = read(`${out}/originals/reel-pages.json`);
  assert.deepEqual(registry.pages.slice(0, original.pages.length), original.pages);
  assert.equal(registry.pages.length, original.pages.length + 164);
  assert.equal(new Set(registry.pages.map(page => page.reelId)).size, registry.pages.length);
  assert.equal(new Set(registry.pages.map(page => page.path)).size, registry.pages.length);
  const reels = read('data/reels.json');
  const context = vm.createContext({ window: {}, URL, console });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/reel-guide-list.js'), 'utf8'), context);
  const entries = context.window.ReelCalcGuideList.mergeEntries(read('data/reel-guide-legacy.json'), registry, reels, new Set(), false);
  assert.equal(entries.length, 1421);
  for (const page of pending) {
    assert.equal(entries.filter(entry => entry.reelId === page.reelId && entry.path === page.path).length, 1);
    assert(reels.some(reel => reel.id === page.reelId), 'Comparison entry must resolve to the exact reel');
  }
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://www.reelcalc.com/fishing-line-setup-guides', runScripts: 'outside-only' });
  dom.window.eval(fs.readFileSync(path.join(root, 'js/setup-guide-hub.js'), 'utf8'));
  const hub = dom.window.ReelCalcSetupHub;
  const lines = hub.buildLineEntries(read('data/line-page-imports.json'), read('data/line-page-release.json'), read('data/line-page-products.json'));
  const page = hub.buildHub(entries, lines, 'https://stefanellit.github.io/reelcalc-wizard');
  dom.window.document.body.appendChild(page);
  assert.equal(lines.length, 121);
  assert.equal(page.querySelectorAll('a[data-reel-id]').length, 1421);
  const ids = new Set(Array.from(page.querySelectorAll('a[data-reel-id]'), link => link.dataset.reelId));
  for (const entry of pending) assert(ids.has(entry.reelId));
  const input = page.querySelector('#rc-hub-reels-search');
  for (const [query, count] of [['CHD-3000A', 1], ['stella fj', 5], ['Caldia LT 2025', 15], ['Concept A2', 8]]) {
    input.value = query;
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.equal(page.querySelectorAll('#reelcalc-reel-guide-directory .rc-hub-family:not([hidden]) li:not([hidden]) a').length, count, query);
  }
  const brands = Array.from(page.querySelectorAll('#reelcalc-reel-guide-directory .rc-hub-brand-name'), element => element.textContent);
  assert.deepEqual(brands, [...brands].sort(new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare));
  dom.window.close();
  const result = { passed: true, totalReelPages: 1421, preservedReelPages: 1257, added: 164, unchangedLinePages: 121, protectedFiles: Object.keys(baseline.hashes).length - 1, uniqueIdsAndUrls: true, searchAndAlphabeticalGrouping: true };
  write(`${out}/test-results.json`, result);
  console.log(JSON.stringify(result, null, 2));
} else throw new Error(`Unknown mode: ${mode}`);
