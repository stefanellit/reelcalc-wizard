import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { parse, parseFragment } from "parse5";
import postcss from "postcss";

const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
const all = (node, predicate) => [...(predicate(node) ? [node] : []), ...(node.childNodes || []).flatMap(n => all(n, predicate))];
const products = JSON.parse(read("data/line-page-products.json")).products;
const lines = JSON.parse(read("data/lines.json"));
const release = JSON.parse(read("data/line-page-release.json"));
assert.match(release.version, /^[a-zA-Z0-9._-]+$/);
assert.equal(new Set(release.products).size, release.products.length);
for (const id of ["powerpro-spectra", "seaguar-invizx", "berkley-trilene-xl"]) assert.ok(release.products.includes(id), `Original guide missing: ${id}`);
for (const id of release.publishedProducts) assert.ok(release.products.includes(id), `Published guide missing: ${id}`);
let selectors = 0;
const unscoped = [];
postcss.parse(read("css/line-page-embed.css")).walkRules(rule => {
  for (const selector of rule.selectors) { if (!selector.startsWith(".rc-line-page")) unscoped.push(selector); selectors++; }
});
assert.deepEqual(unscoped, []);
assert.ok(read("css/line-page-embed.css").includes("@container rc-line-guide"));
for (const file of ["js/line-page-engine.js", "js/line-page-loader.js", "js/affiliate-links.js"]) new vm.Script(read(file));
for (const id of release.products) {
  const product = products[id];
  const doc = parseFragment(read(`components/line-pages/${id}.html`));
  const roots = all(doc, n => attr(n, "data-reelcalc-line-page") !== undefined);
  assert.equal(roots.length, 1);
  assert.equal(roots[0].tagName, "article");
  assert.equal(attr(roots[0], "data-product-id"), id);
  assert.equal(all(doc, n => ["h1", "main", "style"].includes(n.tagName)).length, 0);
  const ids = all(doc, n => attr(n, "id") !== undefined).map(n => attr(n, "id"));
  assert.equal(new Set(ids).size, ids.length, `${id}: duplicate IDs`);
  const records = lines.filter(l => l.brand === product.brand && l.model === product.model && l.type === product.lineType && !product.excludedLineIds?.includes(l.id));
  assert.equal(all(doc, n => attr(n, "data-chart-line") !== undefined).length, records.length);
  for (const link of all(doc, n => n.tagName === "a" && attr(n, "href")?.startsWith("#"))) assert.ok(ids.includes(attr(link, "href").slice(1)));
  for (const image of all(doc, n => n.tagName === "img")) {
    assert.ok(fs.existsSync(path.join(root, attr(image, "data-line-page-image"))));
    assert.ok(attr(image, "alt"));
    assert.ok(!attr(image, "src").includes("127.0.0.1"));
  }
  for (const script of all(doc, n => n.tagName === "script")) {
    assert.equal(attr(script, "type"), "application/ld+json");
    const json = JSON.parse(script.childNodes.map(n => n.value || "").join(""));
    const page = json["@graph"].find(n => n["@type"] === "WebPage");
    assert.equal(page.url, "https://www.reelcalc.com/lines/p/" + product.slug);
    assert.ok(!JSON.stringify(json).includes("aggregateRating"));
  }
  const snippet = read(`generated/line-pages/${id}-squarespace-snippet.html`);
  assert.ok(snippet.length < 700 && !snippet.includes("<style"));
  const scripts = all(parseFragment(snippet), n => n.tagName === "script");
  assert.equal(scripts.length, 1);
  assert.equal(attr(scripts[0], "data-product"), id);
  assert.equal(attr(scripts[0], "src"), "https://stefanellit.github.io/reelcalc-wizard/js/line-page-loader.js");
  const preview = parse(read(`previews/line-pages/${id}-hosted.html`));
  assert.ok(all(preview, n => n.tagName === "meta" && attr(n, "name") === "robots").some(n => attr(n, "content") === "noindex"));
  console.log(`${id}: ${records.length} strengths, ${snippet.length}-character snippet, valid component and schema.`);
}
console.log(`Publishing checks passed; ${selectors} isolated CSS selectors.`);
