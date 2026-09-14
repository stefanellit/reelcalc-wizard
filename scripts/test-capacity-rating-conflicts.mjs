import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const reels = JSON.parse(read("data/reels.json"));
const lines = JSON.parse(read("data/lines.json"));
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(read("js/calculator-core.js"), sandbox);
vm.runInContext(read("js/line-selector.js"), sandbox);
const core = sandbox.window.ReelCalcCore;
const prepared = sandbox.window.ReelCalcLineSelector.prepareLines(lines);
const assess = (reel, catalog = lines) => core.assessReelCapacityRatings(reel, catalog);
const bg = reels.find(reel => reel.id === "daiwa-bg-lt-3000d-xh");
assert.ok(bg);
assert.equal(bg.capacity_note, "10-280, 12-220");
assert.equal(bg.braid_capacity_note, "15-250, 20-220");
assert.equal(bg.sku, "BGLT3000D-XH");
assert.equal(assess(bg).warning, true);
assert.ok(Math.abs(assess(bg).separatedRatio - 403.2 / 178.2) < 1e-9);
assert.ok(Math.abs(core.calculateFullSpoolCapacity(bg, { type: "Fluorocarbon", lb: 10, dia_in: 0.01 }) - 431.2) < 1e-9);
assert.ok(Math.abs(core.calculateFullSpoolCapacity(bg, { type: "Braid", lb: 20, dia_in: 0.01 }, { lineCatalog: lines }) - 169.1) < 1e-9);

const fixture = {
  brand: "Daiwa", id: "fixture", capacity_yards: 200, rated_line_diameter_in: 0.01,
  braid_capacity_note: "20-100", capacity_options: []
};
const catalog = [{ id: "braid-20", brand: "Test", model: "Braid", type: "Braid", lb: 20, dia_in: 0.01 }];
assert.equal(assess(fixture, catalog).warning, true, "Exact 2x boundary");
assert.equal(assess({ ...fixture, capacity_yards: 199 }, catalog).warning, false, "Below threshold");
assert.equal(assess({ ...fixture, capacity_yards: 50 }, catalog).warning, true, "Opposite direction");
assert.equal(assess({ ...fixture, capacity_options: [{ yards: 110, diameter_in: 0.01 }] }, catalog).warning, false, "Closer usable mono anchor prevents warning");
assert.equal(assess({ ...fixture, braid_capacity_note: "20-100, 30-200" }, [...catalog, { ...catalog[0], id: "braid-30", lb: 30 }]).warning, false, "Overlapping bands");
assert.equal(assess({ ...fixture, capacity_options: [null, {}, { yards: -1, diameter_in: -0.01 }] }, catalog).warning, true, "Ignore malformed anchors");
for (const reel of [null, {}, { ...bg, id: "manual-reel" }, { ...bg, manualRating: {} }, { ...bg, capacity_reference_type: "braid" }, { ...bg, braid_capacity_note: "Unknown" }]) {
  assert.equal(assess(reel), null, "Unavailable or manual reference must not be judged");
}
assert.equal(assess(bg, []), null);
const pe = assess({ ...fixture, capacity_yards: 1000, braid_capacity_note: "PE 1-100m" }, catalog);
assert.ok(pe && pe.warning);
assert.equal(pe.braidReferenceQuality, "published-pe-diameter");
assert.ok(Math.abs(pe.braidMinimumYards - 100 * core.YARDS_PER_METER * (0.165 / 25.4 / 0.01) ** 2) < 1e-9);

const before = JSON.stringify({ reels, lines });
let eligible = 0;
const flagged = [];
for (const reel of reels) {
  const result = assess(reel);
  assert.deepEqual(result, assess(reel, prepared), `Raw/prepared catalog mismatch: ${reel.id}`);
  if (!result) continue;
  eligible++;
  assert.ok(Number.isFinite(result.separatedRatio));
  if (result.warning) flagged.push({
    id: reel.id, brand: reel.brand, model: reel.model, size: reel.size_label,
    monoRating: reel.capacity_note, braidRating: reel.braid_capacity_note,
    sourceUrl: reel.source_url || "", ...result
  });
}
assert.equal(JSON.stringify({ reels, lines }), before, "Assessment must not mutate reel or line data");
const fierce = reels.find(reel => /penn-fierce-iv-8000/.test(reel.id));
assert.ok(fierce && assess(fierce) && !assess(fierce).warning, "PENN Fierce IV control");
for (const file of ["js/wizard.js", "js/reel-page-calculator.js", "js/line-page-engine.js", "examples/reel-comparison.js"]) {
  assert.match(read(file), /assessReelCapacityRatings\(/, `${file} must use the shared check`);
  assert.match(read(file), /data-capacity-rating-warning/, `${file} must display the warning`);
  new vm.Script(read(file), { filename: file });
}
assert.match(read("index.html"), /Lines with Similar Diameters/);
assert.match(read("css/line-page-embed.css"), /\.rc-line-page \.rc-rating-warning/);
console.log(`PASS: ${reels.length} reels checked; ${eligible} assessable; ${flagged.length} large conflicts. Edge cases, unchanged BG capacities, raw/prepared parity, non-mutation and all four UI integrations passed.`);

if (process.argv.includes("--report")) {
  const dir = path.join(root, "reports/capacity-rating-conflicts");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "audit.json"), JSON.stringify({
    checkedAt: new Date().toISOString(), total: reels.length, eligible, flagged: flagged.length,
    rule: "Normalize usable mono references and strongest braid references to .010 in; warn only when the closest edges differ by at least 2x. Screening threshold, not a validated physical tolerance.",
    limitations: "These are conflicts under ReelCalc reference-diameter assumptions, not confirmed manufacturer errors. Missing-data and braid-only reels are unassessed, not certified accurate. Sizes and retrieve variants count separately. No calculation outputs or catalog ratings were changed.",
    verifiedSource: {
      url: "https://daiwa.us/collections/spin-reels/products/bg-copy",
      observedRows: [
        { sku: "BGLT2500D-XH", monoLbYd: "8/240, 10/210", braidLbYd: "10/250, 15/185" },
        { sku: "BGLT3000D-XH", monoLbYd: "10/280, 12/220", braidLbYd: "15/250, 20/220" },
        { sku: "BGLT4000D-CXH", monoLbYd: "10/360, 14/250", braidLbYd: "20/280, 30/200" }
      ],
      note: "Official dynamic specification table checked in browser; exact reference diameters are not stated. Other flagged models require individual source review before any data correction."
    },
    reels: flagged
  }, null, 2) + "\n");
  fs.writeFileSync(path.join(dir, "README.md"), `# Capacity-Rating Conflict Audit\n\n${flagged.length} of ${reels.length} reel entries flagged; ${eligible} had both usable references. Sizes and retrieve variants count separately.\n\nThe check compares the estimates from mono and braid ratings at the same .010-inch diameter. It warns only when even the closest usable estimates differ by at least twofold. This is a cautious screening rule, not proof of incorrect manufacturer specifications. Unknown reference diameters and catalog assumptions can produce the gap. No calculations or ratings were changed.\n\n## Verified Example\n\n[Daiwa's official 2026 BG LT table](https://daiwa.us/collections/spin-reels/products/bg-copy) matches all three BG LT database entries. For BGLT3000D-XH, mono is 10 lb/280 yd and 12 lb/220 yd; J-Braid is 15 lb/250 yd and 20 lb/220 yd.\n\nAt .010 inch, the current mono anchors imply 403.2-431.2 yd; the braid anchors imply 160-178.2 yd. The closest estimates differ by 2.26x. The regular mono result remains 431.2 yd and the regular braid center remains 169.1 yd. Neither is a physically verified fill amount.\n\n## Warning Coverage\n\nWizard capacity and backing results, its similar-diameter comparisons, reel-page calculators, line-page setup calculators, and the reel-comparison calculator. Manually entered single ratings and braid-only reference reels are not assessed. The manual homepage calculator has no catalog reel identity and is unchanged.\n\n## Other Flagged Entries\n\nFull audit data is in audit.json. These entries are candidates for source checks or physical testing, not confirmed misprints.\n\n| Reel | Closest estimate ratio |\n| --- | ---: |\n${flagged.map(r => `| ${[r.brand, r.model, r.size].filter(Boolean).join(" ").replaceAll("|", "/")} | ${r.separatedRatio.toFixed(2)}x |`).join("\n")}\n`);
}
