#!/usr/bin/env python3
"""Genera iconos circulares para app nativa, PWA y Vercel."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "images"
PUBLIC = ROOT / "public"
SRC = ASSETS / "cande-butterfly-logo.png"
BG = (255, 251, 247, 255)


def circular_icon(size: int) -> Image.Image:
    butterfly = Image.open(SRC).convert("RGBA")
    pad = int(size * 0.1)
    inner = size - 2 * pad
    butterfly.thumbnail((inner, inner), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.ellipse([0, 0, size - 1, size - 1], fill=BG)

    x = (size - butterfly.width) // 2
    y = (size - butterfly.height) // 2
    canvas.paste(butterfly, (x, y), butterfly)

    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
    canvas.putalpha(mask)
    return canvas


def main() -> None:
    if not SRC.is_file():
        raise SystemExit(f"Missing source logo: {SRC}")

    outputs: dict[Path, int] = {
        ASSETS / "icon.png": 1024,
        ASSETS / "splash-icon.png": 1024,
        ASSETS / "android-icon-foreground.png": 1024,
        ASSETS / "android-icon-monochrome.png": 1024,
        ASSETS / "pwa-icon-512.png": 512,
        ASSETS / "apple-touch-icon.png": 180,
        ASSETS / "favicon.png": 48,
        PUBLIC / "apple-touch-icon.png": 180,
        PUBLIC / "icon-192.png": 192,
        PUBLIC / "icon-512.png": 512,
        PUBLIC / "favicon.png": 48,
    }

    for path, size in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        circular_icon(size).save(path, "PNG")

    bg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    ImageDraw.Draw(bg).ellipse([0, 0, 1023, 1023], fill=BG)
    mask = Image.new("L", (1024, 1024), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, 1023, 1023], fill=255)
    bg.putalpha(mask)
    bg.save(ASSETS / "android-icon-background.png", "PNG")

    favicon = circular_icon(48)
    favicon.save(PUBLIC / "favicon.ico", format="ICO", sizes=[(48, 48), (32, 32), (16, 16)])
    print("Circular icons written to assets/images and public/")


if __name__ == "__main__":
    main()
