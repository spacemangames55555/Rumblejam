# UNDERVAULT

A co-op dungeon-crawl arena roguelite for 1–8 players, in the browser, with no
server to run. Pick one of **33 characters** and descend through a 4-floor
Gauntlet: each floor is a **branching node map** (a decision screen, not
corridors) of big scrolling battle arenas, and every floor ends in a
**Siege** — a continuous, mutating last stand capped by the floor boss. Clear
fights with **auto-attacking weapons** (Brotato-style stat stacking — every
mechanic and name here is original), bank level-ups, shop and reroll, and
destroy **The Vault Regent** on floor 4. If the whole party goes down, the run
is over.

Everything is plain JavaScript (ES modules) + Canvas 2D + WebAudio. All art is
drawn with canvas primitives and nearly all sound is synthesized; the only
asset files are the owner-added samples in `assets/` (currently one: the
level-up airhorn), loaded through a tiny decode-and-cache pipeline that falls
back to synthesis if a file is missing. The only external dependency is the
PeerJS client, loaded from a CDN `<script>` tag, used for the peer-to-peer
co-op networking.

- **Content**: 33 characters · 146 items (10 of them cursed) · 26 weapons across 6 classes ·
  12 enemy types · 4 two-phase bosses · elites with 4 modifiers · 5 arena
  templates with spike & lava hazards · 4 bespoke siege arenas · Trader /
  Reliquary stops and eight objective level types on every floor's map.
- **Co-op**: host-authoritative P2P via PeerJS room codes, up to **8 players**.
  The host runs the whole simulation; clients send inputs (~30/s) and
  interpolate binary-packed snapshots (15/s, 12/s at 6+ players) with local
  prediction for their own character. Every client's camera follows its
  **own** character. Downed friends are revived by standing next to them for
  3 s; fight clears auto-revive at 50% HP; during a Siege, every mutation
  revives the fallen at 25% (the mercy rule). Difficulty scales linearly to
  4 players and along a softened curve to 8 (see Decisions); 5+ parties
  fight in ~25% larger arenas.

## The run: node map → arenas → the Siege

- **The node map is the between-fights home screen.** Each floor generates
  8–10 nodes in 4–5 columns with 2–3 choices per step, all paths converging on
  the Siege. Every floor guarantees at least one Trader (shop), one Reliquary
  (treasure: pick 1 of 3), and one Champion (elite) node that is always
  avoidable via another path. Fights get big and long; navigation is one tap.
- **Choosing a path is a consent countdown**: any player taps a node and a 4 s
  timer starts; a *different* player may redirect it to another node exactly
  once, then the choice locks. Solo travels instantly. Extraction works the
  same way — after a fight clears, a portal opens; standing on it runs the
  same 4 s countdown.
- **Arenas scroll.** Five templates (Long Hall, Pillared Field, Cramped Crypt,
  Open Expanse, Broken Ground) from 2400×1600 up to 3200×2000, with obstacle
  architecture and hazard pockets. The camera follows your own character with
  velocity lookahead; edge arrows point to off-screen allies (always),
  elites, bosses, the ward pylon, the extraction portal and hold circles; the
  HUD minimap is a radar of the whole arena.
- **Fights are budget curves, not door-locked waves**: spawning ramps for
  60–90 s (rate grows with floor and map depth), then stops — survivors rush
  you to contact — and the fight ends when the field is empty. Level-ups
  **bank** during the fight and resolve at the clear.
- **Money doesn't wait.** Materials must be walked over *during* the fight —
  there is no end-of-fight vacuum. Whatever is still on the ground when the
  last enemy dies fizzles where it sat, and the clear banner reports both
  numbers (`◆ N collected · M lost`). The **enemy counter** at the top of the
  HUD is the sweep signal: it reads *incoming* while the spawn budget is
  still flowing, then flips to the exact live count the moment spawning
  stops — when that number is small, leave the stragglers and run for the
  money. Sieges get an **8-second looting window** after the boss falls
  (a visible countdown) before the spoils fizzle and the descent opens.
- **Every fight rolls a pressure profile** (see the next section). Roughly
  one combat node in four rolls **Bastion** — marked with a ⛊ shield on the
  node map — where holding your ground is the sanctioned play.
- **Every extraction is a shop.** Clearing a Combat or Champion node opens
  each player's own 4-slot shop right at the portal (reroll, lock, browse at
  your own pace — even after the countdown travels the party). Standard
  shops always stock at least 1 weapon (2 on floor 1). Trader nodes are the
  **Black Market**: 6 slots, rerolls −25%, at least 2 weapons and 1
  rare-or-better item — a destination, not the only shop.
- **The Siege** ends every floor: 2.5–4 minutes of continuous spawning in a
  bespoke handcrafted arena, punctuated by 2–3 scripted **mutations** ~45–60 s
  apart — walls collapse, a lava field migrates across the floor, a ward
  pylon buffs every enemy until it's destroyed, a hold-circle chokes spawning
  while the party stands its ground. Each mutation revives downed players at
  25% (there is no fight-clear revive until the siege ends). After the final
  mutation the **floor boss** enters with reduced add spawns (tapering to
  silence, so a siege is never an unwinnable inflow race). Boss down → full
  payout, post-boss shop, and the descent portal.

## Objective levels: twelve fights, eight of them not a horde

Every floor's map holds **12 combat nodes** (shops, reliquaries and the Siege
are extra). Most of them are no longer "kill what spawns" — each objective
level has its own win condition, its own icon on the node map, and a live
objective bar on screen showing exactly what it wants.

| | level | what clears it |
|---|---|---|
| ◎ | **Zone Control** | A capture zone (10–25% of the arena) fills only while someone stands in it — ~20 s of *occupied* time, paused (never reset) when it empties. Capture it and it moves. Six captures. Spawns never stop and there's no timer, so it's a farm — with a leash: after 150 kills in one zone segment, kills stop paying until the next zone. |
| ☠ | **Elite Arena** | A handful of enormous, slow monsters — Chargers, Lobbers, Splitters and Enragers (which pick up speed the longer they live). Kill them all. Pure kiting. |
| ⁂ | **Nest Purge** | 6–8 destructible spawners feed the room; every one you destroy throttles the global inflow. Destroy them all. |
| ✦ | **Bounty Hunt** | Five marked champions, one at a time, each with an escort pack and a ping on your screen. Killing one marks the next. |
| ⇥ | **Breach** | An elongated corridor cut into 3–4 segments by sealed doors, with a lethal collapse crawling in from the entry the whole time. Each door opens on a kill quota inside the current segment (scaling with party size and floor), so you fight forward under pressure rather than racing. Past the last segment, reach the gate. |
| ⚱ | **Relic Run** | Relics scattered around the map; carrying one costs 20% move speed and pulls aggro onto you; drop it if you go down. Bank five at the central altar. |
| ❄ | **Storm Survival** | A safe circle shrinks over ~20 s, then relocates at full size. Outside it you burn 5% of max HP per second. Survive 90 s. |
| ⛏ | **Payload** | The extraction gate starts sealed. A drill crawls a fixed lane toward it, but only while someone is inside its escort radius. Enemies stall it (they can't destroy it) and it patches itself up while you're close. |

**Every floor gets**: 1 Nest Purge, 1 Bounty Hunt, 1 Breach, 1–2 Zone
Control, 1–2 Elite Arena, plus **Relic Run + Storm Survival on odd floors**
and **Payload on even floors**. Whatever's left is a standard horde arena —
and the generator guarantees **4–6 of those** on every floor, dropping a
duplicate Zone/Elite node if a roll would leave fewer. The floor's **entry
column is always plain arenas**, so a run never opens on a 90-second
survival with a starting kit.

A floor is a much bigger commitment than it used to be: 12 combat nodes
instead of 7, and the objective levels run 30 s (Breach) to 125 s (Zone
Control). Expect a floor to take two to three times as long as it did.

## Pressure profiles: standing still is a choice

Every Combat and Champion node rolls a **pressure profile** at map
generation — a recipe for *how* the fight applies force, so camping in a
corner stops being the default optimum without any single fight maxing every
lever. The levers:

- **Ring spawning** (all non-Bastion profiles): the swarm assembles around
  the players' *current* positions, just off-screen, biased toward backs and
  flanks — running away is running into the next spawn arc. In co-op the
  per-player rings merge: no spawn ever lands on anyone's screen.
- **Mortars**: some Lobbers arrive as artillery — a telegraphed ground
  circle at your current position, a beat of delay, then the impact. Stand
  still and every shell is a direct hit; drift and they always land where
  you were.
- **Death puddles**: profile-flagged chaff leaves an acid puddle where it
  dies (capped at 14 on the field; the oldest fade first), so melee-mulching
  a swarm *in place* carpets your ground.
- **Flankers as wave citizens**: Dashers and Orbiters — enemies that attack
  from angles auto-aim doesn't cover — appear in regular waves, not just as
  elites.
- **Wave-end rushers overshoot**: when spawning ends, survivors dash
  *through* your position and past it, turning the mop-up into crossing
  traffic instead of a queue walking into your muzzle.

The named profiles blend these: **Artillery** (mortar-heavy), **Flanker**,
**Puddle**, **Swarm** (higher spawn rate, lighter levers), **Mixed** (a bit
of everything), and the floor's Siege always runs high-friction. Each
floor's deck is shuffled so all of them show up across a run.

**Bastion (~1 combat node in 4, ⛊ on the map)** is the sanctioned camp: a
single melee-only stream from one arena edge, no artillery, no puddle
chaff, few flankers, at a rate a hold-your-ground build can grind down.
Fortress characters get their fantasy — on the fights marked for it.

**Line of sight is real, for everyone.** Walls absorb straight projectiles —
yours, enemies', turrets' — and block melee swings, chain-lightning hops and
blast damage symmetrically. Auto-aim and turrets target the nearest *visible*
enemy, so a pillar is genuine cover both ways. Lobbed weapons and mortar
shells arc **over** walls (that's their niche), and enemy gunners drift
sideways for an angle rather than plinking masonry forever.

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
   **sources** (regen items, lifesteal, kill-heals, fight-clear breathers,
   between-floor heals — they live on items and traits) and Recovery, which
   multiplies every source by `(1 + Recovery/100)`.
7. **Ingenuity** — summon/structure damage and HP `×(1 + 0.1 × Ingenuity)`.
8. **Attunement** — every elemental/status effect (burn DPS, chill strength
   *and* duration, chain lightning, novas, blasts, echoes) scales
   `×(1 + Attunement/100)`.
9. **Greed** — fortune unified: rarity weights for uncommon+ are
   `×(1 + Greed/100)` everywhere rarity is rolled, and every fight cleared
   pays `floor(Greed / 2)` bonus materials. No self-growth.
10. **Reach** — weapon reach (ranged/lobbed +100% of Reach, melee +30%,
    floor 40) and pickup radius `60 + Reach × 0.5`.

**Crit is not a stat.** Critical hits exist only as granted effects — traits
and items that say "this attack crits" — at ×2 damage (Duskblade's are ×3 and
never random). Six-plus items grant crits under conditions (after a kill, every
Nth attack, vs chilled/burning/full-HP targets, first hit of a fight).

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
Rooms hold up to **8 players** (the Warband).

### Hosting a big room (5–8 players) — honest guidance

The host's machine runs the whole simulation and streams snapshots to every
peer. The Warband netcode packs those snapshots into binary buffers, skips
enemies nobody can see, and drops the stream to 12/s at 6+ players — a full
8-player siege crest measures well under **450 KB/s of host upload** — but
that still means:

- **An 8-player room wants a host on decent wifi or ethernet.** Any normal
  broadband handles it; a strong phone hotspot usually does too.
- **Hosting 7 friends from a phone on cellular is not recommended.** Upload
  on cellular is jittery even when the number looks big, and the game has no
  host migration — when the host chokes, everyone feels it.
- **What an overloaded host looks like from the other seats**: enemies and
  allies start rubber-banding or gliding in straight lines (interpolation
  starving), hit numbers arrive in bursts, the enemy counter jumps instead
  of counting down, extraction/vote countdowns stutter — and in the worst
  case peers hit the 5-second silence watchdog and get dropped back to the
  title screen one by one. If that's happening, hand hosting to the person
  with the best connection; if it happens in *every* fight regardless of
  connection, the host's CPU (old laptop, throttled tab) is the bottleneck
  instead — the host also renders the game while simulating it.

If the free PeerJS cloud is ever down or blocked on your network, you can point
the game at your own signaling server with URL parameters:
`?peerhost=yourhost&peerport=9000&peersecure=0` (works with the standard
`peerjs-server`, or with the tiny dependency-free relay in
`tools/peer_relay.mjs`). Only signaling goes through that server — game traffic
is direct browser-to-browser WebRTC.

## Controls

- **WASD / arrow keys** — move (weapons attack the nearest enemy on their own; no aiming)
- **Tap/click a map node** to choose the party's next stop (4 s consent
  countdown in co-op; one redirect allowed). A **Reopen shop** button sits on
  the map while you're parked at a Trader.
- **E** — open the post-siege shop while standing at the descent portal; as
  the **Cogsmith**, pick up the nearest turret / redeploy the one you're
  carrying (short channel)
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
- **Weapon detail cards**: tap (or hover, on desktop) an owned weapon chip
  for its full card — tier, class, numbers, each scaling stat's live
  contribution from your current build, and an **est. DPS** with your stats
  right now. Stock weapon cards show the same math as est.-DPS-if-bought, so
  offers and owned weapons compare directly; every number updates the moment
  a stat changes.
- **At full weapon slots**: buying a copy of a weapon you own (same tier,
  below IV) **combines straight into your copy** — the card shows a ⇑ badge
  with the outcome first; a tier-IV match explains why it can't be bought.
  Buying a *different* weapon opens the **make-room picker**: every owned
  weapon as a detail card with its sell refund and the net cost — pick one,
  confirm, and the sell + buy execute as a single transaction (or cancel and
  keep everything).
- **Pick up your money mid-fight** — walk over materials as you go (Reach
  widens the scoop radius). Whatever is on the ground when the last enemy
  dies is lost, and the clear banner shows the split. The top-center
  **enemy counter** tells you when to sweep: *incoming* → exact count means
  spawning has stopped. After a Siege boss falls, a **sweep! countdown**
  gives 8 seconds to loot the field before the descent opens.
- After a fight clears, stand on the **extraction portal** to run the 4-second
  countdown back to the map (anyone stepping off cancels it); the same portal
  descends to the next floor after a Siege.
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

## Adding a sound asset

Until the airhorn, every sound was WebAudio-synthesized; that constraint is
lifted for assets added deliberately to `assets/`. The pipeline is two
functions in `js/audio.js`:

1. Drop the file in `assets/` (MP3/OGG/WAV — anything `decodeAudioData`
   accepts).
2. Preload it near boot: `const buf = await loadSample('assets/yourfile.mp3')`
   — fetches, decodes into the shared (suspended-until-gesture) context, and
   caches per path. Wrap the call in a try/catch and fall back to a synth
   sound: **a missing asset must never break the game** (see
   `preloadAirhorn` for the pattern — one `console.warn`, then the fallback).
3. Play it: `playSample(buf, volume)` — routes through the master gain, so
   the volume slider and mute govern it like every synthesized sound. The
   iOS/mobile first-touch unlock already covers samples; nothing extra to do.

The level-up airhorn (`assets/airhorn.mp3`) is the reference user: preloaded
at boot, debounced to one horn per resolution moment
(`CONFIG.AIRHORN_DEBOUNCE_S`), own level-ups at `CONFIG.AIRHORN_VOL_OWN`,
allies' at `CONFIG.AIRHORN_VOL_ALLY`.

## Debug keys

Enabled by the `DEV` flag in `js/config.js` (shipped `true`; set `false` for
clean play). They act on the **host's** simulation:

- **F1** — spawn 50 enemies (stress test; arenas only)
- **F2** — +200 materials for every player
- **F3** — kill everything, end the fight's spawning, and satisfy the current
  objective (the one key that ends any level; also runs the completion
  cleanup, so the room goes inert exactly as it does on a real clear)
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
  ≥1 statline), 600 seeded node-map generations (counts, guarantees,
  avoidable elite, all five templates), consent-vote semantics (solo instant,
  redirect once, lock, expiry), all 32 characters clearing their first fight,
  full-run victories for the six gate characters, per-fight trigger mapping
  (Rampart/Vesper/Facet/Greed/level banking), every arena template + the
  spawn-clip regression, the Siege end-to-end (mutations, mercy revive, pylon
  buff, boss ordering, payout), sub-objectives, the floor-1 DPS gate (±40% of
  the roster median, table printed), 4-player co-op + wipe, build management,
  the shop-economy gates (extraction shops, 100-seed stock guarantees with
  rerolls, auto-combine at 6/6, 5/5 and 4/4, atomic swap + rollback, the
  density/HP knob spot-checks), the airhorn's debounce/volume/fallback rules
  (headless — no WebAudio needed), the friction gates (40-seed profile
  coverage with the Bastion share and elite exclusion, the symmetric Statue
  Test — a never-moving probe dies on floor 1 in every non-Bastion profile ×
  all five templates and survives floor-1 Bastion — plus the Bulwark clause,
  the line-of-sight lab: pillar blocks both sides, lobs arc over, auto-aim
  skips walled-off targets, chains refuse blocked hops, blasts clip; the
  money rule's fizzle ledger and the siege looting window), the Warband
  gates (softened-curve spot-checks at 2/4/6/8, the alive-ceiling firehose
  with banked-budget refill, wire-codec round-trip + size gates with the
  8-player upload estimate logged, party traits at 8 — toll/aura/tether/
  drips, the merged ring with 8 spread players, the airhorn ally cap, and a
  mixed-8 party clearing floor 1 organically), a floor-4 siege stress
  (crest ≥150 alive, tick time, LoS on), snapshot serialization in both
  phases.
- `node tools/browser_test.mjs [--coop]` — boots real headless Chromium over
  the DevTools protocol: title → lobby → map → arena → results with zero
  console errors, node-map taps, camera-follow checks, extraction, trait
  meters and the boon picker in real DOM, mobile emulation with dispatched
  touch events (map nodes at the 44 px standard, joystick extraction walk),
  perf gates at siege density, the patch-8 shop flows (extraction shop,
  Black Market, combine badge, auto-combine, tier-IV reason, make-room swap
  with cancel/atomic-net, live est.-DPS updates, touch sizing), the patch-9
  HUD (enemy counter incoming→exact in real DOM, touch-sized on mobile, the
  Bastion ⛊ on the node map, perf gates re-measured with 14 acid puddles +
  LoS at the crests), plus the two-browser co-op checklist against a local
  relay: contested node pick with redirect + lock, independent cameras,
  merged-ring spawn distances from both players, the full Siege synced
  (mercy revive, wall collapse, boss entry, the looting-window countdown on
  both HUDs, post-boss shop on both, extraction countdown, descent),
  simultaneous shopping with parallel rerolls / auto-combine / swaps,
  aura/tether across the network, turret carry/redeploy sync, cross-play
  desktop + touch, and the 8-window Warband phase: 8 real browsers in one
  room through the full flow (join by code → merged-ring fight → shops ×8 →
  siege with mercy revive, boss, looting window → descent → results ×8),
  host upload measured with WebRTC getStats at the siege crest, snapshot
  age/gaps on the 7th peer, crowd HUD/lobby/results sizing on a mobile
  window.
- `node tools/balance_probe.mjs <charId> [floors]` — a kiting bot plays the
  real node flow organically (picks nodes, shops on a budget weapons-first,
  dives siege objectives, charges melee stragglers) to flag balance
  disasters; prints a per-floor materials-flow ledger (earned / spent /
  buys / shop sessions).
- `node tools/validate_items.mjs js/content/items.js` — item catalog contract
  validator (hook schemas, price bands, category minimums, stat coverage).
- `node tools/gen_design_audit.mjs` — regenerates `docs/design-audit.md` from
  the live content data and enforces the dead-stat gate.
- `node tools/peer_relay.mjs [port]` — minimal PeerServer-compatible signaling
  relay (zero dependencies).

## Decisions (where the brief was silent or conflicted)

### Playtest pass 2 (patch 12)

- **The Breach bugs shared one root cause.** The corridor was reshaped by
  scaling the room's *bounds* after the arena was built, leaving the
  template's architecture hanging outside the room. `_pushOut` then ejected
  players along the shortest exit from a block — straight through the map
  edge. The fix moves the reshape into `buildArena`, where per-axis scaling
  reaches obstacles, hazards and siege mutations too, and re-clamps players
  to the room *after* the push. The minimap was never Breach-specific: it
  scales to the arena aspect correctly, it simply had nothing to draw, so it
  now marks the collapse, the sealed doors, the gate and every other
  objective marker.
- **The wall "never advanced" because it never mattered.** It did move — but
  the party spawned at the arena's centre and the gate sat at the far edge,
  so a 9-second walk ended the level before the collapse was relevant. The
  party now drops in at the mouth of the corridor, and the collapse is paced
  against the map (`(W − 2·WALL) / (segs·24 + 34)`) rather than a flat
  number, so it crosses the whole corridor in about the time a competent
  group needs to earn every door. Measured with the doors in: solo keeps
  ~160 u of daylight, a 4-player group briefly gets caught (−221 u) and
  takes the hit. That is the intended feel.
- **Door quotas scale on both axes**: `(10 + 4·floor) × (1 + 0.55·(players−1))`
  — 14 kills solo on floor 1, 37 for a four-player group, and the enemies to
  pay it spawn *inside the active segment* (behind the door, ahead of the
  collapse) so the fight always happens where the party is.
- **Defeat keeps the session, not just the code.** A loss lands on the
  results screen, where the host gets "NEW RUN (same room)" and everyone else
  is told to wait. Taking it rebuilds the lobby in place: the PeerJS room,
  every peer connection and the host role all persist, and character picks
  are cleared so the party re-drafts. Mid-run *abandon* reuses the same path
  but keeps your picks — abandoning is a do-over, losing is a fresh draft.
  A player who drops during the transition is filtered out by checking the
  live connection map, so the lobby never shows a ghost.
- **Elite Arena numbers.** 10–15 champions (`10 + floor + 0.7·(players−1)`,
  clamped) in waves of 3–5, each wave mixing variants, the next arriving
  when the field thins or 14 s pass. Champion HP needed a floor ramp on top
  of the base scaling — player builds outgrow the floor multiplier, and a
  deep-floor party was clearing a full roster in 24 s. Measured in the
  harness now: **58–114 s of uninterrupted DPS** across 1/4/8 players and
  floors 1–4. That harness bot is god-moded, HP-pinned and never
  repositions, so real play lands in the 2–3 minute target; the honest
  number is the one above.
- **Completion cleanup is a single choke point.** `_sanitizeArena()` runs at
  the top of `_clearFight` and at the siege's boss-down, *before* any offer,
  shop or level-up is pushed: every enemy dies, both sides' projectiles are
  released, spawning stops, and telegraphs, zones, vortexes, hazards, the
  hold-circle and cursed artillery all go quiet. A `safe` flag records it so
  the suites can assert the guarantee rather than infer it. It applies to
  standard arenas exactly as it does to the eight objective types.
- **The item audit is value-matched, not just signed.** Handing an item
  "+2 Grit / −9% Reflex" reads as a tradeoff but is a nerf, so each stat
  carries a rough value-per-point (Grit 6, Ingenuity 5, Greed 3, Ferocity
  and Tempo 2.5, Reflex and Attunement 2, Recovery 1.2, Vitality 1, Reach
  0.6) and the buff that pays for a subtraction is sized in those units.
  Across the 69 reworked items the mean net stat value moved by **0.05
  points** — sharper, not weaker. Commons stayed clean, 51% of eligible
  uncommons took a small subtraction, and **every** non-cursed rare and
  legendary took a meaningful one. Cursed items were left alone; they
  already trade a curse for their stats. Mechanical items that had no stat
  line gained one in their own lane, so the subtraction has something to
  oppose. The dead-stat gate now counts **positive** coverage only — after
  this pass a stat could otherwise look supported while only ever appearing
  as somebody's penalty.

### Objectives, Pulsar and cursed goods (patch 11)

- **The 12-node floor needed a bigger map.** The old floor was 9–10 nodes
  *including* the shop, reliquary and Siege. "12 combat nodes excluding
  shops/boss/event nodes" means the map is now 15: six fight columns holding
  14 nodes (12 combat + the shop + the reliquary) plus the Siege. The
  composition is rolled before layout so the count is exact rather than
  emergent, and the horde-arena invariant is enforced by dropping duplicate
  Zone/Elite nodes — verified over 960 generated floors.
- **Elite Arena inherited the Champion node's job.** The brief's 12-node
  list has no room for the old `elite` Champion stop, and Elite Arena is
  the same fantasy, so Elite Arenas now carry the Champion's guarantees:
  they pay the elite treasure pick on clear, and at least one per floor must
  be avoidable (some path from an entry to the Siege skips it). The `elite`
  kind still exists in the engine so nothing that references it breaks.
- **Bounty HP ramps on the early floors — a deliberate deviation, flagged.**
  The brief prices each mark at ~60–70% of post-patch (doubled) boss HP.
  Five of those is over three bosses' worth of HP in a single level, which
  floor 1 cannot pay: in the harness, a solo player with a *good* floor-1
  build (four weapons at tier II, +60 Ferocity) killed 2 of 5 in eight
  minutes and was on pace for roughly twenty. So the fraction ramps by floor
  — ×0.70 on floor 1 up to the full briefed band by floor 4 — while the
  anchor (the real floor boss's spawn HP), the count (5) and the sequencing
  are exactly as specified. Measured after the ramp: 47–54 s solo and 4p on
  floor 1, 28–37 s on floor 2+. If playtesting wants the full 60–70% from
  floor 1, `bountyFraction` in `js/objectives.js` is the one-line knob.
- **Objective hazards are true damage.** The storm's burn and the Breach
  collapse ignore Grit, shields, dodge and i-frames. They tick continuously,
  so routing them through the normal mitigation path would have made
  standing in a lethal wall a viable build choice.
- **Nest Purge needed its ambient pressure cut.** At the first numbers
  (8 spawners at ×3.2 HP, each holding 3 brood, on top of a full wave) a
  solo player never got through it: auto-aim locks the nearest target, so
  standing on a nest just feeds you brood. Spawners are now ×2.2 HP with a
  brood cap of 2, the ambient wave runs at 15–65% (scaling with nests left
  alive), and every live nest is marked in the world and on the edge arrows.
  Solo clear went from "never" to 18 s.
- **The zone anti-farm counts kills, not time.** 150 kills per zone segment,
  reset on capture — so a party that parks in an endless-spawn level stops
  earning but can still finish the objective. The cap is generous enough
  that normal play never notices it.
- **Structures: "off-screen" is judged generously.** The recall checks a
  2100×1180 box around the owner — larger than any real viewport (the
  renderer shows 1280×720 of world on the narrow axis and more on wide
  monitors). Erring large means a structure you can actually see never packs
  itself up, which is the rule the brief cared about. The channel pauses
  (rather than cancels) in menus and while downed, and breaks outright on
  movement or damage. In co-op the check runs against each owner's own
  position, so one player's camera never recalls another's turrets.
- **Pulsar's nova radius is not a stat.** The 120 cap lands *after* every
  range modifier — Reach, Overwatch, items — and his weapons are capped to
  the same number, so the character can never buy his way out of his own
  blast radius. Measured nova share in the harness: **~50% of his total
  damage**, which is the tuning target the brief set; the sim suite prints
  the number each run so a future rebalance can check it instead of guessing.
- **Cursed items are a loan against exactly one fight.** Buying one queues
  its curse; entering the next arena activates it; entering the arena after
  that clears it. Enemy-side curses (+HP, +speed, extra barrage) fold into
  shared round multipliers so they hit the whole party — that is the point
  of buying one in co-op — while player-side curses (−Tempo, −Reflex, halved
  healing) only ever touch the buyer. Same-key curses stack additively.
  Stats sit ~30–40% above a clean item at the same price.
- **Solo's +15% stacks on top of everything**, including the co-op curve
  (which is ×1 at one player), so the knob is a clean multiplier and the
  2–8 player numbers are untouched.
- **Endless levels take the square root of the co-op spawn multiplier.** A
  horde arena spends a finite budget, so party scaling just makes the same
  fight denser. Zone Control, Relic Run and friends have no budget to spend,
  so the flat ×3.7 at eight players meant fighting that inflow for as long as
  the objective took — minutes. The sqrt keeps a full party's level clearly
  heavier without turning it into an unwinnable war of attrition.
- **Bounty marks win your auto-aim.** Weighting a marked champion at ×0.3
  distance was the difference between "kill the champion" and "kill the
  escort forever while the champion watches" — auto-aim locks the nearest
  body, and a bounty always travels with a pack.
- **Known soft spot, flagged not hidden**: the harness's 8-player *organic*
  floor-1 walk no longer reliably finishes. That bot is a ~50-line kiter; the
  new floor 1 asks for navigation and role coordination (someone carries the
  relic, everyone else covers) that it doesn't have, and its outcome swings
  on global RNG — one run wipes on the opening arena, the next walks three
  nodes. It is reported as a loud warning in the suite rather than quietly
  relaxed. What *is* gated: every objective level driven to completion solo
  and 4-player, and an 8-player Relic Run clearing in 16 s under direct
  steering. An 8-player floor-1 run is the thing to watch in playtesting.

### The Warband (patch 10)

- **Difficulty curves soften at the knee, exactly as briefed.** Enemy count
  ×(1 + 0.5(n−1)) through 4 players, +0.3 per player beyond; enemy HP
  ×(1 + 0.35(n−1)) through 4, +0.2 beyond:

  | players | 2 | 4 | 6 | 8 |
  |---|---|---|---|---|
  | count | ×1.5 | ×2.5 | ×3.1 | ×3.7 |
  | HP | ×1.35 | ×2.05 | ×2.45 | ×2.85 |

  Both knees live in config (`COOP_SOFT_AT`, `COOP_*_SOFT`); the ≤4 path is
  numerically identical to before, which is why the solo/4p gates re-pass
  untouched.
- **The alive ceiling is 300 (`ALIVE_CEILING`), one number for all
  platforms**, sized under the 320 entity pool and the render budget the
  perf gates measure. When it binds, the spawn accumulator simply stops
  being spent — it *is* the bank (capped at `SPAWN_BANK_CAP` 45 so a
  post-ceiling flood is bounded) and flows in as slots free. Champions
  (elite injections) wait for a slot rather than jumping the queue. Fights
  at 8 players get longer, never laggier — verified by a firehose test that
  pins the field at exactly 300 and watches the bank refill the field
  within 1.5 s of a cull.
- **Bandwidth work: binary packing + interest culling + 12 Hz at 6+, no
  delta-ack.** The naive baseline was real (~14.5 KB JSON-shaped snapshots
  × 15 Hz × 7 peers ≈ 1.5 MB/s). Three orthogonal cuts get under the target
  with margin: (1) `js/netcodec.js` packs enemies into 9 bytes each (projs
  13, pickups 4, zones/telegraphs/heavy fx likewise) with a per-snapshot
  color LUT — the sim's snapshot shape is unchanged and clients decode back
  into it at ingest, so the interpolation path never learned the wire
  changed; (2) chaff farther than 1400 u from every player isn't sent at
  all (elites/bosses/pylons always ship; the radar and edge arrows only
  track those, so culling is visually lossless — the HUD counter reads the
  new authoritative `ec` field instead of counting the list); (3) at 6+
  players the snapshot rate drops 15 → 12/s, which the receive-timestamp
  interpolation absorbs automatically. Measured: **~2.9 KB per snapshot at
  a 300-alive 8-player siege crest → ≈246 KB/s estimated host upload**, and
  the 8-window browser gate measures the real wire via WebRTC `getStats()`
  (number logged in the suite output each run — measured **285 KB/s real**
  across 7 peers at a 224-alive crest, with the byte-estimator within 4% of
  the wire, and snapshot age 14 ms / max gap 223 ms on the 7th peer). Delta-against-last-acked
  snapshots were considered and rejected: they'd roughly halve the residual
  cost at the price of per-peer ack state and a desync class we'd have to
  test for — the simple cuts already beat the target by ~45%.
- **Arenas scale geometrically at 5+ players** (`ARENA_CROWD_SCALE` 1.25 on
  both axes, same templates, obstacle/hazard/mutation coordinates scaled
  with the bounds so siege scripts land where the walls actually are).
  Below 5 nothing changes, keeping the earlier tuning gates bit-identical.
- **How the 8-player perf gate is read.** The alive ceiling pins the
  8-player crest to the same ~300-alive field the patch-8/9 perf gates
  already measure at 60 fps (desktop) / 60 fps (mobile emulation, DPR
  capped) on this hardware — that is the point of the ceiling: 8 players
  can't push the renderer past the measured crest. The Warband phase also
  measures fps *while 8 headless Chromiums share 4 SwiftShader cores*; those
  contended numbers are logged with a warning, not gated, because they
  measure the test rig, not the game. A real host runs one browser.
- **Four new seat colors** (blue `#6a8dff`, chartreuse `#eef75e`, lavender
  `#b993ff`, silver `#f0f0f0`) chosen against the enemy reds, the elite
  purple and the material gold; the two `% 4` color fallbacks in the lobby
  code were the only 4-player literals in the netcode.
- **The HP strip condenses at 5+**: your own row keeps full detail (HP,
  shield, XP, trait meter), the other 7 become two columns of name + bar
  minis. Edge arrows fade to 30% for alive allies within ~700 u (just
  off-screen — you know roughly where they are) and stay solid for distant
  ones; downed allies always render full-strength, pulsing, drawn last so
  they sit on top of the clutter.
- **Airhorn at 8**: the global debounce window stays, own horns stay
  once-per-window, and ally horns cap at `AIRHORN_ALLY_CAP` (2) per window —
  7 friends hitting an extraction is a celebration, not 7 horns.
- **The organic-8 gate plays for real** (no kill-cheats, no HP pinning):
  eight bots kite while spawning flows, hunt stragglers to weapon range at
  spawn-stop, scoop money mid-fight, rescue downed allies, and walk out via
  the hatch. A mixed party (tank/casters/supports/economy) clears floor 1 —
  fights, elite, siege, boss — in ~9 minutes of game time with 8/8 standing.
  The first bot draft only fled and never closed range; wave-end mop-up
  deadlocked exactly the way a too-passive party would. The fix (hunt when
  the counter goes exact) is the same lesson the enemy counter teaches
  humans, which reads as design working.

- **Profile recipes.** Each Combat/Champion node rolls one profile at map
  generation; the non-Bastion keys cycle through a shuffled per-floor deck so
  every role appears across a floor. The knobs (js/arenas.js `PROFILES`):

  | profile | ring | artillery | puddle | flankers | rate | notes |
  |---|---|---|---|---|---|---|
  | artillery | ✓ | 0.28 | 0.05 | 0.08 | ×1.0 | mortars own the fight |
  | flanker | ✓ | 0.05 | 0.05 | 0.32 | ×1.0 | Gyres/Lancerfish as citizens |
  | puddle | ✓ | 0.05 | 0.35 | 0.08 | ×1.0 | the ground fills in |
  | swarm | ✓ | 0.04 | 0.08 | 0.08 | ×1.18 | pressure by volume |
  | mixed | ✓ | 0.14 | 0.14 | 0.16 | ×1.0 | a bit of everything |
  | bastion | ✗ (one edge) | 0 | 0 | 0 | ×0.65 | melee-only stream |
  | siege | ✓ | 0.10 | 0.08 | 0.12 | ×1.0 | always high-friction |

  No profile maxes every lever — each fight asks one clear question. Elites
  never roll Bastion (a Champion should never be the easy room).
- **Bastion is melee-only by ban list, streaming from a single edge, at
  ×0.65 rate.** The experiments that set this: two fronts split a
  stationary player's nearest-enemy auto-aim and killed the camping statue;
  Fuseheads (telegraphed self-detonation at your feet) and Lobbers
  (keep-distance 260 outranges short weapons) are *definitional* stillness
  punishers, so any of them in the mix un-sanctions the camp. The ban list
  (`fusehead, lobber, deadeye, wombden, lancerfish, gyre`) redirects those
  rolls to the floor's chaff.
- **The Statue Test's two sides use different archetypes on purpose.** The
  DIE side runs the median-DPS caster (Cindermage) — it must die on floor 1
  in every non-Bastion profile × all five arena templates, and does. The
  SURVIVE side runs Bulwark, the hold-your-ground archetype the profile
  exists for. A spread-pellet caster whiffs most of its fan on single
  approaching targets past ~190 u (pellet spread wider than an enemy body),
  so "any character can camp a Bastion" was never the claim — the claim is
  *the camper's fantasy works there*, and the Bulwark clause (outlasts the
  median by ×1.5+ in open profiles, still dies eventually) pins the
  archetype gap in numbers: 22–24 s median vs 39–40 s Bulwark in the same
  storm.
- **The muzzle moved from 18 u to 6 u.** LoS testing surfaced the old
  Known-limitations whiff: projectiles spawned 18 u toward the target could
  start *past* a contact-range enemy and miss forever. Bastion sanctions
  standing still, so point-blank contact has to be hittable; the entry is
  fixed, not worked around.
- **The looting window is 8 seconds** (`CONFIG.SIEGE_LOOT_WINDOW_S`). The
  brief asked for a "short looting window" on sieges; 8 s crosses a big
  siege arena once with typical Tempo but doesn't stall the descent. It's
  a visible synced countdown ("◆ sweep!"), then the fizzle report, then
  hatch + post-boss shops. On floor 4 the run ends after the window instead.
- **The economy shift is real and intended**: with the vacuum gone, probe
  bots collect ~75% of a floor's drops mid-fight (floor-1 earned ~820 →
  ~610–705; end-of-floor-2 holdings ~1,240 → ~750–1,011). That eats most of
  the patch-8 "buy anything late-run" surplus without touching prices, and
  it makes **Reach** (pickup radius) and **Greed's flat clear bonus**
  (immune to fizzle) quietly better — logged here as the intended direction,
  not a bug.
- **Line of sight exposed a real deadlock, fixed with a stall detector, not
  pathfinding.** Pre-LoS, through-wall shots were a hidden crutch: a
  straggler wedged in a concave wall pocket still died to auto-aim. With
  walls real, a wave-end rusher that stops making progress (moved <24 u in
  1.2 s) now picks a random 420 u detour waypoint and tries again. Cheap,
  and it kept every scripted full run finishable; proper pathfinding stays
  out of jam scope.
- **Enemy gunners may still fire into walls occasionally** — deliberate.
  Denied line of sight they drift sideways toward an angle, hold most
  shots (25% fire anyway), and retry sooner. Perfectly wall-aware enemies
  read as psychic; occasionally dusting masonry reads as dumb, which is
  correct.
- **Perf, re-measured with LoS raycasts + a full puddle cap at the crests**:
  sim siege stress 311→157 alive runs ~0.33 ms/tick (60 Hz budget: 16.6 ms);
  the headless-browser render gates with 14 acid puddles active and LoS on
  held 60 fps at the ~300-alive desktop crest and 60 fps at the ~230-alive
  mobile-emulation crest (the suite logs `PERF` lines each run).

### The airhorn (the first asset pipeline)

- **The synth-only constraint is lifted** — for assets the owner adds
  deliberately. `assets/airhorn.mp3` (owner-uploaded to the repo root,
  moved into `assets/` as the pipeline's canonical home) is the first;
  `loadSample`/`playSample` in `js/audio.js` are the generic path future
  sounds and music will use. Everything still routes through the one master
  gain.
- **The context is now created suspended at preload time** (was: lazily on
  the first gesture) so `decodeAudioData` can run at boot; the existing
  first-gesture `ensureAudio` resume is unchanged and the mobile unlock is
  unaffected — creating a suspended context without a gesture is exactly
  what the autoplay policy permits.
- **The horn fires where the old blip did** — the moment a level banks (the
  "LEVEL UP!" beat), not when the boost cards are picked. Banked levels
  landing in a burst at an extraction arrive within the 1 s debounce window
  and play once; picking cards afterwards is silent, so reading four cards
  slowly never re-triggers a celebration per tap. The generic
  `sfx: 'levelup'` broadcast was removed — the idx-aware `levelUp` event is
  the sole trigger, which is what makes own-vs-ally volume possible.
- **The debounce window is global, not per-player** (per the brief): the
  first level-up in a window decides that window's volume. Four friends
  leveling at one extraction = one horn.
- **Failure is designed for**: fetch or decode failure → one console
  warning, `audioStats.warnings` increments, and every level-up plays the
  old synth blip. The suite boots a browser with the asset request forcibly
  failed to prove level-ups, offers, and the run all survive assetless.

### Shop economy (patch 8)

- **The two difficulty knobs live in `js/config.js`**: `spawnBudgetMult`
  (1.25 — wave/siege inflow and the alive-at-once caps scale together) and
  `enemyHpMult` (1.12 — chaff, ranged, specials, elites, bosses, and the
  ward pylon). Measured: spawn ratio 1.27× on a seeded no-kill fight,
  floor-4 siege crest ~311 alive (pool-capped), host tick ~0.4 ms.
- **Perf at the new crests, measured**: desktop host 60 fps at a 320→284
  alive siege crest; mobile emulation 60 fps at 234→222 alive with the DPR
  cap at 2 (headless SwiftShader numbers — "no render cliff", not device
  benchmarks).
- **The economy interlock, probed organically** (kiting bot, floors 1–2,
  combined effect of density + extraction shops): a median character
  (Bulwark) earns ~820 on floor 1 and spends ~310 across 4 shop sessions
  (13 buys, 6 weapons — a full rack before the floor-1 siege, vs 3 weapons
  pre-patch), then earns ~1 240 / spends ~510 on floor 2. Fight times settle
  at 80–105 s after the first fight because build growth is front-loaded;
  sieges run 130–215 s. Flagged, not fixed: unspent surplus grows (~1 200
  held at floor 2's end) — prices could absorb more later-floor income, but
  per the brief pricing stays as-is.
- **The est.-DPS method** (`estimateDps` in `js/content/weapons.js`): base ×
  tier × (1 + Ferocity/100) × (1 + scaling-tag bonus/100) × attack rate
  after Tempo, × projectile count for spreads; turrets use turret damage ×
  Ingenuity ÷ fire period. A uniform single-target baseline — every pellet
  assumed to hit, chains/burns/blasts/travel ignored, and character-specific
  inheritance (the Overseer's) not modeled. It's labeled "est." everywhere
  and exists to compare weapons, not to predict combat.
- **Auto-combine specifics**: "match" means same type AND same tier below
  IV; with two same-tier copies the first owned slot absorbs the purchase;
  the price paid joins the weapon's invested total (so the Quartermaster's
  sell lineage stays exact). An owned tier-IV copy plus a tier-IV offer
  shows "nothing higher to combine into" on the card. A same-type,
  *different*-tier offer is not a match — at full slots it goes through the
  make-room picker like any other weapon.
- **The swap is validated as one transaction**: the host re-checks stock,
  ownership (id + tier, stale selections rejected), trait rules, and that
  `materials + refund ≥ price` before touching anything; then both legs
  commit. The refund may fund the purchase (you can swap while short on
  cash). There is no partial state to roll back because nothing mutates
  until every check has passed.
- **Extraction shops persist through travel**: close is the only way out —
  walking to the portal with the shop open keeps it browsable on the map
  screen (co-op partners are never blocked by a browsing teammate; the shop
  is per-player). The map's "Reopen shop" button remains Black-Market-only;
  a closed extraction shop is gone (the next clear brings a fresh one).
- **Wave-end rush closes to contact** (was: to firing range). Found by the
  probe: a beaten wave's ranged survivors hovering at 90 u formed a
  permanent firing squad no melee starting kit could reach — Gilded One's
  Vaultspike could never close the last 8 Lobbers. Survivors now walk into
  the blade; ranged kits kill them approaching either way.
- **Trait shops ignore the new guarantees** — their slot rule IS their
  stock rule (see the patch-8.1 restatement of Gilded One's below); the
  Quartermaster's all-weapon rack extends to the Black Market's 6 slots
  (his rare+-item guarantee is meaningless and skipped).

### The Gilded One rescue (patch 8.1)

- **Root cause, restated**: weapons have tiers, not rarities — so a trait
  that fills shop slots with "legendary" goods produced an items-only shop
  *by definition*, locking the economy character out of the weapon economy
  the game now runs on; and `enemyHpMult` 1.12 moved Lobbers past its old
  Vaultspike's one-shot threshold in the first fight, before any shop
  exists.
- **Starting weapon: Kegbomb** (Greed-scaled) — the economy statline powers
  the weapon from the first second, and every Greed purchase grows it.
  Vaultspike untouched (Duskblade ripples). The Kegbomb itself went 17 dmg
  (from 20): its AoE already measures rich in the multi-dummy DPS harness,
  and Greed-15 on top pushed Gilded One to +53% of median — past the ±40%
  gate from the other side. At 17, Gilded One measures +33% and Powderkeg
  (the other Kegbomb start) +13% — both in-gate, both closer to median
  than before. This is the one ripple the rescue allowed, and it follows
  the patch-5 precedent (Kegbomb has been tuned at this gate before:
  24 → 20 → 17).
- **The trait, restated for the real economy**: shop slots always hold the
  finest goods available — legendary items or the floor's top rollable
  weapon tier (II on floor 1, III on floor 2, IV from floor 3) — but only
  2 of them (3 at the Black Market, which also keeps its reroll discount).
  The trait overrides the standard weapon-guarantee composition everywhere;
  auto-combine, the make-room swap, and locks work against its stock like
  anyone else's. Pricing is the existing tier/rarity pricing — top-shelf
  goods cost top-shelf prices, which is the fantasy.
- **Verified organically**: the probe now clears the first fight in ~91 s
  and WINS the full 4-floor run outright (2 weapons after fight one, a full
  rack by floor 2, the Vault Regent down at level ~49) — stronger than the
  "documented close final-boss loss" the gate required. Mirage, Broker, and
  Powderkeg re-probed clean.
- **Probe learned to hunt sources** (general fixes surfaced by the first
  4-floor runs, not Gilded-specific): once spawning stops it walks onto
  Wombden nests (broods replenish forever), Aegimand wardens (shield auras
  make neighbors immortal to nearest-target weapons), and Stitcher medics
  (out-heal low kits) — and it routes around the Champion branch like a
  human playing a below-median build (the map guarantees elites are
  optional; that's what the branch is for). Extraction walking no longer
  counts against the fight-time cap.

### The Gauntlet (patch 7)

- **The map generator is rejection-sampled** (up to 40 attempts per floor):
  columns of 2/2/2/2 with a 60% chance one middle column widens to 3, edges
  from a non-crossing range map plus 45% widening, then shuffled picks for the
  Trader/Reliquary/Champion guarantees. A layout is rejected unless every node
  is reachable, every column offers 2–3 choices, and a BFS with the Champion
  node deleted still reaches the Siege (elite always avoidable). 600 seeded
  generations are asserted in the suite.
- **The extraction portal and the descent hatch are one object** — after a
  normal fight it returns the party to the map; after a Siege it descends.
  One prop, one consent rule, one renderer.
- **Wave rates**: floor 1 is the baseline a one-weapon starting kit
  (~0.6 organic kills/s) can chew through — `r0 = 0.5 + 0.25×(floor−1)`,
  `r1 = 1.2 + 0.55×(floor−1) + 0.18×depth` enemies/s over a 60–90 s ramp.
  The original draft scaled from floor 1 and made the first fight a 150 s+
  slog for low-DPS characters (found by the organic probe, not the F3 suite).
- **Wave-end rush**: when a fight's spawning stops, keep-range enemies
  (Lobbers, Stitchers, Deadeyes) press the attack instead of kiting. Without
  it the last stragglers turned every big arena's fight tail into a hunt.
- **Alive-at-once caps** for ranged/special types (lobber 22, gemmite 18,
  gyre 16, lancerfish 14, fusehead 10, plus the old warden/medic/nest caps);
  melee chaff stays uncapped because swarms are the point, and capped rolls
  redirect into chaff. Before the caps, a low-DPS build could face 65 lobbers
  at once in a floor-1 siege — a stalemate, not a fight.
- **Boss-phase spawn taper**: while the siege boss lives, add spawns run at
  0.35× and fade to zero over 75 s. Without the taper the siege is a pure
  DPS race against infinite inflow, and the weakest roster corner
  (Gilded One at −38% of median) could literally never finish it. With it,
  every siege eventually becomes finite: the boss plus the standing field.
- **Per-fight trigger translation** ("per room" → "per fight node"): Rampart's
  +1 Grit, Vesper's +3 overheal cap, Facet's boons (offered on entering
  Combat/Elite/Siege nodes, expiring at the clear), the Greed tithe, first-kill
  and first-hit items, and level-up banking all key off fight nodes; stops
  (Trader/Reliquary) trigger nothing. All verified by dedicated tests.
- **Spawn placement nudges off obstacles** (`_clearSpot`, deterministic ring
  search): cramped layouts can run architecture through the arena's exact
  midpoint, and a player spawned inside a wall gets pinned by the push-out
  resolver. Found by a co-op browser-test flake; regression covers 25 seeds ×
  5 templates + all 4 siege arenas.
- **Client prediction ignores obstacles**: the predicted self can clip a wall
  corner for a frame before the authoritative snapshot reconciles it. Adding
  obstacle collision to prediction wasn't worth the drift complexity at 15 Hz
  snapshots with 120 ms interpolation.
- **Enemy radius left the wire**: clients derive it from the type index and
  the elite/mini flags (×1.45 / ×0.6). At siege density that trimmed the
  snapshot to ~14–15 KB at a 300-alive crest (~220 KB/s at 15 Hz), measured in
  the suite; obstacles/hazard definitions travel once per arena as events, not
  in snapshots.
- **Perf, measured**: host sim tick averages ~0.4 ms at a floor-4 siege crest
  of ~300 alive (60 fps budget is 16.6 ms). Headless-Chromium render gates:
  desktop 60 fps at ~250 alive, mobile emulation (2.6 DPR viewport, capped at
  2×) 60 fps at ~180 alive — SwiftShader numbers, so treat them as "no
  render-side cliff", not device benchmarks.
- **The siege boss enters far from the party** (the spawn spot furthest from
  the party centroid among candidates) with a 1.5 s telegraph, so a boss
  never materializes on top of a downed-revive pile.
- **A latent pool bug surfaced**: `_bossDown`'s add-sweep could kill a
  splitter whose minis reallocate the boss's just-released pool slot,
  overwriting `bossDef` mid-function. The boss name is captured before the
  sweep now. Worth noting as the one place pool recycling bit us.

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
  at the arena center, four immobile high-HP dummies at 90 u; 20 s; median 22.5;
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
  design; nothing breaches the gate. (Historical snapshot — patch 8.1's
  Kegbomb re-tune moved its two owners: gilded_one 30.0 (+33%), powderkeg
  25.5 (+13%).)
- **Healing model details**: every heal source is multiplied by Recovery, with
  a fractional accumulator so small amplified heals aren't lost to rounding.
  Overheal routing (Hemomancer shield, Vesper's permanent Vitality with its
  +3/fight cap, Sawbones' ally drip) resolves before Soulbond's 25% heal share,
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
  fight-length). The third pick of the same boon makes it permanent at its
  boon value; picking an already-permanent boon stacks its temp bonus again
  for that fight. Boon offers are per-player, non-blocking, and expire at the
  clear.
- **Toll Road** (Tollkeeper) is unchanged in shape: double material drops,
  +25% enemy HP, party-wide.
- **Quartermaster's invested-materials lineage**: starting weapons count their
  base shop price as invested; buying records the price actually paid
  (discounts included); combining sums both sides; selling refunds exactly the
  invested total. Everyone else keeps the 30% floor-scaled refund.
- **Greed's fight-clear tithe** replaces Harvesting entirely — no self-growth
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

- **Seeded vs. live randomness**: the node map, wave composition, shop
  stock, level-up offers, boon offers and treasure picks all derive
  deterministically from the run seed (shown on the results screen).
  Moment-to-moment combat rolls (granted-crit conditions, dodge, proc chances)
  use live randomness — the host is the single authority, so determinism there
  buys nothing and costs feel.
- **Offline-first hosting**: the lobby opens instantly; PeerJS registration
  happens in the background. If the cloud is unreachable the lobby says
  OFFLINE and solo play works fully — a network hiccup never blocks the game.
- **Manual revives also restore 50% HP** (same as the fight-clear auto-revive)
  to keep one simple rule.
- **Between floors** players heal half of their missing HP; at each fight
  clear everyone recovers 10% of missing HP (both are healing *sources*, so
  Recovery amplifies them). Pure attrition across a run of long, dense fights
  was unrecoverable without mandatory sustain builds.
- **Champion (elite) nodes** give every player a free choice of 1 from 3
  rare-or-better items at the clear (mirrors the Reliquary flow, at higher
  rarity); their waves run hotter and inject a modified champion every 16 s
  so the fight stays about the champions.
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
- **Turret placement**: structures teleport to their owner on every arena
  entry and are rebuilt free if destroyed (destroyed structures respawn at
  the next fight). Enemies damage structures by contact only. A carried Overseer
  turret rides on the pilot's shoulder, inert, until redeployed.
- **Settings never pause** — even solo. One rule, no edge cases; a solo
  player can browse from the map screen or a cleared arena in safety anyway.
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
- **No pathfinding**: enemies steer straight at you and slide along walls.
  Line of sight made this visible — a straggler can wedge into a concave
  wall pocket it can't steer out of. A stall detector re-routes any
  wave-end rusher that stops making progress (a random detour waypoint), so
  fights stay finishable, but the detour is a wander, not a route. Enemy
  gunners denied line of sight drift sideways for an angle and occasionally
  fire into the wall anyway — that one is deliberate (they're dumb, not
  psychic).
- **Balance is jam-grade**: probed by bots, a DPS harness and scripted runs,
  not hundreds of human hours. The ±40%-of-median DPS gate holds at floor-1
  baseline; full-run scaling (especially Greed economies and Overseer turret
  stacking) will drift with real play.
- **Level-ups stay banked for the whole Siege.** The banking rule ("resolve
  at the clear") means a 3–4 minute siege runs with zero build progression —
  a player can sit on 10+ unspent boosts through the hardest fight of the
  floor. Resolving banked boosts at mutation beats was considered and
  deliberately not done: the level-up overlay is full-screen, and popping it
  mid-siege (especially over the touch joystick) is worse than the flatness.
  A non-blocking mid-siege card UI would be the real fix.
- **Keyboard + mouse, or touch** — gamepad is still unsupported. Touch support
  was verified with Chromium's mobile emulation (Pixel-class viewport, real
  dispatched touch events); real devices — **especially iOS Safari** — can
  surface quirks emulation can't catch (audio unlock timing, safe-area insets,
  browser-chrome resizes, 120 Hz scheduling), so treat phone support as
  well-tested-in-emulation rather than device-certified.
- The pause-free design means browsing a Trader stop (a map screen, no
  combat) is safe, but reading tooltips mid-fight is at your own risk — as
  intended.
- **Facet's boon strip on very short screens** sits above the bottom edge and
  can briefly overlap the joystick's comfortable zone; it's tap-through
  outside the panel and disappears on pick.
