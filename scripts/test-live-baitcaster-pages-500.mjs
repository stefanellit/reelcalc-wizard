import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "file:///C:/Users/Tyler/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteBase = String(process.env.REELCALC_SITE_BASE_URL || "https://www.reelcalc.com").replace(/\/+$/, "");
const review = JSON.parse(fs.readFileSync(
  path.join(root, "outputs", "reel-page-baitcaster-500", "baitcaster-pages-review.json"),
  "utf8"
));
const embedManifest = JSON.parse(fs.readFileSync(path.join(root, "data", "reel-page-embeds.json"), "utf8"));
const registry = JSON.parse(fs.readFileSync(path.join(root, "data", "reel-pages.json"), "utf8"));
const reels = JSON.parse(fs.readFileSync(path.join(root, "data", "reels.json"), "utf8"));
const reelsById = new Map(reels.map((reel) => [reel.id, reel]));
const auditAllPages = process.env.REELCALC_AUDIT_SCOPE === "all";
const allCases = auditAllPages
  ? registry.pages.map((page) => ({
      reelId: page.reelId,
      pagePath: page.path,
      isBaitcaster: /baitcast/i.test(String(reelsById.get(page.reelId)?.reel_type || ""))
    }))
  : review.pages.filter((page) => page.status === "ready-to-import").map((page) => ({ ...page, isBaitcaster: true }));
const requestedLimit = Number.parseInt(process.env.REELCALC_AUDIT_LIMIT || "", 10);
const cases = Number.isFinite(requestedLimit) && requestedLimit > 0
  ? allCases.slice(0, requestedLimit)
  : allCases;
const expectedSections = [
  "introduction",
  "quick-answer",
  "who-is-this-reel-for",
  "calculator",
  "best-line-setup",
  "line-capacity",
  "specifications",
  "faqs",
  "related-resources",
  "cta"
];

if (!auditAllPages) assert.equal(allCases.length, 480, `Expected 480 imported pages, found ${allCases.length}.`);
else assert.equal(allCases.length, registry.pages.length, "All-page audit did not include the complete registry.");

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  serviceWorkers: "block"
});
await context.route("**/*", async (route) => {
  const type = route.request().resourceType();
  if (type === "font" || type === "media") return route.abort();
  return route.continue();
});

const failures = [];
const results = [];
let cursor = 0;

function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const value = message.text();
    if (/favicon|Failed to load resource|ERR_BLOCKED_BY_CLIENT|Content Security Policy/i.test(value)) return;
    errors.push(value);
  });
  return errors;
}

async function readState(page) {
  return page.evaluate(() => {
    const detail = document.querySelector(".product-detail");
    const description = document.querySelector(".product-description");
    const mount = document.querySelector("[data-reelcalc-calculator]");
    const shadow = mount?.shadowRoot;
    const isVisible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const visibleCommerce = Array.from(document.querySelectorAll("button, a, [role=button]"))
      .filter((element) => /add to (?:cart|bag)|buy now/i.test(element.textContent || ""))
      .filter(isVisible);
    const compareLinks = Array.from(document.querySelectorAll("a"))
      .filter((link) => /Compare This Reel/i.test(link.textContent || ""));
    const wizardLinks = Array.from(document.querySelectorAll("a"))
      .filter((link) => /Open This Reel in the Setup Wizard/i.test(link.textContent || ""));
    const visibleCompareLinks = compareLinks.filter(isVisible);
    const visibleWizardLinks = wizardLinks.filter(isVisible);
    const image = document.querySelector(".reelcalc-product-image");
    return {
      enhanced: description?.dataset.reelcalcEnhanced || "",
      detailEnhanced: Boolean(detail?.classList.contains("reelcalc-imported-guide")),
      reelId: mount?.dataset.reelId || "",
      sections: Array.from(description?.querySelectorAll(":scope > .reelcalc-page-section") || [], (section) => section.dataset.section),
      calculatorReady: mount?.dataset.reelcalcReady || "",
      hasShadow: Boolean(shadow),
      mainProducts: shadow?.querySelector('[data-role="main-product"]')?.options.length || 0,
      backingProducts: shadow?.querySelector('[data-role="backing-product"]')?.options.length || 0,
      mainProduct: shadow?.querySelector('[data-role="main-product"]')?.value || "",
      backingProduct: shadow?.querySelector('[data-role="backing-product"]')?.value || "",
      imagePresent: Boolean(image),
      imageLoaded: Boolean(image?.complete && image.naturalWidth >= 250),
      wizardCount: visibleWizardLinks.length,
      wizardHref: visibleWizardLinks[0]?.getAttribute("href") || "",
      compareCount: visibleCompareLinks.length,
      compareHref: visibleCompareLinks[0]?.getAttribute("href") || "",
      actionDebug: [...wizardLinks, ...compareLinks].map((link) => ({
        text: link.textContent.trim(),
        href: link.getAttribute("href") || "",
        visible: isVisible(link),
        descriptionIndex: Array.from(document.querySelectorAll(".product-description")).indexOf(link.closest(".product-description")),
        section: link.closest(".reelcalc-page-section")?.dataset.section || ""
      })),
      visibleCommerce: visibleCommerce.length,
      loaderErrors: document.querySelectorAll(".reelcalc-page-status").length,
      body: document.body.textContent || "",
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
}

async function runCalculation(page, settings) {
  return page.evaluate((settings) => {
    const shadow = document.querySelector("[data-reelcalc-calculator]")?.shadowRoot;
    if (!shadow) return "";
    const change = (element) => element?.dispatchEvent(new Event("change", { bubbles: true }));
    const closestStrength = (select, target) => Array.from(select?.options || [])
      .map((option) => ({ option, pounds: Number.parseFloat(option.textContent) }))
      .filter((item) => Number.isFinite(item.pounds))
      .sort((left, right) => Math.abs(left.pounds - target) - Math.abs(right.pounds - target))[0]?.option;
    shadow.querySelector('[data-action="material"][data-line-role="main"][data-material="Braid"]')?.click();
    const mainProduct = shadow.querySelector('[data-role="main-product"]');
    const powerPro = Array.from(mainProduct?.options || []).find((option) => option.textContent.trim() === "PowerPro Spectra");
    if (mainProduct && mainProduct.options.length > 1) {
      mainProduct.value = powerPro?.value || mainProduct.options[1].value;
      change(mainProduct);
    }
    const mainStrength = shadow.querySelector('[data-role="main-strength"]');
    if (mainStrength && mainStrength.options.length > 1) {
      const practicalMain = closestStrength(mainStrength, Number(settings.mainLineLb) || 30) ||
        mainStrength.options[mainStrength.options.length - 1];
      mainStrength.value = practicalMain.value;
      change(mainStrength);
    }
    const mainYards = shadow.querySelector('[data-role="main-yards"]');
    const backingProduct = shadow.querySelector('[data-role="backing-product"]');
    const bigGame = Array.from(backingProduct?.options || []).find((option) => option.textContent.trim() === "Berkley Trilene Big Game");
    if (backingProduct && backingProduct.options.length > 1) {
      backingProduct.value = bigGame?.value || backingProduct.options[1].value;
      change(backingProduct);
    }
    const backingStrength = shadow.querySelector('[data-role="backing-strength"]');
    if (backingStrength && backingStrength.options.length > 1) {
      const practicalBacking = closestStrength(backingStrength, Number(settings.backingLb) || 10) ||
        backingStrength.options[1];
      backingStrength.value = practicalBacking.value;
      change(backingStrength);
    }
    const requestedYards = Number(settings.mainLineYards) || 100;
    const amounts = Array.from(new Set([
      requestedYards,
      Math.max(10, Math.floor(requestedYards * 0.75)),
      Math.max(10, Math.floor(requestedYards * 0.5)),
      25,
      10
    ])).sort((left, right) => right - left);
    let output = "";
    for (const amount of amounts) {
      if (mainYards) {
        mainYards.value = String(amount);
        change(mainYards);
      }
      shadow.querySelector('[data-action="calculate"]')?.click();
      output = shadow.querySelector('[data-role="output"]')?.textContent || "";
      if (!/greater than this reel is estimated to hold/i.test(output)) break;
    }
    return output;
  }, settings);
}

async function verifyBaseline() {
  const page = await context.newPage();
  try {
    const response = await page.goto(`${siteBase}/reel-pages/p/shimano-sedona-fj-2500?gold-standard-audit=5aa2404`, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
    assert.equal(response?.status(), 200, "Gold-standard spinning baseline did not return 200.");
    await page.waitForFunction(() => {
      const mount = document.querySelector("[data-reelcalc-calculator]");
      return mount?.dataset.reelcalcReady === "true" && Boolean(mount.shadowRoot);
    }, null, { timeout: 60000 });
    const baseline = await readState(page);
    assert.deepEqual(baseline.sections, expectedSections, "Spinning baseline section structure changed.");
    return baseline.sections;
  } finally {
    await page.close();
  }
}

async function testCase(testCase) {
  const page = await context.newPage();
  const errors = collectErrors(page);
  try {
    const response = await page.goto(`${siteBase}${testCase.pagePath}?baitcaster-live-audit=5aa2404`, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
    assert.equal(response?.status(), 200, `HTTP ${response?.status()}.`);
    await page.waitForFunction(() => {
      const mount = document.querySelector("[data-reelcalc-calculator]");
      const description = document.querySelector(".product-description");
      return description?.dataset.reelcalcEnhanced === "true" &&
        mount?.dataset.reelcalcReady === "true" &&
        Boolean(mount.shadowRoot) &&
        mount.shadowRoot.querySelector('[data-role="main-product"]')?.options.length > 1;
    }, null, { timeout: 60000 });
    await page.waitForFunction(() => {
      const image = document.querySelector(".reelcalc-product-image");
      return Boolean(image?.complete);
    }, null, { timeout: 30000 });

    const desktop = await readState(page);
    if (process.env.REELCALC_AUDIT_DEBUG === "1") {
      console.log(JSON.stringify({
        reelId: desktop.reelId,
        sections: desktop.sections,
        wizardCount: desktop.wizardCount,
        wizardHref: desktop.wizardHref,
        compareCount: desktop.compareCount,
        compareHref: desktop.compareHref,
        actionDebug: desktop.actionDebug,
        visibleCommerce: desktop.visibleCommerce,
        loaderErrors: desktop.loaderErrors,
        imageLoaded: desktop.imageLoaded,
        overflow: desktop.overflow
      }, null, 2));
    }
    assert.equal(desktop.detailEnhanced, true);
    assert.equal(desktop.enhanced, "true");
    assert.equal(desktop.reelId, testCase.reelId);
    assert.deepEqual(desktop.sections, expectedSections);
    assert.equal(desktop.calculatorReady, "true");
    assert.equal(desktop.hasShadow, true);
    assert.ok(desktop.mainProducts > 1 && desktop.backingProducts > 1);
    assert.equal(desktop.mainProduct, "");
    assert.equal(desktop.backingProduct, "");
    assert.equal(desktop.imagePresent, true);
    assert.equal(desktop.imageLoaded, true, "Product image did not load at a usable size.");
    assert.equal(desktop.wizardCount, 1, "Expected exactly one wizard link.");
    assert.equal(desktop.wizardHref, `/reelcalc-wizard?reel=${encodeURIComponent(testCase.reelId)}`);
    assert.equal(desktop.compareCount, 1, "Expected exactly one comparison link.");
    assert.equal(desktop.compareHref, `/reel-comparison?reel1=${encodeURIComponent(testCase.reelId)}`);
    assert.equal(desktop.visibleCommerce, 0);
    assert.equal(desktop.loaderErrors, 0);
    assert.doesNotMatch(desktop.body, /could not finish loading|undefined|\bTODO\b|\bTBD\b/i);
    if (testCase.isBaitcaster) assert.doesNotMatch(desktop.body, /spinning reel|spinning setup/i);
    assert.ok(desktop.overflow <= 1, `Desktop overflowed ${desktop.overflow}px.`);

    const slug = testCase.pagePath.split("/").filter(Boolean).pop();
    const calculationSettings = embedManifest.pages?.[slug]?.calculator;
    assert.ok(calculationSettings, "Missing reel-specific calculator starting setup.");
    const output = await runCalculation(page, calculationSettings);
    assert.match(output, /Best backing estimate|Estimated backing needed/i);
    assert.match(output, /Main line/i);
    assert.match(output, /Backing/i);
    assert.doesNotMatch(output, /NaN|Infinity|undefined/i);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(80);
    const mobile = await readState(page);
    assert.deepEqual(mobile.sections, expectedSections);
    assert.equal(mobile.wizardCount, 1, "Expected exactly one visible mobile wizard link.");
    assert.equal(mobile.compareCount, 1, "Expected exactly one visible mobile comparison link.");
    assert.equal(mobile.visibleCommerce, 0);
    assert.ok(mobile.overflow <= 1, `Mobile overflowed ${mobile.overflow}px.`);
    assert.deepEqual(errors, [], errors.join(" | "));

    results.push({
      reelId: testCase.reelId,
      path: testCase.pagePath,
      sections: desktop.sections.length,
      calculator: "passed",
      desktopOverflow: desktop.overflow,
      mobileOverflow: mobile.overflow
    });
  } catch (error) {
    failures.push({ reelId: testCase.reelId, path: testCase.pagePath, error: error.message });
    if (failures.length <= 5) {
      console.error(`${testCase.reelId}: ${error.message}`);
    }
  } finally {
    await page.close();
  }
}

try {
  await verifyBaseline();
  const workers = Array.from({ length: 6 }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= cases.length) return;
      await testCase(cases[index]);
      if ((index + 1) % 25 === 0 || index + 1 === cases.length) {
        console.log(`Checked ${index + 1}/${cases.length}; failures=${failures.length}`);
      }
    }
  });
  await Promise.all(workers);
} finally {
  await context.close();
  await browser.close();
}

const report = {
  generatedAt: new Date().toISOString(),
  siteBase,
  commit: process.env.REELCALC_AUDIT_COMMIT || "working-tree",
  spinningBaseline: "/reel-pages/p/shimano-sedona-fj-2500",
  expectedSections,
  pagesExpected: cases.length,
  pagesPassed: results.length,
  pagesFailed: failures.length,
  failures,
  checks: {
    liveHttp: "all pages",
    goldStandardStructure: "all pages",
    calculatorInitialization: "all pages",
    calculatorBackingSmokeTest: "all pages",
    lineSelectorsBlankAndLoaded: "all pages",
    exactWizardAndComparisonLinks: "all pages",
    productImages: "all pages",
    hiddenCommerceControls: "all pages",
    desktopOverflow: "all pages",
    mobileOverflow: "all pages"
  }
};
fs.writeFileSync(
  path.join(root, "reports", auditAllPages ? "all-reel-pages-live-audit.json" : "baitcaster-pages-500-live-audit-2026-08-23.json"),
  `${JSON.stringify(report, null, 2)}\n`
);

if (failures.length) {
  console.error(JSON.stringify(failures.slice(0, 20), null, 2));
  throw new Error(`${failures.length} of ${cases.length} live baitcaster pages failed.`);
}

console.log(auditAllPages ? "All registered live reel pages passed." : "All live imported baitcaster pages passed.");
console.log(`- ${results.length} pages matched the gold-standard spinning section structure`);
console.log("- Every page initialized the calculator, loaded blank line selectors, and completed a backing calculation");
console.log("- Every page passed desktop and mobile overflow checks with no visible Squarespace commerce controls");
