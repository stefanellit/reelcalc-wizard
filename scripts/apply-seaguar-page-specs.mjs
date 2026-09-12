import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { normalizeSeaguar } from "./line-page-seaguar-specs.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const save = (file, data) => fs.writeFileSync(path.join(root, file), JSON.stringify(data, null, 2) + "\n");
const lines = read("data/lines.json");
const reviews = read("research/line-pages/source-review.json");
const changes = [];
for (const item of read("research/line-pages/seaguar-batch.json")) {
  const review = reviews[item.id];
  if (review.status !== "verified") continue;
  const source = read(`research/line-pages/sources/${item.id}.json`);
  for (const spec of normalizeSeaguar(source, review)) {
    const matches = lines.filter(line => line.brand === "Seaguar" && line.model === item.model && line.type === item.type && Number(line.lb) === spec.lb);
    assert(matches.length <= 1, `Ambiguous catalog mapping: ${item.model} ${spec.lb}`);
    const old = matches[0];
    const next = {...old, ...spec, brand:"Seaguar", model:item.model, type:item.type,
      id: old?.id || `seaguar-${item.model.toLowerCase().replace(/[^a-z0-9]+/g,"-")}-${item.type.toLowerCase()}-${spec.lb}`,
      product_source_url:item.url, diameter_source_url:review.chartUrl || item.url,
      source_note:`Verified against Seaguar's current assigned product variants and reviewed source evidence (${source.retrievedAt.slice(0,10)}). ${review.note}`,
      search_text:`Seaguar ${item.model} ${item.type} ${spec.lb} lb`.toLowerCase()
    };
    if (JSON.stringify(old) !== JSON.stringify(next)) {
      changes.push({id:next.id, old:old ? {dia_in:old.dia_in,dia_mm:old.dia_mm,spool_sizes_yd:old.spool_sizes_yd || []} : null,
        updated:{dia_in:next.dia_in,dia_mm:next.dia_mm,spool_sizes_yd:next.spool_sizes_yd},source:item.url});
      if (old) lines[lines.indexOf(old)] = next; else lines.push(next);
    }
  }
}
assert.equal(new Set(lines.map(line => line.id)).size, lines.length, "Duplicate line IDs");
// Keep the initial audit trail on repeat builds.
if (changes.length) save("research/line-pages/seaguar-catalog-changes.json", changes);
save("data/lines.json", lines);
console.log(`Applied ${changes.length} source-backed row updates; blocked models untouched.`);
