"""Inspect public catalog pages and extract unmodified manufacturer photos."""
import json
from pathlib import Path
from pypdf import PdfReader
import pypdfium2 as pdfium

root = Path(__file__).resolve().parents[2]
sources = json.loads((root / 'research/spinning-page-followup/sources.json').read_text())
target = root / 'research/spinning-page-followup/catalog-images'
target.mkdir(exist_ok=True)
manifest = []
for url, meta in sources.items():
    if not meta.get('ok'):
        continue
    pages = [17, 41] if 'lews_2023_fnl.pdf' in url else [5] if '2023_mach_final.pdf' in url else [7] if 'quantum_2024.pdf' in url else [1] if any(x in url for x in ['Brutus_SP', 'Centron_SP', 'CRIXUS_spinning', 'Valiant_Eagle_Gold']) else []
    if not pages:
        continue
    source = root / meta['file']
    reader = PdfReader(source)
    document = pdfium.PdfDocument(source)
    for page in pages:
        prefix = ('lews' if 'lews_2023' in url else 'mach' if '2023_mach' in url else 'quantum' if 'quantum_2024' in url else source.stem) + '-p' + str(page)
        document[page - 1].render(scale=1.5).to_pil().save(target / (prefix + '-page.png'))
        if not any(x in url for x in ['lews_2023','2023_mach','quantum_2024']):
            continue
        for img in reader.pages[page - 1].images:
            if img.image.width > 150:
                name = prefix + '-' + Path(img.name).stem + '.png'
                picture = img.image.convert('RGB') if img.image.mode == 'CMYK' else img.image
                picture.save(target / name)
                manifest.append({'file': name, 'url': url, 'page': page, 'width': img.image.width, 'height': img.image.height})
(target / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest, indent=2))
