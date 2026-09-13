import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { parseFragment } from "./line-page-publishing/node_modules/parse5/dist/index.js";

const read = file => fs.readFileSync(new URL("../" + file, import.meta.url), "utf8");
const lines = JSON.parse(read("data/lines.json"));
const reels = JSON.parse(read("data/reels.json"));
const products = JSON.parse(read("data/line-page-products.json")).products;
const affiliateData = JSON.parse(read("data/reel-affiliates.json"));
const before = JSON.stringify({ lines, products, affiliateData });
const context = vm.createContext({
  window: {}, URL, URLSearchParams,
  document: { querySelector: () => ({ dataset: {} }), baseURI: "https://www.reelcalc.com/" }
});
for (const file of ["js/calculator-core.js", "js/affiliate-links.js"]) {
  vm.runInContext(read(file), context, { filename: file });
}

// Expose real production callers in memory without initializing a page or adding runtime exports.
const engine = read("js/line-page-engine.js");
const marker = "var ready = init();";
assert.equal(engine.split(marker).length, 2);
vm.runInContext(engine.replace(marker, "var ready; global.scopeAffiliateTest = { state: state, " +
  "backingLineOffer: backingLineOffer, lineLabel: lineLabel, lineOfferLink: lineOfferLink, calculateSetup: calculateSetup };"),
context, { filename: "js/line-page-engine.js" });
context.window.ReelCalcLinePages.mount({
  dataset: {}, querySelector: () => ({ dataset: {} }), querySelectorAll: () => []
});
const page = context.window.scopeAffiliateTest;
const helpers = context.window.ReelCalcAffiliateLinks;
Object.assign(page.state, { lines, reels, affiliateData });

function nodes(node) {
  return [node, ...(node.childNodes || []).flatMap(nodes)];
}
function textOf(node) {
  return nodes(node).filter(item => item.nodeName === "#text").map(item => item.value).join("");
}
function queryOf(offer, data = affiliateData) {
  return new URL(offer.url).searchParams.get(data.retailers[offer.retailerId].searchQueryParameter || "q");
}
function backingResult(line) {
  return { assessmentTone: "success", needsBacking: true, backingLine: line, backingYards: 40 };
}

const scoped = lines.filter(line => line.source_scope_label);
assert(scoped.length > 0, "Source-scoped regression fixtures are required.");
const unscoped = lines.find(line => line.id === "berkley-trilene-big-game-monofilament-10");
assert(unscoped && !unscoped.source_scope_label);
const hostile = { ...scoped[0], source_scope_label: '<img src=x onerror="alert(1)"> & "scope"' };
let genericBackingCases = 0;
for (const line of [...scoped, unscoped, hostile]) {
  const offer = page.backingLineOffer(backingResult(line));
  assert(offer, `No backing offer for ${line.id}`);
  const plain = `${line.brand} ${line.model} ${line.lb} lb`;
  const display = plain + (line.source_scope_label ? ` (${line.source_scope_label})` : "");
  assert.equal(page.lineLabel(line), display, "Visible identity/strength/scope must be preserved.");
  const rendered = parseFragment(page.lineOfferLink(offer, line, "backing", 0));
  const anchor = nodes(rendered).find(node => node.tagName === "a");
  assert(anchor);
  assert(textOf(anchor).includes(display));
  assert.equal(anchor.attrs.find(attr => attr.name === "data-affiliate-line").value, line.id);
  assert(!nodes(rendered).some(node => node.tagName === "img" || node.attrs?.some(attr => attr.name === "onerror")));
  assert.equal(offer.lineId, line.id);
  assert.equal(offer.lineBrand, line.brand);
  assert.equal(offer.lineModel, line.model);
  assert.equal(offer.lineLb, line.lb);

  if (offer.matchType === "generic_search") {
    const expected = `${plain} ${helpers.normalizedLineType(line.type)} fishing line`;
    assert.equal(queryOf(offer), expected, `Backing search leaked display scope: ${line.id}`);
    assert.equal(offer.query, expected, "Offer query metadata must match the outgoing URL.");
    assert.equal(offer.suggestedSpoolYards, null, "Do not invent a backing retail package.");
    const retailer = affiliateData.retailers[offer.retailerId];
    if (retailer.affiliateTagParameter) {
      assert.equal(new URL(offer.url).searchParams.get(retailer.affiliateTagParameter), retailer.affiliateTag);
    }
    genericBackingCases++;
  }
}
assert(genericBackingCases > 0);

const namedRegressions = [
  ["stren-super-knot-monofilament-8", "Stren Super Knot 8 lb monofilament fishing line"],
  ["hi-seas-fluorocarbon-fluorocarbon-25", "Hi-Seas Fluorocarbon 25 lb fluorocarbon fishing line"]
];
for (const [id, expected] of namedRegressions) {
  assert.equal(queryOf(page.backingLineOffer(backingResult(lines.find(line => line.id === id)))), expected);
}

const knownSpoolIds = ["sufix-invisiline-fluorocarbon-fluorocarbon-8", "sufix-calibr8-braid-15", "spiderwire-stealth-braid-braid-50"];
const reel = reels.find(item => item.id === "shimano-vanford-fa-2500hga-vf2500hga-691");
assert(reel);
for (const id of knownSpoolIds) {
  const line = lines.find(item => item.id === id);
  assert(line);
  page.state.product = Object.values(products).find(product => product.brand === line.brand && product.model === line.model && product.lineType === line.type);
  const spoolYards = line.spool_sizes_yd[0];
  const capacity = context.window.ReelCalcCore.calculateFullSpoolCapacity(reel, line, { lineCatalog: lines });
  const result = page.calculateSetup({ reel, line, spoolYards, workingYards: Math.min(50, capacity / 2), backingLine: unscoped });
  assert(result.ok && result.offer);
  assert.equal(result.offer.matchType, "generic_search");
  const query = queryOf(result.offer);
  assert(!query.includes(line.source_scope_label));
  assert(query.startsWith(`${line.brand} ${line.model} ${line.lb} lb `));
  const metricPackage = line.retail_packages.find(pack => pack.meters > 0 && Math.abs(pack.yards - spoolYards) < 0.000001);
  assert(query.endsWith(metricPackage ? `${metricPackage.meters} meter spool` : `${Math.ceil(spoolYards)} yard spool`));
  assert.equal(result.offer.lineId, id);
}

const mappedLine = lines.find(line => line.id === namedRegressions[0][0]);
const mappedData = structuredClone(affiliateData);
const retailerId = mappedData.retailerPriority[0];
const mappedUrl = "https://www.amazon.com/dp/REGRESSIONFIXTURE?tag=reelcalc-20";
mappedData.lines = { ...mappedData.lines, [mappedLine.id]: { offers: {
  [retailerId]: { url: mappedUrl, matchType: "exact", label: "Mapped fixture" }
} } };
page.state.affiliateData = mappedData;
const direct = page.backingLineOffer(backingResult(mappedLine));
const expectedDirect = helpers.buildRecommendedLineOffer({ affiliateData: mappedData, line: mappedLine, requiredYards: 40 });
assert.deepEqual(direct, expectedDirect, "A mapped offer must remain untouched.");
assert.equal(direct.url, mappedUrl);
page.state.affiliateData = affiliateData;

for (const override of [{ assessmentTone: "warning" }, { needsBacking: false }, { backingLine: null }, { backingYards: 0 }]) {
  assert.equal(page.backingLineOffer({ ...backingResult(unscoped), ...override }), null);
}
assert.equal(JSON.stringify({ lines, products, affiliateData }), before, "Do not mutate source rows, configs or affiliate mappings.");
console.log(JSON.stringify({ passed: true, scopedRows: scoped.length, unscopedCases: 1, hostileScopeCases: 1,
  genericBackingCases, namedRegressions: namedRegressions.length, knownSpoolCases: knownSpoolIds.length,
  mappedOfferCases: 1, ineligibleOfferCases: 4, sourceAndMappingMutation: false }));
