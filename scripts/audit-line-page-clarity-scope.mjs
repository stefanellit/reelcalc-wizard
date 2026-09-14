import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { parseFragment, serializeOuter } from "./line-page-publishing/node_modules/parse5/dist/index.js";

const baseline = "8436241";
const read = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const original = file => execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8", maxBuffer: 25 * 1024 * 1024 }).replace(/\r\n/g, "\n");
const before = JSON.parse(original("data/line-page-products.json"));
const after = JSON.parse(read("data/line-page-products.json"));
const allowed = new Set(["quickSummary", "chartNote", "sourceNote", "strengthGuide", "spoolingGuide", "productGuidance", "faqs", "sources"]);
const changes = [];
const nodes = n => [n, ...(n.childNodes || []).flatMap(nodes)];
const tables = html => nodes(parseFragment(html)).filter(n => n.tagName === "table").map(serializeOuter);
assert.deepEqual(Object.keys(after.products), Object.keys(before.products));
for (const [id, product] of Object.entries(after.products)) {
  const old = before.products[id];
  const fields = Object.keys(product).filter(key => JSON.stringify(product[key]) !== JSON.stringify(old[key]));
  assert.deepEqual(Object.keys(product), Object.keys(old));
  for (const field of fields) assert(allowed.has(field), `${id}: unexpected ${field} change`);
  assert.deepEqual(product.sources.map(({ note, label, ...source }) => source), old.sources.map(({ note, label, ...source }) => source), `${id}: source changed beyond wording`);
  if (fields.length) changes.push({ id, fields });
  for (const directory of ["examples/line-pages", "components/line-pages"]) {
    const file = `${directory}/${id}.html`;
    assert.deepEqual(tables(read(file)), tables(original(file)), `${file}: specification table changed`);
  }
}
const protectedFiles = ["data/lines.json", "data/pe-lines.json", "data/reels.json", "js/calculator-core.js", "js/recommendation-engine.js", "data/line-guide-links.json", "js/affiliate-links.js", "data/reel-affiliates.json"];
for (const file of protectedFiles) assert.equal(read(file), original(file), `${file}: protected data or logic changed`);
const functions = source => new Map([...source.matchAll(/^    function (\w+)\([^]*?(?=^    function |^  \}|$(?![^]))/gm)].map(match => [match[1], match[0]]));
const oldFunctions = functions(original("js/line-page-engine.js"));
const newFunctions = functions(read("js/line-page-engine.js"));
const allowedFunctions = new Set(["cacheElements", "bindInteractiveEvents", "populateSpools", "renderSelectedLineOffer", "updateCalculateState", "lineOfferLink", "bindLineOfferLinks"]);
const changedFunctions = [];
for (const [name, code] of newFunctions) {
  if (code !== oldFunctions.get(name)) {
    assert(allowedFunctions.has(name), `Unexpected engine function change: ${name}`);
    changedFunctions.push(name);
  }
}
for (const name of ["calculateSetup", "fullCapacity", "readManualReel"]) {
  assert(newFunctions.has(name), `Function parser missed ${name}`);
  assert.equal(newFunctions.get(name), oldFunctions.get(name));
}
const report = { passed: true, baseline, pagesChecked: Object.keys(after.products).length,
  mainlinePages: Object.values(after.products).filter(p => p.role !== "leader").length,
  editorialPagesChanged: changes.length, tableCopiesUnchanged: Object.keys(after.products).length * 2,
  protectedFiles, changedFunctions, changes };
fs.mkdirSync("reports/line-page-clarity", { recursive: true });
fs.writeFileSync("reports/line-page-clarity/scope.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, changes: undefined }));
