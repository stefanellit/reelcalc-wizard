import json
from pathlib import Path
import pdfplumber

root = Path(__file__).resolve().parents[2]
base = root / 'research/spinning-page-followup'
sources = json.loads((base / 'sources.json').read_text(encoding='utf-8'))
for url, item in sources.items():
    if not item.get('ok') or not item['file'].endswith('.pdf'):
        continue
    target = root / item['file'].replace('.pdf', '.pages.json')
    if target.exists():
        continue
    with pdfplumber.open(root / item['file']) as pdf:
        pages = [{'page': i + 1, 'text': p.extract_text(layout=False) or '', 'tables': p.extract_tables()} for i, p in enumerate(pdf.pages)]
    target.write_text(json.dumps({'url': url, 'pages': pages}, indent=2) + '\n', encoding='utf-8')
    print(len(pages), url, flush=True)
