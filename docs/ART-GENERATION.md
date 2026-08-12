# Art generation phase

Follows `patch-sprite-pipeline` and `patch-directional-sprites`. The pipeline is
live, the manifest holds 312 ids, and units are 8-direction grids. This document
covers filling them.

Canonical technical reference is [`SPRITES.md`](SPRITES.md). Where this document
and that one disagree, `SPRITES.md` wins — it lives with the code and gets
updated by whoever changes it.

---

## 1. Generator coverage

**Status: the API is reachable; the key is not present.** That is a narrower
block than this section used to describe, and the difference matters.

Verified against the live service, not inferred:

| probe | answer |
|---|---|
| `GET api.pixellab.ai/v1/balance` | `401 Invalid API token` |
| `POST /v1/generate-image-pixflux`, via `tools/pixellab.mjs`'s own curl path | `401 Invalid API token` |
| `GET api.pixellab.ai/v1/openapi.json` | `200` |
| `www.pixellab.ai` | `403` on CONNECT — still blocked |

A 401 is the API refusing a request; a 403 on CONNECT is the gateway refusing a
host. **Transport works end to end, including the stdin-config curl path the
client actually uses.** Only the *marketing* host is blocked, which means the
pricing page cannot be read from here while the meter can: every generate and
rotate response carries `usage`, and `GET /balance` returns the account balance.

So batches 0–8 are blocked on `PIXELLAB_API_KEY` alone. It lives in the
environment (see §11), and nothing else is missing.

**The endpoint surface has not moved.** All four endpoints the client calls
still exist, and every parameter it sends is still in the live schema —
including `style_image`/`style_strength`, `image_guidance_scale`, all eight
`Direction` values and `"low top-down"`. Two deltas worth knowing:

- `/rotate` has **no `no_background`**. `gen_unit.mjs` spreads it in; the schema
  sets no `additionalProperties: false`, so it is ignored rather than rejected.
  The seven rotated facings inherit transparency from their source image, which
  is what the matte check exists to catch.
- Canvas caps are **pixflux 400, bitforge 200, rotate 200**. Enemy cells are 128
  and boss cells 64, so a region generates comfortably. The two character sheets
  that shipped at 256 (Bard, Necromancer) could *not* be regenerated at their
  own cell size through either style-referenced path.

| Asset class | ids | Covered by the four endpoints? |
|---|---|---|
| Characters, enemies, bosses, pets | **46** | Yes — pixflux/bitforge base + `/rotate` ×7 |
| Ground / environment tiles | 5 | Yes, if tiled floors are wanted |
| Projectiles, FX | 30 | **No** |
| Props, structures | 24 | **No** |
| Item and weapon icons | 199 | **No** |
| UI chrome | 8 | **No** |

The 266 non-unit ids need a second generator. That is a separate decision and
must not block the unit batches — the 46 unit sheets are both the highest-value
art in the game and the only part PixelLab is built for.

> **Count corrections, twice over.** An early draft estimated ~8 bosses and ~35
> regular enemies; a later one recorded **64** units against a roster that has
> since been replaced. The live figure is **46** directional units: 14
> characters, 25 enemies (12 base + 12 region + the siege Ward Pylon), 6 bosses
> (4 floor + 2 region) and 1 combat pet. Item icons are **199**, not 172.
>
> Fourteen of those 46 — every region enemy and both region bosses — were
> invisible to this pipeline until `patch-region-art-plumbing`: they carried no
> `spriteId`, so they were absent from the manifest, absent from
> `prompts.json`, and `gen_unit.mjs` refused them by name. See §13 rule 73.

---

## 2. Style anchor

**The anchor is the Druid** — `char.toh_druid`, installed and shipping. Pulsar
carried it under the retired arcade palette; that decision and its cost are
recorded in [`STYLE_ANCHOR.md`](STYLE_ANCHOR.md), and the id the pipeline
actually uses is the `STYLE_ANCHOR_ID` constant in `gen_prompts.mjs`.

1. Every generation references the anchor: `--style=<one facing of the anchor>`,
   and verbatim reuse of the style clause, which is pasted in mechanically.
2. **Never re-roll the anchor once a batch begins.** A changed anchor
   invalidates everything generated before it.

Consistency drift across 312 assets is the primary failure mode of this phase.
The anchor is the only defence.

> **The anchor has never been round-tripped, and the first spend must be that
> and nothing else.** Every sheet in the game arrived as a file: the Druid's
> eight facings were hand-supplied, and so were all thirteen batch-1
> characters — "nothing was regenerated, resampled or retouched". So
> `gen_unit.mjs` has produced no committed asset, and the style clause in
> `STYLE_ANCHOR.md` was *written from* the Druid by measuring him rather than
> *verified against* him. Generate one unit — 8 generations — with
> `--style=docs/art-review/druid/sources/south.png` and put it next to him
> before anything else. If the clause does not reproduce him, that is the
> cheapest possible place to find out; 56 generations into a region is the most
> expensive.
>
> Pass the **cell**, not the sheet. `--style=` base64s whatever file it is
> given, so `assets/sprites/char/toh_druid.png` hands the model a 128×1024 grid
> of eight stacked facings as its style reference.

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
  detail are secondary. All 78 are written, and the generator fails if two units
  share a description, or if a directional id has no subject at all.
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
| 0 | Style anchor round-trip — one unit from the Druid clause | 1 | **Never done.** Approve before anything else (§2) |
| 1 | Player characters + combat pets, idle | 14 | All hand-supplied and installed |
| 2 | Bosses, idle | 6 | 4 floor + 2 region |
| 3 | Regular enemies, idle | 25 | 12 base + 12 region + pylon. Direction-count decision lands here |
| 4 | Animations for approved units | — | Only after all idles are approved |
| 5 | Projectiles, FX, pickups | 30 | Needs a non-character generator |
| 6 | Props, structures | 24 | Needs a non-character generator |
| 7 | Item and weapon icons | 199 | **Blocked on shop-UI DOM wiring** |
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

**The quantity is exact; the unit price is one authenticated call away.**

`gen_unit.mjs` generates one base view and chain-rotates it seven times. That is
**8 API calls per unit**, strictly serial — the two rotation chains are awaited
in sequence, and the tool takes one sprite id per process, so parallelism across
units is the caller's to add.

| | units | calls | wall clock, serial |
|---|---|---|---|
| one unit | 1 | **8** | ~3.5–5.5 min |
| a region: 6 enemies + 1 boss | 7 | **56** | ~25–40 min |
| both built regions | 14 | 112 | ~1 hr |
| all 46 unit sheets, idle | 46 | 368 | — |
| the six unbuilt regions | 42 | 336 | — |

USD cannot be read here — `www.pixellab.ai` is still blocked — but it does not
need to be guessed. `GET /v1/balance` returns the account's balance in its own
unit, and every response carries `usage`, which `tools/pixellab.mjs` accumulates
in **both** meters (see the note on `newSpend`/`spend` there: reading only
`usage.generations` reported `0` for every run on a usd-metered account, which
is a cost instrument lying about money).

**56 is the per-round figure, not the cost.** §6 rejects a batch as a unit, so
the real budget is 56 × rounds-to-approval — and no round has ever been run
under the current anchor. See §2.

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
| `docs/silhouettes.json` | all 78 silhouette notes, hand-authored, uniqueness-checked |
| `tools/secret_gate.mjs` | §11 — no credential in the tree, the index or the ignore rules |
| `docs/STYLE_ANCHOR.md` | §2 anchor record, currently `PENDING` |
| `assets/sprite-overrides.json` | per-sprite manifest overrides, merged by the manifest generator |

All of it is covered by gates in `tools/sim_test.mjs`, which build synthetic
sprite sheets, run them through the real tools, and assert the results.

---

## 11. The key

`PIXELLAB_API_KEY` is read from the environment by `tools/pixellab.mjs` and
nowhere else. **Supply it as an environment variable on the environment record**
— the session container is ephemeral, so anything set per-session is gone with
it, and anything pasted into a conversation is in that conversation forever.

What already keeps it out of the repo, mechanically rather than by care:

- `apiKey()` reads `process.env` and there is no config file to write it to.
- It reaches curl through a **stdin config** (`-K -`), so it is never in `argv`
  and never in `ps`.
- Request bodies go to a temp dir outside the working tree, removed in a
  `finally`. Nothing logs the header.

And the two things that stop the *reflex* rather than the tool:

- `.gitignore` covers the shapes of a credentials file (`.env`, `*.key`,
  `*.pem`, `secrets.json`), because the failure mode is a key pasted into a
  scratch file and swept up by `git add -A` — exactly how the browser suite's
  sprite fixtures got committed twice.
- `tools/secret_gate.mjs` covers what `.gitignore` cannot: **files that are
  already tracked**, where an ignore rule has no effect. It asserts the key's
  literal bytes appear in no tracked file and no staged change, that no tracked
  file assigns a value to a credential-shaped name (documented placeholders like
  `export PIXELLAB_API_KEY=...` pass, values do not), and that the `.gitignore`
  block is still there. `--history` scans every commit; it is clean.

**A gate cannot un-commit a secret.** It runs at the last point where prevention
is possible — the tree and the index. Once a key is pushed, rotation is the only
fix, and a key that has appeared in a conversation should be treated as pushed.
