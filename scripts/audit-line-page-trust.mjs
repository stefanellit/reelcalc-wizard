import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const lines = read("data/lines.json");
const reels = read("data/reels.json");
const products = read("data/line-page-products.json").products;
const context = vm.createContext({ window: {}, URL, URLSearchParams, console,
  document: { querySelector: () => ({ dataset: {} }), baseURI: "http://localhost/" } });
for (const file of ["js/calculator-core.js", "js/affiliate-links.js"]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}
// Expose the pure page calculation without booting the DOM or fetching data.
const source = fs.readFileSync("js/line-page-engine.js", "utf8").replace(
  'var ready = init();',
  "var ready; global.trustAudit = { calculateSetup: calculateSetup, state: state };"
);
vm.runInContext(source, context);
const core = context.window.ReelCalcCore;
const { calculateSetup, state } = context.window.trustAudit;
Object.assign(state, { lines, reels, affiliateData: read("data/reel-affiliates.json") });
const readyReels = reels.filter(core.isReelReady);
const backing = lines.find(x => x.id === "berkley-trilene-big-game-monofilament-10");
const selected = Object.values(products).flatMap(p => lines.filter(l =>
  l.brand === p.brand && l.model === p.model && !(p.excludedLineIds || []).includes(l.id)));
let checks = 0;
const findings = [];
function check(condition, name) { checks++; if (!condition) findings.push(name); }
function near(a, b) { return Number.isFinite(a) && Math.abs(a - b) < Math.max(1e-7, Math.abs(b) * 1e-9); }
function setup(reel, line, workingYards, extra = {}) {
  return calculateSetup({ reel, line, workingYards, spoolYards: 100000,
    backingLine: backing, ...extra });
}

// Independent single-rating volume oracle, including identity and diameter-square tests.
for (const line of selected) {
  const manual = { id: "manual", manualRating: {
    type: /braid/i.test(line.type) ? "braid" : "mono",
    capacityYards: 200, referenceDiameterIn: Number(line.dia_in), diameterProvided: true
  }};
  const full = setup(manual, line, 200, { capacityOnly: true });
  check(near(full.fullCapacity, 200), `Printed rating identity: ${line.id}`);
  for (const ratio of [0.5, 1, 2]) {
    const changed = { ...line, dia_in: Number(line.dia_in) * ratio };
    const expected = 200 / (ratio * ratio);
    const result = setup(manual, changed, expected / 2);
    const expectedBacking = (200 * Number(line.dia_in) ** 2 - expected / 2 * changed.dia_in ** 2) / backing.dia_in ** 2;
    check(near(result.fullCapacity, expected), `Squared diameter ratio ${ratio}: ${line.id}`);
    check(near(result.backingYards, expectedBacking), `Independent backing volume ${ratio}: ${line.id}`);
  }
  for (const fraction of [0.98, 0.995, 1, 1.001, 1.01, 1.02]) {
    const r = setup(manual, line, 200 * fraction);
    check(r.overCapacity === (fraction > 1), `Manual overfill ${fraction}: ${line.id}`);
    check(r.needsBacking === (fraction < 1), `Manual remaining volume ${fraction}: ${line.id}`);
  }
}

// Every offered strength against every usable reel, not just the three example cards.
let pairings = 0;
for (const reel of readyReels) {
  let previous = new Map();
  for (const line of selected) {
    pairings++;
    const cap = core.calculateFullSpoolCapacity(reel, line, { lineCatalog: lines });
    const r = setup(reel, line, cap * 0.5);
    check(r.ok && near(r.fullCapacity, cap), `Page/core parity ${reel.id}/${line.id}`);
    check(Number.isFinite(cap) && cap > 0, `Positive capacity ${reel.id}/${line.id}`);
    const family = `${line.brand}/${line.model}`;
    const volume = cap * line.dia_in ** 2;
    if (previous.has(family)) check(near(volume, previous.get(family)), `Diameter-volume consistency ${reel.id}/${line.id}`);
    previous.set(family, volume);
    const backingCap = core.calculateFullSpoolCapacity(reel, backing, { lineCatalog: lines });
    check(near(r.backingYards, backingCap / 2), `Half spool remaining ${reel.id}/${line.id}`);
    if (!/braid/i.test(line.type)) {
      const independent = reel.capacity_yards * (reel.rated_line_diameter_in / line.dia_in) ** 2;
      check(near(cap, independent), `Independent mono anchor ${reel.id}/${line.id}`);
    }
    const renamed = { ...line, lb: 999 };
    check(near(core.calculateFullSpoolCapacity(reel, renamed, { lineCatalog: lines }), cap), `Diameter not label drives capacity ${reel.id}/${line.id}`);
    const high = setup(reel, line, cap * 1.001);
    check(high.overCapacity && high.assessmentTone === "error", `Catalog slight overfill ${reel.id}/${line.id}`);
    const nearlyFull = setup(reel, line, cap * 0.995);
    check(nearlyFull.needsBacking && near(nearlyFull.backingYards, backingCap * 0.005), `Catalog small remainder ${reel.id}/${line.id}`);
    const short = setup(reel, line, Math.min(cap / 2, 1));
    check(short.assessmentTone !== "success" && !/separate .* working fills/.test(short.efficiencyText), `Short fill caution ${reel.id}/${line.id}`);
    const exact = setup(reel, line, cap, { spoolYards: cap, capacityOnly: true });
    check(exact.spoolEnoughForPlan && exact.leftoverYards === 0 && !exact.needsBacking, `Full spool identity ${reel.id}/${line.id}`);
    const shortage = setup(reel, line, cap, { spoolYards: cap / 2, capacityOnly: true });
    check(shortage.assessmentTone === "error" && near(shortage.shortfallYards, cap / 2), `Retail shortage ${reel.id}/${line.id}`);
  }
}

// Product/strength/length context in every offered purchase link.
let offers = 0;
for (const line of selected) for (const spool of line.spool_sizes_yd) {
  const offer = context.window.ReelCalcAffiliateLinks.buildRecommendedLineOffer({
    affiliateData: state.affiliateData, line, requiredYards: spool, spoolYards: spool });
  const url = new URL(offer.url);
  const query = url.searchParams.get("k") || "";
  check(url.hostname === "www.amazon.com" && !!url.searchParams.get("tag"), `Affiliate tag ${line.id}/${spool}`);
  check(query.toLowerCase().includes(line.brand.toLowerCase()) && query.includes(String(line.lb)) && query.includes(String(spool)), `Affiliate selection ${line.id}/${spool}`);
  offers++;
}

const report = { date: "2026-09-12", strengths: selected.length, readyReels: readyReels.length,
  pairings, offers, checks, failures: findings.length, examples: findings.slice(0, 20) };
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes("--save")) fs.writeFileSync("reports/line-page-trust-audit-2026-09-12-evidence.json", JSON.stringify(report, null, 2) + "\n");
assert.equal(findings.length, 0, `${findings.length} trust audit checks failed`);
