# The Hunter's beast — `beast.bear`

The first non-biped unit in the game, and the first sheet in the `beast.`
namespace. Behaviour is `js/entities/beast.js`; this file is about the art.

[`00-bear-with-hunter.png`](00-bear-with-hunter.png) — the bear beside its
Hunter at true device size, a crop of a real game frame at 1440×900 @dpr2 with
the floor grid visible. **Look at this before any of the numbers below.**

## Installed

| | |
|---|---|
| sheet | `assets/sprites/beast/bear.png`, 128×1024, `directions: 8` |
| cell | 128×128 (`w`/`h` override — the namespace default is 32) |
| content | `[120, 114]`, measured by `--record-content` at install |
| fit | 1.1228 |
| scale | **2.18** — the roster value, per the patch brief |
| autocrop | 252×252 → 125×117 union, no resampling |
| supplied | 2026-08-05, eight 252×252 RGBA PNGs in two messages of four |

Sources are committed verbatim under [`sources/`](sources/) at the md5s they
arrived with:

| facing | md5 | | facing | md5 |
|---|---|---|---|---|
| E | `d0f5b49982a25e04d679f6631a6bfee4` | | W | `43732896269e9af8dbed3c945e3c089e` |
| SE | `51c3f54064e8b0e154c779e66897425f` | | NW | `bf97ea87296d9bc69731a3fe9e850e43` |
| S | `3ff11a48f54936f5bf3d516ffa3eab80` | | N | `4f96b63ce372078644437914be53ecb4` |
| SW | `932bf174297b11dbf9e128a2cb1776a0` | | NE | `58322b3564586b673c62980df28155af` |

252×252 is a fifth source canvas across the project (240 / 244 / 248 / 252 /
256). It reaches the game as none of them: content normalisation divides the
canvas out.

## Size, measured off the renderer's own `drawImage`

1440×900 @dpr2 — 2.25 device px per world unit, grid square 144 device px.

| facing | row | drawn W × H (device px) | fill of cell |
|---|---|---|---|
| E | 0 | 154 × 114 | 69% |
| SE | 1 | 125 × 123 | 74% |
| S | 2 | 76 × 141 | 85% |
| SW | 3 | 125 × 123 | 74% |
| W | 4 | 155 × 114 | 69% |
| NW | 5 | 126 × 146 | 88% |
| N | 6 | 79 × 147 | 89% |
| NE | 7 | 126 × 146 | 88% |

Painted cell 165.2 device px in every facing. **The Hunter beside it draws
157.0.** So side-on the bear is about a head shorter than its owner and about
as long as she is tall — roughly one grid square — and head-on it is nearly her
height and half her width.

**Row mapping verified: E→0 through NE→7.** That is not cosmetic bookkeeping.
`_drawSummon` is a different draw path from `_drawPlayer` and the only one that
hands a summon's `aimA` in as a facing, so nothing else in either suite would
have noticed it regressing — a wrong row reads as "the bear faces a bit oddly",
which survives a playtest. A browser gate now pins it.

## The per-facing spread is 29.5%, and that is correct

Every biped on the roster sits between **1.6% and 5.9%**. The bear is
**29.5%** — drawn height runs 113.6 to 147.2 device px.

For a biped that table catches a broken sheet: one facing much taller than the
rest means a pose that will render its character small. **For a quadruped it
measures anatomy.** A bear seen head-on is tall and narrow (content 61×114);
seen side-on it is long and short (120×88). The aspect ratio swings 2.5× across
the eight facings, and no amount of correct art would flatten that.

Content normalisation is on **height** and takes the **tallest** cell, so N/S
set the size and E/W paint 23% shorter. That is foreshortening arriving on
screen the way it should.

**Do not "fix" this number.** If a future quadruped reads 5%, that is the
suspicious one — it would mean the head-on and side-on views are the same
height, which a four-legged animal cannot be.

## Palette

Brown fur, dark steel barding, pale blue unit markings. The fur and steel sit
inside the style clause without argument — they are the same earthy browns and
gunmetal the Hunter is wearing, which is the pairing that matters, and the shot
above is where that was judged.

The blue markings are the one cool note, and they are the same cool blue as the
Mage's crystals. They read as **painted insignia rather than emission**: hard
dark outline on every stroke, no halo, no falloff. Same distinction recorded for
the Mage — "looks bright" and "is drawn with a glow" are different things, and
only the second breaks the clause's *no glow, no emissive rim, no neon*.

## A loader bug this sheet found

`beast.bear` did not load on the first attempt, and the reason is worth keeping.

`js/assets.js` has its **own** namespace whitelist, separate from the one
`tools/gen_assets_manifest.mjs` builds from. The beast patch added `beast` to
the generator and to the sim gate and **not** to the loader, so the id was
written into the manifest and then dropped at load with a warning nobody read.

Nothing caught it, because with no file on disk the symptom — *no sprite, draw
the primitive* — was also the correct behaviour. The browser test asserting the
primitive fallback passed for the wrong reason. It only surfaced the moment real
art landed and did not appear.

Fixed, and gated: `tools/sim_test.mjs` now asserts the loader accepts every
namespace the manifest emits, so the two lists cannot drift again.
