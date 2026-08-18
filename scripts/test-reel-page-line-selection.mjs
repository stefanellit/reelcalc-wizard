import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const reels = JSON.parse(read("data/reels.json"));
const rawLines = JSON.parse(read("data/lines.json"));
const affiliateData = JSON.parse(read("data/reel-affiliates.json"));
const sandbox = { window: {}, URL, URLSearchParams, Map, Set, Array, Number, String, Math };
vm.createContext(sandbox);
vm.runInContext(read("js/calculator-core.js"), sandbox);
vm.runInContext(read("js/line-selector.js"), sandbox);
vm.runInContext(read("js/affiliate-links.js"), sandbox);

const core = sandbox.window.ReelCalcCore;
const selector = sandbox.window.ReelCalcLineSelector;
const affiliates = sandbox.window.ReelCalcAffiliateLinks;
const lines = selector.prepareLines(rawLines);
const reel = (id) => reels.find((record) => record.id === id);
const line = (id) => lines.find((record) => record.id === id);

const shimano = reel("shimano-sedona-fj-2500hg-se2500hgfj-652");
const daiwa = reel("daiwa-bg-2500-bg2500-184");
const revros = reel("daiwa-revros-lt-3000d-c-rvslt3000d-c-104");
const noBraidRating = reel("lew-s-crappie-thunder-spinning-reel-75-43-353");
const centron4000 = reel("kastking-centron-spinning-4000-51-294");
const vanquishPe1000 = reel("shimano-vanquish-1000ssspg-781");
const powerPro15 = line("powerpro-spectra-braid-15");
const powerPro20 = line("powerpro-spectra-braid-20");
const superPower20 = line("kastking-superpower-braid-braid-20");
const superPower40 = line("kastking-superpower-braid-braid-40");
const superPower6 = line("kastking-superpower-braid-braid-6");
const bigGame12 = line("berkley-trilene-big-game-monofilament-12");
const trilene8 = line("berkley-trilene-xl-monofilament-8");
const trilene10 = line("berkley-trilene-xl-monofilament-10");
const invizx8 = line("seaguar-invizx-fluorocarbon-8");
const pex8Micro12 = line("seaguar-jdm-pex8-micro-braid-braid-12");
const sunlineAzayaka3 = line("sunline-shooter-bms-azayaka-fc-fluorocarbon-3");
const maxcuatro100 = line("powerpro-maxcuatro-braid-100");

assert.ok(shimano && daiwa && revros && noBraidRating && centron4000 && vanquishPe1000, "required reel fixtures must exist");
assert.ok(powerPro15 && powerPro20 && superPower6 && superPower20 && superPower40 && bigGame12 && trilene8 && trilene10 && invizx8, "required line fixtures must exist");
assert.ok(pex8Micro12 && sunlineAzayaka3 && maxcuatro100, "2026 line expansion must be available to the shared selector");
assert.equal(lines.length, 903, "central spool-line database valid-record count changed unexpectedly");

// 1-4: Shimano and Daiwa each use mono calibration for mono and braid calibration for braid.
assert.equal(core.capacityBasisForLine(shimano, trilene8).type, "published-mono");
assert.equal(core.capacityBasisForLine(shimano, powerPro15).type, "published-braid");
assert.equal(core.capacityBasisForLine(daiwa, trilene8).type, "published-mono");
assert.equal(core.capacityBasisForLine(daiwa, powerPro20).type, "published-braid");

// 5: Exact strength matches the manufacturer's braid yardage without mono conversion.
const revros15 = core.capacityBasisForLine(revros, powerPro15);
assert.equal(revros15.publishedEstimate.method, "exact");
assert.equal(revros15.capacityYards, 250);
const oldMonoDerivedRevros15 = core.calculateMainLineCapacity(revros, powerPro15);
assert.ok(Math.abs(oldMonoDerivedRevros15 - 250) > 300, "fixture must catch a return of the old mono-to-braid mistake");

// 6: An in-between strength uses the two nearby manufacturer ratings.
const custom18Braid = { type: "Braid", lb: 18, dia_in: 0.0085, custom_line: true };
const interpolated = core.capacityBasisForLine(revros, custom18Braid);
assert.equal(interpolated.type, "published-braid");
assert.equal(interpolated.publishedEstimate.method, "interpolated");
assert.ok(interpolated.capacityYards < 250 && interpolated.capacityYards > 220);

// Even the no-catalog fallback must scale below a reel's lightest published
// braid rating; exact Wizard and reel-page selections use catalog diameters.
const strengthScaledCentron20 = core.capacityBasisForLine(centron4000, superPower20);
assert.equal(strengthScaledCentron20.capacityYards, 620);
const calibratedCentron20 = core.capacityBasisForActualLine(centron4000, superPower20, lines);
assert.equal(calibratedCentron20.type, "published-braid-diameter");
assert.equal(calibratedCentron20.actualLineEstimate.method, "diameter-calibrated");
assert.equal(calibratedCentron20.actualLineEstimate.referenceQuality, "catalog-median-exact");
assert.ok(calibratedCentron20.capacityYards > 625 && calibratedCentron20.capacityYards < 650);

const centron20Range = core.calculateActualLineBraidCapacityRange(centron4000, superPower20, lines);
assert.ok(centron20Range.minimumYards < centron20Range.centerYards);
assert.ok(centron20Range.maximumYards > centron20Range.centerYards);
const centron20Backing = core.calculateActualLineCalibratedBacking(
  centron4000,
  superPower20,
  150,
  bigGame12,
  lines
);
assert.ok(centron20Backing.backingYards > 195 && centron20Backing.backingYards < 210);
const centron20BackingRange = core.calculateActualLineCalibratedBackingRange(
  centron4000,
  superPower20,
  150,
  bigGame12,
  lines
);
assert.ok(centron20BackingRange.minimumYards < centron20Backing.backingYards);
assert.ok(centron20BackingRange.maximumYards > centron20Backing.backingYards);

const calibratedCentron40 = core.capacityBasisForActualLine(centron4000, superPower40, lines);
assert.equal(calibratedCentron40.actualLineEstimate.method, "label-match-diameter-calibrated");
const centron20Space = calibratedCentron20.capacityYards * superPower20.dia_in * superPower20.dia_in;
const centron40Space = calibratedCentron40.capacityYards * superPower40.dia_in * superPower40.dia_in;
assert.ok(
  Math.abs(centron20Space - centron40Space) <= centron20Space * 1e-9,
  "selected line strength must not change the Centron's inferred physical spool space"
);

const peVanquishRange = core.calculateActualLineBraidCapacityRange(vanquishPe1000, superPower6, lines);
assert.equal(peVanquishRange.method, "pe-diameter-calibrated");
assert.equal(peVanquishRange.referenceQuality, "published-pe-diameter");
assert.ok(peVanquishRange.centerYards > 95 && peVanquishRange.centerYards < 115);

// 7-8: Missing braid data is labeled as fallback; fluorocarbon stays on mono calibration.
const fallback = core.capacityBasisForLine(noBraidRating, powerPro15);
assert.equal(fallback.type, "mono-derived-braid-fallback");
assert.equal(fallback.fallback, true);
assert.equal(core.capacityBasisForLine(shimano, invizx8).type, "published-mono");
const copolymer = line("yo-zuri-hybrid-copolymer-10");
assert.ok(copolymer, "copolymer main line should be available");
assert.equal(copolymer.material, "Copolymer");
assert.equal(core.capacityBasisForLine(shimano, copolymer).type, "published-mono");
assert.ok(!lines.some((record) => record.type === "Fluorocarbon Leader"), "leader-only material should not appear as spool line");

// 9: Capacity Only returns the selected exact line's appropriate full-spool reference.
assert.equal(core.capacityBasisForLine(shimano, powerPro15).capacityYards, 145);
assert.equal(
  core.capacityBasisForLine(shimano, trilene8).capacityYards.toFixed(1),
  core.calculateMainLineCapacity(shimano, trilene8).toFixed(1)
);

// 10-12: Main line controls calibration; both selected diameters control mixed-line backing.
const braidOverMono = core.calculateCalibratedBacking(shimano, powerPro15, 100, trilene10);
assert.equal(braidOverMono.basis.type, "published-braid");
assert.ok(braidOverMono.backingYards > 0);
const monoOverMono = core.calculateCalibratedBacking(shimano, trilene8, 100, trilene10);
assert.equal(monoOverMono.basis.type, "published-mono");
const thinnerBacking = core.calculateCalibratedBacking(shimano, powerPro15, 100, trilene8);
assert.ok(thinnerBacking.backingYards > braidOverMono.backingYards);

// 13-14: New valid central records flow in automatically; malformed diameter records do not.
const injected = selector.prepareLines(rawLines.concat([
  { id: "test-future-line-17", brand: "Future Line", model: "Auto Flow", type: "Braid", lb: 17, dia_in: 0.0082 },
  { id: "test-missing-diameter", brand: "Future Line", model: "Missing", type: "Braid", lb: 20, dia_in: null }
]));
assert.ok(injected.some((record) => record.id === "test-future-line-17"));
assert.ok(!injected.some((record) => record.id === "test-missing-diameter"));

// 15: Custom braid works and receives wider uncertainty than a database exact match.
const customRange = core.calculateBraidCapacityRange(shimano, {
  type: "Braid", lb: 15, dia_in: 0.008, custom_line: true
});
const databaseRange = core.calculateBraidCapacityRange(shimano, powerPro15);
assert.ok(customRange.uncertaintyRate > databaseRange.uncertaintyRate);

// 16-19: Product-aware main/backing offers, correct tag, and right-sized retail spools.
const mainOffer = affiliates.buildRecommendedLineOffer({
  affiliateData, line: powerPro15, requiredYards: 142
});
const backingOffer = affiliates.buildRecommendedLineOffer({
  affiliateData, line: trilene10, requiredYards: 73
});
assert.match(mainOffer.query, /PowerPro Spectra 15 lb braided fishing line 150 yard spool/i);
assert.match(backingOffer.query, /Berkley Trilene XL 10 lb monofilament fishing line 100 yard spool/i);
assert.equal(new URL(mainOffer.url).searchParams.get("tag"), "reelcalc-20");
assert.equal(mainOffer.suggestedSpoolYards, 150);
assert.equal(backingOffer.suggestedSpoolYards, 100);

const mappedAffiliateData = structuredClone(affiliateData);
mappedAffiliateData.lineProducts[affiliates.lineProductKey(powerPro15)] = {
  offers: {
    amazon: {
      line: {
        url: "https://www.amazon.com/dp/B000TEST123?tag=reelcalc-20",
        matchType: "exact",
        label: "Check PowerPro Spectra Price on Amazon"
      }
    }
  }
};
const mappedOffer = affiliates.buildRecommendedLineOffer({
  affiliateData: mappedAffiliateData, line: powerPro15, requiredYards: 142
});
assert.equal(mappedOffer.matchType, "exact");
assert.match(mappedOffer.url, /\/dp\/B000TEST123/);

const customOffer = affiliates.buildRecommendedLineOffer({
  affiliateData,
  line: { id: "custom", brand: "Custom", model: "Braid", type: "Braid", lb: 15, dia_in: 0.008, custom_line: true },
  requiredYards: 142
});
assert.doesNotMatch(customOffer.label, /Custom Braid/i);

// 20: Standard/metric conversions round-trip safely.
assert.ok(Math.abs(core.metersToYards(core.yardsToMeters(150)) - 150) < 0.0001);
assert.ok(Math.abs(core.mmToInches(core.inchesToMm(0.008)) - 0.008) < 0.000001);
assert.ok(Math.abs(core.kgToLb(core.lbToKg(15)) - 15) < 0.0001);

// 21: Existing reel preload is untouched; optional line/mode preload is supported.
const preload = selector.parsePreload("?reel=ignored-here&mainLine=powerpro-spectra-braid-15&backingLine=berkley-trilene-xl-monofilament-10&mainYards=150&mode=capacity");
assert.equal(preload.mainLineId, powerPro15.id);
assert.equal(preload.backingLineId, trilene10.id);
assert.equal(preload.mainLineYards, 150);
assert.equal(preload.mode, "capacity");

// 22-23: Shared component contains mobile rules and all page systems still load that one component.
const calculatorSource = read("js/reel-page-calculator.js");
const loaderSource = read("js/squarespace-reel-page-loader.js");
const wizardSource = read("js/wizard.js");
assert.match(calculatorSource, /@media\(max-width:520px\)/);
assert.match(calculatorSource, /lineSelectorTemplate\("main", "Main Line"/);
assert.match(calculatorSource, /lineSelectorTemplate\("backing", "Backing Line"/);
assert.match(calculatorSource, /data\/lines\.json/);
assert.match(calculatorSource, /Best full-spool estimate/);
assert.match(calculatorSource, /Expected real-world range/);
assert.match(calculatorSource, /capacityBasisForActualLine\(reel, mainLine, preparedLines\)/);
assert.match(calculatorSource, /calculateActualLineCalibratedBacking\(reel, mainLine, desiredYards, backingLine, preparedLines\)/);
assert.match(calculatorSource, /Plan for up to/);
assert.match(wizardSource, /calculateActualLineCalibratedBacking\(reel, line, desired, backing, state\.lines\)/);
assert.match(wizardSource, /capacityBasisForActualLine\(reel, line, state\.lines\)/);
assert.match(wizardSource, /Best full-spool estimate/);
assert.match(wizardSource, /How to use the range/);
assert.match(loaderSource, /js\/reel-page-calculator\.js/);
const rendererPath = path.join(root, "scripts/reel-pages/render.mjs");
if (fs.existsSync(rendererPath)) {
  assert.match(fs.readFileSync(rendererPath, "utf8"), /js\/reel-page-calculator\.js/);
}

console.log("Reel-page actual-line selection tests passed.");
console.log(`- ${lines.length} valid central line records are available to both selectors`);
console.log("- Mono/fluoro, exact braid, interpolated braid, and labeled braid fallback passed");
console.log("- Capacity-only, mixed-line backing, custom line, affiliates, preloads, and units passed");
