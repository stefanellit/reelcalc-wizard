import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const pagePath = path.join(
  root,
  "examples",
  "reel-tests",
  "shimano-vanford-c3000xg-fluorocarbon-respool-test.html"
);
const dataPath = path.join(root, "data", "real-world-tests.json");
const linesPath = path.join(root, "data", "lines.json");
const calculatorCorePath = path.join(root, "js", "calculator-core.js");
const imageDir = path.join(root, "assets", "real-world-tests", "shimano-vanford-c3000xg");
const generatedPath = path.join(
  root,
  "generated",
  "reel-tests",
  "shimano-vanford-c3000xg-fluorocarbon-respool-test-squarespace.html"
);
const blogGeneratedPath = path.join(
  root,
  "generated",
  "reel-tests",
  "shimano-vanford-c3000xg-fluorocarbon-respool-test-squarespace-blog.html"
);

const [html, dataText, linesText, calculatorCoreSource, generated, blogGenerated] = await Promise.all([
  fs.readFile(pagePath, "utf8"),
  fs.readFile(dataPath, "utf8"),
  fs.readFile(linesPath, "utf8"),
  fs.readFile(calculatorCorePath, "utf8"),
  fs.readFile(generatedPath, "utf8"),
  fs.readFile(blogGeneratedPath, "utf8")
]);
const data = JSON.parse(dataText);
const lines = JSON.parse(linesText);
const test = data.tests.find((entry) => entry.id === "reelcalc-real-world-test-002");

assert.ok(test, "Test #002 record must exist");
assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, "Page must have one H1");
assert.match(html, /shimano-vanford-c3000xg-fluorocarbon-respool-test/, "Canonical slug must be present");
assert.match(html, /Shimano Vanford C3000XG/, "Exact photographed reel marking must be used");
assert.doesNotMatch(html, /physically tested[^.]*C3000XGA/i, "The tested reel must not be called C3000XGA");
assert.match(html, /65 yd \+ 65 yd \+ 65 yd = 195 yd/, "Three-fill plan must be explicit");
assert.match(html, /not an empty-spool installation/i, "Existing-backing scenario must be explicit");
assert.match(html, /not used for this refill/i, "Line-counter limitation must be explicit");
assert.match(html, /Uni-to-Uni knot/, "Connection knot must be named");
assert.match(html, /About 95 yd/, "Rounded backing plan must appear in the result summary");
assert.match(html, /94\.9 yards, rounded here to about 95 yards/, "Exact calculation and displayed rounding must be explained");
assert.match(html, /Berkley Trilene Big Game/, "Exact backing product must be named");
assert.match(html, /was not physically remeasured during it/, "Calculated backing must not be presented as a new measurement");
assert.equal((html.match(/class="rc-test-step"/g) || []).length, 7, "Process must have seven steps");
assert.match(html, /data-real-world-line-affiliate/, "Reusable line affiliate mount must be present");
assert.match(generated, /js\/affiliate-links\.js\?v=2/, "Squarespace build must load reusable affiliate logic");
assert.match(generated, /js\/real-world-test-runtime\.js\?v=2/, "Squarespace build must load the current test runtime");
assert.match(generated, /data-asset-base="https:\/\/stefanellit\.github\.io\/reelcalc-wizard\/"/, "Squarespace build must use the hosted asset base");
assert.equal((blogGenerated.match(/<h1(?:\s|>)/g) || []).length, 1, "Blog snippet must contain one ReelCalc H1");
assert.match(blogGenerated, /data-test-id="reelcalc-real-world-test-002"/, "Blog compatibility must target this test only");
assert.match(blogGenerated, /nativeHeader\.remove\(\)/, "Blog compatibility must remove the duplicate Squarespace header");
assert.match(blogGenerated, /Shimano Vanford C3000XG Real-World Re-Spool Test: 65 Yards of 10 lb Fluorocarbon/, "Blog compatibility must verify the exact page title");
assert.doesNotMatch(blogGenerated, /<!doctype|<html(?:\s|>)/i, "Blog snippet must remain an embeddable fragment");
assert.doesNotMatch(html, /backing was (?:newly )?installed|installed (?:new )?backing/i, "Backing must not be described as newly installed");
assert.match(html, /not a claim that every angler should use the same amount/i, "65-yard limitation must be explicit");
assert.match(html, /does not make visual guessing a substitute/i, "Line-counter limitation must be explicit");
assert.doesNotMatch(html, /undefined|\bTBD\b|\bTODO\b/i, "Page must not contain unfinished values");

const hrefs = Array.from(html.matchAll(/href="([^"]+)"/g), (match) => match[1]);
assert.ok(hrefs.length >= 10, "Page must include the expected source, CTA, and internal links");
assert.ok(hrefs.every((href) => href && !/^javascript:/i.test(href) && href !== "#"), "Every page link must have a usable destination");
assert.ok(hrefs.includes("/lines/seaguar-invizx-fluorocarbon-diameter-capacity-guide"), "InvizX guide link must use its published path");
assert.ok(hrefs.includes("/blog/how-much-backing-do-i-need-on-a-fishing-reel"), "Backing article link must use its published path");

const schemaMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
assert.ok(schemaMatch, "JSON-LD block must be present");
assert.doesNotThrow(() => JSON.parse(schemaMatch[1]), "JSON-LD must parse");

assert.equal(test.mainLine.installedYards, 65);
assert.equal(test.mainLine.plannedFillCount * test.mainLine.plannedYardsPerFill, 195);
assert.equal(test.backing.removed, false);
assert.equal(test.backing.replaced, false);
assert.equal(test.backing.lineId, "berkley-trilene-big-game-monofilament-10");
assert.equal(test.backing.displayBackingYards, 95);
assert.equal(test.measurement.lineCounterUsed, false);
assert.equal(test.physicalResult.connectionKnot, "Uni-to-Uni knot");
assert.equal(test.images.length, 5);

const missingImages = [];
for (const image of test.images) {
  try {
    await fs.access(path.join(imageDir, image.file));
  } catch {
    missingImages.push(image.file);
  }
}
assert.deepEqual(missingImages, [], "Every recorded Vanford image must exist");

const coreContext = { window: {} };
vm.runInNewContext(calculatorCoreSource, coreContext);
const core = coreContext.window.ReelCalcCore;
const mainLine = lines.find((line) => line.id === test.mainLine.lineId);
const backingLine = lines.find((line) => line.id === test.backing.lineId);
const inputs = test.backing.calculationInputs;
const reelForCalculation = {
  capacity_yards: inputs.reelMonoRatingYards,
  rated_line_lb: inputs.reelMonoRatingLb,
  rated_line_diameter_in: inputs.reelMonoRatingDiameterIn,
  spool_space: inputs.reelMonoRatingYards * inputs.reelMonoRatingDiameterIn ** 2,
  capacity_status: "ready",
  reel_type: "front_drag_freshwater"
};
const backingCalculation = core.calculateActualLineCalibratedBacking(
  reelForCalculation,
  mainLine,
  inputs.mainLineYards,
  backingLine,
  lines
);
assert.ok(backingCalculation, "Shared engine must return a Vanford backing result");
assert.equal(Number(backingCalculation.backingYards.toFixed(1)), test.backing.reelCalcBackingYards);
assert.equal(core.ENGINE_VERSION, test.backing.calculationEngineVersion);

console.log(JSON.stringify({
  testId: test.id,
  status: "passed",
  checks: 45,
  imageCount: test.images.length,
  plannedRetailSpoolUseYards: test.mainLine.plannedTotalYards
}, null, 2));
