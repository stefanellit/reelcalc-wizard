import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const context = { window: {}, URL, URLSearchParams };
vm.runInNewContext(fs.readFileSync(path.join(root, "js/line-database-tools.js"), "utf8"), context);
const tools = context.window.ReelCalcLineTools;
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/lines.json"), "utf8"));
const urls = { homepage: "https://www.reelcalc.com/", wizard: "https://www.reelcalc.com/reelcalc-wizard", pe: "https://www.reelcalc.com/pe-line-capacity-calculator" };
const fmt = (value, places) => Number(value).toFixed(places).replace(/0+$/, "").replace(/\.$/, "");

for (const line of catalog) {
  const record = tools.rowRecord([line.brand, line.model, line.type, String(line.lb), fmt(line.dia_in, 4), fmt(line.dia_mm, 3)], false);
  assert.ok(record, `Read ${line.id}`);
  const exact = tools.matchCatalogLine(record, catalog);
  assert.equal(exact?.id, line.id, `Exact wizard match for ${line.id}`);
  const wizard = new URL(tools.buildDestination(record, false, "wizard", exact, urls));
  assert.equal(wizard.searchParams.get("line"), line.id);
  assert.equal(wizard.searchParams.get("lb"), String(line.lb));
  assert.equal(wizard.searchParams.has("reel"), false);
  assert.equal(wizard.searchParams.has("mainYards"), false);
  const calculator = new URL(tools.buildDestination(record, false, "calculator", null, urls));
  const selection = tools.readSelectionParams(calculator.search);
  assert.equal(selection.diameterIn, Number(fmt(line.dia_in, 4)));
  assert.equal(selection.lb, Number(line.lb));
  assert.equal(selection.name, `${line.brand} ${line.model}`);
  assert.equal(selection.type, /braid/i.test(line.type) ? "braid" : /fluoro/i.test(line.type) ? "fluoro" : "mono");
}

const powerpro = catalog.find(line => line.id === "powerpro-spectra-braid-30");
assert.ok(powerpro);
assert.equal(tools.matchCatalogLine({ ...powerpro, dia_in: 0.02, notes: "" }, catalog), null, "Never change the selected diameter to force a wizard match");
assert.equal(tools.matchCatalogLine({ ...powerpro, notes: "Reference estimate" }, catalog), null);
assert.equal(tools.rowRecord(["No rows match"], false), null);
const generic = tools.rowRecord(["Generic PE Standard", "Estimated PE Diameter", "1.5", "\u2014", "\u2014", "Reference", "0.205", "0.0081", "Reference estimate for PE capacity calculations"], true);
assert.equal(generic.lb, null);
assert.equal(tools.matchCatalogLine(generic, catalog), null);
assert.equal(tools.buildDestination(generic, true, "wizard", null, urls), null);
const peUrl = new URL(tools.buildDestination(generic, true, "calculator", null, urls));
assert.equal(peUrl.pathname, "/pe-line-capacity-calculator");
assert.equal(peUrl.searchParams.get("rcPe"), "1.5");
assert.equal(peUrl.searchParams.has("rcLineLb"), false);
assert.equal(tools.readSelectionParams(peUrl.search).note, generic.notes);
const unsupported = { ...generic, pe: 0.3, dia_mm: 0.094, dia_in: 0.0037 };
const fallback = new URL(tools.buildDestination(unsupported, true, "calculator", null, urls));
assert.equal(fallback.pathname, "/", "Unsupported PE sizes have a working diameter-based route");
assert.equal(tools.readSelectionParams(fallback.search).diameter, 0.094);
assert.equal(tools.readSelectionParams(fallback.search).unit, "mm");

for (const patch of ["rcDiameter=0", "rcDiameter=-0.01", "rcDiameter=Infinity", "rcDiameter=NaN", "rcDiameter=500", "rcDiameterUnit=feet", "rcLineType=steel", "rcSource=unknown", "rcPe=", "rcLineName="]) {
  const params = new URLSearchParams(peUrl.search);
  const [name, value] = patch.split("=");
  params.set(name, value);
  assert.equal(tools.readSelectionParams(params.toString()), null, patch);
}
assert.equal(tools.readSelectionParams(""), null);
assert.equal(tools.readSelectionParams("line=powerpro-spectra-braid-30"), null, "Existing unrelated links are unchanged");
if (process.argv[2]) {
  const peCatalog = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  let wizardMatches = 0;
  let diameterRoutes = 0;
  for (const line of peCatalog) {
    const record = tools.rowRecord([line.brand, line.model, String(line.pe), String(line.lb), String(line.kg), String(line.strands), fmt(line.dia_mm, 3), fmt(line.dia_in, 4), line.notes], true);
    assert.ok(record, `Read PE ${line.brand} ${line.model} ${line.pe}`);
    const exact = tools.matchCatalogLine(record, catalog);
    if (exact) {
      wizardMatches++;
      assert.equal(exact.lb, record.lb);
      assert.equal(fmt(exact.dia_mm, 3), fmt(record.dia_mm, 3));
    }
    const destination = new URL(tools.buildDestination(record, true, "calculator", exact, urls));
    const selected = tools.readSelectionParams(destination.search);
    assert.ok(selected);
    assert.equal(selected.pe, Number(line.pe));
    assert.equal(selected.diameter, Number(fmt(line.dia_mm, 3)));
    assert.equal(selected.lb, Number(line.lb) || null);
    assert.equal(selected.note, line.notes);
    if (destination.pathname === "/") diameterRoutes++;
    if (/reference/i.test(line.notes) || !line.lb) assert.equal(exact, null);
  }
  console.log(`Passed ${peCatalog.length} PE records: ${wizardMatches} exact wizard matches, ${diameterRoutes} diameter-only routes for unsupported PE sizes.`);
}

const wizardContext = vm.createContext({ window: { location: { search: "" }, ReelCalcCore: { isLineReady: line => Number(line.dia_in) > 0 } }, document: { addEventListener() {} }, URLSearchParams, Map, console });
vm.runInContext(fs.readFileSync(path.join(root, "js/wizard.js"), "utf8"), wizardContext);
wizardContext.catalogForTest = catalog;
vm.runInContext(`state.lines = catalogForTest; setActiveButtons = function() {}; selectLine = function(line) { state.selectedLine = line; }; resetDesiredMainLine = function() { state.desiredMainYards = 100; }; trackWizardEvent = function() {};`, wizardContext);
for (const line of catalog) {
  wizardContext.window.location.search = `?line=${encodeURIComponent(line.id)}&lb=${line.lb}`;
  assert.equal(vm.runInContext("applyLinePreloadFromUrl().id", wizardContext), line.id);
  assert.equal(vm.runInContext("state.path", wizardContext), "exact");
}
for (const query of ["", "?line=missing", "?line=powerpro-spectra-braid-30&lb=20", "?line=powerpro-spectra-braid-30&lb=NaN", "?line=powerpro-spectra-braid-30&lb=-1"]) {
  wizardContext.window.location.search = query;
  assert.equal(vm.runInContext("applyLinePreloadFromUrl()", wizardContext), null);
}
wizardContext.window.location.search = "?mainLine=powerpro-spectra-braid-30&mainYards=65";
assert.equal(vm.runInContext("applyLinePreloadFromUrl().id", wizardContext), "powerpro-spectra-braid-30");
assert.equal(vm.runInContext("state.desiredMainYards", wizardContext), 65);
console.log(`Passed: ${catalog.length} exact wizard links and calculator diameter handoffs, PE references, unsupported PE sizes, and invalid URL inputs.`);
