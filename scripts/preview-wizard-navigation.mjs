import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const assetPort = Number(process.env.WIZARD_NAV_ASSET_PORT || 4198);
const embedPort = Number(process.env.WIZARD_NAV_EMBED_PORT || 4199);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const content = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(content);
  } catch { res.writeHead(404).end(); }
}).listen(assetPort, '127.0.0.1');

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname !== '/') { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Embedded wizard navigation preview</title><style>body{margin:0;font:16px Arial,sans-serif;background:#e0e0db}header,main,footer{max-width:1160px;margin:auto;padding:20px}iframe{display:block;width:100%;min-height:1400px;border:0}</style></head><body><header><h1>Fishing Reel Setup Wizard</h1></header><main><iframe title="ReelCalc Reel Setup Wizard" src="http://localhost:${assetPort}/?reel=daiwa-bg-lt-3000d-xh"></iframe></main><footer>Outer page footer</footer></body></html>`);
}).listen(embedPort, '127.0.0.1', () => console.log(`Embedded preview: http://127.0.0.1:${embedPort}/`));
