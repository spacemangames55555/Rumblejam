# UNDERVAULT

A co-op dungeon-crawl arena roguelite for 1–4 players, in the browser, with no
server to run. Pick one of **36 characters**, descend through a 4-floor dungeon
of connected single-screen rooms (Binding-of-Isaac layout), clear enemy waves
with **auto-attacking weapons** (Brotato-style stat stacking — every mechanic
and name here is original), bank level-ups, shop and reroll, beat each floor's
boss, and destroy **The Vault Regent** on floor 4. If the whole party goes
down, the run is over.

Everything is plain JavaScript (ES modules) + Canvas 2D + WebAudio. All art is
drawn with canvas primitives and all sound is synthesized — there are no asset
files. The only external dependency is the PeerJS client, loaded from a CDN
`<script>` tag, used for the peer-to-peer co-op networking.

- **Content**: 36 characters · 110 items · 26 weapons across 6 classes ·
  12 enemy types · 4 two-phase bosses · elites with 4 modifiers · spike & lava
  hazard rooms · shop / treasure / elite / boss rooms on every floor.
- **Co-op**: host-authoritative P2P via PeerJS room codes. The host runs the
  whole simulation; clients send inputs (~30/s) and interpolate snapshots
  (~15/s) with local prediction for their own character. Downed friends are
  revived by standing next to them for 3 s; room clears auto-revive at 50% HP.

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
- **E** — open the shop while standing in a cleared shop room / at the post-boss hatch
- **C** (or the ☰ HUD button) — character sheet: all sixteen stats, weapons,
  and items, live. In solo it pauses the game; in co-op it never pauses and
  only ever covers your own screen.
- **Mouse** — menus, shop, level-up choices
- **In the shop**: your weapons and items are listed under the stock. Own two
  identical same-tier weapons? Tap one, then tap its highlighted match to
  **combine** them into the next tier for free (frees a slot). Anything you own
  can be **sold for 30%** of its shop price — tap Sell once to arm, again to
  confirm; tapping elsewhere cancels.
- Stand in a doorway of a cleared room to start the 3-second **group** door
  countdown; stand on the hatch after a boss to descend.
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
- Everything else is tap: menus, character grid, shop, level-ups, the ↰
  leave button, and the ⚙ settings gear.
- A gold **OPEN SHOP** button appears when the E key would do something
  (re-opening the shop in a shop room or at the post-boss hatch).
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

- `node tools/sim_test.mjs` — headless full-game test suite (content counts,
  36-character smoke, scripted solo win, 4-player co-op + wipe, 250-enemy
  stress timing, snapshot serialization).
- `node tools/browser_test.mjs [--coop]` — boots real headless Chromium over
  the DevTools protocol: title → lobby → run → results with zero console
  errors, plus the full two-browser co-op checklist against a local relay.
- `node tools/balance_probe.mjs <charId>` — a kiting bot plays real combat to
  flag balance disasters.
- `node tools/validate_items.mjs js/content/items.js` — item catalog contract
  validator.
- `node tools/peer_relay.mjs [port]` — minimal PeerServer-compatible signaling
  relay (zero dependencies).

## Decisions (where the brief was silent or conflicted)

- **Seeded vs. live randomness**: dungeon layout, room spawn composition, shop
  stock, level-up offers and treasure picks all derive deterministically from
  the run seed (shown on the results screen). Moment-to-moment combat rolls
  (crit, dodge, proc chances) use live randomness — the host is the single
  authority, so determinism there buys nothing and costs feel.
- **Offline-first hosting**: the lobby opens instantly; PeerJS registration
  happens in the background. If the cloud is unreachable the lobby says
  OFFLINE and solo play works fully — a network hiccup never blocks the game.
- **Manual revives also restore 50% HP** (same as the room-clear auto-revive)
  to keep one simple rule.
- **Between floors** players heal half of their missing HP; at each room clear
  everyone recovers 10% of missing HP. Pure attrition across ~48 rooms was
  unrecoverable without mandatory sustain builds.
- **Elite rooms** give every player a free choice of 1 from 3 rare-or-better
  items (mirrors the treasure room flow, at higher rarity), and spawn half the
  normal quota of basic enemies alongside the elites so the fight stays about
  the champions.
- **Bosses shrug off half of any slow** (chills work at 50% potency on them),
  and killing a boss sweeps its leftover adds/projectiles so the post-boss
  shop is safe and a floor-4 victory can't be stolen by a stray add.
- **If the host closes after the run ends**, clients keep their results screen
  instead of being bounced to "Host disconnected".
- **Abandoning a run** (↰ button) skips the results screen and drops the whole
  party straight into the lobby with connections and room code intact.
  Everyone's previous character stays pre-selected but ready states reset, so
  each player confirms before the next run; the post-abandon lobby also
  accepts brand-new joiners on the same code.
- **Hazards hurt players only** — enemies walking through lava tickled the
  balance in unreadable ways.
- **Melee and the Range stat**: melee weapons gain 30% of the flat Range stat,
  ranged/lobbed weapons gain 100%, so Range is never a dead stat on melee but
  doesn't warp arcs.
- **Engineering scaling**: +10% summon damage *and* HP per point
  (multiplicative with tier and items).
- **Chain lightning damage** (traits/weapons) is a factor of the actual hit
  that triggered it, so it scales with your whole build.
- **Boss flow**: the post-boss shop opens automatically for everyone (and can
  be reopened with E at the hatch); the floor-4 boss ends the run in victory a
  beat after it dies.
- **Turret placement**: structures teleport to their owner on every room
  transition and are rebuilt free if destroyed (destroyed structures respawn
  next room). Enemies damage structures by contact only.
- **Settings never pause** — even solo. One rule, no edge cases; a solo player
  can stand in a cleared room in perfect safety anyway.
- **No duplicate-character lock** in the lobby: two players may pick the same
  character (marked with a ✔ so you know).
- **Debug keys ship enabled** (`DEV = true`) because this is a jam build meant
  to be poked at; flip to `false` for real runs.
- **Build management**: combining is always the player's explicit call — buying
  a duplicate keeps both copies (holding a pair vs. merging for a free slot is
  a real decision), which replaced the original combine-on-purchase behavior
  as the single way combining works. Sell refunds use the undiscounted
  floor-scaled shop price (personal shop discounts neither inflate nor deflate
  refunds). Selling an item removes its stats and mechanical hooks instantly;
  permanent gains it already banked (e.g. Max-HP-per-kill already earned, past
  level-up bonuses) stay — history isn't rewritten. Selling one of a stacked
  item sells exactly one copy. Selling or combining turret weapons
  removes/merges their deployed structures via per-weapon instance ids.
- **Touch details**: only pointers of type `touch` anchor the joystick, so a
  mouse never moves the player by dragging even when touch controls are forced
  On. The joystick floats (anchored wherever you touch) rather than being
  fixed, so it never permanently covers HUD elements. The E action became a
  contextual on-screen button instead of auto-triggering, since the shop
  already auto-opens on room entry and re-opening should be intentional.
  Canvas resolution is capped at 2× devicePixelRatio — 3× phone panels cost
  fill-rate with no visible gain on a flat-shape art style.

## Known limitations

- **Signaling depends on the free PeerJS cloud** (`0.peerjs.com`). If it's
  down or blocked, hosting falls back to offline solo; co-op needs the
  self-host escape hatch described above. Strict corporate NATs without STUN
  success can also fail to connect (no TURN relay is configured).
- **No host migration / reconnection** (per the brief): if the host leaves,
  the run ends for everyone; a disconnected client can't rejoin mid-run.
- **Client-side hit feel**: remote players see enemies ~120 ms in the past
  (interpolation buffer). Your own movement is predicted and instant.
- **Balance is jam-grade**: probed by bots and scripted runs, not hundreds of
  human hours. Luck/economy builds in particular can snowball.
- **Keyboard + mouse, or touch** — gamepad is still unsupported. Touch support
  was verified with Chromium's mobile emulation (Pixel-class viewport, real
  dispatched touch events); real devices — **especially iOS Safari** — can
  surface quirks emulation can't catch (audio unlock timing, safe-area insets,
  browser-chrome resizes, 120 Hz scheduling), so treat phone support as
  well-tested-in-emulation rather than device-certified.
- The pause-free design means a solo player browsing the shop in a *shop room*
  is safe, but reading tooltips mid-combat is at your own risk — as intended.
