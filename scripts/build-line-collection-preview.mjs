import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.resolve(process.argv[2] || "scripts/line-page-publishing/package.json"));
const { parse, parseFragment, serialize } = require("parse5");
const output = "previews/line-pages/collection-layout";
fs.mkdirSync(output, { recursive: true });
const origin = "https://www.reelcalc.com";
const attr = (node, name) => node.attrs?.find(a => a.name === name);
function visit(node, fn) {
  fn(node);
  for (const child of [...(node.childNodes || [])]) visit(child, fn);
}
for (const kind of ["lines", "reel-pages"]) {
  const response = await fetch(`${origin}/${kind}`);
  if (!response.ok) throw new Error(`${kind}: HTTP ${response.status}`);
  const doc = parse(await response.text());
  let head, body;
  visit(doc, node => {
    if (node.tagName === "head") head = node;
    if (node.tagName === "body") body = node;
    if (["script", "iframe", "noscript", "base", "header", "footer"].includes(node.tagName) ||
        attr(node, "data-line-guide-host-css") || attr(node, "data-reelcalc-reel-page-css") ||
        (node.tagName === "link" && attr(node, "rel")?.value !== "stylesheet")) {
      node.parentNode.childNodes = node.parentNode.childNodes.filter(n => n !== node);
      return;
    }
    if (node.attrs) node.attrs = node.attrs.filter(a => !a.name.startsWith("on"));
    if (node.tagName === "body") attr(node, "class").value = attr(node, "class").value.replace(/reelcalc-(line|reel)-collection/g, "");
    if (attr(node, "class")?.value.includes("sqsrte-scaled-text-container")) attr(node, "class").value += " loaded";
    for (const name of ["href", "src"]) {
      const a = attr(node, name);
      if (a && !a.value.startsWith("#") && !a.value.startsWith("data:")) a.value = new URL(a.value, origin).href;
    }
  });
  for (const node of parseFragment('<meta name="robots" content="noindex"><style>html{scroll-behavior:auto!important}</style>').childNodes) {
    node.parentNode = head; head.childNodes.push(node);
  }
  const driver = `<script>
    const base = new URL('../../../', location.href).href;
    const testPath = new URLSearchParams(location.search).get('path') || '/${kind}';
    history.replaceState(null, '', testPath);
    const loader = document.createElement('script');
    loader.src = new URL('js/squarespace-reel-page-loader.js', base).href;
    loader.dataset.assetBase = base;
    document.head.appendChild(loader);
  </script>`;
  for (const node of parseFragment(driver).childNodes) { node.parentNode = body; body.childNodes.push(node); }
  fs.writeFileSync(`${output}/${kind}.html`, serialize(doc));
  console.log(`Captured public ${kind} markup without live analytics or shopping scripts.`);
}
