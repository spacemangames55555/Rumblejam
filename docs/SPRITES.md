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
    "enemy.skulker": { "file": "enemy/skulker.png", "w": 64, "h": 64, "directions": 8 },
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

An 8-direction character with 1 frame is a **64×512** PNG: one 64-px column,
eight 64-px rows, top to bottom in that order.

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

An 8-direction, 1-frame 64×64 sheet decodes to ~131 KB in memory; 64 unit
sheets is ~8.4 MB. At 4 animation frames that becomes ~524 KB each and ~34 MB
total. That is fine on desktop and worth measuring on a phone once the first
batch of art exists. If it bites, the levers are fewer animation frames or
fewer directions on low-value units — not a texture atlas.

## Canonical sizes

One number per category, so nobody has to ask:

| category | size | namespace |
|---|---|---|
| players | 64×64 | `char.` |
| enemies | 64×64 | `enemy.` |
| bosses | 128×128 | `boss.` |
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
