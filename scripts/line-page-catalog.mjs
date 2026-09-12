import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const lines = read("data/lines.json");
const peLines = read("data/pe-lines.json");
const products = read("data/line-page-products.json").products;
const published = new Set(read("data/line-page-release.json").publishedProducts);
const key = line => `${line.brand}|${line.model}`;
const slug = value => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const groups = Object.groupBy(lines, key);
const peGroups = Object.groupBy(peLines.filter(line => line.brand !== "Generic PE Standard"), key);
const pendingPath = path.join(root, "research/line-pages/review-status.json");
const reviewed = fs.existsSync(pendingPath) ? JSON.parse(fs.readFileSync(pendingPath, "utf8")) : {};
const entries = Object.entries(groups).map(([name, rows]) => {
  const configured = Object.entries(products).find(([, product]) => key(product) === name);
  const id = configured?.[0] || slug(name);
  const product = configured?.[1];
  const state = reviewed[id] || {};
  const excluded = new Set(product?.excludedLineIds || []);
  const active = rows.filter(row => !excluded.has(row.id));
  const leader = /leader/i.test(rows[0].type + " " + rows[0].model);
  const missing = [];
  if (!product) missing.push("product-specific gold content and image");
  if (!active.every(row => row.product_source_url && row.diameter_source_url)) missing.push("traceable diameter/product sources");
  if (!active.every(row => row.spool_sizes_yd?.length)) missing.push("strength-specific retail spool lengths");
  if (leader && !product?.leaderOnly) missing.push("leader-specific page flow (not full-spool mainline)");
  if (state.status === "source-conflict") missing.push("manufacturer specifications conflict; clarification required");
  if (!published.has(id) && !state.browserAudit) missing.push("browser and calculation audit");
  return { id, brand: rows[0].brand, model: rows[0].model, types: [...new Set(rows.map(row => row.type))],
    recordCount: rows.length, strengths: rows.map(row => row.lb), role: leader ? "leader" : "mainline",
    peRecordCount: peGroups[name]?.length || 0, status: published.has(id) ? "published" : state.status || (product ? "built-awaiting-audit" : "research-needed"),
    page: product ? `examples/line-pages/${id}.html` : null,
    sourceUrls: [...new Set(rows.flatMap(row => [row.product_source_url, row.diameter_source_url, ...(row.source_note?.match(/https:\/\/[^\s)]+/g) || [])]).filter(Boolean))],
    missing, notes: state.notes || [] };
});
const peOnly = Object.entries(peGroups).filter(([name]) => !groups[name]).map(([name, rows]) => ({
  id: slug(name), brand: rows[0].brand, model: rows[0].model, recordCount: rows.length,
  status: "separate-pe-review", note: "Keep regional/PE ratings separate until exact product identity and published diameters are verified. Do not convert PE into claimed measured diameter."
}));
if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw new Error("Line page ID collision");
const report = { generatedAt: new Date().toISOString(), mainCatalogModels: entries.length, published: entries.filter(e => e.status === "published").length,
  prepared: entries.filter(e => e.status === "audited-awaiting-bulk-release").length,
  notBuilt: entries.filter(e => !e.page).length,
  remaining: entries.filter(e => e.status !== "published").length, peOnlyModels: peOnly.length, entries, peOnly };
fs.mkdirSync(path.join(root, "generated/line-pages"), { recursive: true });
fs.writeFileSync(path.join(root, "generated/line-pages/catalog-progress.json"), JSON.stringify(report, null, 2) + "\n");
const markdown = ["# Line Page Expansion Tracker", "", `Main catalog: ${report.mainCatalogModels} models; ${report.published} published; ${report.remaining} remaining.`,
  `Prepared and audited: ${report.prepared}. Still requiring page construction/research: ${report.notBuilt}. Prepared is not the same as published.`,
  `Additional PE-only model names: ${report.peOnlyModels}; kept separate from the main catalog until identity and regional specifications are checked.`, "",
  "The presence of a diameter in the existing database is not, by itself, publication approval. No unknown spool size is invented.", "",
  "| Model | State | Missing checks |", "| --- | --- | --- |",
  ...entries.map(e => `| ${e.brand} ${e.model} | ${e.status} | ${e.missing.join("; ") || "None recorded"} |`), "",
  "## PE-Only Coverage", "", ...peOnly.map(e => `- ${e.brand} ${e.model}: ${e.status}`), ""].join("\n");
fs.writeFileSync(path.join(root, "generated/line-pages/CATALOG-PROGRESS.md"), markdown);
console.log(JSON.stringify({ mainCatalogModels: report.mainCatalogModels, published: report.published, remaining: report.remaining, peOnly: peOnly.length, leaders: entries.filter(e=>e.role === "leader").length }));
