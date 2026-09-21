"""Extract public manufacturer JSON and HTML specification tables without guessing rows."""
import json
from pathlib import Path
from lxml import html

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'research/spinning-page-expansion'
manifest = json.loads((BASE / 'sources.json').read_text(encoding='utf-8'))
results = []
for url, meta in manifest.items():
    if not meta.get('ok') or meta['file'].endswith('.pdf'):
        continue
    text = (ROOT / meta['file']).read_text(encoding='utf-8')
    if 'sheets/specs?' in url:
        values = json.loads(text)['valueRanges'][0]['values']
        results.append({'url': url, 'kind': 'daiwa', 'rows': [dict(zip([s.strip() for s in values[0]], row)) for row in values[1:]]})
        continue
    tree = html.fromstring(text)
    tables = []
    for table in tree.xpath('//table'):
        rows = [[' '.join(cell.text_content().split()) for cell in row.xpath('./th|./td')] for row in table.xpath('.//tr')]
        tables.append(rows)
    item = {'url': url, 'tables': tables, 'images': tree.xpath('//meta[@property="og:image"]/@content')}
    item['imageCandidates'] = [{k: img.get(k) for k in ['src', 'data-src', 'alt', 'srcset']} for img in tree.xpath('//img')]
    variants = tree.xpath('//script[@id="ProductVariantsMetafields"]/text()')
    if variants:
        item.update(kind='pure', variants=json.loads(variants[0]))
        products = tree.xpath('//script[@id="ProductJSON"]/text()')
        if products:
            item['product'] = json.loads(products[0])
    variants = tree.xpath('//script[@data-pdp-variant-data]/text()')
    if variants:
        item.update(kind='okuma', product=json.loads(variants[0]))
    state = tree.xpath('//*[@data-component="FilteredItemsLoader"]/@data-initial-state')
    if state:
        item.update(kind='lews', catalog=json.loads(state[0]))
    if 'fish.shimano.com' in url:
        item['kind'] = 'shimano'
    results.append(item)
(BASE / 'extracted.json').write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')
for item in results:
    print(item.get('kind', 'table'), item['url'], 'tables:', len(item.get('tables', [])))
