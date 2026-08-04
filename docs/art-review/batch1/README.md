# Batch 1 — Thrones of Heaven

Thirteen characters to install. **One is in.**

| | character | id | status |
|---|---|---|---|
| ✓ | Hunter | `char.toh_hunter` | installed |
| | Blacksmith · Wizard · Necromancer · Mage · Bard · Witch Doctor · Samurai · Monk · Assassin · Priest · Savage · Sundian | | awaiting art |

The Druid (`char.toh_druid`) is the style anchor and is not part of batch 1 —
see [`../druid/README.md`](../druid/README.md) and
[`../../STYLE_ANCHOR.md`](../../STYLE_ANCHOR.md).

[`00-toh-installed.png`](00-toh-installed.png) — every installed ToH character
side by side at true device size on the arena floor. Each panel is a crop of a
real game frame at 1440×900 @dpr2, same viewport, same grid, all facing south.
Regenerate it as each character lands.

## Size: normalization is holding

Every sheet ships at `scale: 2.18` against its own measured content, so **equal
silhouette height is the thing to check** — not equal cell size, which is an
artifact of padding.

| character | scale | fit | content | cell px | silhouette px | vs Druid |
|---|---|---|---|---|---|---|
| Druid | 2.18 | 1.0323 | 90×124 | 162.0 | **157.0** | — |
| Hunter | 2.18 | 1.0492 | 101×122 | 164.7 | **157.0** | **+0.00%** |

Measured off the renderer's own `drawImage` in a real arena. Nothing is more
than 5% off the Druid.

The two sheets came from **different source canvases** — the Druid at 248×248,
the Hunter at 256×256 — and fill different fractions of their cell (96.9% and
95.3%). Their *cells* differ by 2.7 device px. Their silhouettes are identical.
That is exactly the case content normalization was built for, and it is the
first time it has been exercised on art it was not derived from.

## Gate axes — measured, waived, not blocking

The bands were calibrated on the retired arcade anchor. The Druid fails two of
three and the Hunter fails all three. Both are waived in
`assets/gate-exceptions.json`; structural checks are not waived and both pass
them.

| character | contrast (≥45) | spread (≥90) | bodySat (≥0.58) | facing ratio (≥0.85) |
|---|---|---|---|---|
| Druid | **22.7** ✗ | 93.4 ✓ | **0.387** ✗ | 1.009 ✓ |
| Hunter | **13.3** ✗ | **80.9** ✗ | **0.570** ✗ | **1.258** ✓ |

Two things in that table are worth watching as the batch fills in.

**The spread between characters is already wider than the bands.** Contrast 22.7
against 13.3 is a 1.7× difference on the axis that is supposed to gate
readability, and saturation runs the *other* way — the Hunter is markedly more
saturated (0.570) than the anchor (0.387) while being considerably darker. So
the two axes are not measuring one underlying "arcade-ness" that the roster has
uniformly moved away from; they disagree per character. A recalibration that
just lowers both bands to fit would paper over that.

**The Hunter's facing ratio is 1.258 against the Druid's 1.009.** Both pass, and
higher is not better — the band rejects, it does not rank. But 1.258 means his
opposite facings differ considerably more than his neighbours do, which is what
a set of eight genuinely separate drawings looks like. Worth noting as a
reference point, not a target.

## Provenance

Every source file is committed under `<character>/sources/` at the md5 it
arrived with. Nothing is regenerated, resampled or retouched: `--autocrop` crops
to the union of opaque bounds and blits into the cell without resampling.

### Hunter

Supplied 2026-08-04, eight 256×256 RGBA PNGs.

| facing | md5 | file |
|---|---|---|
| E | `7b2f1a02f267ce69e51ad5d14b410c80` | `hunter/sources/east.png` |
| SE | `4a342d6e707786b9957694fe7f69fc0e` | `hunter/sources/southeast.png` |
| S | `4ed50511df2d2861c3a8fdf3b05512ac` | `hunter/sources/south.png` |
| SW | `980c74c9a957fce903edcbb97d9ae522` | `hunter/sources/southwest.png` |
| W | `442c8f1bba1edbdfcc4261bfddab658d` | `hunter/sources/west.png` |
| NW | `66bb0c3ad802766c178d8220295ab206` | `hunter/sources/northwest.png` |
| N | `295d8d93cc241777a786dd4e75cb9af0` | `hunter/sources/north.png` |
| NE | `7b716642555939222b674ce2ada121b4` | `hunter/sources/northeast.png` |

Assembled to `assets/sprites/char/toh_hunter.png`, 128×1024, `directions: 8`,
`content: [101, 122]`, `scale: 2.18`. Autocrop 256×256 → 128×122.

## A tooling bug this batch found

The first install came out as a **2-frame animation**. `process_sprite` treated
each 256×256 source as a horizontal strip of two 128px frames, because 256 is an
exact multiple of the declared cell width — and width alone cannot tell a
2-frame strip from a single oversized drawing.

The Druid never hit it: 248 is not a multiple of 128.

Fixed by testing the height too. A horizontal strip of frames is `n × cellW`
wide and **exactly `cellH` tall**; a 256×256 source against a 128 cell is a
single oversized image. Left unfixed this would have given all thirteen
characters a sprite that flips between its own left and right halves at 8fps —
which reads as a twitching sprite, not as a tooling bug, and would have survived
review.
