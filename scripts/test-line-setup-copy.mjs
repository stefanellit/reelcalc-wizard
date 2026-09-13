import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const baseline = "120b20a";
const original = file => execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
const before = JSON.parse(original("data/line-page-products.json"));
const after = JSON.parse(fs.readFileSync("data/line-page-products.json", "utf8"));
const allowed = new Set(["suitabilitySummary", "bestFit", "quickSummary", "construction", "strengthGuide", "spoolingGuide", "faqs", "chartNote", "sourceNote", "productGuidance"]);
const changes = [];
assert.deepEqual(Object.keys(after.products), Object.keys(before.products));
for (const [id, product] of Object.entries(after.products)) {
  const old = before.products[id];
  const fields = Object.keys(product).filter(field => JSON.stringify(product[field]) !== JSON.stringify(old[field]));
  for (const field of fields) assert(allowed.has(field), `${id}: unexpected field change ${field}`);
  assert.deepEqual(Object.keys(product), Object.keys(old));
  if (fields.length) changes.push({ id, fields, before: Object.fromEntries(fields.map(key => [key, old[key]])), after: Object.fromEntries(fields.map(key => [key, product[key]])) });
  assert(!/do not promise a measured|does not certify abrasion|not (?:a |an )?(?:measured|independently proven) (?:casting|handling)|no independent handling advantage/i.test(product.suitabilitySummary), id);
}
const grand = after.products["daiwa-j-braid-grand-x8"];
for (const id of Object.keys(after.products)) {
  for (const directory of ["examples/line-pages", "components/line-pages"]) {
    const path = `${directory}/${id}.html`;
    const current = fs.readFileSync(path, "utf8");
    const old = original(path);
    assert.deepEqual(current.match(/<table\b[\s\S]*?<\/table>/g), old.match(/<table\b[\s\S]*?<\/table>/g), `${path}: specification table changed`);
  }
}
assert(!/gray|grey|color|sku|promise|advantage/i.test(grand.quickSummary + grand.suitabilitySummary + grand.construction));
assert(grand.chartNote.includes("US Gray Light"), "Preserve the actual specification scope");
assert(grand.sourceNote.includes("Dark Green 100 lb"), "Keep unresolved specification differences documented");
assert.deepEqual(grand.excludedLineIds, before.products["daiwa-j-braid-grand-x8"].excludedLineIds);
for (const file of ["data/lines.json", "data/pe-lines.json", "js/calculator-core.js", "js/recommendation-engine.js", "js/line-page-engine.js", "data/line-guide-links.json"]) {
  assert.equal(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n"), original(file).replace(/\r\n/g, "\n"), `${file}: unrelated data or logic changed`);
}
const report = { baseline, productsReviewed: Object.keys(after.products).length, changedPages: changes.length,
  setupSectionsRewritten: changes.filter(c => c.fields.includes("suitabilitySummary")).length,
  protectedSpecificationsAndCalculatorLogic: "unchanged", changes };
fs.mkdirSync("reports/line-setup-copy", { recursive: true });
fs.writeFileSync("reports/line-setup-copy/changes.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ passed: true, productsReviewed: report.productsReviewed, changedPages: report.changedPages,
  setupSectionsRewritten: report.setupSectionsRewritten, protectedSpecificationsAndCalculatorLogic: report.protectedSpecificationsAndCalculatorLogic }));
