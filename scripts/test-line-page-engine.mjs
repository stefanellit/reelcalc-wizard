import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { buildGoldLinePage } from "./line-page-gold-template.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reels = JSON.parse(fs.readFileSync(path.join(root, "data", "reels.json"), "utf8"));
const lines = JSON.parse(fs.readFileSync(path.join(root, "data", "lines.json"), "utf8"));
const products = JSON.parse(fs.readFileSync(path.join(root, "data", "line-page-products.json"), "utf8")).products;

function browserModule(file) {
  const context = vm.createContext({
    window: {},
    URL,
    URLSearchParams,
    Map,
    Set,
    Number,
    Math,
    String,
    Array,
    Object,
    JSON,
    console
  });
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  return context.window;
}

const core = browserModule("js/calculator-core.js").ReelCalcCore;
const affiliateWindow = browserModule("js/affiliate-links.js");
const affiliateData = JSON.parse(fs.readFileSync(path.join(root, "data", "reel-affiliates.json"), "utf8"));

assert(core, "Production ReelCalcCore did not load.");
assert(affiliateWindow.ReelCalcAffiliateLinks, "Affiliate helper did not load.");

function findReel(id) {
  const reel = reels.find((item) => item.id === id);
  assert(reel, `Missing reel ${id}`);
  assert(core.isReelReady(reel), `Reel is not calculation-ready: ${id}`);
  return reel;
}

function findLine(id) {
  const line = lines.find((item) => item.id === id);
  assert(line, `Missing line ${id}`);
  assert(core.isLineReady(line), `Line is not calculation-ready: ${id}`);
  return line;
}

const backing = findLine("berkley-trilene-big-game-monofilament-10");
const cases = [
  ["PowerPro small spinning", "shimano-vanford-fa-2500hga-vf2500hga-691", "powerpro-spectra-braid-10", 125],
  ["PowerPro 3000 spinning", "shimano-stradic-fm-c3000xg-stc3000xgfm-686", "powerpro-spectra-braid-15", 150],
  ["PowerPro baitcaster", "shimano-slx-a-150-6-3-rh-slx150a", "powerpro-spectra-braid-30", 100],
  ["InvizX small spinning", "shimano-vanford-fa-2500hga-vf2500hga-691", "seaguar-invizx-fluorocarbon-8", 120],
  ["InvizX larger spinning", "daiwa-fuego-lt-2500d-xh-feglt2500d-xh-131", "seaguar-invizx-fluorocarbon-10", 150],
  ["InvizX baitcaster", "shimano-slx-a-150-6-3-rh-slx150a", "seaguar-invizx-fluorocarbon-12", 100],
  ["Trilene XL spinning", "shimano-vanford-fa-2500hga-vf2500hga-691", "berkley-trilene-xl-monofilament-8", 100],
  ["Trilene XL baitcaster", "shimano-slx-a-150-6-3-rh-slx150a", "berkley-trilene-xl-monofilament-12", 75],
  ["Trilene XL verified 17 lb", "shimano-slx-a-150-6-3-rh-slx150a", "berkley-trilene-xl-monofilament-17", 50]
];

const results = cases.map(([name, reelId, lineId, workingYards]) => {
  const reel = findReel(reelId);
  const line = findLine(lineId);
  const capacity = core.calculateFullSpoolCapacity(reel, line, { lineCatalog: lines });
  assert(Number.isFinite(capacity) && capacity > 0, `${name} produced no capacity.`);
  const backingResult = core.calculateActualLineCalibratedBacking(reel, line, Math.min(workingYards, capacity), backing, lines);
  assert(backingResult && Number.isFinite(backingResult.backingYards), `${name} produced no backing result.`);
  assert(backingResult.backingYards >= 0, `${name} produced negative backing.`);
  return { name, capacity, backing: backingResult.backingYards };
});

const powerProExpected = new Map([
  [5, [0.004, 0.10]], [8, [0.005, 0.13]], [10, [0.006, 0.15]], [15, [0.008, 0.19]],
  [20, [0.009, 0.23]], [30, [0.011, 0.28]], [40, [0.012, 0.32]], [50, [0.014, 0.36]],
  [65, [0.016, 0.41]], [80, [0.017, 0.43]], [100, [0.018, 0.46]], [150, [0.022, 0.56]],
  [200, [0.030, 0.76]], [250, [0.035, 0.89]]
]);
for (const [lb, [inches, mm]] of powerProExpected) {
  const line = findLine(`powerpro-spectra-braid-${lb}`);
  assert.equal(line.dia_in, inches, `PowerPro ${lb} lb inch diameter mismatch.`);
  assert.equal(line.dia_mm, mm, `PowerPro ${lb} lb metric diameter mismatch.`);
  assert(Array.isArray(line.spool_sizes_yd) && line.spool_sizes_yd.length, `PowerPro ${lb} lb has no verified spool sizes.`);
}

const invizxExpected = new Map([
  [4, [0.006, 0.165]], [6, [0.008, 0.205]], [8, [0.009, 0.235]], [10, [0.010, 0.260]],
  [12, [0.011, 0.285]], [15, [0.013, 0.330]], [17, [0.015, 0.370]], [20, [0.016, 0.405]],
  [25, [0.017, 0.435]]
]);
for (const [lb, [inches, mm]] of invizxExpected) {
  const line = findLine(`seaguar-invizx-fluorocarbon-${lb}`);
  assert.equal(line.dia_in, inches, `InvizX ${lb} lb inch diameter mismatch.`);
  assert.equal(line.dia_mm, mm, `InvizX ${lb} lb metric diameter mismatch.`);
  assert(Array.isArray(line.spool_sizes_yd) && line.spool_sizes_yd.length, `InvizX ${lb} lb has no verified spool sizes.`);
}

assert(!products["powerpro-spectra"].excludedLineIds.includes("powerpro-spectra-braid-5"));
assert(products["powerpro-spectra"].excludedLineIds.includes("powerpro-spectra-braid-3"), "Legacy 3 lb PowerPro should not appear on the current product page.");

const offer = affiliateWindow.ReelCalcAffiliateLinks.buildRecommendedLineOffer({
  affiliateData,
  line: findLine("powerpro-spectra-braid-15"),
  requiredYards: 125,
  spoolYards: 150
});
assert(offer, "Affiliate offer was not generated.");
assert.equal(offer.suggestedSpoolYards, 150, "Verified selected spool did not reach the affiliate offer.");
assert(offer.url.includes("tag=reelcalc-20"), "Amazon affiliate tag is missing.");
assert(offer.query.includes("150 yard spool"), "Affiliate search does not contain the selected spool length.");

const linePageEngine = fs.readFileSync(path.join(root, "js", "line-page-engine.js"), "utf8");
const xlExpected = [
  [2,.005,.12,330],[4,.008,.20,330],[6,.009,.22,330],[8,.010,.25,330],
  [10,.011,.27,300],[12,.013,.33,300],[14,.014,.35,300],[17,.015,.38,300],
  [20,.016,.40,270],[25,.018,.45,270],[30,.020,.50,250]
];
for (const [lb,inch,mm,filler] of xlExpected) {
  const line = findLine(`berkley-trilene-xl-monofilament-${lb}`);
  assert.equal(line.dia_in, inch);
  assert.equal(line.dia_mm, mm);
  assert.equal(line.spool_sizes_yd[0], filler);
  assert(line.product_source_url && line.diameter_source_url);
}
assert.deepEqual(findLine('berkley-trilene-xl-monofilament-25').spool_sizes_yd, [270,2600]);
assert.deepEqual(findLine('berkley-trilene-xl-monofilament-30').spool_sizes_yd, [250,2300]);
assert.equal(products['berkley-trilene-xl'].defaultMode, 'capacity');
assert(linePageEngine.includes('url.searchParams.set("mode", "backing")'), 'A saved backed mono plan must not revert to its default capacity mode.');
for (const type of ["braid", "fluorocarbon", "monofilament"]) {
  const html = buildGoldLinePage("test", { ...products["powerpro-spectra"], lineType: type }, [findLine("powerpro-spectra-braid-15")], {
    escapeHtml: value => String(value ?? ""), jsonLd: () => "{}", sourceItems: () => "", faqs: () => ""
  });
  assert(html.includes('id="rcManualReel"'), `${type}: manual entry is missing.`);
  if (type === "braid") {
    assert(html.includes("Use its braid capacity rating if available. Otherwise, use its mono rating."));
    assert(html.includes('<option value="braid">Braid rating</option>'));
  } else {
    assert(html.includes(`Use its mono capacity rating for this ${type === "fluorocarbon" ? "fluorocarbon" : "mono"} line.`));
    assert(!html.includes('<option value="braid">Braid rating</option>'));
  }
  assert(!html.includes("A capacity comparison is not a strength, durability, or casting-performance test."));
  assert(!html.includes("Inch and millimeter figures are independently rounded published values"));
}
assert(!/dia_in\s*\*\s*[^;\n]*dia_in/.test(linePageEngine), "Line page introduced a duplicate diameter-squared formula.");
assert(!/spool_space\s*=/.test(linePageEngine), "Line page introduced a duplicate spool-space formula.");
assert(linePageEngine.includes("rcBackingModeButton"), "Line page is missing the capacity-only control.");
assert(linePageEngine.includes("setSuggestedWorkingAmount(false)"), "Strength changes should preserve the current working-line plan.");
assert(!linePageEngine.includes(' + " versus " + '), "Line-switch capacities must not use an unlabeled versus comparison.");
assert(!linePageEngine.includes("nearly the same physical diameter"), "Equal-diameter copy must not show an awkward zero-percent comparison.");
assert(linePageEngine.includes("has the same listed diameter as"), "Equal-diameter comparisons need the simplified wording.");
assert.match(
  linePageEngine,
  /formatYards\(oldCapacity\)[\s\S]*lineLabel\(current\)[\s\S]*formatYards\(newCapacity\)[\s\S]*lineLabel\(replacement\)/,
  "Line-switch capacity comparisons must label both the current and replacement line."
);

const reelPageCalculator = fs.readFileSync(path.join(root, "js", "reel-page-calculator.js"), "utf8");
assert(!reelPageCalculator.includes("Backing uses the selected main and backing line diameters."), "Removed backing explanation is still present.");

const wizard = fs.readFileSync(path.join(root, "js", "wizard.js"), "utf8");
assert(wizard.includes("applyLinePreloadFromUrl"), "Wizard exact-line preload was not installed.");
assert(wizard.includes('params.get("line") || params.get("mainLine")'), "Wizard line parameter aliases are missing.");

for (const productId of Object.keys(products)) {
  const html = fs.readFileSync(path.join(root, "examples", "line-pages", `${productId}.html`), "utf8");
  assert(html.includes('data-reelcalc-line-page'), `${productId} page is missing the shared engine mount.`);
  assert(html.includes("js/line-page-engine.js"), `${productId} page is missing the shared engine.`);
  assert(html.includes('id="rcBackingModeButton"'), `${productId} page is missing the capacity-only button.`);
  assert(html.includes("<noscript>"), `${productId} page is missing progressive fallback.`);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(blocks.length, 1, `${productId} should contain one JSON-LD graph.`);
  JSON.parse(blocks[0][1]);
  if (products[productId].presentation === "gold") {
    assert(html.includes('class="rc-line-page rc-line-gold"'), "Gold layout must be opt-in.");
    assert(html.includes('css/line-page-gold.css'), "Gold layout is missing its scoped stylesheet.");
    const product = products[productId];
    const shortName = product.shortName || product.brand;
    assert(html.includes(`How much ${shortName} will fit?`), `${productId} needs a product-specific heading.`);
    for (const entry of product.exampleSetups) findReel(entry.reelId);
    const expectedStrengths = lines.filter(line => line.brand === product.brand && line.model === product.model && line.type === product.lineType && !product.excludedLineIds.includes(line.id) && line.lb > 0 && line.dia_in > 0).length;
    assert.equal([...html.matchAll(/data-select-line="/g)].length, expectedStrengths, `${productId} chart must include every offered strength.`);
    assert(html.indexOf('id="use-this-line"') < html.indexOf('id="diameter-chart"'), "The calculator must precede the full chart.");
    for (const id of ["rcStrength", "rcSpool", "rcCalculate", "rcResults", "rcStrengthWizard"]) {
      assert.equal([...html.matchAll(new RegExp(`id="${id}"`, "g"))].length, 1, `${id} must be unique.`);
    }
    assert(html.indexOf('id="product-fit-title"') < html.indexOf('id="use-this-line"'), "Product suitability must precede the calculator.");
    assert(!html.includes('id="rcFishingType"') && !html.includes('id="rcPriority"'), "Gold pages must not duplicate Wizard recommendation controls.");
    assert(!html.includes('js/recommendation-engine.js'), "The simplified guide must not load the unused recommendation engine.");
    assert(html.includes('data-example-mode="capacity"'), "Gold-page reel examples must use the currently selected line's capacity.");
    assert(!html.includes('Three reel-and-line plans'), "Gold-page examples must not describe fixed backing plans.");
  }
}

console.log(JSON.stringify({
  passed: true,
  lineRecords: lines.length,
  calculationCases: results.map((result) => ({
    name: result.name,
    capacityYards: Number(result.capacity.toFixed(1)),
    backingYards: Number(result.backing.toFixed(1))
  }))
}, null, 2));
