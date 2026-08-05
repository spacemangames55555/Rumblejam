# Batch 1 — Thrones of Heaven

Thirteen characters to install. **Ten are in.**

| | character | id | status |
|---|---|---|---|
| ✓ | Hunter | `char.toh_hunter` | installed |
| ✓ | Witch Doctor | `char.toh_witch_doctor` | installed |
| ✓ | Assassin | `char.toh_assassin` | installed |
| ✓ | Savage | `char.toh_savage` | installed |
| ✓ | Samurai | `char.toh_samurai` | installed |
| ✓ | Priest | `char.toh_priest` | installed |
| ✓ | Monk | `char.toh_monk` | installed |
| ✓ | Mage | `char.toh_mage` | installed |
| ✓ | Wizard | `char.toh_wizard` | installed |
| ✓ | Bard | `char.toh_bard` | installed |
| | Blacksmith · Necromancer · Sundian | | awaiting art (3) |

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
| Monk | 2.18 | 1.0492 | 96×122 | 164.7 | **157.0** | **−0.00%** |
| Assassin | 2.18 | 1.0492 | 121×122 | 164.7 | **157.0** | **−0.00%** |
| Savage | 2.18 | 1.0492 | 117×122 | 164.7 | **157.0** | **−0.00%** |
| Hunter | 2.18 | 1.0492 | 101×122 | 164.7 | **157.0** | **−0.00%** |
| Priest | 2.18 | 1.0756 | 88×119 | **168.8** | **157.0** | **−0.00%** |
| Mage | 2.18 | 1.0756 | 99×119 | **168.8** | **157.0** | **−0.00%** |
| Wizard | 2.18 | 1.0407 | 105×123 | 163.3 | **157.0** | **−0.00%** |
| Bard † | 2.18 | 1.0079 | 190×254 | 158.2 | **157.0** | **−0.00%** |

† **The Bard is on a 256 cell, not 128** — the only one. His art arrived drawn
at roughly twice the roster's scale: the figure fills 254 of a 256 canvas where
every other character fills ~123 of 240–256. It does not fit a 128 cell, so the
`w`/`h` override puts him on 256 and normalisation does the rest. See the note
under his provenance entry — his on-screen size is right, his pixel density is
not, and that is a judgement for the contact sheet.

Measured off the renderer's own `drawImage` in a real arena. Nothing is more
than 5% off the Druid.

Eleven sheets, eleven content boxes, **four** source canvases: 240×240 (Mage),
244×244 (Savage, Priest), 248×248 (Druid, Assassin, Samurai, Monk, Wizard),
256×256 (Hunter, Witch Doctor, Bard). Cell fill runs 93.0% to 97.7% on the ten
128-cell sheets and **99.2%** on the Bard's 256 cell.

The spread across **cells** is now 160.7 to 168.8 device px — 8.1px, opened up
by the Priest and matched exactly by the Mage, who lands on the same 119px
content height from a different direction (99 wide against the Priest's 88, off
a 240 canvas rather than 244). Their **silhouettes are identical to a tenth of a
pixel**, as are all nine.

Two characters converging on the same `fit` from different canvases and
different content widths is the clearest evidence yet that the normalization is
measuring the right thing. Four canvas sizes arriving unannounced across nine
characters is exactly the situation it was built for, and every one of them
turned up on its own rather than as a test case. Before the change this would
have been four different apparent sizes and four hand-calibrations. The canvas
an artist happens to export on is now invisible to the game.

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
| Priest | 118 118 114 115 119 117 113 112 | 119 | 112 | 5.9% |
| Monk | 122 122 120 122 122 120 117 120 | 122 | 117 | 4.1% |
| Mage | 119 119 118 118 119 117 116 117 | 119 | 116 | **2.6%** |
| Wizard | 121 121 121 123 123 121 120 119 | 123 | 119 | **3.4%** |
| Bard | 248 254 248 254 248 246 244 246 | 254 | 244 | **4.1%** |

Four sit in the same ~5% band; the Savage (1.6%), Samurai (2.4%) and Mage (2.6%)
are notably tighter — their poses barely change height between facings, where the
others bob a few pixels. Nothing to act on; it just means those eight drawings
are unusually consistent with each other. The Mage is the interesting one of the
three, because he *carries a raised staff* — the exact feature this table was
built to catch. It stays inside the silhouette in every facing rather than
poking above the head in one, so it costs nothing. All nine characters sit, so
no facing is dragging its character smaller. Worth re-checking per character: a
raised staff or a leaping pose in one facing only would show up here as a spread
well outside this range, and the fix would be art-side rather than a scale tweak.

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

### Priest

Supplied 2026-08-04, eight **244×244** RGBA PNGs, in two messages of four; not
assembled until all eight were present.

| facing | md5 | file |
|---|---|---|
| E | `cc60192f622b7b2e1f551c9d9e29ebd8` | `priest/sources/east.png` |
| SE | `7690ef1be1a6b087a6226d0427d41d4d` | `priest/sources/southeast.png` |
| S | `1f9e3f71043c35c61f203a4eae3637e0` | `priest/sources/south.png` |
| SW | `eafd35b1670634725c70f448c4002101` | `priest/sources/southwest.png` |
| W | `c11dd85b8ba7919c7a4367f75a90dd0c` | `priest/sources/west.png` |
| NW | `bd6bfad7fbd200c0c6baa9d33c3aa32b` | `priest/sources/northwest.png` |
| N | `a0e685cdf9f92b349ae0b5677097370b` | `priest/sources/north.png` |
| NE | `5680d126e2f135f0763ccdef8a647110` | `priest/sources/northeast.png` |

Assembled to `assets/sprites/char/toh_priest.png`, 128×1024, `directions: 8`,
`content: [88, 119]`, `scale: 2.18`. Autocrop 244×244 → 92×122.

### Monk

Supplied 2026-08-04, eight **248×248** RGBA PNGs, in two messages of four; not
assembled until all eight were present.

| facing | md5 | file |
|---|---|---|
| E | `b7a402967d9d524226b1a099875e8c5d` | `monk/sources/east.png` |
| SE | `57faf482f2d6c95882ea43e09eec64a8` | `monk/sources/southeast.png` |
| S | `d8e00dfba4517cbcc76e9eb4f76e1968` | `monk/sources/south.png` |
| SW | `2f88535b436166b43c8af14c20e64991` | `monk/sources/southwest.png` |
| W | `7aaaaa7f92cc540e8053c994e7055782` | `monk/sources/west.png` |
| NW | `24cae4b419dd7eba3e93704708ef4a6c` | `monk/sources/northwest.png` |
| N | `22a9bef9140f54b41e3dc48afff79137` | `monk/sources/north.png` |
| NE | `08ab2371cb4c56074090a53367b1fde8` | `monk/sources/northeast.png` |

Assembled to `assets/sprites/char/toh_monk.png`, 128×1024, `directions: 8`,
`content: [96, 122]`, `scale: 2.18`. Autocrop 248×248 → 111×123.

### Mage

Supplied 2026-08-04, eight **240×240** RGBA PNGs — a fourth canvas size, in two
messages of four; not assembled until all eight were present.

| facing | md5 | file |
|---|---|---|
| E | `17275a162c93f06d4ea1efdffd83cc2e` | `mage/sources/east.png` |
| SE | `ce31253b8043187c8c260e7df2776a5a` | `mage/sources/southeast.png` |
| S | `4cf0d94c096918a882ad4f949dfee786` | `mage/sources/south.png` |
| SW | `0780dacb19fca67440ec61caf3d3128d` | `mage/sources/southwest.png` |
| W | `a92ae8fedb83b1ece48c66842dc6f011` | `mage/sources/west.png` |
| NW | `1f392826ad7003a2d6fd390dd4c7828d` | `mage/sources/northwest.png` |
| N | `45a1d97a45863979f65d739a3efcd01b` | `mage/sources/north.png` |
| NE | `4068221932b1817a82111a6368e5ad49` | `mage/sources/northeast.png` |

Assembled to `assets/sprites/char/toh_mage.png`, 128×1024, `directions: 8`,
`content: [99, 119]`, `scale: 2.18`. Autocrop 240×240 → 110×120.

### Wizard

Supplied 2026-08-05, eight **248×248** RGBA PNGs, in two messages of four; not
assembled until all eight were present.

| facing | md5 | file |
|---|---|---|
| E | `e4bbf677d620884641a5d29209e3d097` | `wizard/sources/east.png` |
| SE | `f4910ec8e0f8c73c6b79d11b5f73836a` | `wizard/sources/southeast.png` |
| S | `12ccb326484e55a30272c2163942cbb8` | `wizard/sources/south.png` |
| SW | `4f8ddc3a716c106205b80d8e8be2e38d` | `wizard/sources/southwest.png` |
| W | `6512512f7e2d21fcff35b066eb9a5e6b` | `wizard/sources/west.png` |
| NW | `4af91db22f2b38c135cd3b075c16c812` | `wizard/sources/northwest.png` |
| N | `c207c7ced35443301b50e603e2ff4486` | `wizard/sources/north.png` |
| NE | `fa7ea256bfc1d8428215b27acced9c74` | `wizard/sources/northeast.png` |

Assembled to `assets/sprites/char/toh_wizard.png`, 128×1024, `directions: 8`,
`content: [105, 123]`, `scale: 2.18`. Autocrop 248×248 → 105×123.

### Bard

Supplied 2026-08-05, eight **256×256** RGBA PNGs, all eight in one message.

| facing | md5 | file |
|---|---|---|
| E | `8377704f0bfab9d84106484373b23a08` | `bard/sources/east.png` |
| SE | `98a129f2b839fb4c16b3a7ef591d01f5` | `bard/sources/southeast.png` |
| S | `d5cbff62160fb780d4839fcff9ec252d` | `bard/sources/south.png` |
| SW | `ab25f525fea27c8cee4a4a963e0a7d08` | `bard/sources/southwest.png` |
| W | `6e70e89bc6515ec600edfeefb059b1df` | `bard/sources/west.png` |
| NW | `402cd2282ca9f6e8074fcd53f7e00f23` | `bard/sources/northwest.png` |
| N | `0f090792f96a98315584cfecc366c6fa` | `bard/sources/north.png` |
| NE | `f61f50d694d1fd4c3ec3c960781e4464` | `bard/sources/northeast.png` |

Assembled to `assets/sprites/char/toh_bard.png`, **256×2048**, `directions: 8`,
`content: [190, 254]`, `scale: 2.18`. Autocrop 256×256 → 214×254.

**He is drawn at about twice the roster's scale, and that is worth knowing.**
The autocrop union is 214×254 where every other character crops to roughly
90–125 × 119–125. The figure fills its source canvas almost edge to edge. That
will not fit a 128 cell, so he ships on a 256 one.

Normalisation makes his **on-screen size** correct — silhouette 157.0 device px,
identical to the other ten, because `fit` divides the measured content height
out regardless of what cell it sits in. What it cannot fix is **pixel density**:

| character | content height | drawn at | source px per device px |
|---|---|---|---|
| Druid | 124 | 157 px | 0.79 |
| Wizard | 123 | 157 px | 0.78 |
| Hunter | 122 | 157 px | 0.78 |
| Mage | 119 | 157 px | 0.76 |
| **Bard** | **254** | 157 px | **1.62** |

The roster is drawn slightly *below* its rendered size and scaled up, which is
what gives it a chunky pixel grid. The Bard is drawn well *above* it and scaled
down, so his pixels land at roughly half the size of everyone else's and he
reads smoother and finer next to them. Nothing is resampled at install — the
downscale happens at draw time, same as every other sheet.

**This is a size fact, not a taste one, which is why it is recorded here.**
Whether the finer grid matters is a look question and the contact sheet is where
it gets answered. If it does matter, the fix is a re-render at the roster's
scale, not a change to the pipeline.

He also costs more memory than the rest: 256×2048 RGBA is **2.00 MB decoded**
against ~0.5 MB for a 128×1024 sheet. One character's worth is fine; a roster of
them would not be.

## What the contact sheet shows — look at this, not at numbers

Size is settled and mechanical. The sheet is for everything else.

**The running palette commentary stops at the Wizard.** From the Bard onward the
install report is size, the structural gate, and the sheet — consistency is
judged by eye from the picture, which is where it was always actually decided.
The tables below are left as they were rather than being extended; they are a
record of a question that was answered, not a form to keep filling in.

**Ten characters. Six agree, four do not — and they disagree in three different
ways.**

| | | |
|---|---|---|
| **Druid** | inside | dark greens, leather, antler bone |
| **Hunter** | inside | olive, webbing, gunmetal |
| **Witch Doctor** | inside | bronze and teal over dark cloth |
| **Samurai** | inside | indigo lacquer, straw kasa, steel |
| **Monk** | inside | burnt orange over dark brown, bare shoulder, dark sash |
| **Assassin** | **pale** | white hood, blue-grey cloak |
| **Priest** | **pale** | seafoam and cream robes, white hood, gold trim |
| **Savage** | **high-chroma** | orange, turquoise, brass |
| **Mage** | **cool, not earthy** | violet cloak, blue-grey plate, gold trim, pale blue crystal |
| **Wizard** | inside *on value*, gold-heavy on hue | dark blue nemes, bronze skin, cream kilt, gold, a held flame |

"Inside" means the style clause: *"muted earthy palette… strong dark outline and
deep shadow mass"*, value mass sitting low.

### The Mage is a third kind of outlier

He is not pale and he is not high-chroma. His value mass is fine — near-black
outlines throughout, a genuinely dark cloak, real shadow under the hood and
between the armour plates. On the axis that caught the Assassin and the Priest
he passes comfortably.

What separates him is **hue**. The clause asks for *"greens browns and
leather"*; the Mage is violet, blue-grey and gold, with a wooden staff shaft as
the only warm earthy note on the figure. Nothing about him is wrong — he reads
well on the floor and his silhouette is the most distinctive on the sheet — but
he is not the palette the clause describes.

**On "no glow, no emissive rim, no neon":** the shoulder crystals and the staff
head are pale blue with near-white cores, and they read as luminous. They are
nonetheless *literally* compliant — every crystal has a hard dark outline, and
there is no halo, no soft falloff and no additive bleed anywhere on the sheet.
The luminance is done with value contrast against a dark cloak, which is what
the clause is asking for rather than what it forbids. Worth stating explicitly
because "looks like it glows" and "is drawn with a glow" are different things,
and only the second one is a defect.

The Wizard is the one row that does not want a yes or a no. His **value mass is
squarely inside** — near-black outlines throughout, a dark headdress and a dark
cloak anchoring the top and back, real shadow under the drapery. His **hue is
not**: gold, cream and bronze carry most of the figure, which is warm and
earth-adjacent but a long way from "greens browns and leather". Calling that a
pass or a fail would be forcing a binary onto a sheet that is plainly doing one
of the two things well. Recorded as it reads.

He also carries the roster's **first depicted light source** — an orange flame
in the off hand — which is worth a sentence because the clause says *no glow, no
emissive rim, no neon*. The flame is drawn, not rendered: a hard dark outline
around the whole shape, a white-hot core made of value contrast, and **no halo,
no falloff, and no light thrown onto the arm or the cloak that holds it**. The
clause forbids rendering techniques, not fire. Same distinction as the Mage's
crystals, one step further along, and still on the right side of it. The line to
watch for is a future sheet that lights its own figure from an effect — that
would be an emissive rim by any other name.

### The garment hypothesis: confirmed from the other direction

At seven characters the pattern read as **robes come back pale**. The Monk broke
the simple version — robed, not pale — and the sharper claim became **large
uninterrupted single-value garments come back pale**, on the reasoning that the
clause's *"deep shadow mass"* comes for free from the gaps between many small
pieces and has nowhere to go on one continuous surface.

The Mage is the first real test of that, and he **corrects it**.

His front view is heavily interrupted — plate, crystal, trim, tabard — so it
doesn't test the claim. **His back does**, and it is the cleanest test case in
the roster: `assets/sprites/char/toh_mage.png`, row 6 (N), is a single violet
cloak covering roughly three-quarters of the figure with nothing on it but two
faint fold lines.

It did not come back pale. It came back **flat** — mid-value violet, almost no
internal shadow, a hem and two creases.

So the mechanism is right and the symptom was wrong. A large uninterrupted
garment loses its **shadow mass**, not its **darkness**. Where it lands after
that depends on the garment's own value: the Priest's cream and the Assassin's
white had nowhere to go but pale, the Mage's violet stays mid. The restated
claim:

> **A large uninterrupted single-value garment comes back with no shadow mass.
> Whether that reads as "pale" depends on the garment's base value, not on the
> mechanism.**

That is a better claim than the one it replaces, because it now predicts two
distinguishable outcomes instead of one, and the second is what actually
happened.

**The Wizard tests it from the opposite side, and it holds.**

The Mage's back was *uninterrupted and mid-value* → it came back **flat but not
pale**. The Wizard's front is *light and heavily interrupted* → it comes back
**light but not flat**. His kilt is cream, which is the colour that went pale on
the Priest and the Assassin, but it is broken by a bare torso, a belt, a sash, a
cloak and a headdress, and it keeps its folds and its shadow.

Put side by side:

| | garment | interrupted? | came back |
|---|---|---|---|
| Priest | seafoam-cream robe, shoulder to floor | no | pale **and** flat |
| Assassin | white hood and cloak | no | pale **and** flat |
| Mage (back) | violet cloak over 3/4 of the figure | no | mid-value, **flat** |
| Wizard (front) | cream kilt and drape | **yes** | light, **not flat** |
| Monk | burnt-orange robe | **yes** | mid, not flat |

That is the claim tested from both directions and surviving both: **the failure
is the unbroken surface, not the colour.** Lightness alone does not cause it —
the Wizard is proof — and darkness does not prevent it — the Mage is proof.

**How much to trust it now: enough to act on, not enough to gate on.** Four
confirming cases across five characters, two of which corrected an earlier
version of the claim rather than agreeing with it. The **Necromancer is the last
scheduled test**; if he is robed and uninterrupted and comes back with shadow
mass, the mechanism is wrong and this section should be rewritten rather than
patched again.

Note also that the Savage remains a **separate axis** — his value mass is fine
and his shadow mass is fine; it is chroma. Three unrelated ways to fall outside
one clause, which is itself worth knowing: the clause is doing at least three
jobs and a single number could never have gated it. That is the retired
aesthetic bands' obituary, restated from the other end.

### The prediction record, so far

Kept because it is the only way to know whether reading source files is worth
anything:

| character | called from sources | sheet said | |
|---|---|---|---|
| Assassin | unremarkable | **pale outlier** | ✗ wrong |
| Samurai | inside clause | inside clause | ✓ |
| Priest | pale | pale | ✓ |
| Monk | inside clause | inside clause | ✓ |
| Mage | *no prediction entered* | **cool-hue outlier** | — |
| Wizard | *no prediction entered* | inside on value, gold on hue | — |

Still three of four, with the miss in the reassuring direction. The last two rows
are deliberately empty: after the Assassin miss the standing rule became **source
files are a guess; the sheet is the evidence**, so nothing was called before the
sheet rendered. That costs a data point and is the right trade — a prediction
made in order to have a row to fill in is not a prediction.

Note that the source images for both were *visible in the conversation* before
the sheet existed, which is exactly the temptation the rule is for. Looking at a
240px PNG in a chat window is the same guess the Assassin miss came from.

**Nothing has been changed on account of any of this.** All three outliers read
well on the arena floor. The open question is whether the roster should look
like one game, and the cheapest way to answer it is the round-trip that
[`../../STYLE_ANCHOR.md`](../../STYLE_ANCHOR.md) records as never having been
run — now with a specific thing to look for: generate a robed caster and see
whether the garment comes back light.

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
