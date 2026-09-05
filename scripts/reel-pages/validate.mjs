import { recommendedBackingStrength } from "./recommendations.mjs";

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return [...duplicates];
}

function check(name, passed, detail) {
  return {
    name,
    passed: Boolean(passed),
    detail: passed ? "OK" : detail
  };
}

function decodeBasicHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function validateGeneratedPage({ html, reel, model, registry, projectFiles }) {
  const visibleText = decodeBasicHtmlEntities(html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " "));
  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicateIds = duplicateValues(ids);
  const registeredPaths = new Set([
    registry.wizardPath,
    registry.comparisonPath || "/reel-comparison",
    ...registry.pages.map((page) => page.path),
    ...registry.resources.map((resource) => resource.path),
    ...(model.resources || []).map((resource) => resource.path),
    ...(model.realWorldTest?.path ? [model.realWorldTest.path] : [])
  ]);
  const internalLinks = [...html.matchAll(/href=["'](\/[^"'?#]*)(?:\?[^"']*)?["']/gi)]
    .map((match) => match[1]);
  const unknownInternalLinks = internalLinks.filter((path) => !registeredPaths.has(path));
  const pagePaths = registry.pages.map((page) => page.path);
  const duplicatePagePaths = duplicateValues(pagePaths);
  const expectedWizardUrl = `${registry.wizardPath}?reel=${encodeURIComponent(reel.id)}`;
  const expectedComparisonUrl = `${registry.comparisonPath || "/reel-comparison"}?reel1=${encodeURIComponent(reel.id)}`;
  const expectedCalculator = `data-reel-id="${reel.id}"`;
  const requiredSections = [
    "introduction",
    "quick-answer",
    "who-is-this-reel-for",
    "calculator",
    "best-line-setup",
    "line-capacity",
    "specifications",
    "faqs",
    "related-resources",
    "wizard-cta",
    ...(model.realWorldTest ? ["real-world-test"] : [])
  ];
  const relatedCount = model.related.length;

  const checks = [
    check("Exact reel record found", Boolean(reel.id), "No exact reel ID."),
    check("Correct brand", visibleText.includes(reel.brand), "Brand is not present."),
    check("Correct model", visibleText.includes(reel.model), "Model is not present."),
    check("Correct size", visibleText.includes(reel.sizeLabel), "Exact size is not present."),
    check(
      "Verified product image is present",
      /^https:\/\//.test(model.page.imageUrl || "") &&
        html.includes(`src="${String(model.page.imageUrl).replace(/&/g, "&amp;")}"`) &&
        Boolean(model.page.imageAlt),
      "A verified product image or alt text is missing."
    ),
    check("Capacity data exists", reel.capacityYards > 0 && reel.ratedLineDiameterIn > 0, "Capacity fields are missing."),
    check(
      "Capacity data matches source",
      html.includes(`data-capacity-yards="${reel.capacityYards}"`) &&
        html.includes(`data-rated-line-lb="${reel.ratedLineLb}"`),
      "Rendered capacity markers do not match the reel record."
    ),
    check("Calculator points to correct reel", html.includes(expectedCalculator), "Calculator reel ID is wrong."),
    check("Calculator preload is valid", projectFiles.calculatorExists && projectFiles.coreExists, "Shared calculator or core file is missing."),
    check(
      "Main-line preload is reel-appropriate",
      Number(model.calculatorDefaults?.mainLineLb) > 0 &&
        Number(model.calculatorDefaults?.mainLineYards) > 0 &&
        Number(model.calculatorDefaults?.mainLineDiameterIn) > 0,
      "Main-line preload is missing."
    ),
    check(
      "Backing preload follows practical size and braid-strength guidance",
      Number(model.calculatorDefaults?.backingLb) === recommendedBackingStrength(
        reel,
        model.calculatorDefaults?.mainLineLb
      ) && Number(model.calculatorDefaults?.backingDiameterIn) > 0,
      "Backing preload does not match the practical ReelCalc backing rule."
    ),
    check(
      "Calculator preload values are embedded",
      /data-main-line-lb="[^"]+"[\s\S]*data-main-line-yards="[^"]+"[\s\S]*data-backing-diameter-in="[^"]+"/i.test(html),
      "Generated calculator preload attributes are missing."
    ),
    check("Wizard points to correct reel", html.includes(expectedWizardUrl), "Wizard reel ID is wrong."),
    check("Wizard URL is valid", expectedWizardUrl.startsWith("/reelcalc-wizard?reel="), "Wizard URL format is invalid."),
    check("Comparison points to correct reel", html.includes(expectedComparisonUrl), "Comparison reel ID is wrong."),
    check("Comparison URL is valid", expectedComparisonUrl.startsWith("/reel-comparison?reel1="), "Comparison URL format is invalid."),
    check(
      "Introduction uses an approved evidence mode",
      ["verified-features", "verified-specifications"].includes(model.introDetailMode),
      `Unexpected introduction evidence mode: ${model.introDetailMode || "missing"}.`
    ),
    check(
      "Introduction evidence matches the exact reel-family source",
      model.introEvidenceSource === reel.sourceUrl,
      `Feature source ${model.introEvidenceSource || "missing"} does not match ${reel.sourceUrl}.`
    ),
    check(
      "Introduction technology count is controlled",
      model.introDetailMode !== "verified-features" ||
        (model.introFeatureNames.length >= 1 && model.introFeatureNames.length <= 3),
      `Expected 1-3 verified technologies; found ${model.introFeatureNames?.length || 0}.`
    ),
    check(
      "Approved technologies appear in the introduction",
      (model.introFeatureNames || []).every((name) => model.intro.includes(name)),
      "One or more approved technology names are missing from the introduction."
    ),
    check(
      "Specification fallback remains model-specific",
      model.introDetailMode !== "verified-specifications" ||
        [reel.retrieveIn, reel.weightOz, reel.maxDragLb, reel.capacityYards]
          .some((value) => model.intro.includes(String(value))),
      "Specification-only introduction lacks an exact published reel detail."
    ),
    check("No placeholder variables remain", !/\b(TODO|REPLACE_ME|SHARED_REELCALC|YOUR_URL)\b/i.test(html), "Placeholder text remains."),
    check("No database underscores in visible copy", !visibleText.includes("_"), "A raw database label is visible."),
    check("No dummy URLs remain", !/href=["'](?:#|javascript:|https?:\/\/example\.com)/i.test(html), "Dummy URL remains."),
    check("No empty affiliate buttons appear", !/reelcalc-affiliate-link[^>]*>\s*<\/a>/i.test(html), "An empty affiliate button exists."),
    check("Internal links use known URLs", unknownInternalLinks.length === 0, `Unknown links: ${unknownInternalLinks.join(", ")}`),
    check("Related reels are focused", relatedCount >= 4 && relatedCount <= 6, `Expected 4-6 related reels; found ${relatedCount}.`),
    ...requiredSections.map((section) =>
      check(`${section} section present`, html.includes(`data-section="${section}"`), `Missing ${section} section.`)
    ),
    check("H1 is present", /<h1>[\s\S]+?<\/h1>/i.test(html), "H1 is missing."),
    check("No duplicate HTML IDs", duplicateIds.length === 0, `Duplicate IDs: ${duplicateIds.join(", ")}`),
    check("Mobile stylesheet remains available", projectFiles.mobileCssPresent, "Shared page CSS has no mobile media query."),
    check("No fabricated specifications", reel.warnings.length === 0, `Data warnings: ${reel.warnings.join("; ")}`),
    check("No accidental duplicate reel-page URL", duplicatePagePaths.length === 0, `Duplicate paths: ${duplicatePagePaths.join(", ")}`),
    check("Existing page URL is preserved", model.page.path.startsWith("/"), "No registered page URL.")
  ];

  const failures = checks.filter((item) => !item.passed);
  return {
    status: failures.length ? "FAILED" : "PASSED",
    checks,
    failures
  };
}
