import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("js/comparison-data.js");
const sandbox = { window: {}, Number, String, Array, Object, Math };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const comparison = sandbox.window.ReelCalcComparisonData;
assert.ok(comparison, "comparison data helper should load");

const reelA = {
  id: "shimano-stradic-fm-c3000xg-stc3000xgfm-686",
  brand: "Shimano",
  model: "Stradic FM",
  sku: "STC3000XGFM",
  size_label: "C3000XG",
  weight_oz: 7.9,
  line_retrieve_in: 37,
  max_drag_lb: 20
};
const reelB = {
  id: "daiwa-fuego-lt-3000d-c-feglt3000d-c-132",
  brand: "Daiwa",
  model: "Fuego LT",
  sku: "FEGLT3000D-C",
  size_label: "3000D-C",
  weight_oz: 7.2,
  line_retrieve_in: 31.6,
  max_drag_lb: 22
};
const pageA = { family: "shimano-stradic-fm" };
const pageB = { family: "daiwa-fuego-lt" };

const pairAB = comparison.normalizedPairId(reelA.id, reelB.id);
const pairBA = comparison.normalizedPairId(reelB.id, reelA.id);
assert.equal(pairAB, pairBA, "A vs B and B vs A must share one pair ID");
assert.equal(pairAB, [reelA.id, reelB.id].sort().join("__vs__"));
assert.equal(comparison.normalizedPairId(reelA.id, reelA.id), "", "same-reel pairs are invalid");
assert.equal(comparison.normalizedPairId(reelA.id, ""), "", "incomplete pairs are invalid");

const params = comparison.comparisonParameters(reelA, reelB, pageA, pageB, "shared_url");
assert.equal(params.reel_1_id, reelA.id, "left/right order must be retained");
assert.equal(params.reel_2_id, reelB.id, "left/right order must be retained");
assert.equal(params.comparison_pair_id, pairAB);
assert.equal(params.same_brand, "false");
assert.equal(params.same_family, "false");
assert.equal(params.same_size, "false");
assert.equal(params.comparison_source, "shared_url");

const sameFamilyB = { ...reelA, id: "shimano-stradic-fm-4000xg", sku: "ST4000XGFM", size_label: "4000XG" };
const sameFamilyParams = comparison.comparisonParameters(
  reelA,
  sameFamilyB,
  pageA,
  pageA,
  "manual_selection"
);
assert.equal(sameFamilyParams.same_brand, "true");
assert.equal(sameFamilyParams.same_family, "true");
assert.equal(sameFamilyParams.same_size, "false");

const sameSizeB = { ...reelB, id: "daiwa-fuego-lt-c3000xg", size_label: reelA.size_label };
const sameSizeParams = comparison.comparisonParameters(reelA, sameSizeB, pageA, pageB, "other");
assert.equal(sameSizeParams.same_size, "true");
assert.equal(sameSizeParams.same_family, "false");

const selector = comparison.selectorParameters(reelA, pageA, "left");
assert.deepEqual(
  JSON.parse(JSON.stringify(selector)),
  {
    reel_id: reelA.id,
    brand: reelA.brand,
    family: pageA.family,
    model: reelA.sku,
    size: reelA.size_label,
    selector_position: "left"
  }
);

const summary = comparison.comparisonSummary(reelA, reelB);
assert.match(summary, /0\.7 oz lighter/);
assert.match(summary, /5\.4 in more line per handle turn/);
assert.doesNotMatch(summary, /better|best|outperform/i, "summary must stay factual");

const comparisonSource = read("examples/reel-comparison.js");
for (const eventName of [
  "reel_comparison_completed",
  "reel_comparison_reel_1_selected",
  "reel_comparison_reel_2_selected",
  "reel_comparison_link_copied",
  "reel_comparison_reset",
  "reel_comparison_reel_page_clicked",
  "reel_comparison_wizard_clicked",
  "reel_comparison_amazon_clicked"
]) {
  assert.ok(comparisonSource.includes(eventName), `missing analytics event ${eventName}`);
}
assert.match(comparisonSource, /completedPairIds\.has\(normalizedId\)/, "completion events need local duplicate protection");
assert.match(comparisonSource, /onceKey: normalizedId/, "completion events need analytics-helper duplicate protection");
assert.match(comparisonSource, /history\[method\]/, "pair changes should use the History API");
assert.match(comparisonSource, /addEventListener\("popstate"/, "back and forward should restore state");
assert.match(comparisonSource, /document\.execCommand\("copy"\)/, "copy should have a clipboard fallback");
assert.match(comparisonSource, /\/reelcalc-wizard\?reel=/, "wizard links should preload stable reel IDs");
assert.doesNotMatch(comparisonSource, /DEFAULT_(?:MAIN|BACKING)_LINE/, "comparison should not preload default lines");
assert.match(comparisonSource, />Choose strength<\/option>/, "line strength should wait for the user");

const loaderSource = read("examples/reel-comparison-loader.js");
const htmlSource = read("examples/reel-comparison.html");
assert.match(loaderSource, /https:\/\/www\.reelcalc\.com\/reel-comparison/);
assert.match(htmlSource, /rel="canonical" href="https:\/\/www\.reelcalc\.com\/reel-comparison"/);
assert.match(loaderSource, /js\/analytics\.js/, "loader should use the shared analytics helper");
assert.match(loaderSource, /js\/comparison-data\.js/, "loader should use the shared pair helper");

const registry = JSON.parse(read("data/reel-pages.json"));
const reels = JSON.parse(read("data/reels.json"));
const reelIds = new Set(reels.map((reel) => reel.id));
assert.ok(registry.pages.length > 0);
for (const page of registry.pages) {
  assert.ok(reelIds.has(page.reelId), `comparison page record has unknown stable ID ${page.reelId}`);
}

const sitemapCandidates = fs.readdirSync(root).filter((name) => /sitemap/i.test(name));
for (const name of sitemapCandidates) {
  assert.doesNotMatch(read(name), /reel-comparison\?reel1=/, "query comparisons must not enter a sitemap");
}

console.log("Reel comparison tracking tests passed.");
console.log(`- normalized pair: ${pairAB}`);
console.log(`- ${registry.pages.length} comparison-ready reel IDs validated`);
console.log("- completed, selector, copy, reel-page, wizard, and affiliate events present");
console.log("- canonical, History API, popstate, and clipboard fallback protections present");
