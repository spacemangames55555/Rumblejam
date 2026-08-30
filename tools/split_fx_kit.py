#!/usr/bin/env python3
"""Split a 2x2 magenta FX kit into four 32x32 sprites via process_fx_sprite."""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PROCESS = Path(__file__).resolve().parent / 'process_fx_sprite.py'


def split(src: Path, prefix: str, names: list[str], out_dir: Path):
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    cw, ch = w // 2, h // 2
    cells = [
        im.crop((0, 0, cw, ch)),
        im.crop((cw, 0, w, ch)),
        im.crop((0, ch, cw, h)),
        im.crop((cw, ch, w, h)),
    ]
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        for name, cell in zip(names, cells):
            if not name:
                continue
            raw = td / f'{prefix}_{name}.png'
            cell.save(raw)
            dst = out_dir / f'{prefix}_{name}.png'
            subprocess.check_call([sys.executable, str(PROCESS), str(raw), str(dst)])
            written.append(dst.name)
    return written


if __name__ == '__main__':
    # src prefix n0 n1 n2 n3
    src = Path(sys.argv[1])
    prefix = sys.argv[2]
    names = sys.argv[3:7]
    out = Path(sys.argv[8]) if len(sys.argv) > 8 else ROOT / 'assets' / 'sprites' / 'fx'
    print(prefix, split(src, prefix, names, out))
