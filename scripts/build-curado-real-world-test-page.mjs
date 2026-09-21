import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const slug = "shimano-curado-200hg-mono-respool-test";
const testId = "reelcalc-real-world-test-003";
const pageTitle = "Shimano Curado 200 M HG Real-World Re-Spool Test";
const assetBase = "https://stefanellit.github.io/reelcalc-wizard/";
const outputDir = path.join(root, "generated", "reel-tests");
const html = await fs.readFile(path.join(root, "examples", "reel-tests", `${slug}.html`), "utf8");
const schema = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
const article = html.match(/<!-- REELCALC_REAL_WORLD_TEST_START -->([\s\S]*?)<!-- REELCALC_REAL_WORLD_TEST_END -->/);
if (!schema || !article) throw new Error("Curado test article or structured data is missing.");
JSON.parse(schema[1]);

const imagePrefix = "assets/real-world-tests/shimano-curado-200hg/";
const sharedParts = [
  "<!-- ReelCalc Real-World Test #003: Shimano Curado 200 HG -->",
  `<link rel="stylesheet" href="${assetBase}css/real-world-test.css?v=2">`,
  schema[0],
  article[1].trim().replaceAll(`href="../../${imagePrefix}`, `href="${assetBase}${imagePrefix}`),
  `<script src="${assetBase}js/reel-page-runtime.js?v=2" data-asset-base="${assetBase}"></script>`,
  `<script src="${assetBase}js/affiliate-links.js?v=2"></script>`,
  `<script src="${assetBase}js/real-world-test-runtime.js?v=2" data-asset-base="${assetBase}"></script>`
];
const blogCompatibility = `
<!-- Remove only this post's duplicate Squarespace header. -->
<style>
body.view-item:has(.reelcalc-real-world-test[data-test-id="${testId}"]) .blog-item-top-wrapper {
  display: none !important;
}
</style>
<script>
(() => {
  const testPage = document.querySelector('.reelcalc-real-world-test[data-test-id="${testId}"]');
  if (!testPage) return;
  const nativeTitle = Array.from(document.querySelectorAll('h1.entry-title[data-content-field="title"]'))
    .find((heading) => heading.textContent.trim() === ${JSON.stringify(pageTitle)});
  if (!nativeTitle || testPage.contains(nativeTitle)) return;
  const nativeHeader = nativeTitle.closest('.blog-item-top-wrapper');
  if (nativeHeader) nativeHeader.remove();
  else nativeTitle.closest('.blog-item-title')?.remove();
})();
</script>`;

const seo = [
  "PAGE TITLE / H1", pageTitle, "",
  "SEO TITLE", "Curado 200 M HG Re-Spool Test: Switching to Mono | ReelCalc", "",
  "META DESCRIPTION",
  "See a Curado 200 HG switch from 10 lb InvizX to 65 yards of Sunline Super Natural mono, keeping the existing backing. Photos, calculator setup, and final fill.", "",
  "URL SLUG", slug, "",
  "CANONICAL URL", `https://www.reelcalc.com/reel-tests/${slug}`, "",
  "HUB EXCERPT",
  "Fresh mono without starting over: a Curado 200 HG gets about 65 yards of Sunline Super Natural while keeping its Big Game backing. See the setup and finished spool.", "",
  "HUB THUMBNAIL", `${imagePrefix}IMG_2647.jpeg`, "",
  "PUBLISHING",
  "Create one post in the existing Real-World Tests blog collection (/reel-tests), not a new blog, product, or standalone page.",
  `Use ${slug}-squarespace-blog.html as the post's HTML code block, with the title, slug, excerpt, and thumbnail above.`,
  "Publish the GitHub assets before publishing the Squarespace post. Publishing the post in the existing collection adds it to /reel-tests automatically.",
  "Verify the public post, hub card, original photos, calculator screenshot, and affiliate button after publication.", "",
  "REEL RELATIONSHIP",
  "The owner confirmed model CU200HGM: Shimano Curado 200 M 200 HG RH, matching the calculator screenshot.",
  "After the blog post is live, link it from /reel-pages/p/shimano-curado-200-m-200-hg-rh-cu200hgm.", ""
].join("\n");

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, `${slug}-squarespace.html`), [...sharedParts, ""].join("\n"));
await fs.writeFile(path.join(outputDir, `${slug}-squarespace-blog.html`), [...sharedParts, blogCompatibility.trim(), ""].join("\n"));
await fs.writeFile(path.join(outputDir, `${slug}-seo.txt`), seo);
console.log(`Built Curado test page fragments and publishing settings in ${outputDir}`);
