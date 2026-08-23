import json
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
IMAGE_REPORT = ROOT / "reports" / "baitcaster-page-image-candidates-500.json"
ASSET_BASE = "https://stefanellit.github.io/reelcalc-wizard/"
MAX_EDGE = 1400
WEBP_QUALITY = 86


def optimize_image(source: Path) -> tuple[Path, int, int]:
    destination = source.with_suffix(".webp")

    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)
        image.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)

        if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
            image = image.convert("RGBA")
        else:
            image = image.convert("RGB")

        image.save(
            destination,
            "WEBP",
            quality=WEBP_QUALITY,
            method=6,
            exact=True,
        )

    return destination, source.stat().st_size, destination.stat().st_size


def main() -> None:
    report = json.loads(IMAGE_REPORT.read_text(encoding="utf-8"))
    conversions = []

    for family in report.get("families", []):
        selected = family.get("selected") or {}
        cached_file = selected.get("cachedFile")
        if not cached_file:
            continue

        source = ROOT / cached_file
        if source.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
            continue

        destination, before, after = optimize_image(source)
        relative = destination.relative_to(ROOT).as_posix()
        selected["cachedFile"] = relative
        selected["cachedUrl"] = ASSET_BASE + relative
        selected["contentType"] = "image/webp"
        selected["bytes"] = after
        conversions.append(
            {
                "family": family.get("family"),
                "source": cached_file,
                "optimized": relative,
                "beforeBytes": before,
                "afterBytes": after,
            }
        )

    IMAGE_REPORT.write_text(
        json.dumps(report, indent=2, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )

    before_total = sum(item["beforeBytes"] for item in conversions)
    after_total = sum(item["afterBytes"] for item in conversions)
    reduction = 0 if before_total == 0 else round((1 - after_total / before_total) * 100, 1)
    print(
        json.dumps(
            {
                "status": "COMPLETED",
                "convertedImages": len(conversions),
                "beforeMB": round(before_total / 1024 / 1024, 1),
                "afterMB": round(after_total / 1024 / 1024, 1),
                "reductionPercent": reduction,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
