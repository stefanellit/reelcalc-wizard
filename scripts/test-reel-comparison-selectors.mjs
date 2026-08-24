import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "file:///C:/Users/Tyler/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const BASE = "http://127.0.0.1:4173/examples/reel-comparison.html";
const VANFORD = "shimano-vanford-fa-c3000xga-vfc3000xga-692";
const BG = "daiwa-bg-3000-bg3000-185";
const BATTLE = "penn-battle-iv-3000-btliv3000-458";
const CURADO = "shimano-curado-150-m-150-hg-rh-cu150hgm";
const SLX = "shimano-slx-150-dc-slxdc150hg";
const TATULA = "daiwa-tatula-x-tatx100h";
const REVO = "abu-garcia-revo-stx-lp-revo5-stx-lp";
const artifactDir = path.resolve("generated", "browser-tests");
fs.mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true
});

async function ready(page) {
  await page.waitForFunction(() => {
    const status = document.querySelector("#comparison-status");
    return status && !status.textContent.includes("Loading verified reel data");
  });
}

async function chooseType(page, side, type) {
  await page.locator(`#reel-${side}-selector [data-reel-type="${type}"]`).click();
  assert.equal(await page.locator(`#reel-${side}-input`).isEnabled(), true);
}

async function search(page, side, query) {
  await page.locator(`#reel-${side}-input`).fill(query);
  await page.waitForFunction(({ side, query }) => {
    return document.querySelector(`#reel-${side}-options`)?.dataset.query === query;
  }, { side, query });
  return page.locator(`#reel-${side}-options .rc-reel-option`);
}

async function chooseBySearch(page, side, type, reelId) {
  await chooseType(page, side, type);
  await search(page, side, reelId);
  await page.locator(`#reel-${side}-options [data-reel-id="${reelId}"]`).click();
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !/Failed to load resource|favicon/i.test(message.text())) errors.push(message.text());
  });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await ready(page);

  assert.equal(await page.locator(".rc-reel-option").count(), 0, "initial page must not render hundreds of reel options");
  assert.equal(await page.locator("#reel-a-brand").isDisabled(), true);
  assert.equal(await page.locator("#reel-a-family").isDisabled(), true);
  assert.equal(await page.locator("#reel-a-exact").isDisabled(), true);

  await chooseType(page, "a", "spinning");
  for (const query of ["Vanford", "vanford 3000", "C3000XG", "Shimano   C3000"]) {
    const results = await search(page, "a", query);
    assert.ok(await results.count() > 0, `${query} should return spinning-reel matches`);
    assert.ok(await results.count() <= 12, `${query} should initially render at most 12 matches`);
  }
  await search(page, "a", "not a real reel 999xyz");
  assert.match(await page.locator("#reel-a-options").textContent(), /No matching spinning reels found/i);

  await search(page, "a", VANFORD);
  await page.locator("#reel-a-input").press("ArrowDown");
  await page.locator("#reel-a-input").press("Enter");
  assert.equal(new URL(page.url()).searchParams.get("reel1"), VANFORD);
  assert.equal(await page.locator("#reel-a-brand").inputValue(), "Shimano");
  assert.equal(await page.locator("#reel-a-family").inputValue(), "Vanford A");
  assert.equal(await page.locator("#reel-a-exact").inputValue(), VANFORD);
  assert.match(await page.locator("#reel-a-selected").textContent(), /Selected Reel.*Shimano Vanford A C3000XGA/is);

  await chooseBySearch(page, "b", "baitcasting", SLX);
  assert.equal(new URL(page.url()).searchParams.get("reel2"), SLX);
  assert.equal(await page.locator('#reel-b-selector [data-reel-type="baitcasting"]').getAttribute("aria-pressed"), "true");

  await page.locator("#reel-a-clear").click();
  assert.equal(new URL(page.url()).searchParams.has("reel1"), false, "clearing Reel 1 removes only reel1");
  assert.equal(new URL(page.url()).searchParams.get("reel2"), SLX, "clearing Reel 1 preserves Reel 2");
  assert.equal(await page.locator("#reel-b-exact").inputValue(), SLX);

  await chooseType(page, "a", "spinning");
  await page.locator("#reel-a-browse-toggle").click();
  await page.locator("#reel-a-brand").selectOption("Shimano");
  await page.locator("#reel-a-family").selectOption("Vanford A");
  await page.locator("#reel-a-exact").selectOption(VANFORD);
  assert.equal(new URL(page.url()).searchParams.get("reel1"), VANFORD);

  await page.locator('#reel-a-selector [data-reel-type="baitcasting"]').click();
  assert.equal(new URL(page.url()).searchParams.has("reel1"), false, "changing to an incompatible type clears only that reel");
  assert.equal(new URL(page.url()).searchParams.get("reel2"), SLX);
  assert.equal(await page.locator("#reel-a-input").inputValue(), "");

  for (const [query, expected] of [["Curado 150", CURADO], ["SLX DC", SLX], ["Tatula 100", ""], ["revo stx", REVO]]) {
    await search(page, "a", query);
    const resultText = await page.locator("#reel-a-options").textContent();
    if (expected) {
      const resultExists = await page.locator(`#reel-a-options [data-reel-id="${expected}"]`).count() > 0;
      assert.ok(resultExists, `${query} should expose its exact baitcaster. Results: ${resultText}`);
    } else {
      assert.match(resultText, /Daiwa Tatula.*100/is, `${query} should return closely matching Tatula 100 models`);
    }
  }

  await search(page, "a", "");
  assert.equal(await page.locator("#reel-a-options .rc-reel-option").count(), 12);
  assert.equal(await page.locator("#reel-a-options .rc-show-more-reels").isVisible(), true);
  await page.locator("#reel-a-options .rc-show-more-reels").click();
  assert.equal(await page.locator("#reel-a-options .rc-reel-option").count(), 24);
  await page.locator("#reel-a-input").press("Escape");
  assert.equal(await page.locator("#reel-a-options").isHidden(), true);

  for (const [brand, family, reelId, type] of [
    ["Daiwa", "BG", BG, "spinning"],
    ["PENN", "Battle IV", BATTLE, "spinning"],
    ["Shimano", "Curado 150 M", CURADO, "baitcasting"],
    ["Shimano", "SLX DC", SLX, "baitcasting"],
    ["Daiwa", "Tatula X", TATULA, "baitcasting"],
    ["Abu Garcia", "Revo STX LP", REVO, "baitcasting"]
  ]) {
    await chooseType(page, "a", type);
    await page.locator("#reel-a-browse-toggle").click();
    await page.locator("#reel-a-brand").selectOption(brand);
    await page.locator("#reel-a-family").selectOption(family);
    assert.ok(await page.locator(`#reel-a-exact option[value="${reelId}"]`).count() > 0, `${brand} ${family} must contain the exact model`);
    await page.locator("#reel-a-browse-toggle").click();
  }

  assert.equal(errors.length, 0, errors.join(" | "));
  await page.screenshot({ path: path.join(artifactDir, "reel-comparison-selector-desktop.png"), fullPage: true });
  await context.close();

  const shared = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const sharedPage = await shared.newPage();
  await sharedPage.goto(`${BASE}?reel1=${VANFORD}&reel2=${SLX}`, { waitUntil: "networkidle" });
  await ready(sharedPage);
  assert.equal(await sharedPage.locator('#reel-a-selector [data-reel-type="spinning"]').getAttribute("aria-pressed"), "true");
  assert.equal(await sharedPage.locator('#reel-b-selector [data-reel-type="baitcasting"]').getAttribute("aria-pressed"), "true");
  assert.equal(await sharedPage.locator("#reel-a-exact").inputValue(), VANFORD);
  assert.equal(await sharedPage.locator("#reel-b-exact").inputValue(), SLX);
  const layout = await sharedPage.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    touchTargets: [...document.querySelectorAll(".rc-reel-type-switch button")].every((button) => button.getBoundingClientRect().height >= 40),
    labels: ["reel-a-input", "reel-b-input", "reel-a-brand", "reel-b-brand"].every((id) => document.querySelector(`label[for="${id}"]`))
  }));
  assert.ok(layout.overflow <= 1, `mobile layout overflows by ${layout.overflow}px`);
  assert.equal(layout.touchTargets, true);
  assert.equal(layout.labels, true);
  await sharedPage.screenshot({ path: path.join(artifactDir, "reel-comparison-selector-mobile.png"), fullPage: true });
  await shared.close();
} finally {
  await browser.close();
}

console.log("Reel comparison selector tests passed.");
console.log("- indexed search, ranking, no-results, keyboard selection, and result limits passed");
console.log("- spinning and baitcasting browse paths passed across Shimano, Daiwa, PENN, and Abu Garcia");
console.log("- independent clear/type switching and stable URL restoration passed");
console.log("- mobile containment, labels, touch targets, and shared URL hydration passed");
