"""Keep the pending Squarespace import identical except for introduction copy."""
import csv
import io
import json
import subprocess
from pathlib import Path
from lxml import html

root = Path(__file__).resolve().parents[2]
before = '619082ba55345ab6d365bf76dbf87eb3a02841fa'
filename = 'outputs/spinning-reel-followup/UPLOAD-THIS-43-new-spinning-reel-pages.csv'

def previous(file):
    return subprocess.check_output(['git', 'show', f'{before}:{file}'], cwd=root).decode('utf-8')

old_manifest = json.loads(previous('data/reel-page-embeds.json'))
new_manifest = json.loads((root / 'data/reel-page-embeds.json').read_text(encoding='utf-8'))
old_reader = csv.DictReader(io.StringIO(previous(filename)))
with (root / filename).open(encoding='utf-8', newline='') as stream:
    new_reader = csv.DictReader(stream)
    assert old_reader.fieldnames == new_reader.fieldnames
    old_rows, new_rows = list(old_reader), list(new_reader)
assert len(old_rows) == len(new_rows) == 43
for old_row, new_row in zip(old_rows, new_rows):
    slug = old_row['Product URL']
    old_description = old_row.pop('Description')
    new_description = new_row.pop('Description')
    assert old_row == new_row, f'{slug}: changed import settings'
    trees = []
    for description, manifest in [(old_description, old_manifest), (new_description, new_manifest)]:
        tree = html.fragment_fromstring(description, create_parent='div')
        paragraphs = [p for p in tree.xpath('.//p') if p.text_content() == manifest['pages'][slug]['intro']]
        assert len(paragraphs) == 1, f'{slug}: expected one introduction'
        assert len(paragraphs[0]) == 0
        paragraphs[0].text = ''
        trees.append(html.tostring(tree, encoding='unicode'))
    assert trees[0] == trees[1], f'{slug}: changed content outside the introduction'
print('Passed: all 43 import rows unchanged except for their introduction paragraphs.')
