import assert from "node:assert/strict";
import { chromium } from "file:///C:/Users/Tyler/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const baseUrl = String(process.env.REELCALC_WIZARD_BASE_URL || "http://127.0.0.1:4173").replace(/\/+$/, "");
const reelIds = ["penn-fathom-500-fth500lp", "penn-fathom-500-fth500lphs"];
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
];

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true
});

try {
  for (const reelId of reelIds) {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error" && !/Failed to load resource/i.test(message.text())) errors.push(message.text());
      });

      await page.goto(`${baseUrl}/?reel=${encodeURIComponent(reelId)}&fathom-500-regression=1`, {
        waitUntil: "networkidle",
        timeout: 60000
      });
      await page.waitForFunction((expectedId) => document.querySelector("#reelSize")?.value === expectedId, reelId);

      await page.evaluate(() => {
        const fishingType = document.querySelector("#fishingType");
        fishingType.value = "bass";
        fishingType.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForFunction(() => /will not label 50-80 lb braid as an everyday Best Pick/i.test(document.querySelector("#recommendations")?.textContent || ""));
      const bass = await page.evaluate(() => ({
        cards: document.querySelectorAll("#recommendations .setup-card").length,
        text: document.querySelector("#recommendations")?.textContent || "",
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }));
      assert.equal(bass.cards, 0);
      assert.match(bass.text, /heavy saltwater baitcaster/i);
      assert.doesNotMatch(bass.text, /80 lb braid keeps the main line thin/i);
      assert.ok(bass.overflow <= 1, `${reelId}/${viewport.name}: bass warning overflowed ${bass.overflow}px.`);

      await page.evaluate(() => {
        const fishingType = document.querySelector("#fishingType");
        fishingType.value = "inshore";
        fishingType.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForFunction(() => document.querySelectorAll("#recommendations .setup-card").length >= 2);
      const inshore = await page.evaluate(() => ({
        cards: document.querySelectorAll("#recommendations .setup-card").length,
        text: document.querySelector("#recommendations")?.textContent || "",
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }));
      assert.ok(inshore.cards >= 2);
      assert.doesNotMatch(inshore.text, /keeps the main line thin, sensitive, and easy to cast/i);
      assert.doesNotMatch(inshore.text, /40 lb fluorocarbon leader gives you a practical bite section without making the setup feel too bulky/i);
      assert.ok(inshore.overflow <= 1, `${reelId}/${viewport.name}: inshore cards overflowed ${inshore.overflow}px.`);
      assert.deepEqual(errors, [], `${reelId}/${viewport.name}: ${errors.join(" | ")}`);
      await page.close();
    }
  }

  for (const viewport of viewports) {
    const reelId = "lew-s-team-lew-s-pro-ti-slp-series-pt1shg2";
    const page = await browser.newPage({ viewport });
    await page.goto(`${baseUrl}/?reel=${encodeURIComponent(reelId)}&pro-ti-regression=1`, {
      waitUntil: "networkidle",
      timeout: 60000
    });
    await page.waitForFunction((expectedId) => document.querySelector("#reelSize")?.value === expectedId, reelId);
    await page.evaluate(() => {
      const fishingType = document.querySelector("#fishingType");
      fishingType.value = "bass";
      fishingType.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.waitForFunction(() => document.querySelectorAll("#recommendations .setup-card").length >= 3);
    const cards = await page.evaluate(() => Array.from(document.querySelectorAll("#recommendations .setup-card"), (card) => ({
      title: card.querySelector("h3")?.textContent.trim() || "",
      headline: card.querySelector(".setup-headline")?.textContent.trim() || ""
    })));
    const best = cards.find((card) => card.title === "Best Overall Setup");
    const heavy = cards.find((card) => card.title === "Heavy Cover Setup");
    assert.match(best?.headline || "", /^30 lb braid/i);
    assert.match(heavy?.headline || "", /^40 lb braid/i);
    assert.notEqual(best?.headline, heavy?.headline);
    await page.close();
  }
} finally {
  await browser.close();
}

console.log("Penn Fathom 500 recommendation regression passed.");
console.log("- Both variants tested in desktop and mobile layouts");
console.log("- Bass is honestly blocked; Inshore recommendations remain available");
console.log("- Heavy braid and leader copy no longer claims a light, non-bulky setup");
console.log("- Lew's Pro-Ti keeps 30 lb Best Overall distinct from 40 lb Heavy Cover");
