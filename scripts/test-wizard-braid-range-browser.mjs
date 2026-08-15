import assert from "node:assert/strict";
import path from "node:path";
import { chromium } from "file:///C:/Users/Tyler/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
];

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true
});

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
        errors.push(message.text());
      }
    });

    const url = `http://127.0.0.1:4173/?reel=daiwa-revros-lt-3000d-c-rvslt3000d-c-104&browser-test=${viewport.name}`;
    const response = await page.goto(url, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200);

    await page.locator('[data-path="exact"]').click();
    await page.locator("#lineBrand").selectOption({ label: "PowerPro" });
    await page.locator("#lineModel").selectOption({ label: "Spectra" });
    await page.locator("#lineLb").selectOption("15");

    const capacityText = await page.locator("#capacityResult").innerText();
    assert.match(capacityText, /Best full-spool estimate/i);
    assert.match(capacityText, /264\s+yards/i);
    assert.match(capacityText, /Expected real-world range:\s*235-295 yards/i);
    assert.match(capacityText, /How to use the range/i);
    assert.match(capacityText, /Start near the low end/i);
    assert.doesNotMatch(capacityText, /Published reel rating:/i);

    await page.locator('[data-backing="yes"]').click();
    await page.locator("#backingBrand").selectOption({ label: "Berkley" });
    await page.locator("#backingModel").selectOption({ label: "Trilene Big Game" });
    await page.locator("#backingLb").selectOption("10");
    await page.locator("#mainLineYards").fill("100");
    await page.locator("#mainLineYards").dispatchEvent("change");

    const backingText = await page.locator("#backingResult").innerText();
    assert.match(backingText, /Best backing estimate/i);
    assert.match(backingText, /Expected real-world range/i);
    assert.match(backingText, /Start with the best backing estimate/i);

    await page.goto(
      `http://127.0.0.1:4173/?reel=kastking-centron-spinning-4000-51-294&browser-test=${viewport.name}`,
      { waitUntil: "networkidle" }
    );
    const recommendationText = await page.locator("#recommendations").innerText();
    assert.match(recommendationText, /Best Overall Setup[\s\S]*25 lb braid/i);
    assert.doesNotMatch(recommendationText, /Best Overall Setup[\s\S]*15 lb braid/i);

    await page.locator('[data-path="exact"]').click();
    await page.locator("#lineBrand").selectOption({ label: "SpiderWire" });
    await page.locator("#lineModel").selectOption({ label: "EZ Braid" });
    await page.locator("#lineLb").selectOption("10");
    await page.locator('[data-backing="yes"]').click();
    await page.locator("#backingBrand").selectOption({ label: "Berkley" });
    await page.locator("#backingModel").selectOption({ label: "Trilene Big Game" });
    await page.locator("#backingLb").selectOption("10");
    await page.locator("#mainLineYards").fill("150");
    await page.locator("#mainLineYards").dispatchEvent("change");
    const thinBackingText = await page.locator("#backingResult").innerText();
    assert.match(thinBackingText, /Best backing estimate:\s*307\.8 yards/i);

    await page.locator("#lineLb").selectOption("40");
    const thickBackingText = await page.locator("#backingResult").innerText();
    assert.match(thickBackingText, /Best backing estimate:\s*182\.8 yards/i);

    await page.goto(
      `http://127.0.0.1:4173/?reel=lew-s-kvd-spinning-reel-300-kvd300-340&browser-test=kvd-${viewport.name}`,
      { waitUntil: "networkidle" }
    );
    const kvdRecommendationText = await page.locator("#recommendations").innerText();
    const kvdBestPickText = await page.locator(".setup-card").first().innerText();
    assert.match(kvdBestPickText, /Best Overall Setup[\s\S]*15 lb braid/i);
    assert.doesNotMatch(kvdBestPickText, /\b10 lb braid/i);
    const kvdBraidCapacities = await page.locator(".setup-card").evaluateAll((cards) => cards
      .map((card) => card.innerText)
      .filter((text) => /\blb braid\b/i.test(text))
      .map((text) => Number(text.match(/([\d,]+) yd best est\./i)?.[1].replace(/,/g, "")))
      .filter(Number.isFinite));
    assert.ok(kvdBraidCapacities.length >= 2, "KVD 300 should show at least two braid recommendation capacities");
    assert.ok(new Set(kvdBraidCapacities).size >= 2, "KVD 300 braid cards must not all reuse 180 yards");

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    assert.ok(overflow <= 1, `Wizard overflows horizontally by ${overflow}px at ${viewport.name}.`);
    assert.deepEqual(errors, [], errors.join(" | "));

    await page.screenshot({
      fullPage: true,
      path: path.resolve("generated", "browser-tests", `wizard-braid-range-${viewport.name}.png`)
    });
    await page.close();
  }
} finally {
  await browser.close();
}

console.log("Wizard braid-range browser tests passed on desktop and mobile.");
console.log("- Best estimate leads the result and the tighter expected range is secondary");
console.log("- Braid-aware backing range and practical spooling sequence passed");
console.log("- Centron 4000 recommends a practical 25 lb Best Pick and preserves the correct thin-line backing direction");
console.log("- Lew's KVD 300 recommendations no longer reuse 180 yards across different braid diameters");
