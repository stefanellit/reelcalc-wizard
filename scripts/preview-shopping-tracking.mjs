import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const port = Number(process.env.SHOPPING_PREVIEW_PORT || 4198);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const diagnostic = `<script>window.gtag=function(kind,name,parameters){console.debug('Preview event '+JSON.stringify({name,parameters}));};</script>`;
const page = body => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shopping and tracking preview</title>${diagnostic}<script src="/js/analytics.js"></script></head><body style="margin:0;font-family:Arial,sans-serif"><main style="max-width:1100px;margin:auto;padding:16px">${body}</main></body></html>`;
const reels = JSON.parse(fs.readFileSync(path.join(root, 'data/reels.json'), 'utf8'));
const battle = reels.find(r => r.brand === 'PENN' && /Battle IV/.test(r.model) && String(r.size_class) === '5000');
if (!battle) throw new Error('PENN Battle IV 5000 fixture not found');
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let html;
  if (url.pathname === '/__shopping-home') html = page('<div id="reelcalc-homepage-calculator-app"></div><script src="/js/homepage-calculator-v2-loader.js"></script>');
  if (url.pathname === '/__shopping-reel') html = page(`<h1>PENN Battle IV 5000</h1><div data-reelcalc-calculator data-reel-id="${battle.id}" data-main-line-id="powerpro-spectra-braid-30" data-main-line-lb="30" data-main-line-yards="150" data-backing-line-id="berkley-trilene-big-game-monofilament-10"></div><script src="/js/reel-page-runtime.js"></script><script src="/js/reel-page-calculator.js"></script>`);
  if (url.pathname === '/__shopping-embed') html = page(`<h1>Embedded wizard</h1><iframe title="ReelCalc Reel Setup Wizard" src="/?reel=daiwa-bg-lt-3000d-xh" style="width:100%;height:1500px;border:0"></iframe>`);
  if (html) { res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }).end(html); return; }
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    let content = fs.readFileSync(file);
    if (path.extname(file) === '.html') content = content.toString().replace('<head>', '<head>' + diagnostic);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(content);
  } catch { res.writeHead(404).end(); }
}).listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}/__shopping-reel`));
