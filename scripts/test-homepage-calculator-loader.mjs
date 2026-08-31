import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const loader = read("js/homepage-calculator-v2-loader.js");
const core = read("js/calculator-core.js");
const calculator = read("js/homepage-calculator-v2.js");
const stylesheet = read("css/homepage-calculator-v2.css");
const template = read("components/homepage-calculator-v2.html");
const release = JSON.parse(read("data/homepage-calculator-release.json"));
const snippet = read("docs/homepage-calculator-squarespace-snippet.html");
assert.match(snippet, /id="reelcalc-homepage-calculator-app"/);
assert.match(snippet, /stefanellit\.github\.io\/reelcalc-wizard\/js\/homepage-calculator-v2-loader\.js/);
assert.doesNotMatch(snippet, /data-version|homepage-calculator-v2-loader\.js\?v=/);
assert.doesNotMatch(snippet, /<style|calculator-container|function\s+calculate/i);

assert.match(loader, /components\/homepage-calculator-v2\.html/);
assert.match(loader, /css\/homepage-calculator-v2\.css/);
assert.match(loader, /js\/homepage-calculator-v2\.js/);
assert.match(loader, /js\/calculator-core\.js/);
assert.match(loader, /data\/homepage-calculator-release\.json/);
assert.match(loader, /could not load/i);
assert.equal(release.version, "2");

assert.match(template, /id="reelcalc-homepage-calculator"/);
assert.match(template, /id="feedbackHelpful"/);
assert.match(template, /id="copyResultsButton"/);
assert.doesNotMatch(template, /<script|<style/i);

assert.match(stylesheet, /#reelcalc-homepage-calculator/);
assert.match(stylesheet, /@media\s*\(max-width:\s*520px\)/);
assert.match(calculator, /window\.ReelCalcHomepageCalculator/);
assert.match(calculator, /window\.ReelCalcCore/);
assert.match(calculator, /reelcalcInitialized/);
assert.match(core, /dual-anchor-fraction/);

console.log("Homepage calculator GitHub loader package passed.");
console.log("- Snippet contains only the mount point and shared loader");
console.log("- External template, styles, calculator, feedback, and copy controls are present");
