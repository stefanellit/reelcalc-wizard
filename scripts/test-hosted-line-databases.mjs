import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const context = { window: {}, document: { currentScript: null }, URL, Map, WeakMap, Set };
vm.runInNewContext(read("js/line-database-loader.js"), context);
const { validateData } = context.window.ReelCalcLineDatabaseLoader;
for (const [kind, filename, name] of [["regular", "lines.json", "line-database"], ["pe", "pe-lines.json", "pe-line-database"]]) {
  const data = JSON.parse(read(`data/${filename}`));
  assert.equal(validateData(data, kind), data);
  for (const field of ["id", "brand", "model", "dia_mm", "dia_in", kind === "pe" ? "pe" : "lb"]) {
    assert.throws(() => validateData([{ ...data[0], [field]: "" }], kind), field);
  }
  for (const diameter of [0, -1, Infinity, NaN, "0.01"]) {
    assert.throws(() => validateData([{ ...data[0], dia_in: diameter }], kind));
  }
  assert.throws(() => validateData([], kind));
  assert.throws(() => validateData([data[0], data[0]], kind));
  const snippet = read(`generated/${name}-squarespace-snippet.html`);
  assert.ok(snippet.length < 250, "Small Squarespace snippet");
  assert.ok(snippet.includes(`data-database="${kind}"`));
  assert.ok(snippet.includes(`id="reelcalc-${name}-app"`));
  assert.ok(!snippet.includes(data[0].model), "No embedded catalog");
  const template = read(`components/${name}.html`);
  assert.ok(!/<(?:script|style)\b/i.test(template), "Layout does not embed scripts/data/styles");
  assert.ok(template.includes(`id="reelcalc-${name}"`));
  const runtime = read(`js/${name}.js`);
  assert.ok(runtime.includes("data.map("), "Renderer accepts the catalog, not a hardcoded copy");
  new vm.Script(runtime);
  console.log(`${kind}: ${data.length} central records valid; snippet ${snippet.length} characters.`);
}
const loader = read("js/line-database-loader.js");
assert.ok(loader.includes('"no-store"'), "Catalog changes do not require a UI release");
assert.ok(loader.includes("credentials: \"omit\""), "Public catalog requests do not send credentials");
console.log("Hosted database validation and snippet checks passed.");
