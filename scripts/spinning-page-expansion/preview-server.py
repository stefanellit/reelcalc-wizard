"""Local-only preview of the exact CSV description plus the production loader."""
import csv
import html
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

root = Path(__file__).resolve().parents[2]
out = root / 'outputs/spinning-reel-expansion'
build = json.loads((out / 'build.json').read_text())
csv_path = out / f'UPLOAD-THIS-{len(build["files"])}-new-spinning-reel-pages.csv'
with csv_path.open(encoding='utf-8-sig', newline='') as stream:
    rows = {r['Product URL']: r for r in csv.DictReader(stream)}
os.chdir(root)

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlsplit(self.path)
        route = parsed.path
        if route.startswith('/reel-pages/p/') and route.rsplit('/', 1)[1] in rows:
            slug = route.rsplit('/', 1)[1]
            row = rows[slug]
            content = row['Description'].replace('https://stefanellit.github.io/reelcalc-wizard/', '/')
            document = f'''<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>{html.escape(row['Title'])}</title><style>body{{margin:0;font-family:Arial,sans-serif}}</style></head><body><main class="product-detail tag-reelcalc-reel-guide"><div class="product-description">{content}</div></main><script src="/js/squarespace-reel-page-loader.js" data-page-slug="{slug}" data-asset-base="/"></script></body></html>'''
            return self.send_document(document)
        if route == '/review':
            links = ''.join(f'<li><a href="/reel-pages/p/{f["slug"]}">{html.escape(f["name"])}</a></li>' for f in build['files'])
            return self.send_document(f'<!doctype html><html><head><title>New Spinning Reel Pages</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font:16px Arial;max-width:1000px;margin:32px auto;padding:16px"><h1>{len(rows)} New Spinning Reel Pages</h1><p>Local previews of the CSV content with the shared website calculator and styling. These pages have not been imported to Squarespace.</p><ul>{links}</ul></body></html>')
        if route == '/mobile-review':
            slug = parse_qs(parsed.query).get('slug', [build['files'][0]['slug']])[0]
            if slug not in rows:
                return self.send_error(404)
            return self.send_document(f'<!doctype html><html><head><title>Mobile Preview</title></head><body style="margin:0"><iframe title="Mobile reel page" src="/reel-pages/p/{slug}" style="display:block;width:390px;height:850px;border:0;margin:0 auto"></iframe></body></html>')
        support = out / 'support' / route.lstrip('/')
        if route in ['/data/reels.json', '/data/reel-page-embeds.json', '/data/reel-affiliates.json'] and support.is_file():
            data = support.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(data)
            return
        return super().do_GET()

    def send_document(self, document):
        data = document.encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

ThreadingHTTPServer(('127.0.0.1', 4187), Handler).serve_forever()
