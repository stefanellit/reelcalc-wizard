"""Extract original, unmodified product image streams from manufacturer catalogs."""
import json
from pathlib import Path
from pypdf import PdfReader

root = Path(__file__).resolve().parents[2]
sources = json.loads((root / 'research/spinning-page-expansion/sources.json').read_text())
target = root / 'research/spinning-page-expansion/catalog-images'
target.mkdir(exist_ok=True)
manifest = []
for url, meta in sources.items():
    if 'quantum_2024.pdf' not in url and 'zebcobrands_product_catalog_2022.pdf' not in url:
        continue
    year = '2024' if '2024' in url else '2022'
    pages = [6, 7, 8, 11] if year == '2024' else [82, 86, 98, 101]
    reader = PdfReader(root / meta['file'])
    for page in pages:
        for image in reader.pages[page - 1].images:
            if image.name.endswith('.jpg'):
                name = f'quantum-{year}-p{page}-{image.name}'
                (target / name).write_bytes(image.data)
                manifest.append({'file': name, 'url': url, 'page': page, 'width': image.image.width, 'height': image.image.height})
(target / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
