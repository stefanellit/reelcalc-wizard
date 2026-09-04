import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const sourcePath = path.join(
  root,
  "examples",
  "reel-tests",
  "penn-fierce-iv-8000-line-capacity-test.html"
);
const outputDir = path.join(root, "generated", "reel-tests");
const outputPath = path.join(
  outputDir,
  "penn-fierce-iv-8000-line-capacity-test-squarespace.html"
);
const blogOutputPath = path.join(
  outputDir,
  "penn-fierce-iv-8000-line-capacity-test-squarespace-blog.html"
);
const seoPath = path.join(
  outputDir,
  "penn-fierce-iv-8000-line-capacity-test-seo.txt"
);

const html = await fs.readFile(sourcePath, "utf8");
const schemaMatch = html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/);
const articleMatch = html.match(
  /<!-- REELCALC_REAL_WORLD_TEST_START -->([\s\S]*?)<!-- REELCALC_REAL_WORLD_TEST_END -->/
);

if (!schemaMatch || !articleMatch) {
  throw new Error("Could not find the Real-World Test article or structured data.");
}

const assetBase = "https://stefanellit.github.io/reelcalc-wizard/";
const pageTitle = "Penn Fierce IV 8000 Real-World Spool Test: 300 Yards of 30 lb Braid + Mono Backing";
const testId = "reelcalc-real-world-test-001";
const sharedParts = [
  "<!-- ReelCalc Real-World Test #001: Penn Fierce IV 8000 -->",
  `<link rel="stylesheet" href="${assetBase}css/real-world-test.css?v=1">`,
  schemaMatch[0],
  articleMatch[1].trim(),
  `<script src="${assetBase}js/reel-page-runtime.js" data-asset-base="${assetBase}"></script>`,
  `<script src="${assetBase}js/real-world-test-runtime.js" data-asset-base="${assetBase}"></script>`
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
  "Penn Fierce IV 8000 Real-World Spool Test: 300 Yards of 30 lb Braid + Mono Backing",
  "",
  "SEO TITLE",
  "Penn Fierce IV 8000 Line Capacity Test: 30 lb Braid + Backing | ReelCalc",
  "",
  "META DESCRIPTION",
  "We spooled a Penn Fierce IV 8000 with 300 yd of 30 lb braid and 200 yd of measured mono backing. Compare ReelCalc's prediction with the actual result.",
  "",
  "URL SLUG",
  "penn-fierce-iv-8000-line-capacity-test",
  "",
  "CANONICAL URL",
  "https://www.reelcalc.com/reel-tests/penn-fierce-iv-8000-line-capacity-test",
  ""
].join("\n");

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(outputPath, snippet, "utf8");
await fs.writeFile(blogOutputPath, blogSnippet, "utf8");
await fs.writeFile(seoPath, seo, "utf8");

console.log(JSON.stringify({ outputPath, blogOutputPath, seoPath }, null, 2));
