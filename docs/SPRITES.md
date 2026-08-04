# Sprites — how to add art to UNDERVAULT

The game shipped for thirteen patches drawn entirely in Canvas primitives:
circles, polygons, glyphs. That code is still there and is still the fallback
for every single entity. This document is about the layer that sits on top of
it.

**The one rule: art is optional, always.** With `assets/sprites/` empty — the
state the repository is in right now — the game runs, plays and looks exactly
as it did before any of this existed. A missing PNG is a normal, expected
state. It is never an error, never a console error, never a broken image, never
a blocked start.

That is what lets art land one file at a time instead of all at once.

## Adding one sprite

1. Open `assets/assets.json` and find the id you want to draw. Every id the
   game can ever ask for is already in there — the manifest **is** the art
   inventory. Note its `file`, its `w`/`h`, and whether it has `directions`.
2. Draw the PNG. No `directions` means one image at exactly `w`×`h`.
   `directions: 8` means a **grid**: `w` wide by `h × 8` tall, one row per
   facing in the order `E SE S SW W NW N NE` — see **Directional units**.
3. Save it at `assets/sprites/<file>`.
4. Reload. That entity is now a sprite; everything else is still primitives.

There is no build step, no import to add, no code to touch.

## The manifest

`assets/assets.json` is **generated**. Do not hand-edit it:

```
node tools/gen_assets_manifest.mjs           # rewrite it from the catalogs
node tools/gen_assets_manifest.mjs --check   # fail if it is stale (the test suite runs this)
```

It is regenerated from the live content tables, so a new item or a new
character gets an inventory entry automatically and cannot be forgotten.

```json
{
  "version": 1,
  "basePath": "assets/sprites/",
  "sprites": {
    "enemy.skulker": { "file": "enemy/skulker.png", "w": 32, "h": 32, "directions": 8 },
    "proj.pebbleshot": { "file": "proj/pebbleshot.png", "w": 32, "h": 32 },
    "prop.altar":    { "file": "prop/altar.png", "w": 64, "h": 64, "anchor": "bottom" }
  }
}
```

| field | default | meaning |
|---|---|---|
| `file` | — | relative to `basePath`. Never a leading slash: Pages serves the game from `/Rumblejam/`. |
| `w`, `h` | — | one frame's size, not the sheet's |
| `frames` | `1` | frames in the strip |
| `fps` | `8` | playback rate |
| `anchor` | `"center"` | `"bottom"` puts the art's feet on the entity's position — use it for anything standing on the floor |
| `directions` | `1` | rows in the grid. `1` (or absent) is the old rotated behaviour |
| `scale` | `1` | cosmetic render-size multiplier — see below |
| `content` | — | `[w, h]`, the measured opaque bounds of the tallest cell. The loader divides its height out so `scale` means the same thing on every sheet — see below |

**Sheets are strips; unit sheets are grids.** Columns are animation frames,
rows are facings. The cell for (frame, direction) sits at
`(frame × w, direction × h)`. A non-directional sprite is a single row: a
4-frame 32×32 bolt is a 128×32 PNG. See **Directional units** below for the
rest.

For any sprite with `directions > 1`, the image must be **exactly**
`w × frames` wide and `h × directions` tall. The loader checks this and, on a
mismatch, warns with the size it expected and marks the id missing so it falls
back to its primitive. A silently wrong grid is worse than no sprite: every
other kind of art bug is visible, but a grid off by one row just makes units
face subtly wrong, which survives a whole playtest.

To animate an existing static sprite, add `frames` and `fps` to the generator
(`tools/gen_assets_manifest.mjs`) and regenerate — not to the JSON by hand, or
the next regeneration will wipe it. If a manifest ever claims more frames than
the file actually holds, the loader notices, warns once, and uses what is
really there rather than drawing blank frames.

### `scale` — a cosmetic size multiplier, and only that

Art arrives at whatever size its author drew it, and a figure that reads small
next to the rest of the roster is a **look** problem. `scale` multiplies how
large the sprite is painted and changes nothing else:

```json
"char.toh_druid": { "file": "char/toh_druid.png", "w": 128, "h": 128, "directions": 8,
                   "scale": 2.18, "content": [90, 124] }
```

> **The Druid ships past the hitbox ceiling. This is deliberate.**
> Tuned against the floor grid at an effective 2.25×: 2.0 read slightly small,
> 2.5 slightly large. The manifest says `2.18` because `scale` is now measured
> against the silhouette rather than the cell, and his art fills 124 of its 128
> cell: `2.18 × (128/124) = 2.2503`. Same size, stated against content.
> His silhouette is 157 device px tall against a 144 px grid square and
> a 50 px catch radius, so his antlers and boots sit about **29 device px
> outside the circle that catches enemy shots** (his shoulders about 7 px).
> Shots will visibly pass near the antlers and the boots without hitting. That
> is an accepted trade for readability, not an oversight — see
> `docs/art-review/druid/README.md` §6. If it stops being acceptable, the fix
> is to grow the hitbox, not to shrink the art, and growing the hitbox is a
> simulation change.

It is **not** a radius. The tempting fix for art that reads small — nudge the
entity's radius until it looks right — is a simulation change: radius is
hitbox, is collision, is knockback distance, is how far a melee swing reaches,
and it is on the wire. This key is the version of that fix that cannot touch
any of them. `js/assets.js` is imported by the renderer and the app shell only;
no simulation module can even see it, and the test suite asserts that.

- Absent means `1`, so every sprite that does not opt in is bit-identical to
  before the key existed.
- Composed on top of the caller's own scale, **after** the row and frame are
  chosen — it changes how big a cell is painted, never which cell.
- Accepted range is `0 < n ≤ 8`. Anything else is refused with a console
  warning and drawn at `1` — never at `0`, which would be an invisible sprite
  with the primitive fallback already skipped.
- Set it in `assets/sprite-overrides.json`, like `frames` and `directions`; it
  is never a category default.

**It costs the fast path.** `drawSprite` normally paints with a bare
`drawImage` and no `save()`/`restore()`; a scale other than 1 is a real
transform and cannot be expressed that way. Measured on a 128px sheet at
72 device px, headless SwiftShader: **11.2 µs/draw on the fast path, 17.0 µs
scaled** — about half again, covering both the transform and the 2.25× pixels a
1.5 sprite fills. That cost is per-sprite, not global. At horde density it is
invisible, because only party members carry a scale: 8 scaled sprites among 300
measured 3.34 ms/frame against 3.35 ms with none scaled, inside the run-to-run
noise. Scaling *every* sprite would cost 1.7 ms/frame at 300 — about a tenth of
the 16.67 ms budget, so even the pathological case is affordable, but there is
no reason to pay it broadly.

## Why there are no aesthetic gates

`tools/verify_art_batch.mjs` checks **structure only** — that a file decodes,
that its dimensions are exactly what the loader will demand, that it has real
transparency rather than a baked matte, that no cell is empty, that it declares
`content` and that the declared `content` still matches the file. Plus facing
separation on 8-direction sheets, because a collapsed rotation is a broken sheet
rather than an unattractive one.

It does **not** judge how the art looks. It used to. Three bands — body
contrast ≥ 45, accent spread ≥ 90, body saturation ≥ 0.58 — were **retired on
2026-08-04**. The reasoning is recorded here because a gate that measures taste
is a tempting thing to re-add, and every one of these problems would come back
with it.

**They were calibrated on an art direction the project abandoned.** The bands
came from one arcade-styled character, generated during batch 0. The roster
moved to a grounded, muted, dark-outlined style; the anchor moved with it. The
bands stayed where they were, describing art nobody wants any more.

**They disagreed with each other as soon as there were two characters to
compare.** The Druid measures contrast 22.7 and saturation 0.387. The Hunter
measures contrast 13.3 and saturation 0.570 — considerably darker *and*
considerably more saturated. There is no single underlying quantity the two
axes are both tracking, so no recalibration makes both of them right at once.
Lowering both bands until the current roster fits would produce numbers that
pass everything and mean nothing.

**The contrast axis was measurably wrong.** It computed `bodyLuma − floorLuma`,
a *signed* difference, which assumes a sprite must be lighter than its floor. On
lighter candidate floors it went to −18.9 while the art became visibly *easier*
to read, because a dark outline separates from a light ground. Readability needs
the absolute separation. The axis could not express a dark sprite on a light
floor at all — a completely ordinary way for a game to look.

**They were least trustworthy at exactly the size the art is seen.** Measured on
rendered pixels, the axes are stable under magnification and move under
*minification*: at 35 device px a 128px sheet reduces to ~481 surviving pixels
and which ones survive is arbitrary. The gate was least reliable precisely where
readability is hardest and the number would have mattered most.

**And in practice they were waived every time.** Both installed characters
failed and both were waived. Thirteen consecutive waivers is not a gate, it is a
ritual — and a waiver list that always grows trains everyone to ignore the
thing it is attached to.

### Where consistency is judged instead

The contact sheet: [`docs/art-review/batch1/00-toh-installed.png`](art-review/batch1/00-toh-installed.png),
every installed character side by side at true device size on the arena floor,
each panel a crop of a real game frame at one fixed viewport. Regenerate it as
each character lands and look at it.

That is where the judgement was actually happening the whole time. The numbers
were a proxy for it, and a bad one.

What *is* still enforced numerically is size, because size has a right answer:
every sheet renders its silhouette at the same height, checked by the browser
suite against the renderer's own `drawImage` and reported per character in the
batch review.

## Directional units

Units are drawn **from a per-angle view**, not by rotating one image. A
character walking west is a different drawing, not the east one turned 180°.

`char.`, `enemy.` and `boss.` ship as **8-direction** grids. Everything else —
projectiles, props, item icons, UI — is single-direction and rotated, because a
bolt genuinely points along its velocity and a directional bolt would be
strictly worse.

### Row order

Fixed and non-negotiable, starting at row 0:

```
0 E    1 SE    2 S    3 SW    4 W    5 NW    6 N    7 NE
```

Screen-space east, then **clockwise** — canvas Y points down, so clockwise on
screen is increasing angle, and the row index falls straight out of `atan2`
with no offset term:

```js
const step = TAU / directions;
const dir  = ((Math.round(angle / step) % directions) + directions) % directions;
```

For `directions: 4` the same rule gives `E, S, W, N`.

An 8-direction character with 1 frame is a **32×256** PNG: one 32-px column,
eight 32-px rows, top to bottom in that order.

### Four directions instead of eight

The renderer handles any `directions` value, so dropping enemies to 4 later is
a one-line manifest change per entry with no code behind it — change
`UNIT_DIRECTIONS` or add a per-namespace rule in
`tools/gen_assets_manifest.mjs` and regenerate. Eight directions for ~60 units
is the largest single line item in the art budget; it is worth deciding once
there is art in play, not before.

### Facing

Nothing on the wire says which way anything is looking, and nothing should — a
facing byte would be a snapshot change for a purely cosmetic detail. The
renderer works it out from what it already draws:

- Enemies face the direction they are **moving**.
- Players face what they are **shooting at** for 0.6s after each shot, and
  their movement direction otherwise.
- A unit that is not moving keeps its last real heading. A unit never yet seen
  faces **south, towards the camera** — an idle arena must never snap east
  because `atan2(0, 0)` is `0`.

That memory lives in a `Map` in `js/render.js`, keyed by entity id, swept
periodically and cleared when the arena changes. It is never attached to an
entity, and a test asserts as much.

### Never rotated, never mirrored

A directional sprite is drawn square: the row *is* the facing. `flipX` is
ignored on a directional sheet — mirroring a west-facing drawing would produce
a sprite facing east with its art flipped. Draw all eight; do not draw four and
mirror.

This also makes the directional path the **cheaper** of the two: it always
qualifies for the renderer's no-`save`/`restore` fast path.

### Texture cost

An 8-direction, 1-frame 32×32 sheet decodes to ~33 KB in memory; 64 unit
sheets is ~2.1 MB. At 4 animation frames that becomes ~131 KB each and ~8.4 MB
total. That is fine on desktop and worth measuring on a phone once the first
batch of art exists. If it bites, the levers are fewer animation frames or
fewer directions on low-value units — not a texture atlas.

## Canonical sizes

One number per category, so nobody has to ask:

| category | size | namespace |
|---|---|---|
| players | 32×32 | `char.` |
| enemies | 32×32 | `enemy.` |
| bosses | 64×64 | `boss.` |
| projectiles, pickups, FX | 32×32 | `proj.` `fx.` |
| item and weapon icons | 32×32 | `item.` |
| props and structures | 64×64 | `prop.` |
| UI chrome | 32×32 | `ui.` |

Every one is a power of two, and that is a hard external constraint rather than
a preference: the generator's rotation endpoint — the only way to produce a
per-angle view — accepts a canvas of exactly 16, 32, 64 or 128 square and
nothing else, and its text-to-image endpoints reject anything under 32×32 in
area. The 48×48 units and 24×24 icons this pipeline first shipped with are not
generatable at all.

They are also chosen to sit near 1:1 with the size things are actually *drawn*
at. A character is drawn at twice its radius — 32 world units, about 36 css px
at the reference viewport — so a 64px sheet would be downscaled 56% and throw
away more than half the pixels it was authored with. 32px is a hair under the
draw size and stays crisp.

Those eight namespaces are the whole vocabulary. An id outside them is a typo
and the loader drops it loudly.

Art is scaled to the entity's actual radius at draw time — an elite is 1.45×
an ordinary enemy and a Blacksmith is 1.4× an ordinary player — so a sprite
never dictates a hitbox. Draw at the canonical size and the engine handles the
rest. Smoothing is off, so pixel art stays crisp at any scale.

## What is in the inventory

298 ids, all of them currently pointing at files that do not exist:

| namespace | count | what |
|---|---|---|
| `char.` | 47 | every character in both rosters (33 classic + 14 Thrones of Heaven) — **8-directional** |
| `enemy.` | 13 | the 12 base types plus the siege Ward Pylon — **8-directional** |
| `boss.` | 4 | the four floor bosses — **8-directional** |
| `proj.` | 21 | see below |
| `item.` | 172 | 146 items + 26 weapons, sharing one icon namespace |
| `prop.` | 24 | hatches, altars, drills, nests, gates, doors, barricades, wall tiles, turrets, drones, rams, lava, spikes, coral, singularities, spirits, decoys |
| `fx.` | 9 | materials, sparks, smoke, blood, booms, blocks, heals, telegraph marks, bone dust |
| `ui.` | 8 | joystick, edge arrows, hearts, shields, cursor, lock |

## Projectiles are special — read this before drawing one

Every other entity carries a type the renderer can look up. Projectiles do not:
a network snapshot carries a projectile's position, velocity, radius, colour
and allegiance, and **nothing else**. Adding a type byte would be a netcode
change, and the sprite layer is not allowed to touch netcode.

So a projectile's sprite is resolved from exactly the two things the renderer
already used to tell projectiles apart: **colour and size class**. The host and
every client resolve the same id from the same bytes, so everyone sees the same
bolt.

- **Friendly** projectiles resolve to `proj.<weapon_id>` — the table is built
  from `js/content/weapons.js`, so it can never drift from it. All 16
  projectile-firing weapons are distinguishable.
- **Hostile** projectiles are named for their *colour*, not their shooter,
  because the wire only carries the colour: the Lobber and the Choir of Eyes
  fire the same violet at the same radius and are genuinely identical on the
  wire. Four bolts cover every hostile shot in the game —
  `proj.hostile_violet` (Lobber spit, Choir ring and volley),
  `proj.hostile_gold` (Vault Regent burst), `proj.hostile_rose` (Choir
  phase-two spiral), `proj.enemy_shot` (everything else).

Projectiles are drawn rotated to their heading, so draw them pointing **right**
(+x).

## Debug flags

| URL | effect |
|---|---|
| `?sprites=off` | forces every fallback. The renderer behaves exactly as it did before this layer existed — useful for A/B comparison and as an escape hatch if art regresses something. |
| `?sprites=debug` | logs every missing id once at load, outlines a magenta dashed box wherever a sprite was requested but absent, and prints the **resolved direction row** on every directional sprite. Use the readout: an off-by-one and a mirrored row order both look *almost* right in motion and are genuinely hard to spot by eye. |
| `?spritescale=N` | paints **every** sprite N times larger. |
| `?playerscale=N` | paints **player sprites** N times larger — the `char.` namespace, which is the character sheets of both rosters plus the decoy ghost that borrows one. |

### Finding a size by eye

`?spritescale` and `?playerscale` exist so the right size can be settled in a
real arena at a real viewport, rather than by arguing about a number in a
manifest. They **compose**, with each other and with the manifest's own
`scale`, so:

```
?playerscale=1.4                    the Druid's shipped 1.5 becomes 2.1
?spritescale=1.2&playerscale=1.5    players 1.8x, everything else 1.2x
```

Range is `0 < N ≤ 8`; anything else warns and is ignored. Absent means 1, so a
URL without them is bit-identical to one from before they existed. When either
is active the loader says so once in the console, because a screenshot taken at
3× and filed as "the art looks wrong" costs more to unpick than one log line.

They are **cosmetic, exactly like the manifest key** — no radius, no hitbox, no
collision, nothing on the wire. Two players on the same host with different
flags see different sizes and agree completely about where everyone is and what
they hit. The browser suite asserts this by driving a real run at 3× painted
size and checking the player radius is still 16 with nothing named `scale` in
the snapshot.

One caveat worth knowing before you settle on a number: the sprite is drawn
`2 × radius` across, so past about **1.4×** a character's silhouette is taller
than the hitbox that catches shots, and past about **2×** the gap is wide enough
to see shots pass through the art. That is a real ceiling, not a rendering
artifact — beyond it the hitbox has to follow the art, which is a simulation
change. The Druid ships past it on purpose; see
`docs/art-review/druid/README.md` for the measured thresholds.

### `content` — what makes `scale` mean the same thing on every sheet

A sheet's figure fills whatever fraction of its cell the artist or the generator
happened to leave it. Measured fill fractions across every sheet on hand when
this was written:

| sheet | cell | content | fill (height) |
|---|---|---|---|
| `char.pulsar` | 32 | 21×27 | 84.4% |
| `char.toh_druid` | 128 | 90×124 | 96.9% |
| batch-0 candidate A | 32 | 18×25 | 78.1% |
| batch-0 candidate B | 32 | 21×26 | 81.3% |
| batch-0 candidate C | 32 | 20×24 | 75.0% |
| batch-0 candidate D | 32 | 29×31 | 96.9% |

**75% to 97% — a 1.29× spread in apparent height for the same `scale` value**,
and A–D came from one generator on one prompt family, so this is not an artifact
of hand-supplied art. Uncorrected, every unit lands at a different apparent size
and needs its own hand-calibration.

So the manifest records `content: [w, h]` — the opaque bounds of the tallest
cell — and the loader divides its height out:

```
fit = h / content[1]           painted size = callerScale × fit × scale × tuning
```

`content` is **measured, never typed**. `process_sprite.mjs` writes it when it
assembles a sheet; for art installed before this existed, backfill it with:

```
node tools/process_sprite.mjs --record-content char.pulsar
```

A hand-entered content box would itself be a padding correction, and a wrong one
is invisible.

#### `scale: 1.0` now means something

**The sprite's silhouette is exactly as tall as the entity's diameter.** That is
art-independent: it holds whether the PNG was cropped tight or exported with
half a cell of air around it. Any other value is therefore a **deliberate design
choice about that character** — "this one reads as a big character" — and not a
correction for how its file happened to be cropped. Two characters with the same
`scale` are the same height on screen, which is what makes the number worth
comparing across a roster.

#### Height, not width, and not area

A character's **height** is what reads as its size. Widths legitimately differ —
a cloaked figure against a spear-carrier — and normalising those to each other
would flatten a difference the art is making on purpose. Normalising on the
wrong axis is the same class of mistake as scaling the cell instead of the
figure, which is precisely what this fixes; picking the axis deliberately is
half the point.

#### A sheet with no `content` warns

Absent `content` means `fit = 1`, which is the old cell-normalised behaviour
exactly — and that is how this regresses **silently**, with no symptom beyond a
character that looks slightly wrong next to the others. Same shape as a stale
loader meeting a newer manifest: two halves disagreeing, a wrong picture, zero
diagnostics. So the loader says so at load, naming every id and the command that
fixes it, and exposes the set as `Assets.missingContent`. The sim suite fails if
any installed sheet lacks it.

## What this layer is not

It is not simulation, and the boundary is enforced by a test.

- `spriteId` lives on **definition tables only** — character, enemy, boss,
  weapon and item defs. It is never on a live entity, never in a snapshot,
  never on the wire. The sim suite asserts this on a real snapshot every run.
- Animation frames come from `performance.now()`, are client-local, and are
  never networked. Two players may be on different frames of the same walk
  cycle. That is fine. Each entity's phase is offset by a stable hash of its
  id, so forty grunts do not breathe in lockstep.
- Facing is render-local too — a `Map` in the render module, keyed by id, not
  a field on anything the simulation owns.
- Nothing here can change a hitbox, a damage number, a spawn, or a tick.

## Loading

Sprites start loading at page load, while the player is still on the title
screen — not at game start. Starting a run waits for the load to settle so art
does not pop in mid-fight, shows a one-line `Loading assets…`, and gives up
after 10 seconds and starts anyway. A hung request is not a reason to keep
anyone out of the game.

## Files

| file | what |
|---|---|
| `js/assets.js` | the loader, `drawSprite()`, the debug flags |
| `js/content/sprites.js` | id tables for everything without a def of its own — projectiles, props, FX, UI |
| `assets/assets.json` | the manifest / art inventory (generated) |
| `tools/gen_assets_manifest.mjs` | the generator |
| `js/render.js` | the draw sites, each one `sprite ?? primitive` |
