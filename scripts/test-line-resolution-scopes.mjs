import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { sha256 } from './line-pack-sources.mjs';
const read = file => fs.readFileSync(file, 'utf8');
const lines = JSON.parse(read('data/lines.json'));
const reels = JSON.parse(read('data/reels.json'));
const products = JSON.parse(read('data/line-page-products.json')).products;
const args = process.argv.slice(2);
assert(args.length <= 1 && args.every(arg => arg.startsWith('--baseline=') && arg.length > 11), 'Use optional --baseline=path-to-hash-baseline.json');
const baseline = JSON.parse(read(args[0]?.slice(11) || 'reports/resolution-integration/baseline.json'));
const scoped = lines.filter(line => line.source_scope_label);
assert.equal(scoped.length, 42);
class Element {
  constructor(tag = 'div') { this.tagName = tag; this.dataset = {}; this.children = []; this.value = ''; this.disabled = false;
    this.attributes = {}; this.classList = { toggle() {}, add() {}, remove() {} }; this.style = {}; this.nodes = new Map(); }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
  set innerHTML(value) { this.html = value; }
  get innerHTML() { return this.html || ''; }
  get cells() { return this.children; }
  get options() { return this.children; }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; this.text = ''; }
  querySelector(key) { if (!this.nodes.has(key)) this.nodes.set(key, new Element()); return this.nodes.get(key); }
  querySelectorAll() { return []; }
  addEventListener() {}
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  insertAdjacentHTML(position, value) { this.innerHTML += value; }
}
const document = new Element();
document.createElement = tag => new Element(tag);
document.getElementById = key => document.querySelector(key);
document.createTextNode = text => { const element = new Element(); element.textContent = text; return element; };
document.baseURI = 'https://www.reelcalc.com/';
document.currentScript = { src: 'https://stefanellit.github.io/reelcalc-wizard/js/reel-page-calculator.js', dataset: {} };
document.readyState = 'loading';
const context = vm.createContext({ window: { location: { search: '' } }, location: { search: '' }, document, URL, URLSearchParams, console,
  Map, Set, CustomEvent: class {} });
function replaceOnce(source, marker, replacement) {
  assert.equal(source.split(marker).length, 2, `Expected one test instrumentation point: ${marker}`);
  return source.replace(marker, replacement);
}
for (const file of ['js/calculator-core.js', 'js/line-selector.js', 'js/affiliate-links.js', 'js/line-database-tools.js', 'js/wizard.js']) vm.runInContext(read(file), context, {filename:file});
const selector = context.window.ReelCalcLineSelector;
const tools = context.window.ReelCalcLineTools;
let source = replaceOnce(read('js/line-database.js'), '    searchInput.addEventListener',
  '    global.scopeDatabase = { appendLineRow: appendLineRow, populateLineSelect: populateLineSelect, lineSelect: lineSelect }; return;\n    searchInput.addEventListener');
vm.runInContext(source, context);
context.window.ReelCalcLineDatabase.initialize(new Element(), lines);
const db = context.window.scopeDatabase;
db.populateLineSelect();
source = replaceOnce(read('examples/reel-comparison.js'), '  initialize();',
  '  window.scopeComparison = { state: state, elements: elements, lineLabel: lineLabel, refreshLineStrengths: refreshLineStrengths, renderLineMenu: renderLineMenu };');
vm.runInContext(source, context);
const comparison = context.window.scopeComparison;
comparison.state.lines = selector.prepareLines(lines);
source = replaceOnce(read('js/reel-page-calculator.js'), '  function initializeMount(mount) {',
  '  window.scopeMount = mountCalculator;\n  function initializeMount(mount) {');
source = replaceOnce(source, '    shadow.addEventListener("click", function(event) {',
  '    window.scopeReelPage = { state: state, lineLabel: lineLabel, refreshRole: refreshRole, shadow: shadow }; return;\n    shadow.addEventListener("click", function(event) {');
vm.runInContext(source, context);
const mount = new Element(); mount.shadowRoot = new Element();
context.window.scopeMount(mount, reels.find(reel => reel.id === 'shimano-slx-a-150-6-3-rh-slx150a'), lines, {},
  { core: context.window.ReelCalcCore, selector, affiliates: context.window.ReelCalcAffiliateLinks });
const reelPage = context.window.scopeReelPage;
source = replaceOnce(read('js/line-page-engine.js'), 'var ready = init();',
  'var ready; global.scopeLinePage = { state: state, el: el, lineLabel: lineLabel, renderExamples: renderExamples };');
vm.runInContext(source, context);
context.window.ReelCalcLinePages.mount(new Element());
const linePage = context.window.scopeLinePage;
context.catalogForTest = lines;
vm.runInContext('state.lines = catalogForTest; setActiveButtons = function() {}; selectLine = function(line) { state.selectedLine = line; }; resetDesiredMainLine = function() { state.desiredMainYards = 100; }; trackWizardEvent = function() {};', context);
const urls = { homepage: 'https://www.reelcalc.com/', wizard: 'https://www.reelcalc.com/reelcalc-wizard', pe: 'https://www.reelcalc.com/pe-line-capacity-calculator' };
const unscoped = lines.filter(line => !line.source_scope_label && line.role !== 'leader').slice(0, 20);
let handoffs = 0;
for (const line of [...scoped, ...unscoped]) {
  const label = line.source_scope_label;
  const body = new Element('tbody'); db.appendLineRow(line, body);
  const record = tools.recordForRow(body.children[0], false);
  assert.equal(record.model, line.model, 'Visible scope must not become part of identity');
  assert.equal(record.source_scope_label, label);
  const match = tools.matchCatalogLine(record, lines);
  assert.equal(match.id, line.id);
  const option = db.lineSelect.options.find(option => option.value === String(lines.indexOf(line)));
  assert.equal(option.textContent, tools.optionLabel(record, false));
  const wizardUrl = new URL(tools.buildDestination(record, false, 'wizard', match, urls));
  assert.equal(wizardUrl.searchParams.get('line'), line.id);
  context.window.location.search = wizardUrl.search;
  assert.equal(vm.runInContext('applyLinePreloadFromUrl().id', context), line.id);
  context.lineForTest = line;
  const wizardLabel = vm.runInContext('formatLineShort(lineForTest)', context);
  const manualUrl = new URL(tools.buildDestination(record, false, 'calculator', null, urls));
  const manual = tools.readSelectionParams(manualUrl.search);
  assert.equal(manual.diameterIn, Number(Number(line.dia_in).toFixed(4)));
  assert.equal(manual.lb, line.lb);
  const productKey = selector.productKey(selector.prepareLines([line])[0]);
  assert.equal(productKey, selector.productKey(selector.prepareLines([{...line, source_scope_label: undefined}])[0]));
  comparison.state.lineRoles.main.material = selector.normalizedMaterial(line.type);
  comparison.refreshLineStrengths('main', productKey, line.id);
  comparison.renderLineMenu('main', line.id);
  reelPage.state.main.material = selector.normalizedMaterial(line.type);
  reelPage.refreshRole('main', line.id);
  const labels = [selector.scopedProductLabel(line), comparison.lineLabel(line), comparison.elements.mainLineDetail.textContent,
    comparison.elements.mainLineProduct.value, comparison.elements.mainLineOptions.innerHTML,
    reelPage.lineLabel(line), reelPage.shadow.querySelector('[data-role="main-detail"]').textContent,
    linePage.lineLabel(line), wizardLabel, manual.name, body.textContent];
  if (label) for (const rendered of labels) assert(rendered.includes(label), `Scope lost for ${line.id}: ${rendered}`);
  else {
    assert.equal(selector.scopedProductLabel(line), `${line.brand} ${line.model}`);
    assert.equal(comparison.lineLabel(line), `${line.brand} ${line.model} ${line.lb} lb`);
    assert.equal(reelPage.lineLabel(line), `${line.brand} ${line.model} ${line.lb} lb`);
    assert.equal(linePage.lineLabel(line), `${line.brand} ${line.model} ${line.lb} lb`);
    assert.equal(manual.name, `${line.brand} ${line.model}`);
  }
  handoffs++;
}
const historical = scoped.find(line => line.id === 'spiderwire-stealth-braid-braid-50');
assert(selector.searchLines(selector.prepareLines(lines), 'Braid', 'SS50G-125').some(line => line.id === historical.id));
const examplesBefore = JSON.stringify(products['spiderwire-stealth-braid'].exampleSetups);
Object.assign(linePage.state, { lines, reels, product: products['spiderwire-stealth-braid'], selectedLine: historical,
  affiliateData: JSON.parse(read('data/reel-affiliates.json')) });
linePage.el.examples = new Element(); linePage.el.examples.dataset.exampleMode = 'capacity';
linePage.renderExamples();
assert.equal((linePage.el.examples.innerHTML.match(/data-plan-reel=/g) || []).length, 1, 'Capacity mode renders one card per reel');
assert.equal(JSON.stringify(products['spiderwire-stealth-braid'].exampleSetups), examplesBefore);
assert.equal(products['spiderwire-stealth-braid'].exampleSetups.length, 2);
linePage.el.examples.dataset.exampleMode = 'backing';
linePage.renderExamples();
assert.equal((linePage.el.examples.innerHTML.match(/data-plan-reel=/g) || []).length, 2, 'Working-plan mode keeps both source pairs');
for (const file of ['js/calculator-core.js', 'js/recommendation-engine.js', 'data/reels.json', 'data/reel-affiliates.json']) assert.equal(sha256(read(file)), baseline.files[file], `Numerical dependency changed: ${file}`);
const report = { checkedAt: new Date().toISOString(), passed: true, scopedRows: 42, unscopedFixtures: 20, crossToolHandoffs: handoffs,
  checks: ['Actual database row rendering and option matching', 'Exact Wizard ID preload and visible historical label',
    'Manual calculator diameter handoff with scoped name', 'Shared selector identity grouping unchanged and scoped search',
    'Comparison search, strength change and selected detail', 'Reel-page result labels and selection detail', 'Line-page labels',
    'Two retained source Stealth pairs, one selected-strength capacity card, two working-plan cards', 'Numerical source/data dependencies byte-unchanged'],
  method: 'Actual production functions run in isolated Node VM with minimal DOM doubles; no browser, networking or visual-layout claim.' };
fs.writeFileSync('reports/resolution-integration/cross-tool-scope-tests.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
