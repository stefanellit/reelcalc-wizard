import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { parseFragment } from "./line-page-publishing/node_modules/parse5/dist/index.js";

const read = file => fs.readFileSync(file, "utf8");
const products = JSON.parse(read("data/line-page-products.json")).products;
const lines = JSON.parse(read("data/lines.json"));
const affiliateData = JSON.parse(read("data/reel-affiliates.json"));
const events = [];
const context = vm.createContext({ window: { ReelCalcAnalytics: { track: (...args) => events.push(args) } }, URL, URLSearchParams,
  document: { baseURI: "https://www.reelcalc.com/", querySelector: () => null } });
for (const file of ["js/calculator-core.js", "js/affiliate-links.js"]) vm.runInContext(read(file), context);
const engine = read("js/line-page-engine.js");
const marker = "var ready = init();";
assert.equal(engine.split(marker).length, 2);
vm.runInContext(engine.replace(marker, "var ready; global.clarityTest = { state, el, updateCalculateState, renderSelectedLineOffer };"), context);
context.window.ReelCalcLinePages.mount({ dataset: { productId: "maxima-ultragreen" } });
const page = context.window.clarityTest;
const node = () => ({ hidden: false, value: "", textContent: "", setAttribute() {}, classList: { toggle() {} } });
for (const key of ["workingYards", "workingYardsLabel", "workingYardsField", "fullSpoolResult", "fullSpoolAmount", "fullSpoolHelp", "calculate", "calculationHelp"]) page.el[key] = node();
const nodes = n => [n, ...(n.childNodes || []).flatMap(nodes)];
const offerBox = { hidden: false, anchors: [], querySelectorAll() { return this.anchors; }, set innerHTML(html) {
  this.html = html;
  this.anchors = nodes(parseFragment(html)).filter(n => n.tagName === "a").map(n => {
    const attrs = Object.fromEntries(n.attrs.map(a => [a.name, a.value]));
    const dataset = Object.fromEntries(Object.entries(attrs).filter(([k]) => k.startsWith("data-")).map(([k,v]) => [k.slice(5).replace(/-([a-z])/g, (_,c) => c.toUpperCase()),v]));
    return { attrs, dataset, addEventListener(type, handler) { this[type] = handler; } };
  });
} };
page.el.selectedLineOffer = offerBox;
Object.assign(page.state, { lines, affiliateData, product: products["maxima-ultragreen"], capacityOnly: true,
  selectedLine: lines.find(l => l.id === "maxima-ultragreen-monofilament-10"), selectedSpoolYards: 220 });
page.updateCalculateState();
assert.equal(page.el.fullSpoolAmount.textContent, "Choose a reel");
assert.equal(page.el.workingYardsField.hidden, true);
assert.equal(page.el.fullSpoolResult.hidden, false);
page.state.reelSource = "manual";
page.updateCalculateState();
assert.equal(page.el.fullSpoolAmount.textContent, "Enter reel specs");
page.state.manualReel = { id: "manual", manualRating: { capacityYards: 200, referenceDiameterIn: .012, lineType: "mono" } };
page.el.workingYards.value = "200";
page.updateCalculateState();
assert.equal(page.el.fullSpoolAmount.textContent, "200 yd");
assert.equal(page.el.calculate.disabled, false);
page.state.capacityOnly = false;
page.el.workingYards.value = "100";
page.updateCalculateState();
assert.equal(page.el.workingYardsField.hidden, false);
assert.equal(page.el.fullSpoolResult.hidden, true);
assert.equal(page.el.workingYards.value, "100");
page.state.manualReel = null;
page.state.capacityOnly = true;
page.updateCalculateState();
assert.equal(page.el.fullSpoolAmount.textContent, "Enter reel specs", "Never retain a stale capacity after removing the reel.");

let offerCases = 0;
for (const [id, product] of Object.entries(products)) {
  if (product.role === "leader") continue;
  const html = read(`components/line-pages/${id}.html`);
  assert(html.includes("My reel isn&#39;t listed") || html.includes("My reel isn't listed"), id);
  assert(html.includes('id="rcFullSpoolAmount"'), id);
  assert(html.includes('id="rcSelectedLineOffer"'), id);
  for (const line of lines.filter(l => l.brand === product.brand && l.model === product.model && l.type === product.lineType && !(product.excludedLineIds || []).includes(l.id) && l.dia_in > 0 && l.lb > 0)) {
    for (const yards of line.spool_sizes_yd || []) {
      Object.assign(page.state, { selectedLine: line, selectedSpoolYards: yards });
      page.renderSelectedLineOffer();
      assert.equal(offerBox.hidden, false, line.id);
      const a = offerBox.anchors[0];
      assert(a, line.id);
      const url = new URL(a.attrs.href);
      assert.equal(url.searchParams.get("tag"), "reelcalc-20");
      assert.equal(a.dataset.affiliateLine, line.id);
      assert.equal(Number(a.dataset.spoolYards), yards);
      assert(a.attrs.rel.includes("sponsored") && a.attrs.rel.includes("noopener"));
      if (url.pathname === "/s") {
        const query = url.searchParams.get("k");
        assert(query.includes(line.brand) && query.includes(line.model) && query.includes(`${line.lb} lb`), line.id);
        const metric = (line.retail_packages || []).find(p => p.yards === yards);
        assert(query.includes(metric ? `${metric.meters} meter spool` : `${Math.ceil(yards)} yard spool`), line.id);
      }
      offerCases++;
    }
  }
}
offerBox.anchors[0].click();
assert(events.some(([name, params]) => name === "line_page_affiliate_click" && params.selection_source === "line_selection" && !params.reel_id), "Track shopping clicks even without a reel.");
page.state.selectedLine = null;
page.renderSelectedLineOffer();
assert.equal(offerBox.hidden, true);
assert.equal(offerBox.anchors.length, 0, "Clear a stale shopping link.");
console.log(JSON.stringify({ passed: true, fullSpoolStates: 5, offerCases, affiliateTag: "reelcalc-20", shoppingClickWithoutReel: true }));
