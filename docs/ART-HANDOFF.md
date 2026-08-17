# Hand-drawn unit art — the full spec

For hand-authored region art. Every shipped sprite in this game arrived this
way: the Druid anchor, all thirteen batch-1 characters, the bear. Four API
round trips produced nothing installable
([`art-review/anchor-roundtrip/`](art-review/anchor-roundtrip/README.md)), so
this is the path that works.

Canonical technical reference is [`SPRITES.md`](SPRITES.md); where this and that
disagree, that one wins.

---

## 1. What every sheet must be

**One PNG per unit.** Eight facings stacked vertically, one row each.

```
width  = cell_w × frames        (frames = 1 for an idle-only sheet)
height = cell_h × 8
```

**Row order, top to bottom — E, SE, S, SW, W, NW, N, NE.** This is fixed and the
loader rejects a grid that is not exactly `w×frames` by `h×8`. Do not
hand-assemble the grid; supply eight separate files and let the installer
stack them. A row-order error looks *almost* right in motion, which is exactly
how it survives review.

**Compass reference.** S is the facing a unit shows before it has ever moved and
the one a reviewer sees most — draw it first. N is the *back* view: no face. Of
the four generated attempts, all four returned a north still showing the
creature's face, so this is the single easiest thing to get wrong.

| row | facing | reads as |
|---|---|---|
| 0 | E | side view, facing right |
| 1 | SE | three-quarter, toward viewer-right |
| 2 | **S** | **front, toward the viewer** |
| 3 | SW | three-quarter, toward viewer-left |
| 4 | W | side view, facing left |
| 5 | NW | three-quarter back, away-left |
| 6 | **N** | **back, away from the viewer — no face** |
| 7 | NE | three-quarter back, away-right |

**Transparency is required, not optional.** A real alpha channel, no baked
background. The installer refuses a sheet with zero transparent pixels and warns
on any cell whose border ring is >90% opaque — a near-black matte is invisible
against the dark arena floor in review and glaring in play.

**No baked ground shadow, no outline glow.** The renderer composites.

**Padding is fine.** You do not need to fill the cell. Supply art at whatever
canvas you drew on and pass `--autocrop`: the installer crops to the union of
opaque bounds across all eight facings and blits into the cell **without
resampling**. It re-centres per direction row by default, using that row's union
bounding box — per-cell re-centring would flatten intentional animation motion.

**Draw all eight before installing any.** Autocrop uses the union across the
set, so a partial set normalises against the wrong bounds.

---

## 2. The installer

```
node tools/process_sprite.mjs <spriteId> <inputDir> --autocrop
```

Filenames it accepts in `<inputDir>` — any one convention, consistently:

```
0.png 1.png … 7.png                          (row index)
e.png se.png s.png sw.png w.png nw.png n.png ne.png
east.png south_east.png south.png …          (also south-east, southeast)
<direction>/*.png                            (a folder per direction, frames sorted by name)
```

It reports which convention it matched, then: assembles the grid, verifies the
dimensions the loader will demand, trims and re-centres, checks true
transparency, fails on any empty cell, and records `frames`, `fps` and the
measured `content` bounds into `assets/sprite-overrides.json` before
regenerating the manifest.

Useful flags: `--dry-run` (report, write nothing), `--recenter=row|cell|sheet|none`,
`--frames=N`, `--allow-matte` (downgrade the matte check to a warning).

Then confirm:

```
node tools/verify_art_batch.mjs enemy --require-all
node tools/gen_facing_review.mjs assets/sprites/enemy/<file>.png --out=/tmp/check.png
```

The second one puts **south beside north** at review size and asks one question:
*can you see its face in the north cell?* There is no metric for this — one was
tried and measured against all fourteen known-good character sheets and could
not separate a real back view from a frontal one, so it is judged by eye
([§13 rule 73](GDD.md)).

---

## 3. Cell sizes, and why bosses just changed

Art is scaled at draw time to cover the entity's **diameter** (`radius × 2`), so
cell size is a detail budget, not a hitbox. What matters is source pixels
available per painted world unit — under 1.0 means the sheet is being upscaled
and no amount of drawing skill survives it.

| | cell | radius | painted | source px per painted unit |
|---|---|---|---|---|
| chaff enemies | 128 | 12–15 | 24–30 | 4.3 – 5.3 |
| heavy enemies | 128 | 19–27 | 38–54 | 2.4 – 3.4 |
| **bosses (was 64)** | ~~64~~ | 46–48 | 92–96 | ~~0.67 – 0.70~~ |
| **bosses (now 192)** | **192** | 46–48 | 92–96 | **2.0 – 2.1** |

**Bosses were 64 and are now 192.** The biggest thing on the field was drawn from
the smallest cell — a sevenfold disparity the wrong way round, on the unit a
player looks at longest. `js/content/sprites.js` had already caught and fixed
this reasoning for enemies (32 → 128) and left bosses on the old assumption.
Changed now because **no boss art exists** — 0 of 6 boss ids have a file — so it
is free today and means redrawing six sheets the moment it is not. Costs 1.13 MB
decoded per boss against 0.13 at 64.

---

## 4. The fourteen units

Draw one at a time. **The silhouette note is the brief** — at ~36 css px on a
dark floor with 200 enemies alive, outline is the entire readability budget, and
every note is checked unique against all 78 others. Colour and interior detail
are secondary to being the only thing on the field with that shape.

### Region 1 — Pacific Northwest
*tileset `pnw`, hazard `undergrowth` (brush that slows), primary domain physical.
Grown, branching, ragged — everything here should read as something that has
been alive.*

| # | sprite id | cell | brief |
|---|---|---|---|
| 1 | `enemy.pnw_sapling` | 128×128 | a slender upright stalk with two drooping frond arms and no head |
| 2 | `enemy.pnw_thornhound` | 128×128 | long and low on four legs, spine ridged with backswept quills |
| 3 | `enemy.pnw_mistwalker` | 128×128 | a tall hooded column that frays into nothing below the waist |
| 4 | `enemy.pnw_bark_hulk` | 128×128 | a squat trunk-bodied mass with two enormous knuckled forelimbs |
| 5 | `enemy.pnw_elk` | 128×128 | a narrow body under a vast branching antler crown twice its width |
| 6 | `enemy.pnw_cedar_warden` | 128×128 | a forward-leaning wedge trailing a single long cedar-plank tail |
| 7 | `boss.pnw_boss` — *The Cedar Mother* | **192×192** | a broad rooted torso crowned by a canopy of splayed limbs, wider at the top than the base |

### Region 2 — Central America (Xibalba)
*tileset `xibalba`, hazard `bloodmire` (damaging ground), primary domain
spiritual. Bladed, geometric, ritual. **These must not converge with region 1 as
black cutouts** — the two rosters share every archetype, and grown-versus-cut is
the axis that keeps them apart.*

| # | sprite id | cell | brief |
|---|---|---|---|
| 8 | `enemy.xib_howler` | 128×128 | a hunched biped with an oversized open jaw taking up half the head |
| 9 | `enemy.xib_ashmoth` | 128×128 | a small body between two ragged wings held in a shallow V |
| 10 | `enemy.xib_censer` | 128×128 | a stooped figure with one long chain hanging from an outstretched arm |
| 11 | `enemy.xib_jade_colossus` | 128×128 | a blocky stepped monolith of stacked rectangles with no neck |
| 12 | `enemy.xib_bloodpriest` | 128×128 | a straight-backed figure under a tall fan-shaped feathered headdress |
| 13 | `enemy.xib_obsidian_lancer` | 128×128 | a lean angular runner holding one long lance flat and forward |
| 14 | `boss.xib_boss` — *Ixkik, the Blood Moon* | **192×192** | a tall thin figure inside a broken crescent ring that arcs overhead |

Full prompts, including the style clause, are in
[`prompts.json`](prompts.json) keyed by sprite id — useful as a written brief
even though nothing will be generated from them.

---

## 5. Matching the anchor by eye

The anchor is **the Druid**, `assets/sprites/char/toh_druid.png`, 128×1024.
Single facings for reference are in
[`art-review/druid/sources/`](art-review/druid/sources/).

These are measured off the shipped sheet — all eight facings, opaque pixels
only — and they are what four API attempts each failed differently to hit. Match
them by eye; they are a description of the anchor, not a gate.

### Value distribution — this is the anchor's identity

| | Druid |
|---|---|
| luma p05 | **0** |
| luma p25 | 24 |
| luma median | **56** |
| luma p75 | 99 |
| luma p95 | 174 |
| luma max | 227 |
| darkest 15%, mean luma | **0.3** |

Read as a shape: **a true-black floor, a broad body sitting well below middle
grey, and a small bright tail.** Median 56 on a 0–255 scale is dark — the body
is roughly 22% luminance. p05 of 0 and a darkest-15% mean of 0.3 mean there is
genuine pure black in the outline and shadow mass, not dark grey.

The four failure modes, for calibration against your own eye:

| attempt | median | darkest 15% | what it looked like |
|---|---|---|---|
| 1, 2 | 119, 109 | 16.2, 17.1 | pale peach body, no black anywhere |
| 3 | 99 | 9.4 | black floor arriving, still too bright |
| 4 | **27** | 8.9 | overshot — half as bright as the anchor |

Nothing landed on 56 from either side. If your instinct says a sprite looks too
dark on a white canvas, it is probably right for this floor.

### Palette tightness

| | Druid | generated |
|---|---|---|
| distinct colours, whole sheet | **115** | 491 – 1,639 |
| saturation p25 / median / p75 / p95 | 0.31 / **0.42** / 0.53 / 0.63 |
| near-grey (sat < 0.15) | **13.7%** |
| dominant hues | yellow-green 19.3% · red 14.2% · rose 10.5% · orange 9.8% · cyan 9.0% |

**115 colours across all eight facings** is the number to work to. That is a
tight, deliberately limited palette — roughly a dozen or so per region of the
figure, reused. About one pixel in seven is near-grey, which is what keeps the
saturated notes reading as accents rather than as the whole drawing.

### Edge density

| | Druid |
|---|---|
| hard-edge pixels (adjacent luma step > 24) | **45.6%** |

Nearly half of all adjacent pixel pairs are a hard value step. **The anchor is
banded, not blended** — crisp steps between value regions rather than gradients.
This is the property no API parameter reached: attempts ran 9.2% to 37.7%,
either smooth-and-many-coloured or flat-and-featureless. It is probably the most
distinctive thing about the style and the most characteristic of hand-authoring.

### Content and framing

| | Druid |
|---|---|
| content bounds, tallest cell | 90×124 within a 128 cell |
| fills | 96.9% of cell height |

Draw to fill the cell height. The installer records measured `content` and the
loader divides it out, so **every unit normalises to the same on-screen
silhouette height regardless of how you padded** — all fourteen batch-1
characters landed on 157.0 device px with no hand-tuning. Do not try to
pre-compensate for size; draw the unit filling its frame and let normalisation
handle it.

---

## 6. Regions 3–8 — the authoring work, which is not art

Six regions exist as names only: **The Sahel, Norse Reach, Steppe, Indus Delta,
Abyssal Trench, The Vault.** They carry no data. That is **42 enemies and 6
two-phase bosses** nobody has written — SEVEN per region, not six: six combat
archetypes plus a `behavior: 'nest'` spawner, so each region's Nest Purge looks
like its region rather than borrowing the base roster's Wombden and Flit brood,
which is what regions 1 and 2 do today. See `docs/regions-3-8-roster-brief.md`
for the slot table and the constraints each roster is gated against. It is
content design, not drawing —
whether it comes before or after the art is your call, but the art spec above
cannot be written for them until it exists, because the silhouette note *is* the
brief and it is derived from what the enemy does.

Per region, the work is one entry in `js/content/regions-enemies.js` and one in
`js/regions.js`. **No engine code.** Every system a region needs is already
generic across all eight: `REGION_BY_INDEX`, `nodeModifiers()`, node-tree
generation, floor composition, difficulty scaling and the objective set all run
with no per-region branches.

### Per enemy

Required on every def: `id`, `name`, `domain` (physical/mental/spiritual), `behavior`,
`hp`, `spd`, `dmg`, `radius`, `mats`, `w` (encounter weight), `shape`, `color`.

Behaviours, and what each additionally requires — a missing block throws on the
first tick that enemy exists, so this is asserted at import:

| behavior | also needs |
|---|---|
| `chaser`, `sprinter`, `brute`, `splitter`, `warden` | — |
| `spitter` | `keepDist`, `fireCd`, `proj` |
| `orbiter` | `orbitR`, `diveCd`, `diveWindup` |
| `bomber` | `boom`, `triggerDist` |
| `medic` | `healR`, `healPs` |
| `nest` | `spawnCd`, `maxBrood`, `broodId` |
| `dasher` | `dash` |
| `sniper` | `beam` |

### The three composition rules, asserted at import

1. **Every heavy telegraphs.** `brute`, `warden` and `dasher` must carry a
   `telegraph` block. A heavy that cannot be read is undodgeable damage wearing
   a big silhouette.
2. **Chaff must NOT telegraph.** Undodgeable contact damage is the other half of
   the trade — it is what Footing's grit and vitality answer, and a roster where
   everything commits collapses Footing into "always break".
3. **At least 50% of the population telegraphs, by encounter weight.** Below
   that, most incoming damage is undodgeable and the hold-or-break decision is
   settled by arithmetic rather than by play.

A `telegraph` block needs `windupMs` (≥350, the reaction floor), `recoverMs`,
`recoverFrozen` (explicit — it is the punish window, not a default),
`cooldownMs`, `retryFrac` in (0,1], `damage`, `domain`, and a `shape` of
`circle{radius}`, `cone{angle,range}` or `line{width,length}`.

### Per boss

Two-phase. `p2.atFrac` in (0,1), and **phase 2 must change the zone SHAPE** —
a second phase with the same shape is a stat multiplier wearing a phase change,
and the read a player learned in phase 1 would stay correct. Both phases
telegraph. Region 1 goes circle → cone; region 2 goes cone → line.

### Per region entry in `js/regions.js`

`id`, `index`, `name`, `nativeClass`, `expectedLevel`, `domainSkew`
(`primary`, optional `secondary`, `maxShare` — currently 0.60, so no more than
60% of a population may share one domain), `tileset`, `hazard`,
`cursedModifier`, the six enemy ids, the boss id, `tuning`
(`hpMult`/`damageMult`/`densityMult`) and `contentReady`.

Enemy ids and the boss id are resolved against the real population for any
region marked `contentReady` — the region table previously named six
`ca_*` enemies that no file defined and a count check passed over it for two
releases ([§13 rule 73](GDD.md)).

### And then the art

Each new region adds **6 enemies at 128×128 and 1 boss at 192×192**, plus a
silhouette note per unit in [`silhouettes.json`](silhouettes.json) — checked
unique against every other note, because two units described the same way get
drawn the same way. Regions also name a `tileset` and a `hazard`; only `tundra`
has tiles on disk, and they are placeholders.

**Totals if all six are built: 48 unit sheets, 384 facings** — 42 enemies
(seven per region) plus the six bosses.
