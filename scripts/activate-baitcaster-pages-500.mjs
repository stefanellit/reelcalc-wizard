import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "outputs", "reel-page-baitcaster-500");
const registryPath = path.join(outputDir, "ACTIVATE-AFTER-IMPORT-reel-pages.json");
const embedsPath = path.join(outputDir, "ACTIVATE-AFTER-IMPORT-reel-page-embeds.json");
const reviewPath = path.join(outputDir, "baitcaster-pages-review.json");

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const writeJson = (filePath, value) => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const registry = readJson(registryPath);
const embeds = readJson(embedsPath);
const review = readJson(reviewPath);
const imported = review.pages.filter((page) => page.status === "ready-to-import");
const importedIds = new Set(imported.map((page) => page.reelId));
const importedSlugs = new Set(imported.map((page) => page.pagePath.split("/").at(-1)));

if (imported.length !== 480) {
  throw new Error(`Expected 480 imported pages, found ${imported.length}.`);
}

let activated = 0;
registry.pages.forEach((page) => {
  if (!importedIds.has(page.reelId)) return;
  page.verifiedLive = true;
  activated += 1;
});

if (activated !== imported.length) {
  throw new Error(`Activated ${activated} registry pages; expected ${imported.length}.`);
}

for (const slug of importedSlugs) {
  if (!embeds.pages[slug]) throw new Error(`Missing embed entry for imported page: ${slug}`);
}

const activatedAt = new Date().toISOString();
registry.generatedAt = activatedAt;
embeds.generatedAt = activatedAt;

writeJson(registryPath, registry);
writeJson(embedsPath, embeds);
writeJson(path.join(root, "data", "reel-pages.json"), registry);
writeJson(path.join(root, "data", "reel-page-embeds.json"), embeds);

console.log(JSON.stringify({
  status: "ACTIVATED",
  importedPages: imported.length,
  totalRegistryPages: registry.pages.length,
  totalEmbedPages: Object.keys(embeds.pages).length,
  activatedAt
}, null, 2));
