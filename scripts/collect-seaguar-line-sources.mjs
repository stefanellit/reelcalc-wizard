import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const batch = JSON.parse(fs.readFileSync(path.join(root, "research/line-pages/seaguar-batch.json"), "utf8"));
const output = path.join(root, "research/line-pages/sources");
fs.mkdirSync(output, { recursive: true });
for (const item of batch) {
  const source = new URL(item.url + ".js");
  if (source.origin !== "https://seaguar.com") throw new Error("Unexpected source host");
  const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`);
  const product = await response.json();
  if (!Array.isArray(product.variants) || !product.variants.length) throw new Error(`${item.id}: missing variants`);
  // Preserve exact labels, SKUs, source time, and image URLs for independent review.
  const record = { ...item, retrievedAt: new Date().toISOString(), dataUrl: source.href, title: product.title,
    description: product.description, options: product.options, images: product.images,
    variants: product.variants.map(v => ({ id: v.id, sku: v.sku, title: v.title, options: v.options, available: v.available })) };
  fs.writeFileSync(path.join(output, item.id + ".json"), JSON.stringify(record, null, 2) + "\n");
  console.log(JSON.stringify({ id: item.id, title: product.title, variants: product.variants.length, options: product.options, sample: record.variants.slice(0, 2) }));
}
