import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFile(path.join(root, file), "utf8");
const data = JSON.parse(await read("data/real-world-tests.json"));
const test = data.tests.find((entry) => entry.id === "reelcalc-real-world-test-003");
assert.ok(test, "Curado test record exists");
const html = await read(`examples/reel-tests/${test.slug}.html`);
const generated = await read(`generated/reel-tests/${test.slug}-squarespace.html`);
const blog = await read(`generated/reel-tests/${test.slug}-squarespace-blog.html`);
const seo = await read(`generated/reel-tests/${test.slug}-seo.txt`);
const lines = JSON.parse(await read("data/lines.json"));
const reels = JSON.parse(await read("data/reels.json"));
const guides = JSON.parse(await read("data/line-guide-links.json"));

assert.equal(test.number, 3);
assert.equal(new Set(data.tests.map((entry) => entry.id)).size, data.tests.length);
assert.equal(test.backing.status, "existing");
assert.equal(test.backing.removed, false);
assert.equal(test.backing.replaced, false);
assert.equal(test.backing.amountMeasuredDuringTest, false);
assert.equal(test.backing.displayBackingYards, 108);
assert.equal(test.mainLine.intendedYards, 65);
assert.equal(test.previousMainLine.originalYards, 65);
assert.equal(test.previousMainLine.remainingAmountMeasured, false);
assert.equal(test.previousMainLine.breakCauseEstablished, false);
assert.equal(test.measurement.photographedFeet, 195.4);
assert.equal(test.measurement.targetFeet / 3, test.mainLine.intendedYards);
assert.equal(Math.round(test.measurement.photographedFeet / 3), test.physicalResult.approximateMainLineYards);
assert.equal(test.physicalResult.connectionKnot, "Uni-to-Uni knot");
assert.equal(test.physicalResult.spoolGapMeasured, false);
assert.equal(test.reel.generationConfirmed, true);
assert.equal(test.reel.modelCode, "CU200HGM");
assert.equal(test.calculatorSetup.physicalReelMatchConfirmed, true);
assert.deepEqual(test.reelPageLinks, [], "Add the reel-page link once the blog post is live");

for (const content of [html, generated, blog]) {
  assert.equal((content.match(/<h1(?:\s|>)/g) || []).length, 1);
  assert.match(content, /css\/real-world-test\.css\?v=2/, "Shared design, no redesign");
  assert.match(content, /not a test of how much line an empty Curado can hold/);
  assert.match(content, /not remeasured/);
  assert.match(content, /No new backing was installed/);
  assert.match(content, /195\.4 feet/);
  assert.match(content, /0\.010 in \/ 0\.260 mm/);
  assert.match(content, /0\.0102 in/);
  assert.match(content, /Uni-to-Uni knot/);
  assert.match(content, /cause was unclear/);
  assert.match(content, /model CU200HGM, matching the Curado 200 M 200 HG RH/);
  assert.doesNotMatch(content, /exact generation still needs confirmation/);
  assert.match(content, /data-real-world-line-affiliate/);
  assert.match(content, /data-line-id="sunline-super-natural-mono-monofilament-10"/);
  assert.equal((content.match(/class="rc-test-step"/g) || []).length, 6);
  assert.doesNotMatch(content, /Three Different Kinds of Evidence|Test Methodology and Disclosure|laboratory measurement|What Changed From the Old Setup/);
  assert.match(content, /Background tidied for clarity/);
  for (const [href, placement, photo] of [
    ["https://amzn.to/4yO5zFA", "spooling_tool_step", "IMG_2645-clean-background.png"],
    ["https://amzn.to/4y21gqd", "line_counter_step", "IMG_2646.jpeg"]
  ]) {
    const step = [...content.matchAll(/<section class="rc-test-step">([\s\S]*?)<\/section>/g)]
      .find((match) => match[1].includes(`data-test-image="${photo}"`))?.[1];
    assert.ok(step, `${placement} photo step exists`);
    assert.ok(step.includes(`href="${href}"`), "Keep the owner's exact affiliate URL beside its photo");
    assert.ok(step.includes(`data-link-placement="${placement}"`));
    assert.match(step, /data-product-role="tool"/);
    assert.match(step, /rel="sponsored nofollow noopener"/);
    assert.match(step, /target="_blank"/);
    assert.match(step, /reelcalc-affiliate-disclosure/);
  }
  assert.doesNotMatch(content, /\bundefined\b|\bTODO\b|\bTBD\b/);
  assert.doesNotMatch(content, /newly installed backing|exact-reel|\$0/);
  const graph = JSON.parse(content.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])["@graph"];
  assert.deepEqual(graph.map((node) => node["@type"]), ["Article", "BreadcrumbList"]);
  assert.equal(graph[0].url, `https://www.reelcalc.com${test.canonicalPath}`);
  assert.equal(graph[1].itemListElement[1].item, "https://www.reelcalc.com/reel-tests");
  assert.ok(graph[0].image.endsWith("/shimano-curado-200hg/IMG_2647.jpeg"));
  assert.doesNotMatch(JSON.stringify(graph), /aggregateRating|reviewRating|"offers"|"Product"/);
}

const figureFiles = [...html.matchAll(/data-test-image="([^"]+)"/g)].map((match) => match[1]);
assert.equal(test.images.length, 8);
assert.deepEqual(new Set(figureFiles), new Set(test.images.map((image) => image.displayFile || image.file)));
for (const image of test.images) {
  const bytes = await fs.readFile(path.join(root, "assets/real-world-tests/shimano-curado-200hg", image.file));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), image.sha256.toLowerCase(), `${image.file} must remain the unaltered original`);
  if (image.displayFile) {
    const editedBytes = await fs.readFile(path.join(root, "assets/real-world-tests/shimano-curado-200hg", image.displayFile));
    assert.equal(createHash("sha256").update(editedBytes).digest("hex"), image.displaySha256);
    assert.equal(image.role, "supply-spool-mounted", "Do not edit counter, label, or final-fill evidence photos");
    assert.ok(html.includes(`href="../../assets/real-world-tests/shimano-curado-200hg/${image.file}"`), "Keep the unedited photo accessible");
  }
}
assert.match(html, /View full-size package photo/);
assert.match(html, /View full-size counter photo/);
assert.match(html, /View full-size calculator screenshot/);
assert.doesNotMatch(blog, /href="\.\.\//, "Hosted fragment must not contain relative asset links");
assert.doesNotMatch(blog, /<!doctype|<html(?:\s|>)/i);
assert.match(blog, /nativeHeader\.remove\(\)/);
assert.match(blog, /data-test-id="reelcalc-real-world-test-003"/);
assert.match(seo, /existing Real-World Tests blog collection/);

const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
for (const key of ["sunline-super-natural-mono", "seaguar-invizx", "berkley-trilene-big-game"]) {
  assert.ok(hrefs.includes(guides.guides[key].url), `${key} links to the live catalog URL`);
}
const wizard = new URL(hrefs.find((href) => href.includes("/reelcalc-wizard?")));
assert.equal(wizard.searchParams.get("line"), test.mainLine.lineId);
assert.equal(wizard.searchParams.get("lb"), "10");
assert.equal(wizard.searchParams.get("mainYards"), "65");
assert.equal(wizard.searchParams.has("reel"), false, "Keep the reviewed line-first wizard link");
assert.equal(wizard.searchParams.has("backingLine"), false, "Wizard does not currently support a backingLine preload");

const context = { window: {} };
vm.runInNewContext(await read("js/calculator-core.js"), context);
const core = context.window.ReelCalcCore;
const reel = reels.find((entry) => entry.id === test.calculatorSetup.reelId);
const mainLine = lines.find((entry) => entry.id === test.mainLine.lineId);
const backingLine = lines.find((entry) => entry.id === test.backing.lineId);
assert.ok(reel && mainLine && backingLine);
assert.equal(mainLine.dia_in, test.mainLine.catalogDiameterIn);
assert.equal(backingLine.dia_in, test.backing.diameterIn);
const result = core.calculateActualLineCalibratedBacking(reel, mainLine, test.mainLine.intendedYards, backingLine, lines);
assert.ok(Math.abs(result.backingYards - test.calculatorSetup.backingYards) < 1e-8);
assert.equal(Math.round(result.backingYards), 108);
assert.equal(core.ENGINE_VERSION, test.calculatorSetup.engineVersion);

const affiliateContext = { window: {}, URL };
vm.runInNewContext(await read("js/affiliate-links.js"), affiliateContext);
const offer = affiliateContext.window.ReelCalcAffiliateLinks.buildRecommendedLineOffer({
  affiliateData: JSON.parse(await read("data/reel-affiliates.json")),
  line: mainLine, requiredYards: 65, spoolYards: 330
});
assert.ok(offer, "Shared affiliate builder returns a Sunline offer");
assert.ok(new URL(offer.url).searchParams.get("tag"), "Amazon link has an affiliate tag");

console.log(JSON.stringify({ testId: test.id, status: "passed", originalImages: test.images.length, backingYards: result.backingYards, displayedBackingYards: 108, physicalModelMatchConfirmed: true }, null, 2));
