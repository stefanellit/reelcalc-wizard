import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import * as html from "parse5";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const write = (name, content) => {
  fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
  fs.writeFileSync(path.join(root, name), content);
};
const settings = JSON.parse(read("generated/line-pages/launch-settings.json"));
const release = JSON.parse(read("data/line-page-release.json"));
const base = "https://stefanellit.github.io/reelcalc-wizard/";
const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
const all = (node, predicate) => [...(predicate(node) ? [node] : []), ...(node.childNodes || []).flatMap(n => all(n, predicate))];
function remove(node) { node.parentNode.childNodes = node.parentNode.childNodes.filter(n => n !== node); }
// Identical columns/escaping to the established reel-page service-product import.
const headers = ["Product ID [Non Editable]", "Variant ID [Non Editable]", "Product Type [Non Editable]", "Product Page", "Product URL", "Title", "Description", "SKU", "GTIN", "MPN", "Option Name 1", "Option Value 1", "Option Name 2", "Option Value 2", "Option Name 3", "Option Value 3", "Price", "Sale Price", "On Sale", "Stock", "Categories", "Tags", "Weight", "Length", "Width", "Height", "Visible", "Hosted Image URLs"];
function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
const rows = [], pages = {}, previews = [];
for (const entry of settings) {
  const doc = html.parseFragment(read(`components/line-pages/${entry.id}.html`));
  const page = doc.childNodes.find(n => n.tagName === "article");
  if (!page) throw new Error(`Missing native guide: ${entry.id}`);
  // Import real readable content, not scripts or an empty calculator shell.
  for (const node of all(page, n => n.tagName === "script" || n.tagName === "nav" ||
    ["use-this-line", "compare-lines"].includes(attr(n, "id")) || attr(n, "aria-labelledby") === "examples-title")) remove(node);
  for (const button of all(page, n => n.tagName === "button")) { button.tagName = "span"; button.attrs = []; }
  for (const node of all(page, n => n.attrs)) {
    node.attrs = node.attrs.filter(a => !a.name.startsWith("data-") && a.name !== "aria-live");
  }
  page.attrs.push({ name: "data-line-guide-fallback", value: entry.id });
  const fallbackUrl = `${base}examples/line-pages/${entry.id}.html`;
  for (const link of all(page, n => n.tagName === "a" && attr(n, "href") === "#use-this-line")) link.attrs.find(a => a.name === "href").value = fallbackUrl + "#use-this-line";
  const description = html.serializeOuter(page).replace(/[\t ]+$/gm, "");
  if (/<(?:script|input|select|button|iframe|style)\b/i.test(description)) throw new Error(`Unsupported import markup: ${entry.id}`);
  const sku = "RCL" + createHash("sha256").update(entry.id).digest("hex").slice(0, 17).toUpperCase();
  const fields = { "Product Type [Non Editable]": "SERVICE", "Product Page": "lines", "Product URL": entry.slug,
    Title: entry.title, Description: description, SKU: sku, Price: "0", "On Sale": "No", Stock: "Unlimited",
    Categories: "/line-guides", Tags: "reelcalc-line-guide", Visible: "No" };
  rows.push(headers.map(key => fields[key] || ""));
  pages[entry.slug] = { id: entry.id, title: entry.title, seoTitle: entry.seoTitle, seoDescription: entry.seoDescription,
    url: entry.url, image: new URL(entry.thumbnail, base).href, sku };

  const fixture = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><meta name="description" content="Squarespace imported description"><link rel="canonical" href="${entry.url}"><title>${escape(entry.title)}</title>
<style>html{font-size:20px}body{margin:0;font-family:Georgia,serif;background:#eef1ef}header,footer{padding:20px}h1{font-size:32px}a{color:#931654}button{font-family:Georgia,serif}.product-content-wrapper{display:flex;gap:32px}.product-gallery{background:#fee2e2;min-height:500px;width:50%}.product-meta{width:50%;padding-left:38px}.product-add-to-cart{padding:20px;background:#fee2e2}.hidden-up-md{display:none}@media(max-width:720px){.hidden-up-md{display:block}.hidden-down-md{display:none}}</style>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"ReelCalc"},{"@type":"Product","name":"${escape(entry.title)}","offers":{"@type":"Offer","price":0}}]}</script>
<script src="../../js/squarespace-reel-page-loader.js" data-asset-base="../../" data-page-slug="${entry.slug}" defer></script></head>
<body><header id="host-header"><a href="https://www.reelcalc.com/">ReelCalc</a></header><main class="product-detail tag-reelcalc-line-guide"><div data-product-detail-layout="simple"><nav class="product-nav">Line Guides</nav><div class="product-content-wrapper"><div class="product-gallery">Product gallery</div><div class="product-meta"><h1 class="product-title">${escape(entry.title)}</h1><div class="product-price">$0.00</div><div class="product-description hidden-down-md">${description}</div><div class="product-add-to-cart"><button>Add to cart</button></div><div class="product-description hidden-up-md">${description}</div></div></div></div></main><footer id="host-footer">ReelCalc</footer></body></html>`;
  const preview = `previews/line-pages/${entry.id}-imported.html`;
  write(preview, fixture + "\n"); previews.push({ id: entry.id, preview });
}
if (new Set(rows.map(row => row[7])).size !== rows.length || new Set(rows.map(row => row[4])).size !== rows.length) throw new Error("Duplicate import IDs.");
const importFile = "generated/line-pages/UPLOAD-THIS-three-line-guides.csv";
write(importFile, [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n");
write("data/line-page-imports.json", JSON.stringify({ version: release.version, collection: "lines", pages }, null, 2) + "\n");
write("generated/line-pages/import-inventory.json", JSON.stringify({ importFile, count: rows.length, visibility: "hidden", previews, pages }, null, 2) + "\n");
console.log(`Built one ${rows.length}-page Squarespace import, URL registry, and product-wrapper previews. Pages import hidden.`);
