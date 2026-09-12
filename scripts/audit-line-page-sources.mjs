import assert from "node:assert/strict";
import fs from "node:fs";

const lines = JSON.parse(fs.readFileSync("data/lines.json", "utf8"));
const products = JSON.parse(fs.readFileSync("data/line-page-products.json", "utf8")).products;
const report = { date: "2026-09-12", sources: [], variants: [], links: [] };
async function json(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
  assert(r.ok, `${url}: ${r.status}`);
  const body = await r.json();
  report.sources.push({ url, status: r.status, product: body.title, variants: body.variants.length });
  return body.variants.filter(v => v.sku);
}
function compare(productId, variants, readVariant) {
  const p = products[productId];
  for (const line of lines.filter(l => l.brand === p.brand && l.model === p.model && !(p.excludedLineIds || []).includes(l.id))) {
    const matches = variants.map(readVariant).filter(v => v.lb === Number(line.lb));
    const offered = [...new Set(matches.map(v => v.yd))].sort((a, b) => a - b);
    const pass = JSON.stringify(offered) === JSON.stringify(line.spool_sizes_yd)
      && matches.every(v => (!v.inches || v.inches === line.dia_in) && (!v.mm || v.mm === line.dia_mm));
    report.variants.push({ id: line.id, pass, catalog: line.spool_sizes_yd, published: offered });
  }
}
compare("seaguar-invizx", await json("https://seaguar.com/products/invizx.js"), v => {
  const m = v.option1.match(/([\d.]+)LB\s+([\d.]+)\s+in\.\s*\/\s*([\d.]+)\s*mm/i);
  assert(m, `Unrecognized InvizX option: ${v.option1}`);
  return { lb: Number(m[1]), inches: Number(m[2]), mm: Number(m[3]), yd: parseFloat(v.option2) };
});
compare("powerpro-spectra", await json("https://fishshop.shimano.com/products/powerpro.js"), v => ({
  lb: parseFloat(v.option1), yd: parseFloat(v.option2)
}));
const xl = [];
for (const slug of ["trilene-xl-filler-spool", "trilene-xl-bulk-spool"]) {
  xl.push(...await json(`https://www.berkley-fishing.com/products/${slug}.js`));
}
compare("berkley-trilene-xl", xl, v => ({ lb: parseFloat(v.option1), yd: parseFloat(v.option3) }));

// Follow only ordinary internal editorial/tool links, not affiliate clicks or draft canonicals.
const links = new Set();
for (const id of Object.keys(products)) {
  const html = fs.readFileSync(`examples/line-pages/${id}.html`, "utf8");
  for (const match of html.matchAll(/<a\b[^>]*\bhref="(https:\/\/www\.reelcalc\.com[^\"]*)"/g)) links.add(match[1].replaceAll("&amp;", "&"));
}
for (const url of links) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
    const body = await r.text();
    const title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
    report.links.push({ url, status: r.status, finalUrl: r.url, title, pass: r.ok && !/not found|page unavailable/i.test(title) });
  } catch (error) { report.links.push({ url, pass: false, error: String(error) }); }
}
report.passed = report.variants.every(v => v.pass) && report.links.every(l => l.pass);
fs.writeFileSync("reports/line-page-trust-audit-2026-09-12-sources.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
assert(report.passed, "Source or destination discrepancy needs review");
