# UNDERVAULT

A co-op dungeon-crawl arena roguelite for 1–4 players, in the browser, with no
server to run. Pick one of **32 characters**, descend through a 4-floor dungeon
of connected single-screen rooms (Binding-of-Isaac layout), clear enemy waves
with **auto-attacking weapons** (Brotato-style stat stacking — every mechanic
and name here is original), bank level-ups, shop and reroll, beat each floor's
boss, and destroy **The Vault Regent** on floor 4. If the whole party goes
down, the run is over.

Everything is plain JavaScript (ES modules) + Canvas 2D + WebAudio. All art is
drawn with canvas primitives and all sound is synthesized — there are no asset
files. The only external dependency is the PeerJS client, loaded from a CDN
`<script>` tag, used for the peer-to-peer co-op networking.

- **Content**: 32 characters · 136 items · 26 weapons across 6 classes ·
  12 enemy types · 4 two-phase bosses · elites with 4 modifiers · spike & lava
  hazard rooms · shop / treasure / elite / boss rooms on every floor.
- **Co-op**: host-authoritative P2P via PeerJS room codes. The host runs the
  whole simulation; clients send inputs (~30/s) and interpolate snapshots
  (~15/s) with local prediction for their own character. Downed friends are
  revived by standing next to them for 3 s; room clears auto-revive at 50% HP.

## The stat sheet (the Great Rebalance)

Ten stats, and any of them can be a damage stat:

1. **Vitality** — hit points. Base 80. Gaining Vitality also grants the
   difference as current HP.
2. **Ferocity** — the universal damage %:
   `hit = weapon base × tier mult × (1 + Ferocity/100) × (1 + scaling-tag bonus/100)`.
3. **Tempo** — one stat for all speed: attack cooldown
   `= base / max(0.25, 1 + Tempo/100)`, move speed `= 300 × (1 + Tempo/100)`
   (floor 60).
4. **Grit** — mitigation `raw × 15/(15 + Grit)` (negative capped at +50%
   extra damage) plus knockback/pull resistance by the same ratio.
5. **Reflex** — dodge chance, cap 60 (traits can change it). Every on-dodge
   effect keys off this.
6. **Recovery** — amplifies **all** healing received. Healing has two layers:
   **sources** (regen items, lifesteal, kill-heals, room-clear breathers,
   between-floor heals — they live on items and traits) and Recovery, which
   multiplies every source by `(1 + Recovery/100)`.
7. **Ingenuity** — summon/structure damage and HP `×(1 + 0.1 × Ingenuity)`.
8. **Attunement** — every elemental/status effect (burn DPS, chill strength
   *and* duration, chain lightning, novas, blasts, echoes) scales
   `×(1 + Attunement/100)`.
9. **Greed** — fortune unified: rarity weights for uncommon+ are
   `×(1 + Greed/100)` everywhere rarity is rolled, and every room clear pays
   `floor(Greed / 2)` bonus materials. No self-growth.
10. **Reach** — weapon reach (ranged/lobbed +100% of Reach, melee +30%,
    floor 40) and pickup radius `60 + Reach × 0.5`.

**Crit is not a stat.** Critical hits exist only as granted effects — traits
and items that say "this attack crits" — at ×2 damage (Duskblade's are ×3 and
never random). Six-plus items grant crits under conditions (after a kill, every
Nth attack, vs chilled/burning/full-HP targets, first hit of a room).

**Weapon scaling**: every weapon lists one or two scaling stats in its tooltip.
Percent stats contribute their percentage directly; flat stats convert via
`SCALING_RATES` in `js/config.js` (1% damage per 4 Vitality; per 1 Grit,
Ingenuity or Greed; per 12 Reach). Weapon class (melee/ranged/lobbed/summon)
remains only as a tag for conditions and traits.

## Run it locally

ES modules do **not** load from `file://` — you must serve the folder:

```
cd this-folder
python3 -m http.server 8000
```

then open **http://localhost:8000/** in a modern browser (Chrome/Edge/Firefox).
That's it — no build step, no npm install.

## Deploy it free

- **Netlify Drop**: go to https://app.netlify.com/drop and drag this folder
  onto the page. You get a public URL immediately.
- **itch.io**: zip the folder (index.html must be at the zip root), create a
  new project, set *Kind of project* to **HTML**, upload the zip, and tick
  *"This file will be played in the browser"*.

## How friends join

1. Host opens the game URL, clicks **HOST GAME**, and gets a 5-letter room code.
2. Friends open the **same URL**, type the code, and click **JOIN**.
3. Everyone picks a character, readies up, and the host presses **START RUN**.

Send them both the URL *and* the code. Lobby-only joining — no mid-run joins.
Hosting alone is simply a solo run (works fully offline from the PeerJS cloud too).

If the free PeerJS cloud is ever down or blocked on your network, you can point
the game at your own signaling server with URL parameters:
`?peerhost=yourhost&peerport=9000&peersecure=0` (works with the standard
`peerjs-server`, or with the tiny dependency-free relay in
`tools/peer_relay.mjs`). Only signaling goes through that server — game traffic
is direct browser-to-browser WebRTC.

## Controls

- **WASD / arrow keys** — move (weapons attack the nearest enemy on their own; no aiming)
- **E** — open the shop while standing in a cleared shop room / at the
  post-boss hatch; as the **Cogsmith**, pick up the nearest turret / redeploy
  the one you're carrying (short channel)
- **C** (or the ☰ HUD button) — character sheet: all ten stats (base shown
  where it differs), weapons with their scaling stats, and items, live. In solo
  it pauses the game; in co-op it never pauses and only ever covers your own
  screen.
- **What does a stat do?** Every stat name you see with a dotted underline —
  in the sheet, in shop and item tooltips, on the character-select grid — is
  the same glossary affordance: hover it on desktop for a plain-language
  explanation, tap it on touch. Sheet rows expand their explanation inline on
  tap. Level-up and boon cards always print the stat's one-line summary right
  on the card, no interaction needed.
- **Mouse** — menus, shop, level-up choices, Facet's boon picker
- **In the shop**: your weapons and items are listed under the stock. Own two
  identical same-tier weapons? Tap one, then tap its highlighted match to
  **combine** them into the next tier for free (frees a slot). Anything you own
  can be **sold for 30%** of its shop price (the Quartermaster instead recovers
  exactly the materials invested) — tap Sell once to arm, again to confirm;
  tapping elsewhere cancels.
- Stand in a doorway of a cleared room to start the 3-second **group** door
  countdown; stand on the hatch after a boss to descend.
- **Trait visuals**: characters with meters (Onrush, Resonant, Stillness,
  Jester) show a charge ring around their body and a bar under their HP;
  Banneret's aura, Lodestone's tether and Mirage's decoys render on every
  player's screen.
- The ⚙ button (bottom right) has SFX volume and a screen-shake toggle; it
  never pauses the simulation.
- The ↰ button (next to ⚙, in-run only) leaves the run after a confirmation:
  the host/solo player ends the run for the whole party and everyone returns
  to the lobby together for a fresh run; a non-host player leaves alone and
  returns to the title screen.

### On phones (touch)

- **Floating joystick**: touch anywhere on the playfield and drag — the
  joystick anchors where you touch; release to stop. That's the only combat
  input needed (weapons auto-aim).
- Everything else is tap: menus, character grid, shop, level-ups, Facet's boon
  strip, the ↰ leave button, and the ⚙ settings gear. All targets meet the
  44 px touch standard.
- A gold **OPEN SHOP** button appears when the E key would do something
  (re-opening the shop, or always for the Cogsmith's turret carrying).
- The game plays **landscape only** — portrait shows a rotate prompt.
- Touch controls switch on automatically on touch devices; force them with
  **⚙ → Touch controls: Auto / On / Off** (handy for touch-screen laptops).

## Debug keys

Enabled by the `DEV` flag in `js/config.js` (shipped `true`; set `false` for
clean play). They act on the **host's** simulation:

- **F1** — spawn 50 enemies (stress test)
- **F2** — +200 materials for every player
- **F3** — kill everything and clear the room
- **F4** — skip to the next floor
- **F5** — god mode toggle
- **F6** — show hitboxes + FPS/entity counter

Console helper: `uvSmoke()` runs every character through a scripted combat and
reports failures (used for the automated character smoke check).

## Dev tools (not needed to play)

`tools/` contains the test harnesses used during development — the game itself
never loads them:

- `node tools/sim_test.mjs` — headless full-game test suite: content counts
  (32/≥100/26), the dead-stat gate (every stat on ≥2 weapons, ≥5 items,
  ≥1 statline), all 32 characters clearing floor 1 solo, full-run victories
  for the six gate characters, the floor-1 DPS gate (±40% of the roster
  median, table printed), 4-player co-op + wipe, build management, rebalance
  mechanic assertions, 250-enemy stress timing, snapshot serialization.
- `node tools/browser_test.mjs [--coop]` — boots real headless Chromium over
  the DevTools protocol: title → lobby → run → results with zero console
  errors, trait meters and the boon picker in real DOM, mobile emulation with
  dispatched touch events, plus the two-browser co-op checklist (Banneret aura
  and Lodestone tether across the network, Facet boon isolation, Cogsmith
  turret carry/redeploy sync) against a local relay.
- `node tools/balance_probe.mjs <charId>` — a kiting bot plays real combat to
  flag balance disasters.
- `node tools/validate_items.mjs js/content/items.js` — item catalog contract
  validator (hook schemas, price bands, category minimums, stat coverage).
- `node tools/gen_design_audit.mjs` — regenerates `docs/design-audit.md` from
  the live content data and enforces the dead-stat gate.
- `node tools/peer_relay.mjs [port]` — minimal PeerServer-compatible signaling
  relay (zero dependencies).

## Decisions (where the brief was silent or conflicted)

### The Great Rebalance (patch 5)

- **Crit resolution happens at fire time with the target known**, which is what
  makes "crits vs chilled/burning/full-HP" items implementable. Duskblade's
  "first hit against a full-HP enemy crits" is implemented as "any hit against
  a full-HP enemy crits" — identical by definition (an enemy that's been hit
  is no longer at full HP), with no per-enemy bookkeeping.
- **Jester's ramp** became trait-internal odds: +5% per non-crit attack,
  cap 60%, reset to zero the moment a crit lands (shown on the HUD meter).
- **Stillness (Overwatch)** charges after 1.5 s of *holding fire beyond the
  weapon's own cooldown*. The spec's flat 1.5 s idle window would auto-charge
  every shot of any weapon slower than 1.5 s (Longbarrel is 1.9 s), doubling
  its DPS for free; measured at +100% of the roster median, tuned to the
  hold-fire rule and re-measured at +7%.
- **Resonant's charge ring** was raised from 6 to 9 hits (the 200% attuned
  shockwave hitting a whole crowd measured +65% over the roster median at 6).
- **Cogsmith starts with one Bolt Turret** (not two): with turrets inheriting
  100% of pilot stats on top of Ingenuity, two mounts measured +80% over the
  roster median. Four mounts remain to grow into; the Overseer's shop rolls
  weapons at 50% (vs 30%) and only from the summon rack, and only summon
  weapons can be bought.
- **Summon damage does not additionally apply the weapon scaling-tag bonus** —
  Ingenuity's ×(1+0.1×I) is the summon damage rule, and stacking the 1%/point
  scaling tag on top would double-dip. The Overseer's 100%-inheritance is:
  Ferocity multiplies turret damage, Tempo divides turret cooldown, Reach adds
  turret range, and statuses (Ember Turret burns) already ride Attunement.
- **DPS-gate tuning log** (all changes re-measured): Pebbleshot 8 dmg/0.70 s →
  10/0.65 (Broker was −48%); Coilgun 18 → 21 (Threader −40%); Kegbomb 24 → 20
  (Powderkeg +60%); Hailburst 4 dmg/0.90 s → 3/0.95 (Glasswing +62%);
  Sparkbolt chain factor 0.55 → 0.5 and Voltaic's Attunement 20 → 12
  (Voltaic +52%, Attunement double-dips its scaling tag and its chains).
- **Floor-1 baseline DPS table** (dummy-target harness: god-mode player pinned
  at room center, four immobile high-HP dummies at 90 u; 20 s; median 22.5;
  gate ±40%): bulwark 18.9 (−16%), cogsmith 20.3 (−10%), zephyr 21.6 (−4%),
  tollkeeper 14.7 (−35%), duskblade 18.6 (−17%), rampart 15.8 (−30%), onrush
  27.0 (+20%), vesper 15.8 (−30%), broker 15.5 (−31%), resonant 26.6 (+18%),
  facet 25.6 (+14%), stillness 24.0 (+7%), powderkeg 30.0 (+33%),
  quartermaster 27.0 (+20%), mirage 15.3 (−32%), banneret 23.4 (+4%), sawbones
  19.3 (−14%), lodestone 20.4 (−10%), voltaic 27.3 (+21%), wisp 27.3 (+21%),
  gilded_one 13.9 (−38%), redmaw 16.0 (−29%), glasswing 24.0 (+7%), twinsoul
  26.4 (+17%), hemomancer 22.5 (0%), jester 31.1 (+38%), cindermage 22.5 (0%),
  frostcaller 23.4 (+4%), longshot 22.0 (−2%), threader 15.8 (−30%), tinker
  19.8 (−12%), hivewright 28.8 (+28%). Economy/support characters sit low by
  design; nothing breaches the gate.
- **Healing model details**: every heal source is multiplied by Recovery, with
  a fractional accumulator so small amplified heals aren't lost to rounding.
  Overheal routing (Hemomancer shield, Vesper's permanent Vitality with its
  +3/room cap, Sawbones' ally drip) resolves before Soulbond's 25% heal share,
  and the share applies whether or not the heal overflowed.
- **Soulbond mechanics**: the 30% damage share transfers *post-mitigation*
  damage directly to the partner (no second dodge/Grit roll) and *can* down
  them; solo, the bond attaches to the strongest summon, which soaks shares
  and can die from them; with no summon the trait is dormant (the sheet says
  so). The joint-hit echo is 50% of the triggering hit, attuned, with a 0.5 s
  per-enemy cooldown; summon hits stamp the enemy separately from player hits
  so solo bonding works.
- **Bulwark's contact damage** (3 + 25% Grit + 5% Vitality) ticks on its own
  per-enemy cooldown and fires even during the player's post-hit i-frames —
  standing in a crowd is the trait.
- **Mirage's decoys** are engine-level taunt targets: enemy targeting goes
  through `tauntTarget()`, which prefers a decoy within its 180 u taunt radius
  over real players (bosses included). Decoys last 2 s, then burst attuned.
- **Banneret's aura** recomputes on the periodic 0.25 s stat pass (aura power
  `≈ (1 + Vitality/1000)`, self at half effect); crossing the aura edge
  registers within a quarter second, which reads as instant.
- **Facet's boons** roll quality through the same Greed-biased rarity function
  as everything else, at 1.5× the level-up boost magnitude (they're
  room-length). The third pick of the same boon makes it permanent at its
  boon value; picking an already-permanent boon stacks its temp bonus again
  for that room. Boon offers are per-player, non-blocking, and expire at the
  door.
- **Toll Road** (Tollkeeper) is unchanged in shape: double material drops,
  +25% enemy HP, party-wide.
- **Quartermaster's invested-materials lineage**: starting weapons count their
  base shop price as invested; buying records the price actually paid
  (discounts included); combining sums both sides; selling refunds exactly the
  invested total. Everyone else keeps the 30% floor-scaled refund.
- **Greed's room-clear tithe** replaces Harvesting entirely — no self-growth
  anywhere in the economy now; interest items survive as the "banker" fork.
- **The Archivist fold**: its extra level-up choice is the *Archivist's Folio*
  (uncommon Greed item, `+1 level-up choice`).
- **Level-up boost pool** rebuilt as small/medium/large per stat (30 entries,
  rarity-weighted exactly as before).
- **Carried-character translations**: Wisp keeps the 90 Reflex cap, gains +1%
  Ferocity per 1% Reflex, Vitality capped at 30 (was a 20 HP cap). Hemomancer's
  Life Steal became an innate 10% lifesteal *source* plus the overheal shield.
  Redmaw's missing-HP bonus now feeds Ferocity. Glasswing/Twinsoul/Voltaic/
  Cindermage/Frostcaller/Longshot/Threader/Tinker/Hivewright/Gilded One map
  speed→Tempo, dodge→Reflex, elemental→Attunement, engineering→Ingenuity,
  luck/harvesting→Greed with no trait change.
- **Rare+ stat-only items no longer require a negative tradeoff** (old
  validator rule dropped): the ten-stat sheet has fewer, broader stats, so
  big clean packages at rare/legendary prices are the point.
- **Build-fork → item mapping** (every roster fork has fuel): Bulwark
  contact-tank → Cinder Cloak / Thorncoat / Bulette Plating; summons
  (Cogsmith/Tinker/Hivewright/Twinsoul) → Foreman's Manual / Overclock
  Governor / Architect's Omnitool; dodge (Zephyr/Mirage/Wisp/Glasswing) →
  Matador's Cape / Duelist's Veil / Skirmish Garb; crit (Duskblade/Jester) →
  the six-plus crit granters + Red Ribbon Salve; economy (Tollkeeper/Broker/
  Gilded One) → Doublestrike Ledger / Coin of Return / Haggler's Tongue /
  Vault Compass; pickup procs (Powderkeg) → Sparkdust Pouch / Detonation
  Tithe / Greedwind Charm / Loose Change / Magpie's Eye; sustain
  (Vesper/Hemomancer/Redmaw) → Gravedigger's Pact / Butcher's Bill / Saint's
  Reliquary / Leech Locket; party (Banneret/Sawbones/Lodestone) → the aura
  items / Medic's Satchel / Lodemother's Chime / Banner of the Last Stand;
  status (Resonant/Voltaic/Cindermage/Frostcaller) → the status spreaders +
  Tempest Codex; reach (Stillness/Longshot/Threader) → Longwatch Lens /
  Horizon Glass / Surveyor's Array; momentum (Onrush) → Slaughter Rhythm /
  Greedwind Charm / Chronomancer's Gear. Quartermaster can't buy items by
  design — his fork is fed by weapon scaling stats instead.

### Stat glossary (patch 6)

- **One source of truth**: `js/content/glossary.js` holds a short line
  (≤12 words) and a 1–2 sentence plain-language detail for each of the ten
  stats; every surface (sheet, level-up and boon cards, character select,
  weapon/item tooltips) renders from it, so wording can never drift. The sim
  suite asserts completeness and that every stat name the UI can render
  resolves to an entry.
- **No formulas in glossary text** — exact numbers stay on the character sheet
  and in the README. The details name what *kinds* of things scale with a stat
  instead.
- **One interaction mechanism**: a dotted underline marks every explained stat
  name. The tap handler runs in the browser's capture phase, so a stat name
  inside a clickable card (shop offer, treasure pick, character card) opens
  the glossary *instead of* buying/picking — tapping the term never spends
  materials or selects a character. Hover works on desktop only; the touch UI
  is tap-driven throughout.
- **Sheet rows expand inline** (mobile-first, works on desktop too) rather
  than using the popover, per the brief; expansion state survives the sheet's
  live re-renders in co-op. Rows are ≥44px on touch via padding, and stat-name
  hit areas get an invisible padding boost on touch devices.
- **Boon cards got the short line too** — the brief named level-up cards, but
  Facet's boon picks are the same decision moment.
- **Level-up sentence marks**: the spec's own Greed example ("Fortune. …") is
  three sentence marks, so the completeness check allows a one-word label plus
  two sentences.

### Original build

- **Seeded vs. live randomness**: dungeon layout, room spawn composition, shop
  stock, level-up offers, boon offers and treasure picks all derive
  deterministically from the run seed (shown on the results screen).
  Moment-to-moment combat rolls (granted-crit conditions, dodge, proc chances)
  use live randomness — the host is the single authority, so determinism there
  buys nothing and costs feel.
- **Offline-first hosting**: the lobby opens instantly; PeerJS registration
  happens in the background. If the cloud is unreachable the lobby says
  OFFLINE and solo play works fully — a network hiccup never blocks the game.
- **Manual revives also restore 50% HP** (same as the room-clear auto-revive)
  to keep one simple rule.
- **Between floors** players heal half of their missing HP; at each room clear
  everyone recovers 10% of missing HP (both are healing *sources*, so Recovery
  amplifies them). Pure attrition across ~48 rooms was unrecoverable without
  mandatory sustain builds.
- **Elite rooms** give every player a free choice of 1 from 3 rare-or-better
  items (mirrors the treasure room flow, at higher rarity), and spawn half the
  normal quota of basic enemies alongside the elites so the fight stays about
  the champions.
- **Bosses shrug off half of any slow** (chills work at 50% potency on them,
  after Attunement), and killing a boss sweeps its leftover adds/projectiles
  so the post-boss shop is safe and a floor-4 victory can't be stolen by a
  stray add.
- **If the host closes after the run ends**, clients keep their results screen
  instead of being bounced to "Host disconnected".
- **Abandoning a run** (↰ button) skips the results screen and drops the whole
  party straight into the lobby with connections and room code intact.
  Everyone's previous character stays pre-selected but ready states reset, so
  each player confirms before the next run; the post-abandon lobby also
  accepts brand-new joiners on the same code.
- **Hazards hurt players only** — enemies walking through lava tickled the
  balance in unreadable ways.
- **Chain lightning damage** (traits/weapons) is a factor of the actual hit
  that triggered it, so it scales with your whole build — and with Attunement.
- **Boss flow**: the post-boss shop opens automatically for everyone (and can
  be reopened with E at the hatch); the floor-4 boss ends the run in victory a
  beat after it dies.
- **Turret placement**: structures teleport to their owner on every room
  transition and are rebuilt free if destroyed (destroyed structures respawn
  next room). Enemies damage structures by contact only. A carried Overseer
  turret rides on the pilot's shoulder, inert, until redeployed.
- **Settings never pause** — even solo. One rule, no edge cases; a solo player
  can stand in a cleared room in perfect safety anyway.
- **No duplicate-character lock** in the lobby: two players may pick the same
  character (marked with a ✔ so you know).
- **Debug keys ship enabled** (`DEV = true`) because this is a jam build meant
  to be poked at; flip to `false` for real runs.
- **Build management**: combining is always the player's explicit call — buying
  a duplicate keeps both copies (holding a pair vs. merging for a free slot is
  a real decision). Sell refunds use the undiscounted floor-scaled shop price
  (personal shop discounts neither inflate nor deflate refunds). Selling an
  item removes its stats and mechanical hooks instantly; permanent gains it
  already banked stay — history isn't rewritten. Selling one of a stacked item
  sells exactly one copy. Selling or combining turret weapons removes/merges
  their deployed structures via per-weapon instance ids.
- **Touch details**: only pointers of type `touch` anchor the joystick, so a
  mouse never moves the player by dragging even when touch controls are forced
  On. The joystick floats (anchored wherever you touch) rather than being
  fixed, so it never permanently covers HUD elements. The E action became a
  contextual on-screen button instead of auto-triggering. Canvas resolution is
  capped at 2× devicePixelRatio — 3× phone panels cost fill-rate with no
  visible gain on a flat-shape art style.

## Known limitations

- **Signaling depends on the free PeerJS cloud** (`0.peerjs.com`). If it's
  down or blocked, hosting falls back to offline solo; co-op needs the
  self-host escape hatch described above. Strict corporate NATs without STUN
  success can also fail to connect (no TURN relay is configured).
- **No host migration / reconnection** (per the brief): if the host leaves,
  the run ends for everyone; a disconnected client can't rejoin mid-run.
- **Client-side hit feel**: remote players see enemies ~120 ms in the past
  (interpolation buffer). Your own movement is predicted and instant.
- **Aura/conditional-stat cadence**: Banneret's aura, conditional items and
  Lodestone's bond target re-evaluate on the periodic 0.25 s stat pass, so
  crossing an aura edge or swapping bond targets can lag by up to a quarter
  second. Invisible in play; measurable in a frame-by-frame test.
- **Point-blank projectiles**: a ranged shot fired at an enemy standing
  *exactly* on the player's center spawns just past it and can whiff. Only
  reproducible with a pinned player in a harness — in real play enemies sit at
  contact range and the player moves.
- **Balance is jam-grade**: probed by bots, a DPS harness and scripted runs,
  not hundreds of human hours. The ±40%-of-median DPS gate holds at floor-1
  baseline; full-run scaling (especially Greed economies and Overseer turret
  stacking) will drift with real play.
- **Keyboard + mouse, or touch** — gamepad is still unsupported. Touch support
  was verified with Chromium's mobile emulation (Pixel-class viewport, real
  dispatched touch events); real devices — **especially iOS Safari** — can
  surface quirks emulation can't catch (audio unlock timing, safe-area insets,
  browser-chrome resizes, 120 Hz scheduling), so treat phone support as
  well-tested-in-emulation rather than device-certified.
- The pause-free design means a solo player browsing the shop in a *shop room*
  is safe, but reading tooltips mid-combat is at your own risk — as intended.
- **Facet's boon strip on very short screens** sits above the bottom edge and
  can briefly overlap the joystick's comfortable zone; it's tap-through
  outside the panel and disappears on pick.
