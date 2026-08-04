# Batch 1 — Thrones of Heaven

Thirteen characters to install. **Five are in.**

| | character | id | status |
|---|---|---|---|
| ✓ | Hunter | `char.toh_hunter` | installed |
| ✓ | Witch Doctor | `char.toh_witch_doctor` | installed |
| ✓ | Assassin | `char.toh_assassin` | installed |
| ✓ | Savage | `char.toh_savage` | installed |
| ✓ | Samurai | `char.toh_samurai` | installed |
| | Blacksmith · Wizard · Necromancer · Mage · Bard · Monk · Priest · Sundian | | awaiting art (8) |

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
| Druid (anchor) | 2.18 | 1.0323 | 90×124 | 162.0 | **157.0** | — |
| Witch Doctor | 2.18 | 1.0240 | 120×125 | 160.7 | **157.0** | **+0.00%** |
| Samurai | 2.18 | 1.0407 | 97×123 | 163.3 | **157.0** | **−0.00%** |
| Assassin | 2.18 | 1.0492 | 121×122 | 164.7 | **157.0** | **−0.00%** |
| Savage | 2.18 | 1.0492 | 117×122 | 164.7 | **157.0** | **−0.00%** |
| Hunter | 2.18 | 1.0492 | 101×122 | 164.7 | **157.0** | **−0.00%** |

Measured off the renderer's own `drawImage` in a real arena. Nothing is more
than 5% off the Druid.

Six sheets, six different content boxes, cell fills from 95.3% to 97.7%, and
**three different source canvases**: 244×244 (Savage), 248×248 (Druid, Assassin,
Samurai), 256×256 (Hunter, Witch Doctor). Their **cells** span 160.7 to 164.7
device px, a 4px spread that means nothing. Their **silhouettes are identical to
a tenth of a pixel.**

Three canvas sizes arriving unannounced across five characters is exactly the
situation content normalization was built for, and it turned up on its own
rather than as a test case. Before the change this would have produced three
different apparent sizes and required per-character hand-calibration to hide it.
The canvas an artist happens to export on is now invisible to the game.

### Per-facing height spread

Normalization uses the tallest cell, so a sheet with one unusually tall facing
would render its other seven short. Measured:

| character | per-facing heights (E→NE) | max | min | spread |
|---|---|---|---|---|
| Druid | 122 122 118 124 123 121 118 121 | 124 | 118 | 4.8% |
| Hunter | 118 118 120 122 118 116 116 118 | 122 | 116 | 4.9% |
| Witch Doctor | 125 122 122 124 122 118 122 125 | 125 | 118 | 5.6% |
| Assassin | 120 120 119 122 120 115 120 121 | 122 | 115 | 5.7% |
| Savage | 122 121 121 122 122 120 121 122 | 122 | 120 | **1.6%** |
| Samurai | 122 123 122 123 122 121 120 121 | 123 | 120 | **2.4%** |

Four sit in the same ~5% band; the Savage (1.6%) and Samurai (2.4%) are notably
tighter — their poses barely change height between facings, where the others bob
a few pixels. Nothing to act on; it just means those eight drawings are unusually
consistent with each other. All six sit, so no facing is dragging its character
smaller. Worth re-checking per character: a raised staff or a leaping pose in
one facing only would show up here as a spread well outside this range, and the
fix would be art-side rather than a scale tweak.

## Gates: structure only

The aesthetic bands (contrast, accent spread, body saturation) were **retired on
2026-08-04**, after this batch's first character made the case. Both installed
characters had failed them and both had been waived; the Druid and the Hunter
disagreed with each other on which direction they failed in — the Hunter is
considerably darker *and* considerably more saturated than the anchor — so no
recalibration could have made both axes right. Reasoning is recorded in
`docs/SPRITES.md`, *"Why there are no aesthetic gates"*, so it is not re-added.

`node tools/verify_art_batch.mjs` now checks that a file decodes, that its
dimensions are exactly what the loader demands, that it has real transparency
rather than a baked matte, that no cell is empty, that `content` is declared and
still matches the file, and that an 8-direction sheet's facings are genuinely
eight drawings. Every installed sheet passes with nothing waived —
`assets/gate-exceptions.json` is empty.

**Consistency is judged on the contact sheet**, not from numbers.

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

### Witch Doctor

Supplied 2026-08-04, eight 256×256 RGBA PNGs.

| facing | md5 | file |
|---|---|---|
| E | `1c39421fd06ac441d0f2cec9a8251bc8` | `witch_doctor/sources/east.png` |
| SE | `200c92cf1c35c5098ee945c213398493` | `witch_doctor/sources/southeast.png` |
| S | `53231d21cc8318c1ea80a7ff6734569e` | `witch_doctor/sources/south.png` |
| SW | `2480a2f16e94c8b43c09cdd23e9f1f5a` | `witch_doctor/sources/southwest.png` |
| W | `790afc13d1209968868b52dbd3aaed3b` | `witch_doctor/sources/west.png` |
| NW | `ff59d25da83767ea7414c4e4487a1746` | `witch_doctor/sources/northwest.png` |
| N | `a41b4145a6c0d43fb3b32bbb90f0f9bf` | `witch_doctor/sources/north.png` |
| NE | `a639384675c88a82c370cd9d7436224c` | `witch_doctor/sources/northeast.png` |

Assembled to `assets/sprites/char/toh_witch_doctor.png`, 128×1024,
`directions: 8`, `content: [120, 125]`, `scale: 2.18`. Autocrop 256×256 →
120×127.

### Assassin

Supplied 2026-08-04, eight **248×248** RGBA PNGs — the Druid's canvas, not the
256×256 the Hunter and Witch Doctor arrived on. Delivered in two messages of
four; the sheet was not assembled until all eight were present.

| facing | md5 | file |
|---|---|---|
| E | `9d26be3a7c00ef09dd1e0e70ef465f49` | `assassin/sources/east.png` |
| SE | `bab76047c5490db5b318909da1c590c3` | `assassin/sources/southeast.png` |
| S | `0055fbb2dbee6bf19dbf07d0a6de5e2f` | `assassin/sources/south.png` |
| SW | `6fe6b48c4e622ffc359651d25e4ec222` | `assassin/sources/southwest.png` |
| W | `143ecd3edbbdfeb736c265839eebe1f8` | `assassin/sources/west.png` |
| NW | `12dddccf2ac30a6a66c1b7d1977e7ced` | `assassin/sources/northwest.png` |
| N | `df71b719d1e9d9ddc3d4e0ef671de5cf` | `assassin/sources/north.png` |
| NE | `3acc851549c2c39f5eabb00c7e5acd27` | `assassin/sources/northeast.png` |

Assembled to `assets/sprites/char/toh_assassin.png`, 128×1024, `directions: 8`,
`content: [121, 122]`, `scale: 2.18`. Autocrop 248×248 → 123×124.

### Savage

Supplied 2026-08-04, eight **244×244** RGBA PNGs — a third canvas size, in two
messages of four; not assembled until all eight were present.

| facing | md5 | file |
|---|---|---|
| E | `09e211fc057cd3a47f4e2c750796968d` | `savage/sources/east.png` |
| SE | `a884b6a175b8bf2b60fe51f0478e99bf` | `savage/sources/southeast.png` |
| S | `26e3757545c8b39efb13e4b5c6671c3b` | `savage/sources/south.png` |
| SW | `f0eafe32c2456271e8c2b5e55c9941fb` | `savage/sources/southwest.png` |
| W | `2227a5806684d4b1623a90cc21dbf714` | `savage/sources/west.png` |
| NW | `0549baaebe4ebd0028fb62edb7b379c1` | `savage/sources/northwest.png` |
| N | `67c9b1b7a84dde316d5665df6ae6983e` | `savage/sources/north.png` |
| NE | `54f0600e2ba49c5c468ead7fd0263313` | `savage/sources/northeast.png` |

Assembled to `assets/sprites/char/toh_savage.png`, 128×1024, `directions: 8`,
`content: [117, 122]`, `scale: 2.18`. Autocrop 244×244 → 120×122.

### Samurai

Supplied 2026-08-04, eight **248×248** RGBA PNGs, in two messages of four; not
assembled until all eight were present.

| facing | md5 | file |
|---|---|---|
| E | `3fca26e663c31c64c89c3c7d9fdc264a` | `samurai/sources/east.png` |
| SE | `b3372b3d0d4cdff40af3a7959ef765c4` | `samurai/sources/southeast.png` |
| S | `327f60b3d28345492ba1ca63c0e4418f` | `samurai/sources/south.png` |
| SW | `85d1ad6dc2ff86768f596d8d4a032ff3` | `samurai/sources/southwest.png` |
| W | `1a3d9b0778bc2284d9f5b0a8cafe1db1` | `samurai/sources/west.png` |
| NW | `944ff0ea7cf25720932c672f52f3aef8` | `samurai/sources/northwest.png` |
| N | `c60db14aaf083828956e0ac577f6ff43` | `samurai/sources/north.png` |
| NE | `26100c7d936ddf3b7a7c39a01634bcc3` | `samurai/sources/northeast.png` |

Assembled to `assets/sprites/char/toh_samurai.png`, 128×1024, `directions: 8`,
`content: [97, 123]`, `scale: 2.18`. Autocrop 248×248 → 116×124.

## What the contact sheet shows — look at this, not at numbers

Size is settled and mechanical. The sheet is for everything else.

**Six characters, and the palette splits four to two.**

Inside the style clause — *"muted earthy palette of greens browns and leather,
desaturated next to arcade colour"*, dark-dominant with a small bright tail:

- **Druid** — dark greens, leather, antler bone
- **Hunter** — olive, webbing, gunmetal
- **Witch Doctor** — bronze and teal over dark cloth
- **Samurai** — indigo lacquer, straw kasa, steel

Outside it, in **opposite directions**:

- **Assassin** — pale and cool. White hood, blue-grey cloak; his largest value
  mass sits high where the other four sit low.
- **Savage** — warm and high-chroma. Orange, turquoise and brass, a lot of
  bright saturated mid-tone.

### Reading it

At four characters this looked like the clause failing to constrain. At six it
looks more like **two characters with strong identities and four that agree** —
the Samurai landed squarely in the group without anything being asked of him,
which is the first positive evidence the clause is doing work rather than being
ignored.

That is a change of read, and it was a prediction before it was an observation:
the Samurai was called as inside-clause from his source files, and the sheet
confirmed it. Worth stating because the opposite happened with the Assassin —
he looked unremarkable in isolation and only stood out once he was next to the
others at 157 px. **The sheet is the evidence; source files are a guess.**

Still open, and cheaper to answer than to keep speculating about:
[`../../STYLE_ANCHOR.md`](../../STYLE_ANCHOR.md) records that the clause was
written *from* the Druid and has **never been round-tripped**. If two of the
remaining eight also scatter, that test stops being optional.

**Nothing has been changed on account of any of this.**

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
