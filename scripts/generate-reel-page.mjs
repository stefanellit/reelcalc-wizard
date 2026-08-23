import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import {
  normalizeReel,
  reelDisplayName,
  requiredDataProblems,
  resolveReel
} from "./reel-pages/lookup.mjs";
import {
  buildCalculatorDefaults,
  buildCapacityRows,
  buildRecommendationModel,
  relatedPagesFor
} from "./reel-pages/recommendations.mjs";
import {
  buildPageModel,
  renderPreviewDocument,
  renderSquarespaceBlock
} from "./reel-pages/render.mjs";
import { validateGeneratedPage } from "./reel-pages/validate.mjs";
import {
  normalizeAffiliateRegistry,
  resolvePreferredReelOffer
} from "./reel-pages/affiliates.mjs";
import { featureProfileFor } from "./reel-pages/features.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let sharedServices;

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function loadSharedServices() {
  if (sharedServices) return sharedServices;

  const recommendationSandbox = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "js/recommendation-engine.js"), "utf8"),
    recommendationSandbox
  );
  const coreSandbox = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "js/calculator-core.js"), "utf8"),
    coreSandbox
  );

  sharedServices = {
    typicalDiameter: recommendationSandbox.window.ReelCalcRecommendations.typicalDiameter,
    calculateMainLineCapacity: coreSandbox.window.ReelCalcCore.calculateMainLineCapacity
  };
  return sharedServices;
}

function queryFromArgs(args) {
  const flagIndex = args.findIndex((value) => value === "--reel" || value === "--query");
  if (flagIndex >= 0) return args.slice(flagIndex + 1).join(" ").trim();
  return args.join(" ").trim();
}

function printMatches(matches) {
  matches.forEach((reel) => {
    console.log(`- ${reelDisplayName(reel)} | SKU: ${reel.sku || "missing"} | ID: ${reel.id}`);
  });
}

function failNeedsData(reel, fields) {
  console.log(`REEL:\n${reel ? reel.displayName : "Unknown"}\n`);
  console.log("STATUS:\nNEEDS DATA\n");
  console.log("MISSING:");
  fields.forEach((field) => console.log(`- ${field}`));
  process.exitCode = 2;
}

function lineEvidence(lines, recommendation) {
  const braidNumbers = recommendation.braidRange.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  const monoNumbers = recommendation.monoRange.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  const braidMin = Math.min(...braidNumbers);
  const braidMax = Math.max(...braidNumbers);
  const monoMin = Math.min(...monoNumbers);
  const monoMax = Math.max(...monoNumbers);
  return {
    braidRows: lines.filter((line) =>
      /braid/i.test(line.type) &&
      Number(line.lb) >= braidMin &&
      Number(line.lb) <= braidMax &&
      Number(line.dia_in) > 0
    ).length,
    monoFluoroRows: lines.filter((line) =>
      /mono|fluoro/i.test(line.type) &&
      Number(line.lb) >= monoMin &&
      Number(line.lb) <= monoMax &&
      Number(line.dia_in) > 0
    ).length
  };
}

export function generateReelPage(query, options = {}) {
  const reels = options.reels || readJson("data/reels.json");
  const lines = options.lines || readJson("data/lines.json");
  const registry = options.registry || readJson("data/reel-pages.json");
  const featureCatalog = options.featureCatalog || readJson("data/reel-family-features.json");
  const affiliates = normalizeAffiliateRegistry(
    options.affiliates || readJson("data/reel-affiliates.json")
  );
  const resolution = resolveReel(reels, query);

  if (resolution.status !== "resolved") {
    return {
      status: resolution.status,
      matches: resolution.matches || []
    };
  }

  const reel = normalizeReel(resolution.reel);
  const problems = requiredDataProblems(reel);
  const page = registry.pages.find((item) => item.reelId === reel.id);
  if (!page) problems.push("registered existing or approved page URL");
  if (page && (!page.imageUrl || !page.imageAlt)) problems.push("verified product image and alt text");
  const affiliateOffer = resolvePreferredReelOffer(affiliates, reel.id);
  if (!affiliateOffer) problems.push("verified direct or clearly labeled retailer search offer");

  const capacityRows = buildCapacityRows(reel);
  if (!capacityRows.length) problems.push("published capacity rows");
  if (problems.length) {
    return { status: "needs-data", reel, problems };
  }

  const recommendation = buildRecommendationModel(reel);
  const evidence = lineEvidence(lines, recommendation);
  if (!evidence.braidRows) problems.push("matching braid diameter rows in data/lines.json");
  if (!evidence.monoFluoroRows) problems.push("matching mono/fluoro diameter rows in data/lines.json");
  if (problems.length) {
    return { status: "needs-data", reel, problems };
  }
  const calculatorDefaults = buildCalculatorDefaults(
    reel,
    recommendation,
    lines,
    loadSharedServices()
  );
  if (!calculatorDefaults) {
    return {
      status: "needs-data",
      reel,
      problems: ["reel-appropriate calculator preload"]
    };
  }

  const reelsById = new Map(reels.map((item) => [item.id, item]));
  const related = relatedPagesFor(reel, registry, reelsById);
  const featureProfile = featureProfileFor(reel, featureCatalog);
  const model = buildPageModel({
    reel,
    page,
    registry,
    recommendation,
    calculatorDefaults,
    capacityRows,
    related,
    featureProfile
  });
  const productionBlock = renderSquarespaceBlock(model, registry.assetBaseUrl);
  const outputSlug = model.page.path.replace(/^\/+|\/+$/g, "");
  const localOutputDirectory = path.join(root, "generated", path.dirname(outputSlug));
  const localAssetBase = path.relative(localOutputDirectory, root).replace(/\\/g, "/") || ".";
  const localBlock = renderSquarespaceBlock(model, localAssetBase).replace(
    /href="\/([^"]*)"/g,
    `href="${registry.siteBaseUrl}/$1"`
  );
  const previewDocument = renderPreviewDocument(model, localBlock);
  const pageCss = fs.readFileSync(path.join(root, "css/reel-page.css"), "utf8");
  const validation = validateGeneratedPage({
    html: productionBlock,
    reel,
    model,
    registry,
    projectFiles: {
      calculatorExists: fs.existsSync(path.join(root, "js/reel-page-calculator.js")),
      coreExists: fs.existsSync(path.join(root, "js/calculator-core.js")),
      mobileCssPresent: pageCss.includes("@media")
    }
  });

  return {
    status: validation.status === "PASSED" ? "generated" : "validation-failed",
    reel,
    model,
    productionBlock,
    previewDocument,
    validation,
    lineEvidence: evidence,
    affiliateMappingPresent: Boolean(affiliateOffer),
    affiliateRetailer: affiliateOffer?.retailerName || null,
    affiliateMatchType: affiliateOffer?.matchType || null
  };
}

function writeOutputs(result) {
  const slug = result.model.page.path.replace(/^\/+|\/+$/g, "");
  const blockPath = path.join(root, "generated", `${slug}-squarespace.html`);
  const previewPath = path.join(root, "generated", `${slug}-preview.html`);
  const reportPath = path.join(root, "generated", `${slug}-validation.json`);
  const report = {
    reel: result.reel.displayName,
    reelId: result.reel.id,
    sourceFile: result.reel.sourceFile,
    pageUrl: result.model.suggestedUrl,
    localValidation: result.validation,
    lineEvidence: result.lineEvidence,
    affiliateMappingPresent: result.affiliateMappingPresent,
    affiliateRetailer: result.affiliateRetailer,
    affiliateMatchType: result.affiliateMatchType,
    deploymentRequired: [
      "css/reel-page.css",
      "js/reel-page-calculator.js",
      "js/reel-page-runtime.js",
      "data/reel-affiliates.json"
    ]
  };

  fs.mkdirSync(path.dirname(blockPath), { recursive: true });
  fs.writeFileSync(blockPath, result.productionBlock + "\n", "utf8");
  fs.writeFileSync(previewPath, result.previewDocument + "\n", "utf8");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  return { blockPath, previewPath, reportPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const query = queryFromArgs(process.argv.slice(2));
  if (!query) {
    console.log('Usage: node scripts/generate-reel-page.mjs --reel "Shimano Sedona FJ 2500"');
    process.exitCode = 2;
  } else {
    const result = generateReelPage(query);

    if (result.status === "ambiguous") {
      console.log("AMBIGUOUS REEL\n");
      printMatches(result.matches);
      process.exitCode = 2;
    } else if (result.status === "not-found") {
      failNeedsData(null, [`No reel record matched "${query}" in data/reels.json`]);
    } else if (result.status === "needs-data") {
      failNeedsData(result.reel, result.problems);
    } else if (result.status === "validation-failed") {
      console.log(`REEL:\n${result.reel.displayName}\n`);
      console.log("STATUS:\nVALIDATION FAILED\n");
      result.validation.failures.forEach((failure) => {
        console.log(`- ${failure.name}: ${failure.detail}`);
      });
      process.exitCode = 2;
    } else {
      const files = writeOutputs(result);
      console.log(`REEL:\n${result.reel.displayName}\n`);
      console.log(`SOURCE DATA:\n${result.reel.sourceFile} | data/reels.json | ${result.reel.id}\n`);
      console.log("STATUS:\nLOCAL VALIDATION PASSED - SHARED ASSET UPLOAD REQUIRED\n");
      console.log(`PAGE TITLE:\n${result.model.pageTitle}\n`);
      console.log(`SUGGESTED URL:\n${result.model.suggestedUrl}\n`);
      console.log(`SEO TITLE:\n${result.model.seoTitle}\n`);
      console.log(`META DESCRIPTION:\n${result.model.metaDescription}\n`);
      console.log("OUTPUT FILES:");
      console.log(`- Squarespace block: ${files.blockPath}`);
      console.log(`- Local preview: ${files.previewPath}`);
      console.log(`- Validation report: ${files.reportPath}\n`);
      console.log(`VALIDATION:\n${result.validation.checks.length} checks passed.`);
    }
  }
}
