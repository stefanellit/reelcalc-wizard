import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { root, escape } from './refresh-braid-faqs.mjs';
const out = path.resolve(process.argv[2]);
const port = Number(process.argv[3] || 4196);
const read = file => JSON.parse(fs.readFileSync(path.join(out, file), 'utf8').replace(/^\uFEFF/, ''));
const before = new Map(read('originals/squarespace-products.json').filter(row => row['Product Page'] === 'reel-pages').map(row => [row['Product URL'], row]));
const after = new Map(read('squarespace-updated-products.json').map(row => [row['Product URL'], row]));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const route = decodeURIComponent(url.pathname);
    res.setHeader('Cache-Control', 'no-store');
    if (route === '/' || route === '/review') { res.setHeader('Content-Type', 'text/html'); res.end(fs.readFileSync(path.join(out, 'review.html'))); return; }
    const match = route.match(/^\/(before|after|overlay)\/([^/]+)$/);
    if (match) {
      const [ , mode, slug] = match;
      const product = (mode === 'after' ? after : before).get(slug) || before.get(slug);
      if (!product) { res.writeHead(404).end(); return; }
      const base = mode === 'before' ? '/__before/' : '/';
      res.setHeader('Content-Type', 'text/html');
      res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escape(product.Title)}</title><style>body{margin:0;font-family:Arial,sans-serif;color:#18221d;background:#fff}main{max-width:1200px;margin:auto;padding:24px}.review-nav{padding:14px 24px;background:#edf4ef}.review-nav a{color:#145837}@media(max-width:600px){main{padding:12px}}</style></head><body><nav class="review-nav"><a href="/review">FAQ review</a> / ${mode === 'before' ? 'Original' : 'Proposed'}</nav><main><div class="product-detail tag-reelcalc-reel-guide"><div class="product-description">${product.Description}</div></div></main><script src="${base}js/squarespace-reel-page-loader.js" data-asset-base="${base}" data-page-slug="${escape(slug)}"></script></body></html>`); return;
    }
    const old = route.startsWith('/__before/');
    const relative = route.replace(/^\/__before\//, '').replace(/^\//, '');
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const original = path.join(out, 'originals', relative);
    const file = old && fs.existsSync(original) ? original : target;
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  } catch (error) { res.writeHead(500).end(String(error)); }
});
server.listen(port, '127.0.0.1', () => console.log(`FAQ preview: http://127.0.0.1:${port}/review`));
