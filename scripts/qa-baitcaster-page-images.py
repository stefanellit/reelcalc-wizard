import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "reports" / "baitcaster-page-image-candidates-500.json"
IMAGE_DIR = ROOT / "assets" / "reel-page-images"
OUTPUT_DIR = ROOT / "reports" / "baitcaster-page-image-contact-sheets"

COLS = 4
ROWS = 5
CELL_W = 360
CELL_H = 300
IMAGE_H = 230


def selected_path(family):
    filename = str(family["selected"]["cachedUrl"]).rsplit("/", 1)[-1]
    return IMAGE_DIR / filename


def fit_label(draw, label, max_width):
    words = label.split()
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines[:2]


def main():
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    families = sorted(report["families"], key=lambda item: item["family"])
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    audit_rows = []
    for family in families:
        image_path = selected_path(family)
        with Image.open(image_path) as source:
            width, height = source.size
            source.verify()
        audit_rows.append({
            "family": family["family"],
            "file": image_path.name,
            "width": width,
            "height": height,
            "bytes": image_path.stat().st_size,
            "sha256": hashlib.sha256(image_path.read_bytes()).hexdigest(),
            "sourceType": family["selected"]["sourceType"],
            "sourceUrl": family["selected"]["sourceUrl"],
            "imageOriginalUrl": family["selected"]["imageUrl"],
        })

    page_size = COLS * ROWS
    sheet_paths = []
    for sheet_index in range((len(families) + page_size - 1) // page_size):
        page = families[sheet_index * page_size:(sheet_index + 1) * page_size]
        sheet = Image.new("RGB", (COLS * CELL_W, ROWS * CELL_H), "#f5f7f4")
        draw = ImageDraw.Draw(sheet)
        for index, family in enumerate(page):
            col = index % COLS
            row = index // COLS
            x = col * CELL_W
            y = row * CELL_H
            draw.rectangle((x + 4, y + 4, x + CELL_W - 4, y + CELL_H - 4), fill="white", outline="#cbd5d1")
            with Image.open(selected_path(family)) as source:
                source = source.convert("RGB")
                fitted = ImageOps.contain(source, (CELL_W - 24, IMAGE_H - 20))
                image_x = x + (CELL_W - fitted.width) // 2
                image_y = y + 10 + (IMAGE_H - 20 - fitted.height) // 2
                sheet.paste(fitted, (image_x, image_y))
            label = family["family"].replace("|", " - ")
            for line_index, line in enumerate(fit_label(draw, label, CELL_W - 24)):
                draw.text((x + 12, y + IMAGE_H + 8 + line_index * 17), line, fill="#16324f", font=ImageFont.load_default())
            source_label = family["selected"]["sourceType"].replace("_", " ")
            draw.text((x + 12, y + CELL_H - 24), source_label, fill="#52606d", font=ImageFont.load_default())
        output_path = OUTPUT_DIR / f"baitcaster-images-{sheet_index + 1:02d}.jpg"
        sheet.save(output_path, quality=90)
        sheet_paths.append(str(output_path))

    hashes = {}
    for row in audit_rows:
        hashes.setdefault(row["sha256"], []).append(row["family"])
    duplicate_groups = [families for families in hashes.values() if len(families) > 1]
    audit = {
        "families": len(audit_rows),
        "minimumWidth": min(row["width"] for row in audit_rows),
        "minimumHeight": min(row["height"] for row in audit_rows),
        "minimumBytes": min(row["bytes"] for row in audit_rows),
        "duplicateImageGroups": duplicate_groups,
        "contactSheets": sheet_paths,
        "images": audit_rows,
    }
    (ROOT / "reports" / "baitcaster-page-image-visual-audit.json").write_text(
        json.dumps(audit, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({key: audit[key] for key in ("families", "minimumWidth", "minimumHeight", "minimumBytes", "duplicateImageGroups", "contactSheets")}, indent=2))


if __name__ == "__main__":
    main()
