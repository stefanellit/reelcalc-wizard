import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const output = path.join(root, 'outputs/setup-guides-hub-2026-10-24');
const require = createRequire(path.join(output, 'test-deps/package.json'));
const { JSDOM } = require('jsdom');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const context = vm.createContext({ window: {}, URL, console });
vm.runInContext(read('js/reel-guide-list.js'), context);
const directory = context.window.ReelCalcGuideList;
const data = json('data/reels.json');
const entries = directory.mergeEntries(json('data/reel-guide-legacy.json'), json('data/reel-pages.json'), data, new Set(), false);
const before = json('scripts/fixtures/setup-guide-links-2026-10-24.json');
const normalizePath = value => new URL(value, 'https://www.reelcalc.com').pathname;
const oldReels = before.filter(l => /\/reel-pages\/p\//.test(l.href)).map(l => normalizePath(l.href)).sort();
assert.deepEqual(Array.from(entries, e => e.path).sort(), oldReels, 'Published reel links must be preserved');
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://www.reelcalc.com/fishing-line-setup-guides', runScripts: 'outside-only' });
dom.window.eval(read('js/setup-guide-hub.js'));
const hub = dom.window.ReelCalcSetupHub;
const lines = hub.buildLineEntries(json('data/line-page-imports.json'), json('data/line-page-release.json'), json('data/line-page-products.json'));
const page = hub.buildHub(entries, lines, 'https://stefanellit.github.io/reelcalc-wizard');
dom.window.document.body.appendChild(page);
const $ = selector => page.querySelector(selector);
const $$ = selector => Array.from(page.querySelectorAll(selector));
const event = type => new dom.window.Event(type, { bubbles: true });
const input = (selector, value) => { $(selector).value = value; $(selector).dispatchEvent(event('input')); };
const visibleLinks = section => $$(section + ' .rc-hub-family:not([hidden]) li:not([hidden]) a');
assert.equal($$('h1').length, 1);
assert.equal($$('nav a').length, 4);
assert.equal(entries.length, 1257);
assert.equal(lines.length, 121);
assert.equal(new Set($$('a[href*="/reel-pages/p/"]').map(a => a.href)).size, entries.length);
assert.equal(new Set($$('a[href*="/lines/p/"]').map(a => a.href)).size, lines.length);
const allPaths = new Set($$('a[href]').map(a => normalizePath(a.href)));
for (const old of before) assert(allPaths.has(normalizePath(old.href)), 'Lost original destination: ' + old.href);
assert.equal($$('details[open]').length, 0);
for (const id of ['reelcalc-reel-guide-directory', 'reelcalc-line-guide-directory']) {
  const brands = $$('#' + id + ' .rc-hub-brand-name').map(e => e.textContent);
  assert.deepEqual(brands, [...brands].sort(new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare));
}
input('#rc-hub-reels-search', 'penn battle iv 5000');
assert.equal(visibleLinks('#reelcalc-reel-guide-directory').length, 1);
assert.equal(visibleLinks('#reelcalc-reel-guide-directory')[0].getAttribute('aria-label'), 'PENN Battle IV 5000');
assert.equal($$('#reelcalc-reel-guide-directory details:not([hidden])[open]').length, 1);
input('#rc-hub-reels-search', 'btliv5000');
assert.equal(visibleLinks('#reelcalc-reel-guide-directory').length, 1, 'SKU search');
input('#rc-hub-reels-search', 'BattleIV5000');
assert.equal(visibleLinks('#reelcalc-reel-guide-directory').length, 1, 'Whitespace-tolerant search');
input('#rc-hub-reels-type', 'baitcasting');
assert.equal(visibleLinks('#reelcalc-reel-guide-directory').length, 0, 'Combined filters must apply');
assert.equal($('#reelcalc-reel-guide-directory .rc-hub-empty').hidden, false);
$('#reelcalc-reel-guide-directory .rc-hub-actions button').click();
assert.equal($('#rc-hub-reels-search').value, '');
assert.equal($('#rc-hub-reels-type').value, '');
assert.equal($$('#reelcalc-reel-guide-directory details[open]').length, 0);
assert.equal(dom.window.document.activeElement.id, 'rc-hub-reels-search');
input('#rc-hub-reels-search', 'battle iv');
const sizes = visibleLinks('#reelcalc-reel-guide-directory').map(a => a.textContent);
assert.deepEqual(sizes, ['1000', '2000', '2500', '3000', '4000', '4000HS', '5000', '6000', '6000HS', '8000', '8000HS', '10000']);
input('#rc-hub-lines-search', 'jbraid x4');
assert.equal(visibleLinks('#reelcalc-line-guide-directory').length, 1);
input('#rc-hub-lines-search', '');
input('#rc-hub-lines-type', 'fluoro');
input('#rc-hub-lines-role', 'leader');
assert(visibleLinks('#reelcalc-line-guide-directory').length > 0);
assert(visibleLinks('#reelcalc-line-guide-directory').every(a => lines.some(l => l.path === a.href && l.material === 'fluoro' && l.role === 'leader')));
input('#rc-hub-lines-brand', 'Shimano');
assert.equal(visibleLinks('#reelcalc-line-guide-directory').length, 1);
assert.match(visibleLinks('#reelcalc-line-guide-directory')[0].textContent, /Ocea/);
assert.equal($('#rc-hub-reels-search').value, 'battle iv', 'Line filtering must not change reel filters');
assert.equal(hub.buildLineEntries({pages:{draft:{id:'unpublished',title:'Unpublished'}}}, {publishedProducts:[]}, {products:{}}).length, 0);
const families = hub.groupFamilies([
  {model:'Vanford',category:'spinning',label:'Old',size:'3000'},
  {model:'Vanford A',category:'spinning',label:'New',size:'3000'}
]);
assert.equal(families.length, 2, 'Different generations stay distinct');
assert.equal($$('a[data-reel-id]').length, entries.length, 'Reel tracking IDs retained');
for (const file of ['js/calculator-core.js','js/recommendation-engine.js','js/wizard.js','js/analytics.js','js/affiliate-links.js','js/reel-page-calculator.js','data/reels.json','data/lines.json','data/reel-affiliates.json','index.html']) {
  assert.equal(read(file).replace(/\r\n/g, '\n'), execFileSync('git', ['show', 'f6e2d60:' + file], { encoding: 'utf8', maxBuffer: 50e6 }).replace(/\r\n/g, '\n'), 'Protected file changed: ' + file);
}
assert.doesNotMatch(read('js/setup-guide-hub.js'), /localStorage|sessionStorage|gtag\(|\.track\(/);
async function checkMount(mode) {
  const fixture = new JSDOM('<!doctype html><main><section id="reelcalc-line-guide-directory">Original lines</section><div id="mount" aria-live="polite"><a href="/reel-pages/p/penn-battle-iv-5000">Original reel</a></div></main>', {
    url: 'https://www.reelcalc.com/fishing-line-setup-guides#%invalid', runScripts: 'outside-only'
  });
  fixture.window.eval(read('js/setup-guide-hub.js'));
  fixture.window.fetch = async url => {
    if (mode === 'data-failure') throw new Error('Unavailable');
    return { ok: true, json: async () => json('data/' + url.split('/').pop()) };
  };
  const append = fixture.window.document.head.appendChild.bind(fixture.window.document.head);
  fixture.window.document.head.appendChild = node => {
    append(node);
    queueMicrotask(() => node.dispatchEvent(new fixture.window.Event(mode === 'style-failure' ? 'error' : 'load')));
    return node;
  };
  const mount = fixture.window.document.getElementById('mount');
  const original = mount.innerHTML;
  const api = fixture.window.ReelCalcSetupHub;
  if (mode !== 'success') {
    await assert.rejects(api.mount(mount, entries, 'https://example.test'));
    assert.equal(mount.innerHTML, original, mode + ': original directory retained');
    assert.equal(fixture.window.document.getElementById('reelcalc-line-guide-directory').textContent, 'Original lines');
  } else {
    await Promise.all([api.mount(mount, entries, 'https://example.test'), api.mount(mount, entries, 'https://example.test')]);
    assert.equal(mount.querySelectorAll('#reelcalc-setup-hub').length, 1, 'Concurrent mount is idempotent');
    assert.equal(mount.getAttribute('aria-live'), null);
    const legacy = fixture.window.document.createElement('section');
    legacy.id = 'reelcalc-line-guide-directory';
    mount.before(legacy);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(fixture.window.document.querySelectorAll('#reelcalc-line-guide-directory').length, 1, 'Cached old loader cannot duplicate the line directory');
    await api.mount(mount, entries, 'https://example.test');
    assert.equal(fixture.window.document.querySelectorAll('link[rel="stylesheet"]').length, 1);
  }
  fixture.window.close();
}
await checkMount('success');
await checkMount('data-failure');
await checkMount('style-failure');
console.log(`PASS: ${entries.length} reels, ${lines.length} lines, all original destinations, A-Z grouping, numeric sizes, combined filters, SKU search, material/leader roles, reset/focus, independent forms, and protected-file parity.`);
console.log('PASS: Concurrent/repeated mount, malformed hash, delayed legacy loader, and original-directory fallback on data/style failure.');
dom.window.close();
