import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "file:///C:/Users/Tyler/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const BASE = "http://127.0.0.1:4173";
const A = "shimano-stradic-fm-c3000xg-stc3000xgfm-686";
const B = "daiwa-fuego-lt-3000d-c-feglt3000d-c-132";
const C = "penn-battle-iv-3000-btliv3000-458";
const expectedPairAB = [A, B].sort().join("__vs__");
const artifactDir = path.resolve("generated", "browser-tests");
fs.mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true
});

async function newPage(context) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !/Failed to load resource/i.test(message.text())) errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !/favicon\.ico(?:\?|$)/i.test(response.url())) {
      errors.push(`HTTP ${response.status()} ${response.url()}`);
    }
  });
  await page.addInitScript(() => {
    window.__comparisonEvents = [];
    document.addEventListener("reelcalc:analytics-event", (event) => {
      window.__comparisonEvents.push(event.detail);
    });
  });
  return { page, errors };
}

async function waitReady(page) {
  await page.waitForFunction(() => {
    const status = document.querySelector("#comparison-status");
    return status && !status.textContent.includes("Loading verified reel data");
  });
}

async function choose(page, side, reelId, type = "spinning") {
  const typeButton = page.locator(`#reel-${side}-selector [data-reel-type="${type}"]`);
  if (await typeButton.getAttribute("aria-pressed") !== "true") await typeButton.click();
  await page.locator(`#reel-${side}-input`).fill(reelId);
  const option = page.locator(`#reel-${side}-options [data-reel-id="${reelId}"]`);
  await option.waitFor({ state: "visible" });
  await option.click();
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const { page, errors } = await newPage(context);
  await page.goto(`${BASE}/examples/reel-comparison.html`, { waitUntil: "networkidle" });
  await waitReady(page);
  assert.equal(await page.locator("#comparison-results").isHidden(), true, "blank URL should not preload reels");
  assert.equal(await page.locator("#reel-a-input").inputValue(), "");
  assert.equal(await page.locator("#reel-b-input").inputValue(), "");
  assert.equal(await page.locator("#main-line-product").inputValue(), "", "blank URL should not preload main line");
  assert.equal(await page.locator("#backing-line-product").inputValue(), "", "blank URL should not preload backing line");
  assert.equal(await page.locator("#main-line-strength").inputValue(), "");
  assert.equal(await page.locator("#backing-line-strength").inputValue(), "");
  assert.equal(await page.locator("#reel-a-input").isDisabled(), true, "search should wait for a reel type");
  assert.equal(await page.locator("#reel-b-input").isDisabled(), true, "search should wait for a reel type");

  await choose(page, "a", A);
  await choose(page, "b", B);
  await page.waitForFunction(() => new URL(location.href).searchParams.get("reel2"));
  assert.equal(new URL(page.url()).searchParams.get("reel1"), A);
  assert.equal(new URL(page.url()).searchParams.get("reel2"), B);
  assert.equal(new URL(page.url()).searchParams.has("mainLine"), false);
  assert.equal(new URL(page.url()).searchParams.has("backingLine"), false);
  assert.equal(await page.locator("#comparison-results").isVisible(), true);
  assert.match(await page.locator("#comparison-summary").textContent(), /lighter|retrieves|maximum drag/i);

  const originalA = await page.locator("#reel-a-input").inputValue();
  const originalB = await page.locator("#reel-b-input").inputValue();
  await page.locator("#swap-reels").click();
  assert.equal(await page.locator("#reel-a-input").inputValue(), originalB);
  assert.equal(await page.locator("#reel-b-input").inputValue(), originalA);
  await page.locator("#swap-reels").click();
  assert.equal(await page.locator("#reel-a-input").inputValue(), originalA);
  assert.equal(await page.locator("#reel-b-input").inputValue(), originalB);

  for (const material of ["Monofilament", "Fluorocarbon", "Copolymer", "Braid"]) {
    await page.locator(`.rc-material-button[data-line-role="main"][data-material="${material}"]`).click();
    assert.equal(await page.locator("#main-line-product").inputValue(), "");
    assert.ok(await page.locator("#main-line-products option").count() > 0, `${material} products should load`);
  }
  for (const material of ["Braid", "Monofilament"]) {
    await page.locator(`.rc-material-button[data-line-role="backing"][data-material="${material}"]`).click();
    assert.equal(await page.locator("#backing-line-product").inputValue(), "");
    assert.ok(await page.locator("#backing-line-products option").count() > 0, `${material} backing products should load`);
  }

  for (const role of ["main", "backing"]) {
    const product = await page.locator(`#${role}-line-products option`).first().getAttribute("value");
    assert.ok(product, `${role} line database choices should be available`);
    await page.locator(`#${role}-line-product`).fill(product);
    assert.equal(await page.locator(`#${role}-line-strength`).inputValue(), "", `${role} strength should wait for the user`);
    await page.locator(`#${role}-line-strength`).selectOption({ index: 1 });
    assert.ok(await page.locator(`#${role}-line-strength`).inputValue(), `${role} line should be selectable`);
  }
  await page.waitForFunction(() => {
    const params = new URL(location.href).searchParams;
    return params.has("mainLine") && params.has("backingLine");
  }, null, { timeout: 3000 });
  assert.equal(new URL(page.url()).searchParams.has("mainLine"), true);
  assert.equal(new URL(page.url()).searchParams.has("backingLine"), true);

  await page.locator('.rc-mode-button[data-backing-mode="off"]').click();
  assert.equal(await page.locator("#backing-line-product").isDisabled(), true);
  assert.equal(await page.locator("#main-line-yards").isDisabled(), true);
  assert.match(await page.locator("#line-fit-summary").textContent(), /full spool/i);
  assert.equal(new URL(page.url()).searchParams.get("backing"), "off");
  await page.locator('.rc-mode-button[data-backing-mode="on"]').click();
  assert.equal(await page.locator("#backing-line-product").isEnabled(), true);
  assert.equal(await page.locator("#main-line-yards").isEnabled(), true);
  assert.match(await page.locator("#line-fit-summary").textContent(), /yards of main line/i);

  let events = await page.evaluate(() => window.__comparisonEvents);
  let completed = events.filter((event) => event.name === "reel_comparison_completed");
  assert.equal(completed.length, 1, "manual completion should fire once");
  assert.equal(completed[0].parameters.comparison_pair_id, expectedPairAB);
  assert.equal(completed[0].parameters.comparison_source, "manual_selection");

  await page.locator("#main-line-yards").fill("125");
  events = await page.evaluate(() => window.__comparisonEvents);
  completed = events.filter((event) => event.name === "reel_comparison_completed");
  assert.equal(completed.length, 1, "line-control rerenders must not duplicate completed events");

  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    document.execCommand = (command) => command === "copy";
  });
  await page.locator("#copy-comparison").click();
  assert.equal((await page.locator("#comparison-status").textContent()).trim(), "Comparison link copied.");
  events = await page.evaluate(() => window.__comparisonEvents);
  assert.equal(events.filter((event) => event.name === "reel_comparison_link_copied").length, 1);

  for (const action of ["reel-page", "wizard", "amazon"]) {
    const locator = page.locator(`[data-comparison-action="${action}"]`).first();
    if (await locator.count()) {
      await locator.evaluate((element) => element.addEventListener("click", (event) => event.preventDefault(), { once: true }));
      await locator.click();
    }
  }
  events = await page.evaluate(() => window.__comparisonEvents);
  assert.equal(events.filter((event) => event.name === "reel_comparison_reel_page_clicked").length, 1);
  assert.equal(events.filter((event) => event.name === "reel_comparison_wizard_clicked").length, 1);
  assert.equal(events.filter((event) => event.name === "reel_comparison_amazon_clicked").length, 1);

  const firstPairUrl = page.url();
  await choose(page, "a", C);
  const secondPairUrl = page.url();
  assert.notEqual(firstPairUrl, secondPairUrl);
  events = await page.evaluate(() => window.__comparisonEvents);
  assert.equal(events.filter((event) => event.name === "reel_comparison_completed").length, 2);

  await page.goBack();
  await page.waitForFunction((id) => new URL(location.href).searchParams.get("reel1") === id, A);
  assert.match(await page.locator("#reel-a-input").inputValue(), /Shimano Stradic FM/);
  await page.goForward();
  await page.waitForFunction((id) => new URL(location.href).searchParams.get("reel1") === id, C);
  assert.match(await page.locator("#reel-a-input").inputValue(), /PENN Battle IV/);
  events = await page.evaluate(() => window.__comparisonEvents);
  assert.equal(events.filter((event) => event.name === "reel_comparison_completed").length, 2, "history restoration must not duplicate prior pairs");
  await page.locator("#reset-comparison").click();
  assert.equal(await page.locator("#comparison-results").isHidden(), true);
  assert.equal(new URL(page.url()).searchParams.has("reel1"), false);
  assert.equal(await page.locator("#main-line-product").inputValue(), "");
  assert.equal(await page.locator("#backing-line-product").inputValue(), "");
  events = await page.evaluate(() => window.__comparisonEvents);
  assert.equal(events.filter((event) => event.name === "reel_comparison_reset").length, 1);
  await page.goBack();
  await page.waitForFunction((id) => new URL(location.href).searchParams.get("reel1") === id, C);
  assert.equal(await page.locator("#comparison-results").isVisible(), true, "back should restore the comparison after reset");
  assert.equal(errors.length, 0, errors.join(" | "));
  await page.screenshot({ path: path.join(artifactDir, "reel-comparison-tracking-desktop.png"), fullPage: true });
  await context.close();

  for (const [name, width, height] of [["mobile", 390, 844], ["desktop", 1440, 1000]]) {
    const viewportContext = await browser.newContext({ viewport: { width, height } });
    const tested = await newPage(viewportContext);
    await tested.page.goto(`${BASE}/examples/reel-comparison.html?reel1=${B}&reel2=${A}`, { waitUntil: "networkidle" });
    await waitReady(tested.page);
    const layout = await tested.page.evaluate(() => {
      const root = document.querySelector(".rc-compare");
      const fields = Array.from(document.querySelectorAll(".rc-selector-field"));
      const rootRect = root.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        fieldsInside: fields.every((field) => {
          const rect = field.getBoundingClientRect();
          return rect.left >= rootRect.left - 1 && rect.right <= rootRect.right + 1;
        }),
        canonical: document.querySelector('link[rel="canonical"]')?.href || ""
      };
    });
    assert.ok(layout.overflow <= 1, `${name} overflows by ${layout.overflow}px`);
    assert.equal(layout.fieldsInside, true, `${name} selector fields escaped their container`);
    assert.equal(layout.canonical, "https://www.reelcalc.com/reel-comparison");
    assert.equal(await tested.page.locator("#main-line-product").inputValue(), "", `${name} shared reel URL should not preload main line`);
    assert.equal(await tested.page.locator("#backing-line-product").inputValue(), "", `${name} shared reel URL should not preload backing line`);
    const sharedEvents = await tested.page.evaluate(() => window.__comparisonEvents);
    const sharedCompleted = sharedEvents.filter((event) => event.name === "reel_comparison_completed");
    assert.equal(sharedCompleted.length, 1);
    assert.equal(sharedCompleted[0].parameters.comparison_pair_id, expectedPairAB);
    assert.equal(sharedCompleted[0].parameters.comparison_source, "shared_url");
    assert.equal(tested.errors.length, 0, tested.errors.join(" | "));
    await tested.page.screenshot({ path: path.join(artifactDir, `reel-comparison-tracking-${name}.png`), fullPage: true });
    await viewportContext.close();
  }

  const explicitLineContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const explicitLineTest = await newPage(explicitLineContext);
  await explicitLineTest.page.goto(
    `${BASE}/examples/reel-comparison.html?reel1=${A}&reel2=${B}&mainLine=seaguar-smackdown-braid-15&backingLine=berkley-trilene-big-game-monofilament-10&mainYards=150&backing=on`,
    { waitUntil: "networkidle" }
  );
  await waitReady(explicitLineTest.page);
  assert.equal(await explicitLineTest.page.locator("#main-line-strength").inputValue(), "seaguar-smackdown-braid-15");
  assert.equal(await explicitLineTest.page.locator("#backing-line-strength").inputValue(), "berkley-trilene-big-game-monofilament-10");
  assert.equal(await explicitLineTest.page.locator("#main-line-yards").inputValue(), "150");
  assert.equal(explicitLineTest.errors.length, 0, explicitLineTest.errors.join(" | "));
  await explicitLineContext.close();

  const mismatchContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const mismatch = await newPage(mismatchContext);
  await mismatch.page.goto(
    `${BASE}/examples/reel-comparison.html?reel1=penn-battle-iv-10000-btliv10000-466&reel2=daiwa-bg-sw-2026-8000-h-bgsw8000-h&mainLine=daiwa-j-braid-grand-x8-braid-6&backing=off`,
    { waitUntil: "networkidle" }
  );
  await waitReady(mismatch.page);
  assert.equal(await mismatch.page.locator(".rc-fit-warning").count(), 2, "each reel should flag a braid strength outside its published ratings");
  assert.match(await mismatch.page.locator("#line-fit-comparison").textContent(), /outside this reel's published braid ratings/i);
  assert.equal(mismatch.errors.length, 0, mismatch.errors.join(" | "));
  await mismatchContext.close();

  for (const query of [`reel1=invalid&reel2=${B}`, `reel1=${A}`, ""]) {
    const invalidContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const tested = await newPage(invalidContext);
    await tested.page.goto(`${BASE}/examples/reel-comparison.html${query ? `?${query}` : ""}`, { waitUntil: "networkidle" });
    await waitReady(tested.page);
    assert.equal(await tested.page.locator("#comparison-results").isHidden(), true);
    assert.equal(tested.errors.length, 0, tested.errors.join(" | "));
    await invalidContext.close();
  }

  const blockedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await blockedContext.route("**/js/analytics.js*", (route) => route.abort());
  const blocked = await newPage(blockedContext);
  await blocked.page.goto(
    `${BASE}/generated/browser-tests/reel-comparison-loader-fixture.html?reel1=${A}&reel2=${B}`,
    { waitUntil: "networkidle" }
  );
  await waitReady(blocked.page);
  assert.equal(await blocked.page.locator("#comparison-results").isVisible(), true, "analytics blocking must not break comparison");
  assert.match(await blocked.page.locator("#reel-a-input").inputValue(), /Shimano Stradic FM/);
  await blockedContext.close();
} finally {
  await browser.close();
}

console.log("Reel comparison browser tests passed.");
console.log("- blank, shared, incomplete, and invalid URLs behaved safely");
console.log("- reel-only links stayed blank while explicitly shared line choices restored");
console.log("- impractical braid/reel pairings received an honest published-rating warning");
console.log("- manual and shared analytics fired once with normalized pair IDs");
console.log("- copy fallback, click tracking, and back/forward restoration passed");
console.log("- mobile and desktop containment passed with no page errors");
console.log("- comparison remained functional when analytics was blocked");
