import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const port = Number(process.env.PORT || 4194);
const synthetic = process.argv.includes("--synthetic-fixtures");
const real = process.argv.includes("--api-preview");
const actual = real ? JSON.parse(await fs.readFile(path.join(root, "data/line-laboratory.json"), "utf8")) : null;
const firstId = real ? "line-laboratory:" + actual.records.find(r => r.brand.trim() === "Daiwa" && r.product === "Jbraid x4" && r.rated_strength.value === 20).source_record_id : "line-laboratory:TEST-ONLY-6";
// In-memory UI fixtures only. This server never updates the release gate or public data files.
const records = [6, 60].map(lb => ({ source_record_id: "TEST-ONLY-" + lb,
  original_name: "SYNTHETIC UI TEST ONLY " + lb, brand: "TEST ONLY", product: "NOT A REAL LINE", variant: "SYNTHETIC variant",
  material: "Braid", rated_strength: { value: lb, unit: "lb", label: lb + " lb" },
  diameters: [{ method_id: "synthetic-test-only", value: lb === 6 ? .12 : .42, unit: "mm" }],
  capacity_method_id: "synthetic-test-only", updated_at: "2026-10-01T00:00:00Z", status: "active" }));
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    let route = decodeURIComponent(url.pathname);
    if (route === "/__lab-review") {
      const width = url.searchParams.get("mobile") === "1" ? 390 : 1060;
      res.setHeader("Content-Type", "text/html");
      res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Line Laboratory preview</title><style>body{font:16px Arial;margin:16px;line-height:1.6}a{display:inline-block;margin:0 16px 8px 0}iframe{border:1px solid #ccc;width:' + width + 'px;height:1100px;max-width:100%}</style><h1>Line Laboratory preview</h1><p>' + (real ? actual.records.length + ' authentic API records. Local preview only; the live site is unchanged.' : synthetic ? 'SYNTHETIC SOFTWARE TEST ONLY. Not Line Laboratory measurements.' : 'Laboratory integration disabled.') + '</p><nav aria-label="Calculator previews"><a href="/index.html?lineSource=line_laboratory&line=' + firstId + '">Setup Wizard</a><a href="/__lab-reel?lineSource=line_laboratory&line=' + firstId + '">Reel-page calculator</a><a href="/examples/reel-comparison.html">Reel comparison</a></nav><iframe title="Reel-page calculator preview" src="/__lab-reel?lineSource=line_laboratory&amp;line=' + firstId + '"></iframe>');
      return;
    }
    if (route === "/__lab-reel") {
      res.setHeader("Content-Type", "text/html");
      res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reel calculator preview</title><div style="max-width:760px;margin:auto" data-reelcalc-calculator data-reel-id="daiwa-bg-lt-3000d-xh" data-default-mode="capacity"></div><script src="/js/reel-page-calculator.js"></script>'); return;
    }
    if (real && route === "/data/line-laboratory-release.json") {
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ schemaVersion: 1, enabled: true, selectionMode: "separate", approvedMethods: ["line-laboratory-api-average"], dataPath: "data/line-laboratory.json" })); return;
    }
    if (synthetic && route === "/data/line-laboratory-release.json") {
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ schemaVersion: 1, enabled: true, approvedMethods: ["synthetic-test-only"], dataPath: "data/line-laboratory.json" })); return;
    }
    if (synthetic && route === "/data/line-laboratory.json") {
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ schemaVersion: 1, source: "line_laboratory", records })); return;
    }
    if (route === "/") route = "/index.html";
    if (!/^\/(js|css|data|components|previews|examples)\//.test(route) && !["/index.html", "/wizard.css"].includes(route)) throw new Error("Not served");
    const file = path.resolve(root, "." + route);
    if (!file.startsWith(root + path.sep)) throw new Error("Invalid path");
    res.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store"); res.end(await fs.readFile(file));
  } catch { res.statusCode = 404; res.end("Not found"); }
}).listen(port, "127.0.0.1", () => console.log("Local laboratory preview: http://127.0.0.1:" + port + "/__lab-review"));
