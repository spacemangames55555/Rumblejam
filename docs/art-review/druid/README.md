# Druid — installed at eight facings, measured, and a floor sweep

`assets/sprites/char/toh_druid.png` · sources in [`sources/`](sources/)

## 1. Installed

**Eight facings, all hand-supplied.** The four diagonals (SE, SW, NW, NE)
arrived after the first four and completed the set, so nothing was
chain-rotated and nothing was invented to fill a gap. The sheet is now a plain
`directions: 8` grid in the standard row order — the per-sprite `directions`
override is gone, because eight *is* the category default.

The four cardinals are byte-identical to the ones installed before (`md5`
unchanged), so this is the same art with four rows added, not a re-supply.

Cell size is **128×128**, as before. The sources are **248×248** with the figure
occupying only ~97×124 of it, and `--autocrop` crops to the union of all content
first. The union across eight sources is **the same 97×124 box** it was across
four — the diagonals sit in register with the cardinals, which is why the figure
does not jitter between facings.

| | |
|---|---|
| file | `assets/sprites/char/toh_druid.png`, 128×1024 |
| manifest | `w:128 h:128 directions:8` (`directions` now the default, not an override) |
| rows | 0 E · 1 SE · 2 S · 3 SW · 4 W · 5 NW · 6 N · 7 NE |
| loader | accepted in the running game: `accepted: true`, `inMissing: false`, image 128×1024 |

[`02-installed-8rows.png`](02-installed-8rows.png) — the eight cells laid out as
a compass at 1:1, with a 36 device px strip beneath in sheet order.

[`03-ingame-8facings.png`](03-ingame-8facings.png) — the same eight drawn
**through the shipped `drawSprite()` path in the running game**, at 72 and 36
device px on the arena floor colour, stepping the heading 0° → 45° → … → −45°.
`drawSprite` returned `true` for all eight, and `dirIndex()` mapped each angle to
its own row with no offset:

```
E   0°  -> row 0 (E)      W  180°  -> row 4 (W)
SE  45° -> row 1 (SE)     NW -135° -> row 5 (NW)
S   90° -> row 2 (S)      N  -90°  -> row 6 (N)
SW 135° -> row 3 (SW)     NE -45°  -> row 7 (NE)
```

[`00-installed-4rows.png`](00-installed-4rows.png) is the earlier four-row
install, superseded by the above and kept only as the record of that state.

## 2. Measured, not gated

Against `#14161f`. **He still fails contrast and saturation.** Installed anyway,
waived in `assets/gate-exceptions.json`.

| | contrast (band ≥45) | spread (band ≥90) | bodySat (band ≥0.58) |
|---|---|---|---|
| whole sheet | **22.7** ✗ | 93.4 ✓ | **0.387** ✗ |
| row 0 E | **20.4** ✗ | 102.2 ✓ | **0.393** ✗ |
| row 1 SE | **16.4** ✗ | 104.2 ✓ | **0.401** ✗ |
| row 2 S | **18.0** ✗ | 100.8 ✓ | **0.334** ✗ |
| row 3 SW | **16.9** ✗ | 101.2 ✓ | **0.402** ✗ |
| row 4 W | **16.0** ✗ | 103.5 ✓ | **0.376** ✗ |
| row 5 NW | **27.2** ✗ | **81.9** ✗ | **0.397** ✗ |
| row 6 N | **32.3** ✗ | **80.9** ✗ | **0.391** ✗ |
| row 7 NE | **31.3** ✗ | **77.5** ✗ | **0.394** ✗ |

The front views are darker and carry more accent; the back views are lighter and
carry less. That is the cloak: from behind it is one broad green mass with the
face, beard, belt and staff-head all hidden, so there is less bright material to
form an accent quarter. The whole sheet passes spread on the strength of the
front and profile rows.

### Facing separation now passes

| | |
|---|---|
| opposite mean | 133.1 |
| adjacent mean | 132.0 |
| **ratio** | **1.009** (band ≥0.85) ✓ |

```
opposite   E/W 133   SE/NW 154   S/N 135   SW/NE 111
adjacent   E/SE 165  SE/S 113    S/SW 120  SW/W 147
           W/NW 146  NW/N 115    N/NE 120  NE/E 130
```

This is the number that read **0.82** on the four-row sheet, where the README
argued the band would not transfer to four directions because the "adjacent"
pairs were 90° apart rather than 45°. With the real eight rows in place it
clears the band without the band moving. The earlier 0.82 was an artifact of the
sheet shape, not a property of the art.

## 3. The gate is still wrong in the same specific, fixable way

Nothing here changes that finding, and nothing in the gate was touched.

[`01-floor-sweep.png`](01-floor-sweep.png) is **unchanged and still applies** —
its rows are the same source art, and adding four facings does not alter how the
figure sits against a floor. Each row is a candidate floor with its own grid
lines, showing the Druid at 72 device px, at 36 device px, a bright projectile
(`#ffd45e`), and a telegraph disc (`rgba(255,93,108,0.28)` fill, `#ff5d6c` edge).

| floor | | Druid contrast | projectile | telegraph edge |
|---|---|---|---|---|
| `#14161f` | current | 18.0 | 190.4 | 106.3 |
| `#1b1e2b` | grid-line value | 10.0 | 182.3 | 98.2 |
| `#23273a` | | 0.8 | 173.1 | 89.0 |
| `#2b3145` | | **−8.9** | 163.5 | 79.4 |
| `#343b52` | | **−18.9** | 153.4 | 69.4 |
| `#2f2a3d` | cooler | −4.2 | 168.2 | 84.1 |
| `#332f28` | warmer | −7.1 | 165.3 | 81.2 |

**The measured contrast goes negative while the Druid becomes easier to see.**
He reads *better* on `#2b3145` and `#343b52` than on the current floor, because
his dark outline separates from a lighter ground. The number says −18.9.

That is a defect in the metric. The contrast axis computes
`bodyLuma − floorLuma`, a **signed** difference, which silently assumes a sprite
must be lighter than its floor. Readability needs the **absolute** separation. A
dark sprite on a light floor is a normal way to read; the gate cannot currently
express it.

The saturation failure is different and looks real rather than an artifact: 0.39
against a 0.58 band. The Druid's greens and browns genuinely are muted next to
the arcade reference the band was calibrated on. Whether that is a problem
depends on whether the whole game moves to this palette — which is what the
playtest decides, not the gate.

The signed-vs-absolute fix is one line with consequences for every future batch,
and it should follow the playtest rather than pre-empt it.

## 4. The tradeoff a lighter floor buys

Raising the floor helps the Druid and costs the danger layer:

- The **projectile** survives everywhere — gold at luma 212 stays 150+ above any
  of these floors. Not the constraint.
- The **telegraph** is the constraint. Its fill is only 28% alpha, so on
  `#343b52` the filled interior is nearly indistinguishable from the floor and
  the read collapses to the 2px edge ring. A danger zone that only reads as a
  thin outline is a worse trade than a dim Druid.

If the floor moves, the telegraph fill alpha has to move with it. That is a
one-line change in `PALETTE.telegraph` and it is not applied here.

## Open question, for the playtest

Whether a Druid *feels* like a Druid in motion — now with all eight facings, so
turning is a real turn rather than a snap between four. No measurement in this
document answers that, and none of the numbers above should be allowed to
overrule it. Handedness across the profiles is yours to judge in play: the tools
verified row order and angle mapping, not which hand holds the staff.
