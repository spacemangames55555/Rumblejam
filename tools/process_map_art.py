#!/usr/bin/env python3
"""Install world/region atlas plates and biome floor tiles.

Maps stay JPEG (CSS backgrounds). Tiles become 64x64 PNG, made wrap-seamless,
value-shifted to the biome's groundValue, with five variants per atlas.
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageStat

ROOT = Path(__file__).resolve().parents[1]
ART = Path("/workspace/artifacts/imagine_images")
MAP_OUT = ROOT / "assets" / "maps"
TILE_OUT = ROOT / "assets" / "tiles"
REVIEW = ROOT / "docs" / "art-review" / "maps"

# Restyled equirectangular Earth (2:1) and unlabeled regional plates.
MAPS = {
    "world": ART / "30b48095-3196-4e89-b5e4-cd320a8d804d.jpg",
    "regions/pacific_northwest": ART / "59e99b99-7acb-442e-b01d-98255a6cfe58.jpg",
    "regions/central_america": ART / "2f4bca79-1b07-49a8-ad3c-116ed2f6e04c.jpg",
    "regions/sahel": ART / "9e82e256-205e-4deb-a365-670dff3feb0f.jpg",
    "regions/norse_reach": ART / "f0df6c9e-53e5-4320-af00-a79d3a66e237.jpg",
    "regions/steppe": ART / "075f78a2-e9b2-4549-bfe9-3553b92a82e6.jpg",
    "regions/indus_delta": ART / "61097b1b-51a6-4b81-86f8-47e394360871.jpg",
    "regions/abyssal_trench": ART / "d654b1d3-07d8-48f3-ba25-79b99e781787.jpg",
    "regions/vault": ART / "d809d27e-e2e0-4e0a-9915-1cc5864c7b89.jpg",
}

# One painted source per variant where we have them; otherwise the processor
# wraps a single master into five offsets. groundValue is the luminance we
# grade toward — biomes.js must match the measured mean after install.
TILES = {
    "xibalba": {
        "groundValue": 0.34,
        "sources": [
            ART / "c7079aa2-5f0e-4ae0-a97e-20406eb08e88.jpg",
            ART / "b7a49c87-f7ba-4079-84b6-2f91afc938ff.jpg",
            ART / "68d21a5d-5e08-4599-aa70-bffcd7aa2c27.jpg",
            ART / "0e0eaf12-208d-4125-a16e-5860ff5b0ff8.jpg",
            ART / "a7c2738b-86c5-4e50-9711-f139f0bf73b0.jpg",
        ],
    },
    "sahel": {
        "groundValue": 0.42,
        "sources": [
            ART / "ca82bf38-8a78-4a39-bf47-e3e925cde21d.jpg",
            ART / "fc94edb9-af6b-45ff-8125-2853cf2fd851.jpg",
            ART / "8b1bd567-ee2e-46af-b2fc-9dbe19db1117.jpg",
            ART / "a833ff82-9fc9-40aa-8fd9-bc7c15bcb179.jpg",
            ART / "ca82bf38-8a78-4a39-bf47-e3e925cde21d.jpg",
        ],
        "offsets": [0, 0, 0, 0, 220],
    },
    "outback": {
        "groundValue": 0.38,
        "sources": [ART / "21c5badb-4126-4af8-a2c0-50048d8dc1dd.jpg"],
    },
    "steppe": {
        "groundValue": 0.45,
        "sources": [ART / "25b03eb7-82fe-476e-83d0-b3c0a9f6cb9a.jpg"],
    },
    "abyss": {
        "groundValue": 0.22,
        "sources": [ART / "1daa3a89-d18c-4131-a444-ad2f25d8d007.jpg"],
        "crop": (80, 80, 900, 900),  # skip the fish in the lower field
    },
    "delta": {
        "groundValue": 0.36,
        "sources": [ART / "9dbaefaa-2305-4a0d-9b8f-091f61f5b163.jpg"],
    },
    "norse": {
        "groundValue": 0.55,
        "sources": [ART / "3a9d5726-c5f4-49b0-9b41-0b124b5e67c1.jpg"],
    },
}

SIZE = 64
VARIANTS = 5


def luma(im: Image.Image) -> float:
    g = im.convert("L")
    return ImageStat.Stat(g).mean[0] / 255.0


def grade_to(im: Image.Image, target: float) -> Image.Image:
    cur = luma(im)
    if cur <= 1e-4:
        return im
    factor = target / cur
    # Keep a little of the original so a badly bright source does not crush
    # to mud — clamp the multiply.
    factor = max(0.35, min(1.85, factor))
    out = im.point(lambda p: max(0, min(255, int(p * factor))))
    # If we are still far, a second smaller nudge.
    cur2 = luma(out)
    if abs(cur2 - target) > 0.04:
        f2 = max(0.7, min(1.35, target / max(cur2, 1e-4)))
        out = out.point(lambda p: max(0, min(255, int(p * f2))))
    return out


def make_seamless(im: Image.Image, blend: int = 48) -> Image.Image:
    """Wrap-blend opposite edges so a 2x2 repeat does not flash a seam."""
    im = im.convert("RGB")
    w, h = im.size
    blend = min(blend, w // 4, h // 4)
    arr = im.copy()
    # Horizontal wrap
    left = arr.crop((0, 0, blend, h))
    right = arr.crop((w - blend, 0, w, h))
    for x in range(blend):
        t = x / (blend - 1)
        # cosine ease
        t = (1 - math.cos(t * math.pi)) / 2
        col_l = left.crop((x, 0, x + 1, h))
        col_r = right.crop((x, 0, x + 1, h))
        mix = Image.blend(col_r, col_l, t)
        arr.paste(mix, (w - blend + x, 0))
        mix2 = Image.blend(col_l, col_r, t)
        arr.paste(mix2, (x, 0))
    # Vertical wrap
    top = arr.crop((0, 0, w, blend))
    bot = arr.crop((0, h - blend, w, h))
    for y in range(blend):
        t = y / (blend - 1)
        t = (1 - math.cos(t * math.pi)) / 2
        row_t = top.crop((0, y, w, y + 1))
        row_b = bot.crop((0, y, w, y + 1))
        mix = Image.blend(row_b, row_t, t)
        arr.paste(mix, (0, h - blend + y))
        mix2 = Image.blend(row_t, row_b, t)
        arr.paste(mix2, (0, y))
    return arr


def tile_variant(src: Image.Image, i: int, target: float, extra_off: int = 0) -> Image.Image:
    w, h = src.size
    # Center square, then wrap-offset so variants differ without new art.
    side = min(w, h)
    x0 = (w - side) // 2
    y0 = (h - side) // 2
    sq = src.crop((x0, y0, x0 + side, y0 + side))
    # Seamless blend has to happen at working resolution. Blending 48px of a
    # 1408px plate and then shrinking to 64 leaves a 2px seam.
    work = 256
    sq = sq.resize((work, work), Image.Resampling.LANCZOS)
    off = (extra_off + i * (work // VARIANTS)) % work
    sq = ImageChops.offset(sq, off, (off * 3) // 4)
    sq = make_seamless(sq, blend=40)
    jitter = 1.0 + ((i - 2) * 0.035)
    sq = ImageEnhance.Brightness(sq).enhance(jitter)
    sq = sq.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    sq = grade_to(sq, target)
    return sq.convert("RGB")


def save_jpeg(im: Image.Image, dest: Path, size: tuple[int, int], quality: int = 88) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    out = im.convert("RGB").resize(size, Image.Resampling.LANCZOS)
    out.save(dest, "JPEG", quality=quality, optimize=True)
    print(f"  {dest.relative_to(ROOT)}  {out.size}  {dest.stat().st_size // 1024}k")


def composite_2x2(tile: Image.Image, dest: Path) -> None:
    g = Image.new("RGB", (SIZE * 4, SIZE * 4))
    for y in range(4):
        for x in range(4):
            g.paste(tile, (x * SIZE, y * SIZE))
    dest.parent.mkdir(parents=True, exist_ok=True)
    g.save(dest)


def install_maps() -> None:
    print("maps")
    earth = Image.open(MAPS["world"])
    # Keep 2:1 exactly so pin lat/lng land on continents.
    save_jpeg(earth, MAP_OUT / "world.jpg", (1920, 960), quality=86)
    for key, path in MAPS.items():
        if key == "world":
            continue
        im = Image.open(path)
        save_jpeg(im, MAP_OUT / f"{key}.jpg", (1600, 900), quality=86)


def install_tiles() -> dict:
    report = {}
    print("tiles")
    REVIEW.mkdir(parents=True, exist_ok=True)
    for biome, spec in TILES.items():
        target = spec["groundValue"]
        sources = spec["sources"]
        offsets = spec.get("offsets", [0] * len(sources))
        crop = spec.get("crop")
        dest_dir = TILE_OUT / biome
        dest_dir.mkdir(parents=True, exist_ok=True)
        means = []
        for i in range(VARIANTS):
            src_path = sources[i] if i < len(sources) else sources[0]
            im = Image.open(src_path).convert("RGB")
            if crop:
                im = im.crop(crop)
            extra = offsets[i] if i < len(offsets) else (i * 80)
            tile = tile_variant(im, i, target, extra_off=extra)
            out = dest_dir / f"tile-{i:02d}.png"
            tile.save(out, "PNG", optimize=True)
            m = luma(tile)
            means.append(m)
            composite_2x2(tile, REVIEW / f"{biome}-v{i}-repeat.png")
            print(f"  {out.relative_to(ROOT)}  luma {m:.3f}  target {target:.2f}")
        report[biome] = {
            "target": target,
            "mean": sum(means) / len(means),
            "variants": [round(m, 4) for m in means],
        }
        print(f"  {biome} set mean {report[biome]['mean']:.3f}")
    (REVIEW / "tile-luma.json").write_text(json.dumps(report, indent=2) + "\n")
    return report


def main() -> None:
    MAP_OUT.mkdir(parents=True, exist_ok=True)
    (MAP_OUT / "regions").mkdir(parents=True, exist_ok=True)
    install_maps()
    install_tiles()


if __name__ == "__main__":
    main()
