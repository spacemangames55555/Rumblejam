# The classic roster — retired, preserved

`characters-classic.js` here is the original 33-character roster. It is **not
imported by anything** and does not ship. It is kept because there is usable
design in it — stat spreads, trait ideas, names, symbols — that may be worth
mining for the fourteen Thrones of Heaven classes.

## Why it was retired

It is pre-overhaul content. The GDD's 14-class design replaces it rather than
extending it, so the 33 were never waiting for skill trees; building trees for
them would have been authoring content the design had already removed.

The thing that forced the decision was §15 defect #11. Weapons were removed in
`patch-trigger-core`, which made skills the only damage source. Skills come from
trees, trees are keyed by `charId`, and **not one of these 33 characters has a
tree** — so the roster the game booted into could not deal a point of aimed
damage. Measured, all 33, twenty seconds each:

```
bulwark:0  cogsmith:0  zephyr:0  tollkeeper:0  duskblade:0  rampart:0  onrush:0
vesper:0  broker:0  resonant:0  facet:0  stillness:0  powderkeg:0 …
```

The choice was to author 33 trees for content the design had dropped, or to
retire the roster. Retiring it was the smaller and more honest change.

## What went with it

- `js/roster.js` — URL/localStorage roster resolution, the lobby roster picker,
  and `applyHostRoster()`, the co-op guard that force-corrected a client onto
  the host's roster. With one roster there is nothing to resolve or guard.
- The roster switcher in `js/content/characters.js`, and the lobby's
  roster buttons.
- The silent `CHAR_BY_ID[id] || CHAR_BY_ID.bulwark` fallback in `js/game.js`.
  With one roster there is nothing to fall back *from*, and that fallback is
  most of why #11 stayed invisible: an id from the other roster resolved to
  `bulwark` with the right stats and the wrong `charId`, so `treesFor(p)` found
  nothing and said nothing.

## If you mine it

These characters were built for a weapons-and-stats game. A trait here is an
engine hook keyed by `trait.key` and implemented in `js/game.js`; most of those
hooks are gone or have moved into the skill system. Take the *design* — the
shape of an idea like Bulwark's "bigger hitbox, contact damage" — rather than
the data, which will not load.

Git history has the full context: `git log --follow archive/classic-roster/characters-classic.js`.
