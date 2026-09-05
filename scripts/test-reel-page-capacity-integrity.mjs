import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { generateReelPage } from "./generate-reel-page.mjs";
import { normalizeReel } from "./reel-pages/lookup.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) => JSON.parse(
  fs.readFileSync(path.join(root, relativePath), "utf8")
);
const reels = readJson("data/reels.json");
const registry = readJson("data/reel-pages.json");
const manifest = readJson("data/reel-page-embeds.json");
const coreSandbox = { window: {} };
vm.runInNewContext(
  fs.readFileSync(path.join(root, "js", "calculator-core.js"), "utf8"),
  coreSandbox
);
const core = coreSandbox.window.ReelCalcCore;

let parserParityCount = 0;
for (const raw of reels) {
  const requiresYardsFirstSlash = ["okuma", "pflueger", "quantum"].includes(
    String(raw.brand || "").trim().toLowerCase()
  ) && /\d+\s*\/\s*\d+/.test(String(raw.braid_capacity_note || ""));
  if (!requiresYardsFirstSlash) continue;
  const normalized = normalizeReel(raw);
  const pagePairs = normalized.braidCapacities
    .filter((row) => row.ratingType === "lb")
    .map((row) => [row.lb, row.yards]);
  const calculatorPairs = Array.from(core.publishedBraidCapacityOptions(raw))
    .map((row) => [row.lb, row.yards]);
  assert.deepEqual(
    pagePairs,
    calculatorPairs,
    `${raw.id}: reel page and calculator interpret the braid capacity differently.`
  );
  parserParityCount += 1;
}

let publishedPageCount = 0;
for (const page of registry.pages) {
  const slug = page.path.split("/").filter(Boolean).at(-1);
  const entry = manifest.pages[slug];
  assert.ok(entry, `${page.reelId}: live page manifest entry is missing.`);

  const generated = generateReelPage(page.reelId);
  assert.equal(generated.status, "generated", `${page.reelId}: page could not be generated.`);
  assert.deepEqual(
    entry.content?.capacityRows,
    generated.model.capacityRows,
    `${page.reelId}: live capacity table is stale or differs from the generator.`
  );
  assert.equal(
    entry.content?.monoText,
    generated.model.monoText,
    `${page.reelId}: live mono capacity text is stale.`
  );
  assert.equal(
    entry.content?.braidText,
    generated.model.braidText,
    `${page.reelId}: live braid capacity text is stale.`
  );
  assert.equal(
    entry.content?.faqCapacity,
    generated.model.faqCapacity,
    `${page.reelId}: live capacity FAQ is stale.`
  );
  assert.deepEqual(
    entry.realWorldTest || null,
    generated.model.realWorldTest || null,
    `${page.reelId}: real-world test link differs from the generator.`
  );
  publishedPageCount += 1;
}

const avenger = generateReelPage("okuma-avenger-b-4000-av-4000b-380");
assert.equal(avenger.model.braidText, "30 lb / 210 yards, 40 lb / 180 yards");
assert.doesNotMatch(avenger.productionBlock, /210 lb \/ 30 yards|180 lb \/ 40 yards/);

const pennTestPage = generateReelPage("penn-fierce-iv-8000-frciv8000-474");
assert.match(pennTestPage.productionBlock, /data-section="real-world-test"/);
assert.match(pennTestPage.productionBlock, /penn-fierce-iv-8000-line-capacity-test/);
assert.equal((pennTestPage.productionBlock.match(/data-section="real-world-test"/g) || []).length, 1);

const vanfordTestPage = generateReelPage("shimano-vanford-fa-c3000xga-vfc3000xga-692");
assert.match(vanfordTestPage.productionBlock, /earlier-generation Vanford C3000XG/);
assert.match(vanfordTestPage.productionBlock, /shimano-vanford-c3000xg-fluorocarbon-respool-test/);
assert.equal((vanfordTestPage.productionBlock.match(/data-section="real-world-test"/g) || []).length, 1);

const loaderSource = fs.readFileSync(
  path.join(root, "js", "squarespace-reel-page-loader.js"),
  "utf8"
);
assert.match(loaderSource, /line-capacity/);
assert.match(loaderSource, /content\.capacityRows/);
assert.match(loaderSource, /content\.braidText/);
assert.match(loaderSource, /reel-page-embeds\.json\?v=9/);
assert.match(loaderSource, /insertRealWorldTest/);

const wizardSource = fs.readFileSync(path.join(root, "js", "wizard.js"), "utf8");
assert.match(wizardSource, /publishedBraidCapacityOptions/);
assert.match(wizardSource, /Braid capacity/);
assert.match(wizardSource, /formatPublishedBraidNote/);

console.log("Reel-page capacity integrity audit passed.");
console.log(`- Calculator/page parser parity: ${parserParityCount} braid-rated reel records`);
console.log(`- Live manifest parity: ${publishedPageCount} published reel pages`);
console.log("- Okuma Avenger B 4000 regression: 30 lb / 210 yards and 40 lb / 180 yards");
