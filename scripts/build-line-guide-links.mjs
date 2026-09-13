import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));

export function buildLineGuideLinks() {
  const products = read("data/line-page-products.json").products;
  const registry = read("data/line-page-imports.json");
  const release = read("data/line-page-release.json");
  const catalog = read("data/lines.json");
  const guides = {};
  const lines = {};
  for (const id of release.publishedProducts) {
    const product = products[id];
    const page = product && registry.pages[product.slug];
    if (!page || page.id !== id) throw new Error(`Missing published route: ${id}`);
    const url = new URL(page.url);
    if (url.origin !== "https://www.reelcalc.com" || !url.pathname.startsWith("/lines/p/")) throw new Error(`Invalid guide URL: ${id}`);
    guides[id] = { url: url.href, title: product.h1 };
    const excluded = new Set(product.excludedLineIds || []);
    const choices = catalog.filter(line => line.brand === product.brand && line.model === product.model &&
      line.type === product.lineType && !excluded.has(line.id) && line.lb > 0 && line.dia_in > 0 &&
      line.dia_mm > 0 && line.spool_sizes_yd?.length);
    if (!choices.length) throw new Error(`No verified strengths: ${id}`);
    for (const line of choices) {
      if (lines[line.id]) throw new Error(`Ambiguous line guide: ${line.id}`);
      lines[line.id] = { guide: id, brand: line.brand, model: line.model, type: line.type,
        lb: line.lb, dia_in: line.dia_in, dia_mm: line.dia_mm };
    }
  }
  const output = { version: release.version, guides, lines };
  fs.writeFileSync(path.join(root, "data/line-guide-links.json"), JSON.stringify(output) + "\n");
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildLineGuideLinks();
  console.log(JSON.stringify({ guides: Object.keys(result.guides).length, strengths: Object.keys(result.lines).length }));
}
