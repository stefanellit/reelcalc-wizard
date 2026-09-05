import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testsPath = path.join(root, "data", "real-world-tests.json");
const registryPath = path.join(root, "data", "reel-pages.json");
const manifestPath = path.join(root, "data", "reel-page-embeds.json");
const tests = JSON.parse(fs.readFileSync(testsPath, "utf8"));
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const linksByReelId = new Map();

for (const test of tests.tests || []) {
  for (const link of test.reelPageLinks || []) {
    if (linksByReelId.has(link.reelId)) {
      throw new Error(`More than one real-world test link targets ${link.reelId}.`);
    }
    linksByReelId.set(link.reelId, {
      testId: test.id,
      relationship: link.relationship,
      heading: link.heading,
      summary: link.summary,
      linkLabel: link.linkLabel,
      path: test.canonicalPath
    });
  }
}

let registryLinked = 0;
let registryCleared = 0;

for (const page of registry.pages) {
  const link = linksByReelId.get(page.reelId);
  if (link) {
    page.realWorldTest = link;
    registryLinked += 1;
  } else if (page.realWorldTest) {
    delete page.realWorldTest;
    registryCleared += 1;
  }
}

if (registryLinked !== linksByReelId.size) {
  const registeredIds = new Set(registry.pages.map((page) => page.reelId));
  const missing = [...linksByReelId.keys()].filter((reelId) => !registeredIds.has(reelId));
  throw new Error(`Real-world test links target unregistered reel pages: ${missing.join(", ")}`);
}

registry.version = 7;
fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

const pagesByReelId = new Map(registry.pages.map((page) => [page.reelId, page]));
let manifestLinked = 0;
let manifestCleared = 0;

Object.values(manifest.pages || {}).forEach((entry) => {
  const page = pagesByReelId.get(entry.reelId);
  if (page?.realWorldTest) {
    entry.realWorldTest = page.realWorldTest;
    manifestLinked += 1;
  } else if (entry.realWorldTest) {
    delete entry.realWorldTest;
    manifestCleared += 1;
  }
});

if (manifestLinked !== linksByReelId.size) {
  const manifestIds = new Set(Object.values(manifest.pages || {}).map((entry) => entry.reelId));
  const missing = [...linksByReelId.keys()].filter((reelId) => !manifestIds.has(reelId));
  throw new Error(`Real-world test links target reels missing from the live embed manifest: ${missing.join(", ")}`);
}

manifest.version = 9;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Synced ${registryLinked} real-world test link${registryLinked === 1 ? "" : "s"}.`);
const cleared = registryCleared + manifestCleared;
if (cleared) console.log(`Cleared ${cleared} stale real-world test link${cleared === 1 ? "" : "s"}.`);
