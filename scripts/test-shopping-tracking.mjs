import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from './line-page-publishing/node_modules/parse5/dist/index.js';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const original = file => execFileSync('git', ['show', 'bd0de9f:' + file], { encoding: 'utf8', maxBuffer: 20e6 });
const baseline = process.argv.includes('--baseline');
const source = file => baseline ? original(file) : read(file);
const data = JSON.parse(read('data/reel-affiliates.json'));
const affiliateContext = vm.createContext({ window: {}, URL, console });
vm.runInContext(source('js/affiliate-links.js'), affiliateContext);
const affiliates = affiliateContext.window.ReelCalcAffiliateLinks;
const named = { id: 'test-line', brand: 'Daiwa', model: 'J-Braid X4', type: 'Braid', lb: 20 };
const offer = affiliates.buildRecommendedLineOffer({ affiliateData: data, line: named, requiredYards: 185 });
assert.equal(new URL(offer.url).searchParams.get('tag'), 'reelcalc-20');
assert.equal(new URL(offer.url).searchParams.get('k'), 'Daiwa J-Braid X4 20 lb braided fishing line 200 yard spool');
if (!baseline) {
  // A delayed GA loader must deliver each queued event once, even after repeated flushes.
  const delivered = [];
  const queuedWindow = { setTimeout: () => 1, ReelCalcAnalyticsQueue: [{ name: 'homepage_calculator_view', parameters: { page_type: 'homepage_calculator' } }] };
  const analytics = vm.createContext({ URL, console, location: { href: 'https://www.reelcalc.com/', pathname: '/' }, window: queuedWindow,
    CustomEvent: function(name, init) { this.type = name; this.detail = init.detail; },
    document: { baseURI: 'https://www.reelcalc.com/', currentScript: null, readyState: 'loading', addEventListener() {}, dispatchEvent() {}, getElementById: id => id === 'reelcalc-homepage-calculator' ? {} : null }
  });
  vm.runInContext(read('js/analytics.js'), analytics);
  queuedWindow.ReelCalcAnalytics.instrumentHomepageCalculator();
  queuedWindow.gtag = (kind, name, parameters) => delivered.push({ name, parameters });
  queuedWindow.ReelCalcAnalytics.flush();
  queuedWindow.ReelCalcAnalytics.flush();
  vm.runInContext(read('js/analytics.js'), analytics);
  assert.deepEqual(delivered.map(e => e.name), ['homepage_calculator_view']);

  assert.equal(offer.label, 'Search Amazon for Daiwa J-Braid X4 20 lb - 200 yd');
  assert.match(offer.reminder, /Confirm the model, strength, and spool size/);
  for (const flag of ['custom_line', 'generic_recommendation']) {
    const generic = affiliates.buildRecommendedLineOffer({ affiliateData: data, line: { ...named, [flag]: true }, requiredYards: 142 });
    assert.equal(generic.label, 'Search Amazon for braid 20 lb - 150 yd');
    assert(!generic.url.includes('Daiwa'));
  }
  assert.equal(affiliates.shoppingLabel(offer, named, null), 'Search Amazon for Daiwa J-Braid X4 20 lb');
  const metric = { ...named, retail_packages: [{ meters: 300, yards: 300 / 0.9144 }] };
  const metricOffer = affiliates.buildRecommendedLineOffer({ affiliateData: data, line: metric, spoolYards: 300 / 0.9144 });
  assert.match(metricOffer.label, /300 m$/);
  assert.match(new URL(metricOffer.url).searchParams.get('k'), /300 meter spool$/);
  const mappedData = structuredClone(data);
  mappedData.lines = { [named.id]: { offers: { amazon: { url: 'https://www.amazon.com/dp/FIXTURE?tag=reelcalc-20' } } } };
  const mapped = affiliates.buildRecommendedLineOffer({ affiliateData: mappedData, line: named, requiredYards: 185 });
  assert.equal(mapped.matchType, 'product_family', 'A mapping without evidence is not an exact match');
  assert.match(mapped.label, /^View .* options on Amazon$/);
  assert.equal(mapped.url, mappedData.lines[named.id].offers.amazon.url);
}

// Use the existing lightweight DOM fixture, but run the full production init and UI listeners.
const fixture = read('scripts/test-homepage-rating-switch.mjs').replace(/\r\n/g, '\n');
let helper = fixture.slice(fixture.indexOf('function calculator()'), fixture.indexOf('\nfunction fill('));
helper = helper.replace('console, window: {},', 'console, window: { ReelCalcAnalytics: { track: (name, parameters) => events.push({name, parameters}) } },');
helper = helper.replace('    element,\n', '    element,\n    initialize: () => context.window.ReelCalcHomepageCalculator.initialize(),\n');
const events = [];
const host = vm.createContext({ vm, console, events, read: source });
vm.runInContext(helper + '\nthis.makeCalculator = calculator;', host);
const calc = host.makeCalculator();
calc.initialize();
calc.initialize();
if (!baseline) assert.equal(events.filter(e => e.name === 'homepage_calculator_view').length, 1);
assert.equal(calc.calculate(), null, 'Invalid/empty form must not complete');
const fill = values => Object.entries(values).forEach(([key, value]) => { calc.element(key).value = String(value); });
calc.click('modeSegment', 'capacity');
fill({ monoStrength: 10, monoCapacity: 200, mainDiameter: 0.009 });
const capacity = JSON.parse(JSON.stringify(calc.calculate()));
const capacityHtml = calc.element('output').innerHTML;
calc.click('modeSegment', 'backing');
fill({ mainAmount: 100, backingDiameter: 0.012 });
const backing = JSON.parse(JSON.stringify(calc.calculate()));
const backingHtml = calc.element('output').innerHTML;
calc.click('unitSegment', 'metric');
calc.click('unitSegment', 'standard');
calc.initialize();
if (!baseline) {
  assert.equal(events.filter(e => e.name === 'homepage_calculator_view').length, 1, 'Updates must not produce views');
  const completions = events.filter(e => e.name === 'homepage_calculator_calculation_complete');
  assert.equal(completions.length, 2, 'Exactly one completion per successful calculation');
  assert.deepEqual(completions.map(e => e.parameters.calculator_mode), ['capacity', 'backing']);
  assert(!events.some(e => /calculation_completed/.test(e.name)));
}

// Exercise the actual runtime registration twice, including incomplete product selections.
const handlers = new Map();
const tracked = [];
const doc = {
  currentScript: { src: 'https://stefanellit.github.io/reelcalc-wizard/js/reel-page-runtime.js', dataset: {} },
  baseURI: 'https://www.reelcalc.com/', readyState: 'loading', documentElement: { dataset: {} },
  querySelectorAll: () => [],
  addEventListener(name, fn) { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(fn); }
};
const runtime = vm.createContext({ document: doc, URL, location: { pathname: '/reel-pages/p/test' }, window: {
  ReelCalcAnalytics: { track: (name, parameters) => tracked.push({ name, parameters }) }
} });
vm.runInContext(source('js/reel-page-runtime.js'), runtime);
runtime.window.ReelCalcReelPageRuntime.initialize();
runtime.window.ReelCalcReelPageRuntime.initialize();
const dispatch = detail => handlers.get('reelcalc:line-selection-changed').forEach(fn => fn({ detail }));
dispatch({ reelId: 'test-reel', lineRole: 'main', selectionStage: 'type', lineType: 'braid' });
dispatch({ reelId: 'test-reel', lineRole: 'main', selectionStage: 'product', lineId: '', lineType: 'braid' });
dispatch({ reelId: 'test-reel', lineRole: 'main', selectionStage: 'product', lineId: named.id, lineBrand: named.brand, lineModel: named.model, lineLb: 20, lineType: 'braid' });
dispatch({ reelId: 'test-reel', lineRole: 'main', selectionStage: 'strength', lineId: 'test-30', lineBrand: named.brand, lineModel: named.model, lineLb: 30, lineType: 'braid' });
if (!baseline) {
  assert.deepEqual(tracked.map(e => e.name), ['reel_line_type_selected', 'reel_line_selected', 'reel_line_selected']);
  assert.deepEqual(tracked.slice(1).map(e => [e.parameters.line_model, e.parameters.line_lb]), [['J-Braid X4',20],['J-Braid X4',30]]);
  assert.match(source('js/reel-page-calculator.js'), /lineLb: nextLine \? nextLine\.lb : 0/);
}

// Execute the production iframe bridge independently of Squarespace page decoration.
const loader = source('js/squarespace-reel-page-loader.js');
const bridgeSource = loader.slice(loader.indexOf('  function initializeAnalyticsBridge()'), loader.indexOf('  function sectionKey('));
const messages = [];
const forwarded = [];
const bridgeWindow = { addEventListener: (name, fn) => messages.push(fn), ReelCalcAnalytics: { track: (name, parameters) => forwarded.push({name, parameters}) } };
const bridge = vm.createContext({ document: { documentElement: { dataset: {} } }, window: bridgeWindow, Set });
vm.runInContext(bridgeSource + '\ninitializeAnalyticsBridge(); initializeAnalyticsBridge();', bridge);
assert.equal(messages.length, 1, 'Only one iframe message handler');
for (const name of ['reel_line_type_selected','reel_line_selected','homepage_calculator_view','homepage_calculator_calculation_complete']) {
  messages[0]({ origin: 'https://stefanellit.github.io', data: { source: 'reelcalc-analytics', name, parameters: { line_model: 'J-Braid X4', line_lb: 20, calculator_version: 'v2', setup_mode: 'simple', not_allowed: 'drop' } } });
}
messages[0]({ origin: 'https://untrusted.example', data: { source: 'reelcalc-analytics', name: 'reel_line_selected' } });
messages[0]({ origin: 'https://stefanellit.github.io', data: { source: 'reelcalc-analytics', name: 'not_allowed' } });
if (!baseline) {
  assert.equal(forwarded.length, 4);
  assert(forwarded.every(e => !('not_allowed' in e.parameters)));
  assert.equal(forwarded[3].parameters.calculator_version, 'v2');
}

if (!baseline) {
  for (const file of ['js/calculator-core.js','js/recommendation-engine.js','data/reels.json','data/lines.json','data/reel-affiliates.json']) {
    assert.equal(read(file).replace(/\r\n/g,'\n'), original(file).replace(/\r\n/g,'\n'), file + ' must be unchanged');
  }
  const nodes = node => [node, ...(node.childNodes || []).flatMap(nodes)];
  const current = nodes(parse(read('index.html'))).filter(n => n.tagName === 'a');
  const before = nodes(parse(original('index.html'))).filter(n => n.tagName === 'a');
  assert.deepEqual(current.map(n=>n.attrs), before.map(n=>n.attrs), 'Navigation targets and URLs unchanged');
  const baselineResults = JSON.parse(execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--baseline'], { encoding:'utf8', maxBuffer:10e6 }));
  assert.deepEqual({capacity,backing,capacityHtml,backingHtml}, baselineResults, 'Calculator outputs must be identical to published main');
  console.log('PASS: named/generic/metric/mapped shopping, preserved affiliate URL/tag, homepage initialization and completion counts, material/product events, duplicate-handler protection, iframe allowlist, calculator output parity, protected data and footer navigation.');
} else {
  console.log(JSON.stringify({capacity,backing,capacityHtml,backingHtml}));
}
