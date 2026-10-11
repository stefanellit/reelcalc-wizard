import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/reel-page-calculator.js", import.meta.url), "utf8");
// Exercise the actual async startup path, replacing only DOM rendering with a spy.
const start = source.indexOf("  function mountCalculator(");
const end = source.indexOf("  function initializeMount(");
assert.ok(start > 0 && end > start);
const instrumented = source.slice(0, start) + `
  function mountCalculator(mount) {
    mounted.push(mount);
    mount.dataset.reelcalcReady = "true";
  }
` + source.slice(end);
const mounts = [{ dataset: { reelId: "bg-lt" } }];
const mounted = [];
const reels = [{ id: "bg-lt" }];
let releaseData;
const dataReady = new Promise(resolve => { releaseData = resolve; });
let releaseBridge;
const bridgeReady = new Promise(resolve => { releaseBridge = resolve; });
const context = vm.createContext({
  URL, Map, Promise, mounted,
  document: {
    baseURI: "https://example.test/",
    currentScript: { src: "https://example.test/js/reel-page-calculator.js", dataset: {} },
    readyState: "complete",
    querySelectorAll: () => mounts
  },
  window: {
    ReelCalcCore: { isReelReady: () => true },
    ReelCalcLineSelector: {},
    ReelCalcAffiliateLinks: {},
    ReelCalcCapacityPages: { ready: bridgeReady, enabled: () => false }
  },
  fetch: async url => {
    await dataReady;
    return { ok: true, json: async () => url.endsWith("reels.json") ? reels : [] };
  }
});
const settle = () => new Promise(resolve => setImmediate(resolve));
vm.runInContext(instrumented, context);
context.window.ReelCalcReelPageCalculator.initialize();
context.window.ReelCalcReelPageCalculator.initialize();
// A second script evaluation must also respect the pending mount.
vm.runInContext(instrumented, context);
releaseData();
await settle();
context.window.ReelCalcReelPageCalculator.initialize();
assert.equal(mounted.length, 0, "must wait for the capacity bridge");
releaseBridge();
await settle();
assert.equal(mounted.length, 1, "concurrent initialization must bind controls only once");
context.window.ReelCalcReelPageCalculator.initialize();
await settle();
assert.equal(mounted.length, 1, "ready calculators must not bind controls again");

const second = { dataset: { reelId: "bg-lt" } };
mounts.push(second);
context.window.ReelCalcReelPageCalculator.initialize();
await settle();
assert.equal(mounted.length, 2, "a new mount must initialize independently");
const retry = { dataset: { reelId: "not-yet-available" } };
mounts.push(retry);
context.window.ReelCalcReelPageCalculator.initialize();
await settle();
assert.match(retry.innerHTML, /could not find the reel record/);
assert.notEqual(retry.dataset.reelcalcLoading, "true", "a failed attempt must release the guard");
reels.push({ id: "not-yet-available" });
context.window.ReelCalcReelPageCalculator.initialize();
await settle();
assert.equal(mounted.length, 3, "failed initialization can be retried");
console.log("Reel-page initialization: concurrent calls, duplicate script, bridge delay, ready mounts, independent mounts, and retry passed.");
