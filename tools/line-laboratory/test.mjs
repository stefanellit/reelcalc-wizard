import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import sources from "../../js/line-sources.js";
import { decodeFeed, mergeRecords, runImport, csvFields } from "./import.mjs";
import { prepareApi, method } from "./prepare-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = file => fs.readFile(path.join(root, file), "utf8");
const json = async file => JSON.parse(await read(file));
const manufacturer = await json("data/lines.json");
for (const file of ["js/calculator-core.js", "js/homepage-calculator-v2.js", "js/line-database-tools.js", "js/line-page-engine.js", "js/line-page-loader.js", "js/line-selector.js", "js/recommendation-engine.js", "js/capacity-page-bridge.js", "data/lines.json", "data/reels.json"]) {
  const previous = execFileSync("git", ["show", "HEAD:" + file], { cwd: root, maxBuffer: 40_000_000 }).toString().replaceAll("\r\n", "\n");
  assert.equal((await read(file)).replaceAll("\r\n", "\n"), previous, file + " must be unchanged");
}
console.log("PASS homepage, line pages, Compare Lines, core, reference selector and manufacturer datasets unchanged");
const reels = await json("data/reels.json");
const release = { schemaVersion: 1, enabled: true, approvedMethods: ["synthetic-test-only"], dataPath: "data/line-laboratory.json" };
// Synthetic software fixtures, not Line Laboratory measurements. Never written to site data.
const fixture = (id, lb, diameter, variant = "SYNTHETIC variant A") => ({
  source_record_id: "TEST-ONLY-" + id, original_name: "SYNTHETIC TEST ONLY " + lb,
  brand: "TEST ONLY", product: "NOT A REAL PRODUCT", variant, material: "Braid",
  rated_strength: { value: lb, unit: "lb", label: lb + " lb" },
  tested_breaking_strength: { value: lb * 2, unit: "lb" },
  diameters: [{ method_id: "synthetic-test-only", value: diameter, unit: "mm" }],
  capacity_method_id: "synthetic-test-only", source_url: "https://example.invalid/test-only",
  updated_at: "2026-10-01T00:00:00Z", status: "active"
});
const records = [fixture("6", 6, .12), fixture("60", 60, .42), fixture("6B", 6, .14, "SYNTHETIC variant B")];
const empty = { schemaVersion: 1, source: sources.SOURCE, lastSuccessfulSync: null, records: [] };
const data = { ...empty, records };
const catalog = sources.createCatalog(manufacturer, data, release);
assert.equal(catalog.laboratory.length, 3);
assert.equal(catalog.manufacturer, manufacturer);
assert.equal(catalog.resolve(sources.SOURCE, "line-laboratory:TEST-ONLY-6").lb, 6);
assert.equal(catalog.resolve(sources.SOURCE, "line-laboratory:TEST-ONLY-60").lb, 60);
assert.notEqual(catalog.laboratory[0].id, catalog.laboratory[2].id);
assert.equal(catalog.resolve("manufacturer", catalog.laboratory[0].id), null);
assert.equal(catalog.resolve(sources.SOURCE, manufacturer[0].id), null);
assert.equal(catalog.resolve(sources.SOURCE, "TEST-ONLY-6"), null);
assert.equal(catalog.resolve(sources.SOURCE, "unknown"), null);
assert.equal(catalog.laboratory[0].tested_breaking_strength.value, 12);
assert.equal(sources.createCatalog(manufacturer, data, { ...release, enabled: false }).laboratory.length, 0);
assert.equal(sources.createCatalog(manufacturer, data, { ...release, approvedMethods: [] }).laboratory.length, 0);
for (const bad of [{ ...records[0], rated_strength: null }, { ...records[0], updated_at: "2026-02-30T00:00:00Z" }, { ...records[0], diameters: [{ method_id: "synthetic-test-only", value: .12, unit: "MM" }] }, { ...records[0], source_url: "javascript:alert(1)" }]) assert.throws(() => sources.validateRecord(bad, release.approvedMethods));
const link = new URL(sources.buildLink("https://example.invalid/?reel=exact-reel&lb=60", catalog.laboratory[0]));
assert.deepEqual(sources.selection(link.search), { id: catalog.laboratory[0].id, source: sources.SOURCE, explicit: true });
assert.equal(link.searchParams.has("lb"), false);
assert.equal(sources.verifiedMatch(manufacturer[0], catalog, []), null);
const m = { ...manufacturer[0], type: "Braid", lb: 6 }, lab = catalog.laboratory[0];
const mapping = { status: "approved", approved_by: "SYNTHETIC REVIEW", approved_at: "2026-10-01T00:00:00Z", evidence_url: "https://example.invalid/test-only", manufacturer_id: m.id, source_record_id: lab.source_record_id,
  manufacturer_fingerprint: JSON.stringify([m.id, m.brand, m.model, m.type, m.lb, m.dia_in, m.dia_mm, m.source_scope_label || ""]),
  laboratory_fingerprint: JSON.stringify([lab.source_record_id, lab.brand, lab.model, lab.variant, lab.type, lab.rated_strength.value, lab.rated_strength.unit, lab.rated_strength.label]) };
assert.equal(sources.verifiedMatch(m, catalog, [mapping]).id, lab.id);
assert.equal(sources.verifiedMatch({ ...m, lb: m.lb + 1 }, catalog, [mapping]), null);
assert.equal(sources.verifiedMatch(m, catalog, [mapping, mapping]), null);
assert.equal(sources.verifiedMatch(m, catalog, [{ ...mapping, approved_at: "unknown" }]), null);
assert.equal(sources.createCatalog(manufacturer, { ...data, records: [{ ...records[0], status: "retired" }] }, release).laboratory.length, 0);
console.log("PASS exact identities, rated/tested strengths, variants, units, methods, links, disabled gate");

const result = mergeRecords(empty, records, release);
assert.equal(result.counts.added, 3);
assert.equal(mergeRecords(result.data, records, release).changed, false);
assert.equal(mergeRecords(result.data, records.slice(0, 1), release).counts.retained, 2);
assert.throws(() => mergeRecords(result.data, [], release));
assert.throws(() => mergeRecords(result.data, [records[0], records[0]], release));
assert.throws(() => mergeRecords(result.data, [{ ...records[0], rated_strength: { value: 60, unit: "lb", label: "60 lb" }, updated_at: "2026-10-02T00:00:00Z" }], release));
const renamed = { ...records[0], original_name: "SYNTHETIC RENAMED DISPLAY ONLY", updated_at: "2026-10-02T00:00:00Z" };
assert.equal(mergeRecords(result.data, [renamed], release).counts.updated, 1);
assert.throws(() => mergeRecords(result.data, [{ ...records[0], original_name: "unversioned change" }], release));
assert.equal(decodeFeed(JSON.stringify(data), "json").length, 3);
const csvRow = Object.fromEntries(csvFields.map(field => [field, records[0][field] || ""]));
Object.assign(csvRow, { rated_strength_value: "6", rated_strength_unit: "lb", rated_strength_label: "6 lb", diameters_json: JSON.stringify(records[0].diameters), tested_breaking_strength_value: "12", tested_breaking_strength_unit: "lb" });
const quote = value => '"' + String(value).replaceAll('"', '""') + '"';
const csv = csvFields.map(quote).join(",") + "\n" + csvFields.map(field => quote(csvRow[field])).join(",");
assert.equal(decodeFeed(csv, "csv")[0].rated_strength.value, 6);
assert.throws(() => decodeFeed(csv.replace('"6",', '"6lb",'), "csv"));
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "reelcalc-lab-test-"));
try {
  const dataFile = path.join(temp, "catalog.json"), input = path.join(temp, "feed.json");
  await fs.writeFile(dataFile, JSON.stringify(empty)); await fs.writeFile(input, JSON.stringify(data));
  const config = { ...release, format: "json", partnerAuthorized: true, approvedBy: "SYNTHETIC TEST", authorizationReference: "TEST ONLY", privateDir: path.join(temp, "private") };
  assert.equal((await runImport({ config, input, dataFile })).written, false);
  assert.equal((await runImport({ config, input, dataFile, write: true })).added, 3);
  const saved = await fs.readFile(dataFile, "utf8");
  assert.equal((await runImport({ config, input, dataFile, write: true })).changed, false);
  await fs.writeFile(input, JSON.stringify(empty));
  await assert.rejects(runImport({ config, input, dataFile, write: true }));
  assert.equal(await fs.readFile(dataFile, "utf8"), saved);
  await assert.rejects(runImport({ config: { ...config, feedUrl: "https://example.invalid/private?token=SECRET", allowedFeedHosts: [] }, dataFile, write: true }));
  assert.equal(await fs.readFile(dataFile, "utf8"), saved);
  assert.ok(!(await fs.readFile(path.join(temp, "private/sync.jsonl"), "utf8")).includes("SECRET"));
} finally { await fs.rm(temp, { recursive: true, force: true }); }
console.log("PASS CSV/JSON, duplicate prevention, versioned updates, identity holds, failed/empty feed preservation, private history");

const coreContext = { window: {} }; vm.runInNewContext(await read("js/calculator-core.js"), coreContext);
const core = coreContext.window.ReelCalcCore;
const reel = reels.find(item => core.isReelReady(item) && item.brand === "Daiwa");
const measured = catalog.laboratory[0];
const plain = { id: "custom-main-line", brand: "Custom", model: "Braid", type: "Braid", lb: measured.lb, dia_in: measured.dia_in, dia_mm: measured.dia_mm };
assert.equal(core.calculateFullSpoolCapacity(reel, measured), core.calculateFullSpoolCapacity(reel, plain));
assert.equal(core.capacityBasisForActualLine(reel, measured, manufacturer).capacityYards, core.capacityBasisForActualLine(reel, plain, manufacturer).capacityYards);
console.log("PASS shared-engine measured input parity without changing manufacturer reference pool");

async function dom(html, search = "", labData = data, labRelease = release) {
  const instance = new JSDOM(html, { url: "https://local.example/index.html" + search, runScripts: "outside-only", pretendToBeVisual: true });
  await new Promise(resolve => instance.window.addEventListener("load", resolve, { once: true }));
  instance.window.console = console;
  instance.window.fetch = async url => {
    const pathname = new URL(String(url), "https://local.example/").pathname.slice(1);
    if (pathname === "data/line-laboratory-release.json") return { ok: true, json: async () => labRelease };
    if (pathname === "data/line-laboratory.json") return { ok: true, json: async () => labData };
    return { ok: true, json: async () => json(pathname) };
  };
  instance.window.HTMLElement.prototype.scrollIntoView = function() {};
  return instance;
}
async function script(instance, name) {
  Object.defineProperty(instance.window.document, "currentScript", { configurable: true, value: { src: "https://local.example/" + name, dataset: {} } });
  instance.window.eval(await read(name) + (name === "js/wizard.js" ? "\nwindow.__testState = state;" : ""));
}
const pickerDOM = await dom("<div id='pick'></div><div id='manufacturer'>Existing controls</div>");
await script(pickerDOM, "js/line-sources.js");
const ds = pickerDOM.window.ReelCalcLineSources;
let picked = measured, source;
ds.mountPicker({ catalog, parent: pickerDOM.window.document.getElementById("pick"), manufacturerFields: [pickerDOM.window.document.getElementById("manufacturer")], onSourceChange: value => { source = value; picked = null; }, onSelect: value => { picked = value; } });
const selects = pickerDOM.window.document.querySelectorAll("select");
assert.equal(selects[0].value, "manufacturer", "Measured diameters remain opt-in");
assert.equal(selects[0].options[1].textContent, "Line Laboratory - measured diameters");
const coverage = pickerDOM.window.document.querySelector(".rc-line-source > small");
assert.equal(coverage.hidden, true);
selects[0].value = sources.SOURCE; selects[0].dispatchEvent(new pickerDOM.window.Event("change"));
assert.equal(picked, null); assert.equal(source, sources.SOURCE);
assert.equal(coverage.hidden, false);
assert.equal(coverage.textContent, "Currently available: tested braid.");
assert.ok(pickerDOM.window.document.body.textContent.includes("Search tested lines"));
selects[1].value = measured.id; selects[1].dispatchEvent(new pickerDOM.window.Event("change"));
assert.equal(picked.id, measured.id);
const creditLink = pickerDOM.window.document.querySelector("a");
assert.equal(creditLink.href, "https://linelaboratory.com/");
assert.equal(creditLink.textContent, "Visit Line Laboratory");
assert.equal(creditLink.target, "_blank");
assert.ok(creditLink.rel.includes("noopener"));
assert.ok(pickerDOM.window.document.body.textContent.includes("Spool capacity is still an estimate."));
const credit = pickerDOM.window.document.createElement("div");
ds.renderAttribution(credit, { ...measured, source_url: "" });
assert.equal(credit.querySelector("a").href, "https://linelaboratory.com/", "Homepage credit does not require a per-test API URL");
assert.equal(measured.source_url, "https://example.invalid/test-only", "Original source provenance is retained");
selects[0].value = "manufacturer"; selects[0].dispatchEvent(new pickerDOM.window.Event("change"));
assert.equal(picked, null);
assert.equal(coverage.hidden, true);
assert.equal(pickerDOM.window.document.querySelector("a"), null);
const mixed = sources.createCatalog(manufacturer, { ...data, records: [records[0], { ...records[1], material: "Monofilament" }] }, release);
const mixedParent = pickerDOM.window.document.createElement("div");
ds.mountPicker({ catalog: mixed, parent: mixedParent, selection: { source: sources.SOURCE, id: "" }, onSourceChange() {}, onSelect() {} });
assert.equal(mixedParent.querySelector("small").textContent, "Currently available: tested monofilament, braid.", "Coverage follows the available materials rather than assuming every lab test is braid");
const comparison = pickerDOM.window.document.createElement("div");
function compareDiameters(quoted, measuredMm) {
  ds.renderDiameters(comparison, { ...measured, quoted_diameter_mm: quoted, dia_mm: measuredMm });
  assert.equal(comparison.querySelector(".rc-lab-diameter-caution"), null, "Diameter differences are informational, never a warning");
  const difference = comparison.querySelector(".rc-lab-diameter-difference");
  if (difference) {
    for (const style of ["background", "border", "color", "fontWeight"]) assert.equal(difference.style[style], "");
    assert.equal(difference.getAttribute("role"), null);
    assert.equal(difference.querySelector("strong"), null);
  }
  return comparison.querySelector(".rc-lab-diameter-difference")?.textContent;
}
assert.equal(compareDiameters(.21, .313), "Measured diameter is 49% larger than the label.");
assert.ok(!comparison.textContent.includes("extra caution"));
assert.equal(compareDiameters(.4, .3), "Measured diameter is 25% smaller than the label.");
assert.equal(compareDiameters(.2, .2498), "Measured diameter is 24.9% larger than the label.");
assert.equal(compareDiameters(.4, .5), "Measured diameter is 25% larger than the label.");
assert.equal(compareDiameters(.1, .3), "Measured diameter is 200% larger than the label.");
assert.equal(compareDiameters(.21, .21), "Measured diameter matches the label.");
assert.equal(compareDiameters(.2, .20001), "Measured diameter is less than 0.1% larger than the label.");
for (const invalid of [null, undefined, 0, -1, NaN, Infinity]) {
  assert.equal(compareDiameters(invalid, .313), undefined);
  assert.equal(comparison.querySelector(".rc-lab-diameter-caution"), null);
}
const inchQuotedRecord = { ...records[0], quoted_diameter: { value: .01, unit: "in" }, diameters: [{ method_id: "synthetic-test-only", value: .3175, unit: "mm" }] };
ds.renderDiameters(comparison, ds.toLine(inchQuotedRecord, release.approvedMethods));
assert.equal(comparison.querySelector(".rc-lab-diameter-difference").textContent, "Measured diameter is 25% larger than the label.");
ds.renderDiameters(comparison, manufacturer[0]);
assert.equal(comparison.textContent, "", "Switching away clears all laboratory comparisons and cautions");
pickerDOM.window.close();
console.log("PASS optional measured source, material coverage, estimate notice, homepage attribution and neutral signed diameter differences without warnings");

const wizardDOM = await dom(await read("index.html"), "?reel=" + reel.id + "&line=" + measured.id + "&lineSource=line_laboratory");
await script(wizardDOM, "js/calculator-core.js"); await script(wizardDOM, "js/recommendation-engine.js"); await script(wizardDOM, "js/line-sources.js"); await script(wizardDOM, "js/wizard.js");
wizardDOM.window.document.dispatchEvent(new wizardDOM.window.Event("DOMContentLoaded"));
await new Promise(resolve => setTimeout(resolve, 300));
assert.equal(wizardDOM.window.eval("getActiveMainLine().id"), measured.id);
assert.equal(wizardDOM.window.__testState.lines.length, manufacturer.length);
assert.equal(wizardDOM.window.eval("getActiveMainLine().lb"), 6);
wizardDOM.window.__testState.backingMode = "yes";
const backingSource = wizardDOM.window.document.querySelector('select[aria-label="backing line diameter source"]');
backingSource.value = sources.SOURCE; backingSource.dispatchEvent(new wizardDOM.window.Event("change"));
assert.equal(wizardDOM.window.getBackingLine(), null, "No generic backing substituted for empty laboratory choice");
assert.ok(wizardDOM.window.document.getElementById("backingResult").textContent.includes("No manufacturer diameter"));
const backingTest = wizardDOM.window.document.querySelector('select[aria-label="backing Line Laboratory test"]');
backingTest.value = catalog.laboratory[1].id; backingTest.dispatchEvent(new wizardDOM.window.Event("change"));
assert.equal(wizardDOM.window.getBackingLine().id, catalog.laboratory[1].id);
assert.ok(wizardDOM.window.document.getElementById("backingResult").textContent.includes("60"));
wizardDOM.window.__testState.mainSourcePicker.reset();
assert.equal(wizardDOM.window.eval("getActiveMainLine()"), null);
wizardDOM.window.close();

async function reelDOM(id) {
  const instance = await dom('<div data-reelcalc-calculator data-reel-id="' + reel.id + '" data-default-mode="capacity"></div>', "?lineSource=line_laboratory&line=" + id);
  for (const file of ["js/calculator-core.js", "js/line-selector.js", "js/affiliate-links.js", "js/line-sources.js"]) await script(instance, file);
  instance.window.ReelCalcCapacityPages = { ready: Promise.resolve(), enabled: () => false, resolve: () => null };
  instance.window.ReelCalcLineGuides = { showAfter() {} };
  await script(instance, "js/reel-page-calculator.js");
  await new Promise(resolve => setTimeout(resolve, 300));
  return instance;
}
const rd = await reelDOM(measured.id);
const shadow = rd.window.document.querySelector("[data-reelcalc-calculator]").shadowRoot;
assert.ok(shadow);
assert.ok(shadow.querySelector('[data-role="output"]').textContent.includes("SYNTHETIC TEST ONLY 6"), rd.window.document.body.textContent + shadow.querySelector('[data-role="output"]').textContent);
shadow.querySelector('[data-action="unit"][data-unit="metric"]').click();
assert.ok(shadow.querySelector('[data-role="output"]').textContent.includes("SYNTHETIC TEST ONLY 6"));
rd.window.close();
const missing = await reelDOM("line-laboratory:missing");
const missingShadow = missing.window.document.querySelector("[data-reelcalc-calculator]").shadowRoot;
assert.ok(!missingShadow.querySelector('[data-role="output"]').textContent.includes("yd"));
assert.ok(missingShadow.textContent.includes("No manufacturer diameter will be substituted"));
missing.window.close();
console.log("PASS picker switching, Wizard exact preload, reel-page results, unit switching and missing-record blocking");

const actualData = await json("data/line-laboratory.json");
const actualRelease = { ...release, selectionMode: "separate", approvedMethods: [method] };
const actualCatalog = sources.createCatalog(manufacturer, actualData, actualRelease);
assert.ok(actualCatalog.laboratory.length >= 199);
assert.equal(actualCatalog.laboratory.length, actualData.records.filter(r => r.status === "active").length);
const jbraid = actualCatalog.laboratory.find(l => l.brand.trim() === "Daiwa" && l.model === "Jbraid x4" && l.lb === 20);
assert.equal(jbraid.dia_mm, .313); assert.equal(jbraid.quoted_diameter_mm, .21);
const snapshotText = JSON.stringify(actualData.records.map(r => r.api_provenance.raw));
assert.equal(prepareApi(snapshotText, actualData, new Date().toISOString()).changed, false);
assert.throws(() => prepareApi("[]", actualData, new Date().toISOString()));
const changedRows = JSON.parse(snapshotText); changedRows[0].AverageDiameter += .001;
assert.throws(() => prepareApi(JSON.stringify(changedRows), actualData, new Date().toISOString()), /requires review/);
const duplicateRows = JSON.parse(snapshotText); duplicateRows.push(duplicateRows[0]);
assert.throws(() => prepareApi(JSON.stringify(duplicateRows), actualData, new Date().toISOString()));
const fewer = JSON.parse(snapshotText).slice(1);
assert.equal(prepareApi(JSON.stringify(fewer), actualData, new Date().toISOString()).data.records.length, actualData.records.length);
const publishedRelease = await json("data/line-laboratory-release.json");
assert.equal(publishedRelease.enabled, true);
assert.deepEqual(publishedRelease.approvedMethods, [method]);
assert.equal(publishedRelease.selectionMode, "separate");
console.log("PASS authentic API label/measured mapping, stable IDs, repeat/empty/changed/duplicate/missing feed safety; optional live gate configured");

const actualWizard = await dom(await read("index.html"), "?reel=" + reel.id + "&line=" + jbraid.id, actualData, actualRelease);
for (const file of ["js/calculator-core.js", "js/recommendation-engine.js", "js/line-sources.js", "js/wizard.js"]) await script(actualWizard, file);
actualWizard.window.document.dispatchEvent(new actualWizard.window.Event("DOMContentLoaded"));
await new Promise(resolve => setTimeout(resolve, 300));
assert.equal(actualWizard.window.eval("getActiveMainLine().dia_mm"), .313);
assert.ok(actualWizard.window.document.querySelector(".rc-lab-diameters").textContent.includes("0.21 mm"));
const searchBox = actualWizard.window.document.querySelector('.rc-line-source input[type="search"]');
searchBox.value = "jbraid x4 20"; searchBox.dispatchEvent(new actualWizard.window.Event("input"));
assert.equal(actualWizard.window.document.querySelector('select[aria-label="main Line Laboratory test"]').options.length, 2);
assert.equal(actualWizard.window.eval("getActiveMainLine().id"), jbraid.id);
actualWizard.window.close();


const comparisonReels = ['daiwa-bg-lt-3000d-xh', 'daiwa-bg-lt-4000d-cxh'];
assert.ok(comparisonReels.every(id => reels.some(r => r.id === id)));
const rc = await dom(await read("examples/reel-comparison.html"), "?reel1=" + comparisonReels[0] + "&reel2=" + comparisonReels[1] + "&mainLine=" + jbraid.id + "&lineSource=line_laboratory&backing=off", actualData, actualRelease);
rc.window.ReelCalcCapacityPages = { ready: Promise.resolve(), enabled: () => false, resolve: () => null };
rc.window.ReelCalcLineGuides = { showAfter() {} };
for (const file of ["js/calculator-core.js", "js/line-selector.js", "js/comparison-data.js", "js/line-sources.js", "examples/reel-comparison.js"]) await script(rc, file);
await new Promise(resolve => setTimeout(resolve, 300));
assert.ok(rc.window.document.querySelector(".rc-lab-diameters")?.textContent.includes("0.313 mm"));
assert.equal(rc.window.document.querySelector('select[aria-label="main Line Laboratory test"]').value, jbraid.id);
assert.ok(!rc.window.document.getElementById("comparison-status").classList.contains("is-error"));
assert.equal(rc.window.document.querySelector('[data-comparison-action="wizard"]') != null, true);
for (const link of rc.window.document.querySelectorAll('[data-comparison-action="wizard"]')) {
  assert.equal(new URL(link.href).searchParams.get('line'), jbraid.id);
  assert.equal(new URL(link.href).searchParams.get('lineSource'), sources.SOURCE);
}
rc.window.document.getElementById('reset-comparison').click();
assert.notEqual(new URL(rc.window.location.href).searchParams.get('lineSource'), sources.SOURCE);
assert.equal(rc.window.document.querySelector('select[aria-label="main line diameter source"]').value, 'manufacturer');
rc.window.close();
console.log("PASS actual-data Wizard search and reel-comparison preload, handoff and source reset");
