import fs from "node:fs";

const file = "data/line-page-products.json";
const config = JSON.parse(fs.readFileSync(file, "utf8"));
const fields = ["quickSummary", "chartNote", "sourceNote", "strengthGuide", "spoolingGuide", "productGuidance", "faqs", "sources"];
const replacements = [
  [/\bcurrent assigned\b/g, "current"],
  [/\bCurrent assigned\b/g, "Current"],
  [/\bassigned product variants\b/g, "listed spool sizes"],
  [/\bassigned variants\b/g, "listed spool sizes"],
  [/\bAssigned variants\b/g, "Listed spool sizes"],
  [/\bpublic variant fields\b/g, "published specifications"],
  [/\bvariant fields\b/g, "published specifications"],
  [/\bvariant yard fields\b/g, "listed spool lengths"],
  [/\bnumeric diameter\b/g, "line diameter"],
  [/\bnumeric fields\b/g, "diameter or length details"],
  [/\bpackage map\b/g, "list of spool sizes"],
  [/\bmainline package choices\b/g, "spools for filling reels"],
  [/\bsource-supported package combinations\b/g, "confirmed strengths and spool sizes"],
  [/\bexact-SKU label corroboration\b/g, "confirmation from the exact package label"],
  [/\bindependently corroborated package measurements\b/g, "separately checked package measurements"],
  [/\bSKU rows\b/g, "package listings"],
  [/\bSKU table\b/g, "product table"],
  [/\bSKUs\b/g, "product codes"],
  [/\bSKU\b/g, "product code"]
];
let count = 0;
function simplify(value, key) {
  if (["url", "linkText"].includes(key)) return value;
  if (typeof value === "string") {
    const next = replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
    if (next !== value) count += 1;
    return next;
  }
  if (Array.isArray(value)) return value.map(item => simplify(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, simplify(v, k)]));
  return value;
}
for (const product of Object.values(config.products)) {
  for (const field of fields) if (field in product) product[field] = simplify(product[field]);
}
fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
console.log(`Simplified repeated package terminology in ${count} text fields. Specifications and URLs are unchanged.`);
