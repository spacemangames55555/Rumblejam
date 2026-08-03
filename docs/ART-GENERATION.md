# Art generation phase

Follows `patch-sprite-pipeline` and `patch-directional-sprites`. The pipeline is
live, the manifest holds 298 ids, and units are 8-direction grids. This document
covers filling them.

Canonical technical reference is [`SPRITES.md`](SPRITES.md). Where this document
and that one disagree, `SPRITES.md` wins — it lives with the code and gets
updated by whoever changes it.

---

## 1. Generator coverage

**Status: no image generator is connected to this environment.** The session's
connectors are Gmail, Google Calendar and Google Drive; there is no PixelLab
MCP, and no image-generation tool of any kind. Outbound HTTPS is also blocked by
the environment's network policy (the proxy answers 403 to CONNECT for every
external host), so the PixelLab API cannot be reached directly either, and its
pricing page cannot be read.

Batches 0–8 are therefore blocked on a generator being made available. Nothing
in this document can start until then. Everything that does *not* depend on
which generator is chosen has been built and is listed in §10.

When a generator does appear, the first action is still to introspect its live
tool schemas rather than trust any README, and to revise this table:

| Asset class | ids | Covered by PixelLab's four documented tools? |
|---|---|---|
| Characters, enemies, bosses | **64** | Yes — `create_character(n_directions=8)` + `animate_character` |
| Ground / environment tiles | — | Yes, if tiled floors are wanted |
| Projectiles, FX | 30 | **No** |
| Props, structures | 24 | **No** |
| Item and weapon icons | 172 | **No** |
| UI chrome | 8 | **No** |

If those four tools are all there is, the 234 non-unit ids need a second
generator. That is a separate decision and must not block the character
batches — the 64 unit sheets are both the highest-value art in the game and the
only part PixelLab is actually built for.

> **Count correction.** The earlier draft estimated ~8 bosses and ~35 regular
> enemies. The live catalog has **4 bosses** and **13 enemy sheets** (12 types
> plus the siege Ward Pylon). Total units is **64**, not ~90. Batch 3 is a
> quarter the size it was budgeted for.

---

## 2. Style anchor

**Generate exactly one unit first and stop.** Pulsar — close-combat nova
character, the reference implementation of engine-not-multiplier, and the most
visually distinctive thing in the roster.

1. Generate Pulsar alone, 8 directions, idle only. Iterate until approved.
2. Record the returned asset id and the exact final prompt in
   [`STYLE_ANCHOR.md`](STYLE_ANCHOR.md).
3. Every later generation references that anchor — via the API's reference
   parameter if one exists, and via verbatim reuse of the style clause either
   way.
4. **Never re-roll the anchor once batch 1 begins.** A changed anchor
   invalidates everything generated before it.

Consistency drift across 298 assets is the primary failure mode of this phase.
The anchor is the only defence.

The discipline is enforced mechanically: `tools/gen_prompts.mjs` reads the style
clause out of `STYLE_ANCHOR.md` between two markers and pastes it into every
prompt byte for byte, and **refuses to emit anything while the clause reads
`PENDING`**. Paraphrasing the style clause is not a rule anyone has to remember,
because there is nowhere to type a paraphrase.

---

## 3. Prompts

```
{subject}, {silhouette note},
{STYLE CLAUSE — verbatim from STYLE_ANCHOR.md, never edited},
{8-directional}, {w}px, transparent background,
no ground shadow, no outline glow
```

- **Subjects** come from the live content tables — name, roles, behaviour — so
  they cannot drift from the game.
- **Silhouette notes** are hand-authored in [`silhouettes.json`](silhouettes.json):
  the one shape feature that distinguishes each unit at 48×48 in a crowd of
  forty ("the widest thing on the field, a walking slab with dragging arms";
  "needle-narrow, the thinnest profile in the cast"). At Rumblejam's density
  silhouette is the entire readability budget — at ~36 css px on a dark floor
  with 200 enemies alive, outline is all a player resolves. Colour and interior
  detail are secondary. All 64 are written, and the generator fails if two units
  share a description.
- Transparent background, no baked shadow. The renderer composites.

`docs/prompts.json` is generated and holds the exact prompt for every unit,
keyed by sprite id, so regenerating one sprite in six weeks reproduces its
neighbours rather than a near-miss.

```
node tools/gen_prompts.mjs            # write docs/prompts.json
node tools/gen_prompts.mjs --check    # fail if stale
```

---

## 4. Post-processing — `tools/process_sprite.mjs`

A generator returns per-direction images. The renderer wants one grid. Between
generation and commit, every asset passes through:

```
node tools/process_sprite.mjs <spriteId> <inputDir> [--recenter=row] [--dry-run]
```

It accepts `0..7.png`, `e/se/s/…png`, `east/south_east/…png`, a folder per
direction, or a horizontal strip per direction, and reports which convention it
matched. Then:

1. **Assembles the grid** in the row order fixed by `patch-directional-sprites`
   — `E SE S SW W NW N NE`, top to bottom, columns are frames.
2. **Verifies final dimensions** are exactly `w*frames × h*directions` — the
   same rule the loader applies at runtime, caught here where the error can name
   the file and the expected size.
3. **Trims transparent padding and re-centres** to the declared cell size.
4. **Confirms true transparency** — fails on a fully opaque sheet, warns on any
   cell whose border ring is >90% opaque and names the colour, because a
   near-black matte is invisible in review on a dark floor and obvious in play.
5. **Records `frames`/`fps`** in `assets/sprite-overrides.json` and regenerates
   the manifest.

Do not hand-assemble grids. Row-order errors look *almost* right in motion, and
hand assembly is how they get in.

> **Deviation, deliberate.** The draft said trim and re-centre *per cell*. The
> tool re-centres **per direction row** by default, using the union bounding box
> of that row's frames. Per-cell re-centring flattens intentional animation
> motion — a walk cycle legitimately moves the body up and down, and normalising
> every frame independently removes exactly that. The inconsistency the trim
> exists to fix comes from directions being *generated separately*, so
> normalising per row fixes it without destroying the animation.
> `--recenter=cell` gives the literal behaviour; `sheet` and `none` are also
> available.

> **Manifest note.** `assets/assets.json` is generated and would lose anything
> hand-edited into it. Per-sprite deviations from the category defaults live in
> `assets/sprite-overrides.json`, which the generator merges — that is where a
> unit's real frame count, or an enemy dropped to 4 directions, is recorded.

---

## 5. Batch order

| # | Batch | Count | Notes |
|---|---|---|---|
| 0 | Style anchor — Pulsar, idle | 1 | Approve before anything else |
| 1 | Player characters, idle | 46 | First real look at directional in play |
| 2 | Bosses, idle | 4 | |
| 3 | Regular enemies, idle | 13 | Direction-count decision lands here |
| 4 | Animations for approved units | — | Only after all idles are approved |
| 5 | Projectiles, FX, pickups | 30 | Needs a non-character generator |
| 6 | Props, structures | 24 | Needs a non-character generator |
| 7 | Item and weapon icons | 172 | **Blocked on shop-UI DOM wiring** |
| 8 | UI chrome | 8 | Last |

**Idles across the whole roster before any animation.** Animation multiplies
both cost and texture footprint by `frames`, and an animated sprite whose base
look gets rejected is wasted twice over.

Batch 7 does not start until an item icon can render in a shop card. Item icons
live in DOM shop cards, not on the canvas, so `drawSprite` never reaches them —
that wiring is a separate change. Generating 172 icons you cannot see in place
means finding sizing and contrast problems 172 assets deep.

---

## 6. Review gate — between every batch

Two artefacts, then stop for approval.

**Contact sheet** — `node tools/gen_contact_sheet.mjs [namespace…]` writes
`tools/contact_sheet.html`. Generated, never hand-written. Every sprite at the
size it is actually drawn in play, on the arena's own background colour, over
the arena's own 64-unit floor grid, packed at fight density. The S row shows by
default with buttons to cycle all eight facings, and a **crowd** toggle that
strips labels and gaps.

1:1 is the default and the 4× zoom is opt-in, deliberately: approving art at 4×
on a white page and then discovering it is mud at 1× on a dark floor is the most
common art mistake there is. For reference, a 48-px character sheet is drawn at
about **36 css px** in play.

**In-game screenshot** — one arena, mid-fight, batch sprites live,
`?sprites=debug` on so direction indices are visible. Nothing substitutes for
this.

Approve or reject the batch **as a unit**. Rejection means adjusting the prompt
template and regenerating the batch, not patching individual sprites — per-sprite
patching produces exactly the inconsistency the anchor exists to prevent.

---

## 7. Measurement at batch 1

Batch 1 is the first time real texture cost exists. Measure it there:

- Decoded bitmap footprint across the loaded set —
  `node tools/verify_art_batch.mjs char` reports both on-disk and decoded size.
- **On iOS Safari as an installed PWA**, not on a dev machine. Decoded bitmaps
  plus canvas backing store plus eight peers' state on an older iPhone is a
  plausible tab reload, and desktop numbers will not show it. *This cannot be
  done from this environment — it needs a real device.*
- Frame time in an 8-player arena at horde density (the browser suite's existing
  perf gates already measure this at the ~200-alive crest).

Projected: ~74 KB decoded per 8×1 sheet, ~4.7 MB across 64; at 8 directions × 4
frames, ~294 KB each and ~19 MB total.

If it bites, the lever is dropping regular enemies to 4 directions.
`UNIT_DIRECTIONS` in `js/content/sprites.js` is one constant and the renderer
handles any value, so it is a manifest-level change with no code cost — which is
why the decision is deferred to here rather than made now.

---

## 8. Acceptance per batch

| # | Check | How |
|---|---|---|
| 1 | Every id in the batch resolves | `node tools/verify_art_batch.mjs <ns> --require-all` |
| 2 | Direction indices match actual facing | `?sprites=debug`, walk a unit through all eight headings |
| 3 | `?sprites=off` still renders full primitive fallback | browser suite |
| 4 | No simulation diff | `node tools/verify_art_batch.mjs --diff-base=main` |
| 5 | Grid dimensions match the manifest for every file | `node tools/verify_art_batch.mjs` |
| 6 | Contact sheet + in-game screenshot on the PR | `tools/gen_contact_sheet.mjs` |
| 7 | Push landed | `git ls-remote origin <branch>` |

`verify_art_batch.mjs` also fails on a baked matte and on any empty cell — a
blank row is how a mis-assembled grid hides.

---

## 9. Budget

**Not answerable from this environment.** Outbound HTTPS is blocked by the
network policy, so PixelLab's pricing page and API docs both return 403 before
any request reaches them.

This needs checking by hand before batch 1, not during it. The quantities to
price against:

| | count | at 8 directions | with 4 animation frames |
|---|---|---|---|
| Unit sheets | 64 | 512 direction-images | 2,048 cells |
| Non-unit assets | 234 | — | — |

---

## 10. What is already built

None of this depends on which generator is chosen; all of it is needed the
moment one exists.

| | |
|---|---|
| `tools/pngkit.mjs` | dependency-free PNG decode/encode (8-bit greyscale, truecolour, indexed, +alpha; all five filters) |
| `tools/process_sprite.mjs` | §4 in full — assemble, verify, trim/re-centre, matte check, manifest update |
| `tools/verify_art_batch.mjs` | §8 acceptance 1, 4, 5 plus matte and empty-cell detection, and coverage counts |
| `tools/gen_contact_sheet.mjs` | §6 contact sheet, generated |
| `tools/gen_prompts.mjs` | §3 prompt assembly with the anchor gate |
| `docs/silhouettes.json` | all 64 silhouette notes, hand-authored, uniqueness-checked |
| `docs/STYLE_ANCHOR.md` | §2 anchor record, currently `PENDING` |
| `assets/sprite-overrides.json` | per-sprite manifest overrides, merged by the manifest generator |

All of it is covered by gates in `tools/sim_test.mjs`, which build synthetic
sprite sheets, run them through the real tools, and assert the results.
