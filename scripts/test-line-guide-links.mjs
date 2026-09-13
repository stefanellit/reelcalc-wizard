import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildLineGuideLinks } from "./build-line-guide-links.mjs";

const data = buildLineGuideLinks();
const catalog = JSON.parse(fs.readFileSync("data/lines.json", "utf8"));
const pe = JSON.parse(fs.readFileSync("data/pe-lines.json", "utf8"));
const release = JSON.parse(fs.readFileSync("data/line-page-release.json", "utf8"));
const context = { window: {}, URL, WeakMap };
vm.runInNewContext(fs.readFileSync("js/line-guide-links.js", "utf8"), context);
const { resolve } = context.window.ReelCalcLineGuides;
assert.deepEqual(Object.keys(data.guides).sort(), release.publishedProducts.slice().sort());
let linked = 0;
for (const line of catalog) {
  const match = resolve(line, data, { reel: "test-reel" });
  assert.equal(Boolean(match), Boolean(data.lines[line.id]), line.id);
  if (!match) continue;
  linked++;
  const url = new URL(match.url);
  assert.equal(url.searchParams.get("line"), line.id);
  assert.equal(url.searchParams.get("lb"), String(line.lb));
  assert.equal(url.searchParams.get("reel"), "test-reel");
  assert.equal(resolve({ ...line, id: "unknown" }, data), null);
  assert.equal(resolve({ ...line, custom_line: true }, data), null);
  assert.equal(resolve({ ...line, manual: true }, data), null);
  assert.equal(resolve({ ...line, dia_in: line.dia_in * 2 }, data), null);
  assert.equal(resolve({ ...line, lb: line.lb + 0.1 }, data), null);
  assert.equal(resolve({ ...line, brand: "Different" }, data), null);
  assert.equal(new URL(resolve(line, data, { reel: "manual-reel" }).url).searchParams.has("reel"), false);
}
const selected = catalog.find(line => line.id === "powerpro-spectra-braid-30");
assert.equal(resolve({ ...selected, id: undefined }, data).lineId, selected.id);
assert.equal(resolve({ ...selected, id: undefined, notes: "Reference estimate" }, data), null);
assert.equal(resolve({ ...selected, id: undefined, dia_mm: 0.5 }, data), null);
assert.equal(resolve(null, data), null);
assert.equal(resolve(selected, null), null);
assert.equal(resolve(selected, { ...data, guides: {} }), null);
assert.equal(resolve(selected, { ...data, guides: { "powerpro-spectra": { url: "javascript:alert(1)" } } }), null);
assert.equal(resolve(selected, { ...data, guides: { "powerpro-spectra": { url: "https://example.com/lines/p/fake" } } }), null);
const peMatches = pe.filter(line => resolve({ ...line, id: undefined, type: "Braid" }, data));
for (const line of peMatches) assert.ok(!/reference/i.test(line.notes || ""));

// Exercise delayed loading: a stale selection must not restore a cleared or newer link.
let finishFetch;
const events = [];
const anchors = [];
const element = { isConnected: true, after(anchor) { this.anchor = anchor; } };
const document = {
  currentScript: { src: "https://example.com/js/line-guide-links.js" }, dispatchEvent() {},
  createElement() {
    const anchor = { dataset: {}, style: {}, attrs: {},
      addEventListener(name, fn) { this[name] = fn; },
      setAttribute(name, value) { this.attrs[name] = value; },
      removeAttribute(name) { delete this[name]; } };
    anchors.push(anchor); return anchor;
  }
};
const browser = { window: { ReelCalcAnalytics: { track(name, params) { events.push({ name, params }); } } },
  URL, WeakMap, Event: class {}, document, fetch() { return new Promise(resolve => { finishFetch = resolve; }); } };
vm.runInNewContext(fs.readFileSync("js/line-guide-links.js", "utf8"), browser);
const show = browser.window.ReelCalcLineGuides.showAfter;
const first = show(element, selected, { source: "test" });
await show(element, null);
finishFetch({ ok: true, json: async () => data });
await first;
assert.equal(element.anchor.hidden, true);
assert.equal(element.anchor.href, undefined);
await show(element, selected, { source: "setup_wizard", role: "main" });
assert.equal(element.anchor.hidden, false);
assert.equal(element.anchor.target, "_blank");
element.anchor.click();
assert.equal(events[0].name, "line_guide_click");
assert.equal(events[0].params.line_id, selected.id);
assert.equal(events[0].params.page_type, "setup_wizard");
const another = catalog.find(line => line.id === "powerpro-spectra-braid-15");
await Promise.all([show(element, selected), show(element, another)]);
assert.equal(new URL(element.anchor.href).searchParams.get("lb"), "15");
assert.equal(anchors.length, 1, "No duplicate links after repeated renders");
await show(element, { ...selected, id: "excluded" });
assert.equal(element.anchor.hidden, true);
assert.equal(element.anchor.href, undefined);
console.log(JSON.stringify({ passed: true, guides: Object.keys(data.guides).length, linkedStrengths: linked,
  safelyUnlinkedCatalogRows: catalog.length - linked, exactPeMatches: peMatches.length, delayedSelectionAndClickTracking: "passed" }));
