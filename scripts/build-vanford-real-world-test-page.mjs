import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const slug = "shimano-vanford-c3000xg-fluorocarbon-respool-test";
const sourcePath = path.join(root, "examples", "reel-tests", `${slug}.html`);
const outputDir = path.join(root, "generated", "reel-tests");
const outputPath = path.join(outputDir, `${slug}-squarespace.html`);
const blogOutputPath = path.join(outputDir, `${slug}-squarespace-blog.html`);
const seoPath = path.join(outputDir, `${slug}-seo.txt`);

const html = await fs.readFile(sourcePath, "utf8");
const schemaMatch = html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/);
const articleMatch = html.match(
  /<!-- REELCALC_REAL_WORLD_TEST_START -->([\s\S]*?)<!-- REELCALC_REAL_WORLD_TEST_END -->/
);

if (!schemaMatch || !articleMatch) {
  throw new Error("Could not find the Vanford Real-World Test article or structured data.");
}

const assetBase = "https://stefanellit.github.io/reelcalc-wizard/";
const pageTitle = "Shimano Vanford C3000XG Real-World Re-Spool Test: 65 Yards of 10 lb Fluorocarbon";
const testId = "reelcalc-real-world-test-002";
const sharedParts = [
  "<!-- ReelCalc Real-World Test #002: Shimano Vanford C3000XG -->",
  `<link rel="stylesheet" href="${assetBase}css/real-world-test.css?v=2">`,
  schemaMatch[0],
  articleMatch[1].trim(),
  `<script src="${assetBase}js/reel-page-runtime.js?v=2" data-asset-base="${assetBase}"></script>`,
  `<script src="${assetBase}js/affiliate-links.js?v=2"></script>`,
  `<script src="${assetBase}js/real-world-test-runtime.js?v=2" data-asset-base="${assetBase}"></script>`
];
const snippet = [...sharedParts, ""].join("\n");
const blogCompatibility = `
<!-- Keeps the ReelCalc article heading and removes Squarespace's duplicate post header on this post only. -->
<style>
body.view-item:has(.reelcalc-real-world-test[data-test-id="${testId}"]) .blog-item-top-wrapper {
  display: none !important;
}
</style>
<script>
(() => {
  const testPage = document.querySelector('.reelcalc-real-world-test[data-test-id="${testId}"]');
  if (!testPage) return;

  const nativeTitle = Array.from(
    document.querySelectorAll('h1.entry-title[data-content-field="title"]')
  ).find((heading) => heading.textContent.trim() === ${JSON.stringify(pageTitle)});

  if (!nativeTitle || testPage.contains(nativeTitle)) return;
  const nativeHeader = nativeTitle.closest('.blog-item-top-wrapper');
  if (nativeHeader) nativeHeader.remove();
  else nativeTitle.closest('.blog-item-title')?.remove();
})();
</script>`;
const blogSnippet = [...sharedParts, blogCompatibility.trim(), ""].join("\n");

const seo = [
  "PAGE TITLE / H1",
  "Shimano Vanford C3000XG Real-World Re-Spool Test: 65 Yards of 10 lb Fluorocarbon",
  "",
  "SEO TITLE",
  "Shimano Vanford C3000XG Re-Spool Test: 10 lb Fluorocarbon | ReelCalc",
  "",
  "META DESCRIPTION",
  "See how a Shimano Vanford C3000XG was re-spooled with 65 yards of 10 lb Seaguar InvizX while its existing ReelCalc-planned backing stayed in place.",
  "",
  "URL SLUG",
  slug,
  "",
  "CANONICAL URL",
  `https://www.reelcalc.com/reel-tests/${slug}`,
  ""
].join("\n");

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(outputPath, snippet, "utf8");
await fs.writeFile(blogOutputPath, blogSnippet, "utf8");
await fs.writeFile(seoPath, seo, "utf8");

console.log(JSON.stringify({ outputPath, blogOutputPath, seoPath }, null, 2));
