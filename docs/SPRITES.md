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
   inventory. Note its `file` and its `w`/`h`.
2. Draw a PNG at exactly that size.
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
    "enemy.skulker": { "file": "enemy/skulker.png", "w": 48, "h": 48 },
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

**Sheets are single horizontal strips.** Frame *N* lives at `x = N × w`, one
row, no padding. A 4-frame 48×48 walk cycle is a 192×48 PNG.

To animate an existing static sprite, add `frames` and `fps` to the generator
(`tools/gen_assets_manifest.mjs`) and regenerate — not to the JSON by hand, or
the next regeneration will wipe it. If a manifest ever claims more frames than
the file actually holds, the loader notices, warns once, and uses what is
really there rather than drawing blank frames.

## Canonical sizes

One number per category, so nobody has to ask:

| category | size | namespace |
|---|---|---|
| players | 48×48 | `char.` |
| enemies | 48×48 | `enemy.` |
| bosses | 96×96 | `boss.` |
| projectiles, pickups, FX | 16×16 | `proj.` `fx.` |
| item and weapon icons | 24×24 | `item.` |
| props and structures | 64×64 | `prop.` |
| UI chrome | 32×32 | `ui.` |

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
| `char.` | 47 | every character in both rosters (33 classic + 14 Thrones of Heaven) |
| `enemy.` | 13 | the 12 base types plus the siege Ward Pylon |
| `boss.` | 4 | the four floor bosses |
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
| `?sprites=debug` | logs every missing id once at load, and outlines a magenta dashed box wherever a sprite was requested but absent — so a half-finished sheet is obvious on screen. |

## What this layer is not

It is not simulation, and the boundary is enforced by a test.

- `spriteId` lives on **definition tables only** — character, enemy, boss,
  weapon and item defs. It is never on a live entity, never in a snapshot,
  never on the wire. The sim suite asserts this on a real snapshot every run.
- Animation frames come from `performance.now()`, are client-local, and are
  never networked. Two players may be on different frames of the same walk
  cycle. That is fine.
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
