import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "file:///C:/Users/Tyler/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = String(process.env.REELCALC_BASE_URL || "http://127.0.0.1:4173").replace(/\/+$/, "");
const artifactDir = path.join(root, "generated", "browser-tests", "baitcaster-pages-500");
const reportPath = path.join(root, "reports", "baitcaster-pages-500-browser-audit-2026-08-23.json");
fs.mkdirSync(artifactDir, { recursive: true });

const reels = JSON.parse(fs.readFileSync(path.join(root, "data", "reels.json"), "utf8"));
const reelById = new Map(reels.map((reel) => [reel.id, reel]));
const cases = [
  "shimano-curado-150-m-150-hg-rh-cu150hgm",
  "daiwa-tatula-x-tatx100",
  "lew-s-custom-pro-gen-3-cpb1hg3",
  "okuma-komodo-ss-450-kds-471",
  "abu-garcia-ambassadeur-c3-6500-c3-6500",
  "kastking-skeet-reese-icon-krlcstsr-72rgs",
  "seviin-gx-series-gxc173r",
  "penn-fathom-500-fth500lp",
  "pflueger-president-pflpreslpx",
  "mach-i-gen-3-mh1shg3",
  "daiwa-jdm-25-alphas-bf-tw-6-3r-4550133256400",
  "shimano-jdm-aldebaran-dc-30hg-right-047830",
  "shimano-curado-bfs-cubfsxgr",
  "shimano-tranx-150-trx150a",
  "daiwa-tatula-200-tatu200"
].map((id) => {
  const reel = reelById.get(id);
  if (!reel) throw new Error(`Missing representative browser fixture: ${id}`);
  return reel;
});

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
];
const screenshotIds = new Set([
  "lew-s-custom-pro-gen-3-cpb1hg3",
  "abu-garcia-ambassadeur-c3-6500-c3-6500",
  "daiwa-jdm-25-alphas-bf-tw-6-3r-4550133256400",
  "shimano-tranx-150-trx150a"
]);

function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(message.text());
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  return errors;
}

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true
});
const results = [];

try {
  for (const reel of cases) {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      const errors = collectErrors(page);
      const url = `${baseUrl}/generated/reel-pages/baitcaster-500/${reel.id}-preview.html`;
      const response = await page.goto(url, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200, `${reel.id}/${viewport.name}: preview did not return 200.`);

      await page.waitForFunction(() => {
        const mount = document.querySelector("[data-reelcalc-calculator]");
        return Boolean(
          mount?.dataset.reelcalcReady === "true" &&
          mount.shadowRoot?.querySelector('[data-role="main-product"]')?.options.length > 1
        );
      });

      const initial = await page.evaluate(async () => {
        const mount = document.querySelector("[data-reelcalc-calculator]");
        const shadow = mount.shadowRoot;
        const image = document.querySelector(".reelcalc-product-image");
        const catalog = await fetch("/data/lines.json").then((result) => result.json());
        const actions = Array.from(document.querySelectorAll(".reelcalc-page-actions a"), (link) => ({
          text: link.textContent.trim(),
          href: link.getAttribute("href")
        }));
        return {
          title: document.querySelector("h1")?.textContent.trim() || "",
          body: document.body.textContent || "",
          reelId: mount.dataset.reelId,
          imageLoaded: Boolean(image?.complete && image.naturalWidth >= 300),
          imageAlt: image?.alt || "",
          catalogLines: catalog.length,
          mainProducts: shadow.querySelector('[data-role="main-product"]')?.options.length || 0,
          backingProducts: shadow.querySelector('[data-role="backing-product"]')?.options.length || 0,
          mainProduct: shadow.querySelector('[data-role="main-product"]')?.value || "",
          backingProduct: shadow.querySelector('[data-role="backing-product"]')?.value || "",
          output: shadow.querySelector('[data-role="output"]')?.textContent.trim() || "",
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          actions
        };
      });

      assert.equal(initial.reelId, reel.id);
      assert.match(initial.title, new RegExp(reel.model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
      assert.match(initial.body, new RegExp(reel.sku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
      assert.match(initial.body, /baitcast/i);
      assert.doesNotMatch(initial.body, /spinning reel|spinning setup/i);
      assert.doesNotMatch(initial.body, /\b(?:a|an|the)\s+-size\b/i);
      assert.doesNotMatch(initial.body, /\b(?:undefined|null|TODO|TBD)\b/i);
      if (String(reel.market_region).toUpperCase() === "JDM") {
        assert.match(initial.body, /exact Japanese-market/i);
      }
      if (/\bPE\b/i.test(String(reel.braid_capacity_note || ""))) {
        assert.match(initial.body, /PE\s/i);
        assert.doesNotMatch(initial.body, /\b(?:0\.6|1|1\.5|2|3|4) lb\s*\/\s*\d+(?:\.\d+)? yards/i);
      }
      if (!reel.capacity_options?.length && reel.braid_capacity_note) {
        assert.match(initial.body, /No monofilament capacity is listed/i);
      }
      assert.equal(initial.imageLoaded, true, `${reel.id}/${viewport.name}: product image did not load.`);
      assert.match(initial.imageAlt, new RegExp(reel.brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
      assert.equal(initial.catalogLines, 1000);
      assert.ok(initial.mainProducts > 1 && initial.backingProducts > 1);
      assert.equal(initial.mainProduct, "");
      assert.equal(initial.backingProduct, "");
      assert.equal(initial.output, "");
      assert.ok(initial.overflow <= 1, `${reel.id}/${viewport.name}: horizontal overflow ${initial.overflow}px.`);
      assert.deepEqual(initial.actions.map((action) => action.text), [
        "Open This Reel in the Setup Wizard",
        "Compare This Reel"
      ]);
      const wizardUrl = new URL(initial.actions[0].href, "https://www.reelcalc.com");
      const comparisonUrl = new URL(initial.actions[1].href, "https://www.reelcalc.com");
      assert.equal(`${wizardUrl.pathname}${wizardUrl.search}`, `/reelcalc-wizard?reel=${encodeURIComponent(reel.id)}`);
      assert.equal(`${comparisonUrl.pathname}${comparisonUrl.search}`, `/reel-comparison?reel1=${encodeURIComponent(reel.id)}`);

      await page.evaluate(() => {
        const shadow = document.querySelector("[data-reelcalc-calculator]").shadowRoot;
        const change = (element) => element.dispatchEvent(new Event("change", { bubbles: true }));
        shadow.querySelector('[data-action="material"][data-line-role="main"][data-material="Braid"]').click();
        const mainProduct = shadow.querySelector('[data-role="main-product"]');
        const powerPro = Array.from(mainProduct.options).find((option) => option.textContent.trim() === "PowerPro Spectra");
        mainProduct.value = powerPro?.value || mainProduct.options[1].value;
        change(mainProduct);
        const mainStrength = shadow.querySelector('[data-role="main-strength"]');
        mainStrength.value = mainStrength.options[1].value;
        change(mainStrength);
        const backingProduct = shadow.querySelector('[data-role="backing-product"]');
        const bigGame = Array.from(backingProduct.options).find((option) => option.textContent.trim() === "Berkley Trilene Big Game");
        backingProduct.value = bigGame?.value || backingProduct.options[1].value;
        change(backingProduct);
        const backingStrength = shadow.querySelector('[data-role="backing-strength"]');
        backingStrength.value = backingStrength.options[1].value;
        change(backingStrength);
        shadow.querySelector('[data-action="calculate"]').click();
      });

      const backingResult = await page.evaluate(() => {
        const shadow = document.querySelector("[data-reelcalc-calculator]").shadowRoot;
        return shadow.querySelector('[data-role="output"]')?.textContent || "";
      });
      assert.match(backingResult, /Best backing estimate/i);
      assert.match(backingResult, /Main line/i);
      assert.match(backingResult, /Backing/i);
      assert.doesNotMatch(backingResult, /NaN|Infinity|undefined/i);

      await page.evaluate(() => {
        const shadow = document.querySelector("[data-reelcalc-calculator]").shadowRoot;
        shadow.querySelector('[data-action="mode"][data-mode="capacity"]').click();
        shadow.querySelector('[data-action="calculate"]').click();
      });
      const capacityResult = await page.evaluate(() => {
        const shadow = document.querySelector("[data-reelcalc-calculator]").shadowRoot;
        return shadow.querySelector('[data-role="output"]')?.textContent || "";
      });
      assert.match(capacityResult, /Best full-spool estimate/i);
      assert.doesNotMatch(capacityResult, /NaN|Infinity|undefined/i);

      await page.evaluate(() => {
        const shadow = document.querySelector("[data-reelcalc-calculator]").shadowRoot;
        shadow.querySelector('[data-unit="metric"]').click();
      });
      const metricResult = await page.evaluate(() => {
        const shadow = document.querySelector("[data-reelcalc-calculator]").shadowRoot;
        return {
          active: shadow.querySelector('[data-unit="metric"]').classList.contains("active"),
          output: shadow.querySelector('[data-role="output"]')?.textContent || ""
        };
      });
      assert.equal(metricResult.active, true);
      assert.match(metricResult.output, /\bm\b/);

      if (screenshotIds.has(reel.id)) {
        await page.screenshot({
          fullPage: true,
          path: path.join(artifactDir, `${reel.id}-${viewport.name}.png`)
        });
      }
      assert.deepEqual(errors, [], `${reel.id}/${viewport.name}: ${errors.join(" | ")}`);
      results.push({
        reelId: reel.id,
        brand: reel.brand,
        baitcasterClass: reel.baitcaster_class,
        market: reel.market_region || "US",
        viewport: viewport.name,
        horizontalOverflowPx: initial.overflow,
        imageLoaded: initial.imageLoaded,
        lineCatalogCount: initial.catalogLines,
        backingCalculation: "passed",
        capacityCalculation: "passed",
        metricToggle: "passed"
      });
      await page.close();
    }
  }
} finally {
  await browser.close();
}

const report = {
  status: "PASSED",
  representativeReels: cases.length,
  viewportRuns: results.length,
  viewports,
  brands: [...new Set(cases.map((reel) => reel.brand))].sort(),
  baitcasterClasses: [...new Set(cases.map((reel) => reel.baitcaster_class))].sort(),
  screenshots: fs.readdirSync(artifactDir).filter((name) => name.endsWith(".png")).sort(),
  results
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: report.status,
  representativeReels: report.representativeReels,
  viewportRuns: report.viewportRuns,
  brands: report.brands.length,
  baitcasterClasses: report.baitcasterClasses.length,
  screenshots: report.screenshots.length
}, null, 2));
