import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { generateReelPage } from "./generate-reel-page.mjs";
import {
  isAllowedRetailerUrl,
  normalizeAffiliateRegistry,
  resolvePreferredReelOffer
} from "./reel-pages/affiliates.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "outputs", "reel-page-baitcaster-500");
const previewDir = path.join(root, "generated", "reel-pages", "baitcaster-500");
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const reels = read("data/reels.json");
const lines = read("data/lines.json");
const liveRegistry = read("data/reel-pages.json");
const stagedRegistry = read("outputs/reel-page-baitcaster-500/ACTIVATE-AFTER-IMPORT-reel-pages.json");
const stagedEmbeds = read("outputs/reel-page-baitcaster-500/ACTIVATE-AFTER-IMPORT-reel-page-embeds.json");
const readiness = read("reports/baitcaster-page-catalog-readiness-500.json");
const imageReport = read("reports/baitcaster-page-image-candidates-500.json");
const review = read("outputs/reel-page-baitcaster-500/baitcaster-pages-review.json");
const featureCatalog = read("data/reel-family-features.json");
const affiliateRegistry = normalizeAffiliateRegistry(read("data/reel-affiliates.json"));
const reelById = new Map(reels.map((reel) => [reel.id, reel]));
const canonical = readiness.pageReelIds.map((id) => reelById.get(id));
const stagedByReel = new Map(stagedRegistry.pages.map((page) => [page.reelId, page]));
const imageByFamily = new Map(imageReport.families.map((entry) => [entry.family, entry.selected]));

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "js", "calculator-core.js"), "utf8"), sandbox);
const core = sandbox.window.ReelCalcCore;
const sampleBraidLine = lines.find((line) => /braid/i.test(String(line.type || "")) && Number(line.dia_in) > 0);
assert.ok(sampleBraidLine, "No exact braid line is available for PE calibration tests.");

function values(value) {
  return String(value || "").match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
}

function visibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function localImagePath(cachedUrl) {
  const marker = "/assets/reel-page-images/";
  const index = String(cachedUrl || "").indexOf(marker);
  return index < 0 ? null : path.join(root, "assets", "reel-page-images", cachedUrl.slice(index + marker.length));
}

assert.equal(readiness.inputRows, 500);
assert.equal(readiness.canonicalPhysicalVariants, 498);
assert.equal(readiness.duplicateAliasRows.length, 2);
assert.equal(canonical.length, 498);
assert.ok(canonical.every(Boolean));
assert.equal(new Set(canonical.map((reel) => reel.id)).size, 498);
assert.equal(liveRegistry.pages.filter((page) => canonical.some((reel) => reel.id === page.reelId)).length, 18);
assert.equal(stagedRegistry.pages.length, liveRegistry.pages.length + 480);
assert.equal(review.newSquarespacePages, 480);
assert.equal(review.uniqueProductUrls, 480);
assert.equal(review.uniqueImportSkus, 480);
assert.equal(review.stagedRegistryPages, stagedRegistry.pages.length);
assert.equal(Object.keys(stagedEmbeds.pages).length, Object.keys(read("data/reel-page-embeds.json").pages).length + 480);

const allPaths = stagedRegistry.pages.map((page) => page.path);
assert.equal(new Set(allPaths).size, allPaths.length, "Staged reel-page paths are not unique.");
const pageSkus = canonical.map((reel) => `${reel.brand.toLowerCase()}|${reel.sku.toLowerCase()}`);
assert.equal(new Set(pageSkus).size, 498, "Canonical pages still contain a physical variant duplicate.");
for (const alias of readiness.duplicateAliasRows) {
  assert.ok(reelById.has(alias.aliasId));
  assert.ok(stagedByReel.has(alias.canonicalId));
  assert.ok(!stagedByReel.has(alias.aliasId), `${alias.aliasId}: alias must not create a duplicate SEO page.`);
}

let validationChecks = 0;
let publishedMonoAnchors = 0;
let publishedBraidAnchors = 0;
let affiliateOffers = 0;
let jdmPages = 0;
let braidOnlyPages = 0;
let peCapacityPages = 0;
let peExactLineCalibrations = 0;
let verifiedFeaturePages = 0;
let exactSpecificationPages = 0;
const verifiedFeatureFamilies = new Set();
const classCounts = {};
const brandCounts = {};

for (const raw of canonical) {
  const page = stagedByReel.get(raw.id);
  assert.ok(page, `${raw.id}: missing staged page registry entry.`);
  assert.match(page.path, /^\/reel-pages\/p\/[a-z0-9-]+$/);
  assert.equal(page.verifiedLive, liveRegistry.pages.some((candidate) => candidate.reelId === raw.id));
  assert.ok(page.imageUrl && page.imageSourcePage && page.imageAlt, `${raw.id}: page image metadata is incomplete.`);

  const family = `${raw.brand}|${raw.model}`;
  const image = imageByFamily.get(family) || (page.verifiedLive ? {
    cachedUrl: page.imageUrl,
    sourceUrl: page.imageSourcePage
  } : null);
  assert.ok(image, `${raw.id}: exact-family image evidence is missing.`);
  assert.equal(page.imageUrl, image.cachedUrl);
  assert.equal(page.imageSourcePage, image.sourceUrl);
  const imagePath = localImagePath(page.imageUrl);
  assert.ok(imagePath && fs.existsSync(imagePath), `${raw.id}: cached page image is missing.`);
  assert.ok(fs.statSync(imagePath).size > 9000, `${raw.id}: cached page image is unexpectedly small.`);

  const generated = generateReelPage(raw.id, {
    reels,
    lines,
    registry: stagedRegistry,
    affiliates: affiliateRegistry,
    featureCatalog
  });
  assert.equal(generated.status, "generated", `${raw.id}: page generation failed.`);
  assert.equal(generated.validation.status, "PASSED", `${raw.id}: built-in page validation failed.`);
  assert.ok(generated.validation.checks.every((check) => check.passed), `${raw.id}: a built-in check failed.`);
  validationChecks += generated.validation.checks.length;

  const html = generated.productionBlock;
  const text = visibleText(html);
  assert.ok(text.includes(raw.brand), `${raw.id}: brand is missing from visible copy.`);
  assert.ok(text.includes(raw.model), `${raw.id}: model is missing from visible copy.`);
  assert.ok(text.includes(raw.size_label), `${raw.id}: size/SKU variant is missing from visible copy.`);
  assert.doesNotMatch(text, /\b(?:undefined|null|TODO|TBD|unknown|needs manual entry)\b/i, `${raw.id}: placeholder copy leaked into page.`);
  assert.doesNotMatch(text, /spinning reel|spinning setup/i, `${raw.id}: spinning wording leaked into baitcaster page.`);
  assert.doesNotMatch(text, /\b(?:a|an|the)\s+-size\b/i, `${raw.id}: an empty reel-size label is visible.`);
  assert.doesNotMatch(text, /monofilament capacities as\s*\./i, `${raw.id}: empty mono-capacity sentence.`);
  assert.doesNotMatch(text, /Source:\s*\[|reel_database_master|\.json/i, `${raw.id}: internal source notation is visible.`);
  assert.equal((html.match(/>Compare This Reel<\/a>/g) || []).length, 1, `${raw.id}: comparison CTA is duplicated or missing.`);
  assert.ok(html.includes(`/reelcalc-wizard?reel=${encodeURIComponent(raw.id)}`));
  assert.ok(html.includes(`/reel-comparison?reel1=${encodeURIComponent(raw.id)}`));
  assert.equal((generated.model.intro.match(/[.!?](?:\s|$)/g) || []).length >= 3, true, `${raw.id}: introduction is too thin.`);

  if (generated.model.introDetailMode === "verified-features") {
    verifiedFeaturePages += 1;
    verifiedFeatureFamilies.add(family);
    assert.ok(generated.model.introFeatureNames.length >= 1 && generated.model.introFeatureNames.length <= 3);
    generated.model.introFeatureNames.forEach((name) => assert.ok(generated.model.intro.includes(name)));
  } else {
    exactSpecificationPages += 1;
    assert.equal(generated.model.introDetailMode, "verified-specifications");
  }
  assert.equal(generated.model.introEvidenceSource, raw.source_url);

  const market = String(raw.market_region || "US").toUpperCase();
  if (market.includes("JDM") || market.includes("JP") || market.includes("JAPAN")) {
    jdmPages += 1;
    assert.match(generated.model.intro, /exact Japanese-market\s+\S+\s+specifications/i, `${raw.id}: JDM distinction is missing.`);
  }

  const monoOptions = generated.reel.monoCapacities;
  const braidOptions = core.publishedBraidCapacityOptions(raw);
  if (/\bPE\b/i.test(String(raw.braid_capacity_note || ""))) {
    peCapacityPages += 1;
    assert.equal(braidOptions.length, 0, `${raw.id}: PE values were exposed as pound-test anchors.`);
    const peRows = generated.model.capacityRows.filter((row) => row.type === "PE Braid");
    assert.ok(peRows.length >= 1, `${raw.id}: PE capacity rows are missing.`);
    assert.ok(peRows.every((row) => /^PE\s/.test(row.ratingLabel)), `${raw.id}: PE rating label is wrong.`);
    assert.ok(peRows.every((row) => /yards \(.+ m\)$/.test(row.capacityLabel)), `${raw.id}: PE meter conversion is missing.`);
    assert.match(generated.model.braidText, /PE\s/i);
    assert.doesNotMatch(generated.model.braidText, /\b(?:0\.6|1|1\.5|2|3|4) lb\b/i);
    const calibrated = core.calculateActualLineBraidCapacityRange(raw, sampleBraidLine, lines);
    assert.ok(calibrated && calibrated.centerYards > 0, `${raw.id}: exact-line PE calibration failed.`);
    peExactLineCalibrations += 1;
  }
  if (!monoOptions.length && braidOptions.length) {
    braidOnlyPages += 1;
    assert.match(generated.model.capacityIntro, /no monofilament capacity is listed|does not list a mono capacity/i);
    assert.match(generated.model.capacityIntro, /instead of inventing a mono rating/i);
  }

  const anchorLine = {
    type: "Monofilament",
    lb: Number(raw.rated_line_lb),
    dia_in: Number(raw.rated_line_diameter_in)
  };
  const anchorCapacity = core.calculateFullSpoolCapacity(raw, anchorLine, { lineCatalog: lines });
  assert.ok(Math.abs(anchorCapacity - Number(raw.capacity_yards)) < 1e-7, `${raw.id}: primary capacity anchor changed.`);
  publishedMonoAnchors += 1;

  for (const option of braidOptions) {
    const estimate = core.calculatePublishedBraidCapacity(raw, {
      type: "Braid",
      lb: option.lb,
      dia_in: 0.01,
      generic_recommendation: true
    });
    assert.ok(estimate, `${raw.id}: published braid anchor did not resolve.`);
    assert.equal(estimate.method, "exact", `${raw.id}/${option.lb}: published braid anchor was interpolated.`);
    assert.equal(estimate.yards, option.yards, `${raw.id}/${option.lb}: published braid yardage changed.`);
    publishedBraidAnchors += 1;
  }

  const defaults = generated.model.calculatorDefaults;
  assert.ok(Number(defaults.mainLineLb) > 0 && Number(defaults.mainLineYards) > 0 && Number(defaults.mainLineDiameterIn) > 0);
  assert.ok(Number(defaults.backingLb) > 0 && Number(defaults.backingDiameterIn) > 0);
  const braidRange = values(raw.reelcalc_recommended_braid);
  if (braidRange.length) {
    assert.ok(defaults.mainLineLb >= Math.min(...braidRange) && defaults.mainLineLb <= Math.max(...braidRange), `${raw.id}: page main-line preset is outside the verified range.`);
  }

  const offer = resolvePreferredReelOffer(affiliateRegistry, raw.id);
  assert.ok(offer, `${raw.id}: affiliate offer is missing.`);
  assert.ok(isAllowedRetailerUrl(offer.url, affiliateRegistry.retailers[offer.retailerId]), `${raw.id}: affiliate URL is not allowed.`);
  if (offer.matchType === "search") assert.match(offer.url, /tag=reelcalc-20/);
  affiliateOffers += 1;

  const previewPath = path.join(previewDir, `${raw.id}-preview.html`);
  assert.ok(fs.existsSync(previewPath), `${raw.id}: local preview is missing.`);
  const preview = fs.readFileSync(previewPath, "utf8");
  assert.match(preview, /<!doctype html>/i);
  assert.doesNotMatch(preview, /https:\/\/stefanellit\.github\.io\/reelcalc-wizard\/assets\//i, `${raw.id}: preview still points to remote static assets.`);

  const slug = page.path.split("/").at(-1);
  const embed = stagedEmbeds.pages[slug];
  assert.ok(embed, `${raw.id}: staged Squarespace loader entry is missing.`);
  assert.equal(embed.reelId, raw.id);
  assert.equal(embed.canonicalPath, page.path);
  assert.equal(embed.imageUrl, page.imageUrl);
  assert.ok(embed.intro && embed.content?.setupRows?.length >= 2);

  const reviewRow = review.pages.find((entry) => entry.reelId === raw.id);
  assert.ok(reviewRow, `${raw.id}: review manifest row is missing.`);
  assert.ok(reviewRow.seoTitleLength <= 68, `${raw.id}: SEO title is too long.`);
  assert.ok(reviewRow.metaDescriptionLength <= 160, `${raw.id}: meta description is too long.`);
  assert.ok(reviewRow.metaDescriptionLength >= 110, `${raw.id}: meta description is too thin.`);

  const reelClass = raw.baitcaster_class || "unspecified";
  classCounts[reelClass] = (classCounts[reelClass] || 0) + 1;
  brandCounts[raw.brand] = (brandCounts[raw.brand] || 0) + 1;
}

assert.equal(affiliateOffers, 498);
assert.equal(jdmPages, 53);
assert.equal(braidOnlyPages, 6);
assert.equal(peCapacityPages, 26);
assert.equal(peExactLineCalibrations, peCapacityPages);
assert.equal(verifiedFeaturePages + exactSpecificationPages, 498);
assert.ok(
  verifiedFeatureFamilies.size >= readiness.familiesWithVerifiedTechnologyCopy &&
    verifiedFeatureFamilies.size <= readiness.familiesWithVerifiedTechnologyCopy + 1,
  "Verified feature-family count drifted beyond the existing pilot naming alias."
);

const report = {
  status: "PASSED",
  databaseRows: 500,
  canonicalPages: 498,
  duplicateAliasesSuppressed: readiness.duplicateAliasRows.length,
  alreadyLivePilots: 18,
  newSquarespaceImports: 480,
  stagedRegistryPages: stagedRegistry.pages.length,
  builtInValidationChecks: validationChecks,
  publishedPrimaryCapacityAnchors: publishedMonoAnchors,
  publishedBraidAnchors,
  affiliateOffers,
  jdmPages,
  braidOnlyPages,
  peCapacityPages,
  peExactLineCalibrations,
  verifiedFeaturePages,
  verifiedFeatureFamilies: verifiedFeatureFamilies.size,
  exactSpecificationPages,
  classCounts,
  brandCounts
};

fs.writeFileSync(
  path.join(root, "reports", "baitcaster-pages-500-audit-2026-08-23.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);
console.log(JSON.stringify(report, null, 2));
