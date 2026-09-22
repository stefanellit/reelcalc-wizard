"""Create the native Squarespace CSV using its exact headers and parsed HTML."""
import csv
import json
from pathlib import Path
from lxml import html

root = Path(__file__).resolve().parents[2]
out = root / 'outputs/spinning-reel-followup'
build = json.loads((out / 'build.json').read_text())
target = out / f'UPLOAD-THIS-{len(build["files"])}-new-spinning-reel-pages.csv'
# A BOM can make Squarespace treat the first header as an unknown column.
with target.open('w', newline='', encoding='utf-8') as stream:
    writer = csv.DictWriter(stream, fieldnames=build['headers'])
    writer.writeheader()
    for page in build['files']:
        tree = html.fragment_fromstring((root / page['blockFile']).read_text(encoding='utf-8'), create_parent='div')
        for node in tree.xpath('.//comment()|.//script|.//link'):
            node.getparent().remove(node)
        for node in tree.xpath('.//article|.//section'):
            node.drop_tag()
        for node in tree.iter():
            for key in list(node.attrib):
                if key in ('class', 'id', 'hidden', 'loading') or key.startswith('data-'):
                    del node.attrib[key]
        row = dict(page['row'])
        markup = ''.join(html.tostring(child, encoding='unicode') for child in tree)
        row['Description'] = '\n'.join(line.rstrip() for line in markup.splitlines()).strip()
        writer.writerow(row)
assert not target.read_bytes().startswith(b'\xef\xbb\xbf')
with target.open(newline='', encoding='utf-8') as stream:
    reader = csv.DictReader(stream)
    assert reader.fieldnames == build['headers']
    assert reader.fieldnames[0] == 'Product ID [Non Editable]'
    rows = list(reader)
assert len(rows) == len(build['files'])
assert len({r['Product URL'] for r in rows}) == len(rows)
assert len({r['SKU'] for r in rows}) == len(rows)
for row in rows:
    assert len(row) == 28 and None not in row
    assert not row['Product ID [Non Editable]'] and not row['Variant ID [Non Editable]']
    assert row['Product Type [Non Editable]'] == 'SERVICE'
    tree = html.fragment_fromstring(row['Description'], create_parent='div')
    assert len(tree.xpath('.//h1')) == 1
    assert not tree.xpath('.//script|.//link')
    assert 'Line Capacity' in tree.text_content()
print(f'CSV round-trip verified: {len(rows)} rows, 28 columns. {target}')
