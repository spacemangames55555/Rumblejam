#!/usr/bin/env python3
"""Chroma-key a generated FX drawing onto a 32x32 transparent PNG.

JPEG generators rarely emit exact #FF00FF, so this keys a magenta hue band,
flood-fills from the corners, and despills leftover fringe before fitting
the opaque bounds into a 32x32 cell with a 2px margin.
"""
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

CELL = 32
MARGIN = 2


def magenta_mask(arr: np.ndarray) -> np.ndarray:
    rgb = arr[:, :, :3].astype(np.float32) / 255.0
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    diff = mx - mn
    hue = np.zeros_like(mx)
    mask_r = (mx == r) & (diff > 0)
    mask_g = (mx == g) & (diff > 0)
    mask_b = (mx == b) & (diff > 0)
    hue[mask_r] = np.mod((g[mask_r] - b[mask_r]) / diff[mask_r], 6.0)
    hue[mask_g] = (b[mask_g] - r[mask_g]) / diff[mask_g] + 2.0
    hue[mask_b] = (r[mask_b] - g[mask_b]) / diff[mask_b] + 4.0
    hue = hue * 60.0
    sat = np.where(mx > 0, diff / np.maximum(mx, 1e-6), 0.0)
    # magenta sits near 300°. JPEG noise widens that band.
    hue_mag = (hue >= 265) | (hue <= 12)
    mag = (sat > 0.28) & (mx > 0.35) & hue_mag & (g < r + 0.08) & (g < b + 0.08)
    mag |= (r > 0.62) & (b > 0.62) & (g < 0.48) & ((r - g) > 0.12)
    return mag


def flood_from_corners(mag: np.ndarray) -> np.ndarray:
    h, w = mag.shape
    vis = np.zeros((h, w), dtype=bool)
    q = deque()
    for y, x in ((0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1), (0, w // 2), (h - 1, w // 2), (h // 2, 0), (h // 2, w - 1)):
        if mag[y, x]:
            vis[y, x] = True
            q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not vis[ny, nx] and mag[ny, nx]:
                vis[ny, nx] = True
                q.append((ny, nx))
    return vis


def despill(arr: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    out = arr.copy()
    rgb = out[:, :, :3].astype(np.float32)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    fringe = (alpha > 0) & (alpha < 250) | ((r > g + 25) & (b > g + 25) & (g < 140) & (alpha > 0))
    # pull magenta fringe toward the green channel (neutralize)
    mean_rb = (r + b) * 0.5
    over = np.maximum(0, mean_rb - g)
    rgb[:, :, 0] = np.clip(r - over * 0.85, 0, 255)
    rgb[:, :, 2] = np.clip(b - over * 0.85, 0, 255)
    out[:, :, :3] = rgb.astype(np.uint8)
    out[:, :, 3] = np.where(fringe & (over > 40) & (alpha < 200), 0, alpha)
    return out


def opaque_bounds(alpha: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.where(alpha > 18)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def process(src: Path, dst: Path) -> None:
    im = Image.open(src).convert("RGBA")
    arr = np.array(im)
    mag = magenta_mask(arr)
    bg = flood_from_corners(mag)
    # also treat isolated magenta islands as background if they touch lots of mag
    alpha = arr[:, :, 3].copy()
    alpha[bg] = 0
    alpha[mag & (arr[:, :, 1] < 90)] = 0
    keyed = arr.copy()
    keyed[:, :, 3] = alpha
    keyed = despill(keyed, keyed[:, :, 3])
    bounds = opaque_bounds(keyed[:, :, 3])
    if bounds is None:
        Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0)).save(dst)
        print(f"empty: {src}")
        return
    x0, y0, x1, y1 = bounds
    crop = Image.fromarray(keyed).crop((x0, y0, x1, y1))
    inner = CELL - MARGIN * 2
    cw, ch = crop.size
    scale = min(inner / max(cw, 1), inner / max(ch, 1))
    nw, nh = max(1, int(round(cw * scale))), max(1, int(round(ch * scale)))
    crop = crop.resize((nw, nh), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    canvas.paste(crop, ((CELL - nw) // 2, (CELL - nh) // 2), crop)
    dst.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dst)
    nz = int(np.count_nonzero(np.array(canvas)[:, :, 3] > 18))
    print(f"wrote {dst.name} crop={cw}x{ch} -> {nw}x{nh} opaque={nz}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: process_fx_sprite.py <input.png> <output.png>")
    process(Path(sys.argv[1]), Path(sys.argv[2]))
