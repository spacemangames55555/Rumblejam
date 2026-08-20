# The skill taxonomy

Generated. `node tools/skill_taxonomy.mjs --write` regenerates this file from
the skill definitions; nothing in it is hand-sorted or hand-written. Geometry
comes from `shapeOfStep` in `js/skilltext.js`, the same function the skill
cards read, so this document and the game cannot disagree.

**420 skills — 356 active, 64 passive — across 14 classes.**

---

## 1. The variants

### The count is 43.

The hypothesis was "roughly 10 outside of passives". Measured, **356 active skills
occupy 43 mechanically distinct shapes**, where a shape is the combination of
delivery, geometry and targeting.

43 is the honest number, but it flatters the roster: **14 of them hold 278 skills
(78%)** and the remaining 29 hold 78 between them.

**Where you cut changes the number, so all three cuts are given.**

| cut | count |
|---|---|
| delivery + geometry + targeting (the brief's definition) | **43** |
| delivery + geometry — the same move aimed differently counts once | **17** |
| delivery alone | **10** |

Targeting is doing a lot of the multiplication: 17 physical shapes become 43
variants once you count what they aim at. A melee fan exists aimed at the
nearest, the densest crowd, the fattest, the objective and the lowest-health
target — five variants, one swing.

**The hypothesis of "roughly 10" is closest to the middle cut (17), and wrong
for the strictest one (43).**

| # | variant | what it does | skills | classes |
|---|---|---|---|---|
| 1 | **Blast cone** — `instant ranged · fan (wide) → densest crowd` | resolves instantly at range (fan (wide)), aimed at the densest crowd | 52 | 13 |
| 2 | `melee · fan (wide) → objective priority` | a swing around the caster (fan (wide)), aimed at the objective priority | 33 | 11 |
| 3 | **Swing** — `melee · fan (wide) → nearest` | a swing around the caster (fan (wide)), aimed at the nearest | 24 | 11 |
| 4 | **Ward** — `self (absorb + reflect) · no geometry → self` | self (absorb, then reflect) · no geometry, aimed at nobody — it hits the caster | 23 | 12 |
| 5 | **Shield** — `self (absorb) · no geometry → self` | gives the caster an absorb pool for a duration, aimed at nobody — it hits the caster | 21 | 13 |
| 6 | `instant ranged · line → farthest` | resolves instantly at range (line), aimed at the farthest | 19 | 12 |
| 7 | **Ground hazard** — `placed · ground area → densest crowd` | drops a zone that persists where it lands, aimed at the densest crowd | 16 | 11 |
| 8 | `projectile · single target → objective priority` | a travelling shot (single target), aimed at the objective priority | 14 | 9 |
| 9 | `projectile · single target → fattest` | a travelling shot (single target), aimed at the fattest | 14 | 7 |
| 10 | **Bolt** — `projectile · single target → nearest` | a travelling shot (single target), aimed at the nearest | 13 | 8 |
| 11 | **Party heal** — `allies (heal) · no geometry → self` | restores health to the caster and every ally in radius, aimed at nobody — it hits the caster | 13 | 9 |
| 12 | **Cleave** — `melee · fan (wide) → densest crowd` | a swing around the caster (fan (wide)), aimed at the densest crowd | 13 | 5 |
| 13 | **Summon** — `summoned · no geometry → self` | puts a body on the field that fights on its own, aimed at nobody — it hits the caster | 12 | 4 |
| 14 | `instant ranged · single target → nearest` | resolves instantly at range (single target), aimed at the nearest | 11 | 10 |
| 15 | `projectile · single target → execute` | a travelling shot (single target), aimed at the execute | 9 | 7 |
| 16 | **Thrust** — `melee · cone (narrow) → nearest` | a swing around the caster (cone (narrow)), aimed at the nearest | 8 | 6 |
| 17 | `melee · cone (narrow) → objective priority` | a swing around the caster (cone (narrow)), aimed at the objective priority | 6 | 3 |
| 18 | `melee · fan (wide) → fattest` | a swing around the caster (fan (wide)), aimed at the fattest | 5 | 4 |
| 19 | `instant ranged · contagion → densest crowd` | resolves instantly at range (contagion), aimed at the densest crowd | 5 | 2 |
| 20 | **Volley** — `projectile · shotgun → densest crowd` | a travelling shot (shotgun), aimed at the densest crowd | 3 | 3 |
| 21 | `instant ranged · contagion → fattest` | resolves instantly at range (contagion), aimed at the fattest | 3 | 3 |
| 22 | `instant ranged · cone (narrow) → densest crowd` | resolves instantly at range (cone (narrow)), aimed at the densest crowd | 3 | 3 |
| 23 | **Domain shift** — `self (domain shift) · no geometry → self` | changes the caster's damage domain, aimed at nobody — it hits the caster | 3 | 1 |
| 24 | `projectile · shotgun → nearest` | a travelling shot (shotgun), aimed at the nearest | 3 | 2 |
| 25 | `placed · ground area → farthest` | drops a zone that persists where it lands, aimed at the farthest | 3 | 1 |
| 26 | `melee · cone (narrow) → execute` | a swing around the caster (cone (narrow)), aimed at the execute | 3 | 2 |
| 27 | **Form** — `self (form) · no geometry → self` | puts the caster into a form for a duration, aimed at nobody — it hits the caster | 3 | 1 |
| 28 | `projectile · single target → farthest` | a travelling shot (single target), aimed at the farthest | 2 | 2 |
| 29 | `self (absorb + reflect) · no geometry + self (absorb) · no geometry → self` | self (absorb, then reflect) · no geometry, then gives the caster an absorb pool for a duration, aimed at nobody — it hits the caster | 2 | 2 |
| 30 | `instant ranged · cone (narrow) → objective priority` | resolves instantly at range (cone (narrow)), aimed at the objective priority | 2 | 2 |
| 31 | `placed · ground area → objective priority` | drops a zone that persists where it lands, aimed at the objective priority | 2 | 1 |
| 32 | `instant ranged · fan (wide) → objective priority` | resolves instantly at range (fan (wide)), aimed at the objective priority | 2 | 1 |
| 33 | `projectile · multi-target → densest crowd` | a travelling shot (multi-target), aimed at the densest crowd | 1 | 1 |
| 34 | `melee · fan (wide) → execute` | a swing around the caster (fan (wide)), aimed at the execute | 1 | 1 |
| 35 | `projectile · shotgun → fattest` | a travelling shot (shotgun), aimed at the fattest | 1 | 1 |
| 36 | `projectile · single target + summoned · no geometry → objective priority` | a travelling shot (single target), then puts a body on the field that fights on its own, aimed at the objective priority | 1 | 1 |
| 37 | **Beam** — `instant ranged · line → densest crowd` | resolves instantly at range (line), aimed at the densest crowd | 1 | 1 |
| 38 | `instant ranged · single target → fattest` | resolves instantly at range (single target), aimed at the fattest | 1 | 1 |
| 39 | `melee · cone (narrow) → fattest` | a swing around the caster (cone (narrow)), aimed at the fattest | 1 | 1 |
| 40 | `projectile · shotgun → farthest` | a travelling shot (shotgun), aimed at the farthest | 1 | 1 |
| 41 | `projectile · multi-target → farthest` | a travelling shot (multi-target), aimed at the farthest | 1 | 1 |
| 42 | `projectile · shotgun → execute` | a travelling shot (shotgun), aimed at the execute | 1 | 1 |
| 43 | `instant ranged · fan (wide) + summoned · no geometry → densest crowd` | resolves instantly at range (fan (wide)), then puts a body on the field that fights on its own, aimed at the densest crowd | 1 | 1 |

### Variants that exist in exactly one class

This is where mechanical identity actually lives.

| variant | class | skills |
|---|---|---|
| `self (domain shift) · no geometry → self` | Wizard | 3 — Attune: Physical, Attune: Mental, Attune: Spiritual |
| `placed · ground area → farthest` | Assassin | 3 — Caltrops, Tripwire, Pressure Plate |
| `self (form) · no geometry → self` | Blacksmith | 3 — Iron Pyrite, Prism Quartz, Celestial Calcite |
| `placed · ground area → objective priority` | Bard | 2 — Struck Chord, Requiem |
| `instant ranged · fan (wide) → objective priority` | Mage | 2 — Draw Fire, Caustic |
| `projectile · multi-target → densest crowd` | Necromancer | 1 — Dark Matter Bomb |
| `melee · fan (wide) → execute` | Assassin | 1 — Garrote |
| `projectile · shotgun → fattest` | Hunter | 1 — Both Barrels |
| `projectile · single target + summoned · no geometry → objective priority` | Hunter | 1 — Loosed |
| `instant ranged · line → densest crowd` | Hunter | 1 — Raking Shot |
| `instant ranged · single target → fattest` | Savage | 1 — Hooked |
| `melee · cone (narrow) → fattest` | Samurai | 1 — Rising Cut |
| `projectile · shotgun → farthest` | Assassin | 1 — Volley |
| `projectile · multi-target → farthest` | Assassin | 1 — Deadfall |
| `projectile · shotgun → execute` | Assassin | 1 — Ricochet |
| `instant ranged · fan (wide) + summoned · no geometry → densest crowd` | Necromancer | 1 — Army of the Dead |

### Skills that do not fit

Every one of the 356 actives maps onto a delivery and a geometry. Nothing was forced.

**4 skill(s) do two things at once**: `hun_loosed` (bolt+summon), `sam_bulwark` (shield+ward), `necro_marrownaut` (shield+ward), `necro_army_of_the_dead` (summon+cone). They are counted as their own variants rather than filed under either half.

---

## 2. Per class

What a class has, and what it does not. The absences are the identity.

### Blacksmith

25 actives across **13 of 43** variants.

| variant | count |
|---|---|
| **Blast cone** `instant ranged · fan (wide) → densest crowd` | 4 |
| **Form** `self (form) · no geometry → self` — **only this class** | 3 |
| **Cleave** `melee · fan (wide) → densest crowd` | 3 |
| **Ward** `self (absorb + reflect) · no geometry → self` | 3 |
| `melee · fan (wide) → objective priority` | 3 |
| **Thrust** `melee · cone (narrow) → nearest` | 2 |
| `projectile · single target → farthest` | 1 |
| **Party heal** `allies (heal) · no geometry → self` | 1 |
| `instant ranged · contagion → fattest` | 1 |
| **Swing** `melee · fan (wide) → nearest` | 1 |
| `instant ranged · single target → nearest` | 1 |
| `melee · cone (narrow) → objective priority` | 1 |
| **Shield** `self (absorb) · no geometry → self` | 1 |

**No access at all to:**

- delivery — `placed`, `self (domain shift)`, `summoned`
- geometry — `ground area`, `line`, `multi-target`, `shotgun`
- targeting — `execute`

Missing 30 of the 43 full variants (delivery x geometry x targeting).

### Wizard

26 actives across **14 of 43** variants.

| variant | count |
|---|---|
| **Bolt** `projectile · single target → nearest` | 3 |
| **Domain shift** `self (domain shift) · no geometry → self` — **only this class** | 3 |
| `instant ranged · line → farthest` | 3 |
| **Blast cone** `instant ranged · fan (wide) → densest crowd` | 3 |
| **Ward** `self (absorb + reflect) · no geometry → self` | 2 |
| **Ground hazard** `placed · ground area → densest crowd` | 2 |
| **Shield** `self (absorb) · no geometry → self` | 2 |
| `projectile · single target → objective priority` | 2 |
| `instant ranged · cone (narrow) → densest crowd` | 1 |
| `projectile · single target → execute` | 1 |
| **Party heal** `allies (heal) · no geometry → self` | 1 |
| `melee · fan (wide) → fattest` | 1 |
| **Volley** `projectile · shotgun → densest crowd` | 1 |
| `melee · fan (wide) → objective priority` | 1 |

**No access at all to:**

- delivery — `self (form)`, `summoned`
- geometry — `contagion`, `multi-target`
- targeting — *(aims every way there is)*

Missing 29 of the 43 full variants (delivery x geometry x targeting).

### Necromancer

27 actives across **16 of 43** variants.

| variant | count |
|---|---|
| **Blast cone** `instant ranged · fan (wide) → densest crowd` | 4 |
| `projectile · single target → fattest` | 3 |
| **Summon** `summoned · no geometry → self` | 3 |
| `projectile · single target → objective priority` | 2 |
| **Ground hazard** `placed · ground area → densest crowd` | 2 |
| `projectile · single target → execute` | 2 |
| `instant ranged · line → farthest` | 2 |
| **Volley** `projectile · shotgun → densest crowd` | 1 |
| `instant ranged · contagion → fattest` | 1 |
| `instant ranged · cone (narrow) → densest crowd` | 1 |
| `projectile · multi-target → densest crowd` — **only this class** | 1 |
| **Thrust** `melee · cone (narrow) → nearest` | 1 |
| **Ward** `self (absorb + reflect) · no geometry → self` | 1 |
| `self (absorb + reflect) · no geometry + self (absorb) · no geometry → self` | 1 |
| **Bolt** `projectile · single target → nearest` | 1 |
| `instant ranged · fan (wide) + summoned · no geometry → densest crowd` — **only this class** | 1 |

**No access at all to:**

- delivery — `allies (heal)`, `self (domain shift)`, `self (form)`
- geometry — *(has every geometry)*
- targeting — *(aims every way there is)*

Missing 27 of the 43 full variants (delivery x geometry x targeting).

### Druid

23 actives across **11 of 43** variants.

| variant | count |
|---|---|
| `melee · fan (wide) → objective priority` | 7 |
| **Blast cone** `instant ranged · fan (wide) → densest crowd` | 3 |
| **Summon** `summoned · no geometry → self` | 3 |
| **Ground hazard** `placed · ground area → densest crowd` | 2 |
| **Ward** `self (absorb + reflect) · no geometry → self` | 2 |
| `instant ranged · cone (narrow) → densest crowd` | 1 |
| **Thrust** `melee · cone (narrow) → nearest` | 1 |
| `melee · fan (wide) → fattest` | 1 |
| **Party heal** `allies (heal) · no geometry → self` | 1 |
| `instant ranged · line → farthest` | 1 |
| **Shield** `self (absorb) · no geometry → self` | 1 |

**No access at all to:**

- delivery — `projectile`, `self (domain shift)`, `self (form)`
- geometry — `contagion`, `multi-target`, `shotgun`, `single target`
- targeting — `execute`

Missing 32 of the 43 full variants (delivery x geometry x targeting).

### Mage

26 actives across **15 of 43** variants.

| variant | count |
|---|---|
| **Swing** `melee · fan (wide) → nearest` | 3 |
| **Shield** `self (absorb) · no geometry → self` | 3 |
| **Cleave** `melee · fan (wide) → densest crowd` | 3 |
| `melee · fan (wide) → fattest` | 2 |
| **Blast cone** `instant ranged · fan (wide) → densest crowd` | 2 |
| **Ward** `self (absorb + reflect) · no geometry → self` | 2 |
| `projectile · single target → objective priority` | 2 |
| `instant ranged · fan (wide) → objective priority` — **only this class** | 2 |
| **Bolt** `projectile · single target → nearest` | 1 |
| **Ground hazard** `placed · ground area → densest crowd` | 1 |
| `projectile · single target → fattest` | 1 |
| `instant ranged · single target → nearest` | 1 |
| `instant ranged · line → farthest` | 1 |
| **Volley** `projectile · shotgun → densest crowd` | 1 |
| `melee · fan (wide) → objective priority` | 1 |

**No access at all to:**

- delivery — `allies (heal)`, `self (domain shift)`, `self (form)`, `summoned`
- geometry — `cone (narrow)`, `contagion`, `multi-target`
- targeting — `execute`

Missing 28 of the 43 full variants (delivery x geometry x targeting).

### Bard

26 actives across **16 of 43** variants.

| variant | count |
|---|---|
| **Blast cone** `instant ranged · fan (wide) → densest crowd` | 5 |
| `melee · fan (wide) → objective priority` | 3 |
| **Swing** `melee · fan (wide) → nearest` | 2 |
| `projectile · shotgun → nearest` | 2 |
| `instant ranged · line → farthest` | 2 |
| `placed · ground area → objective priority` — **only this class** | 2 |
| **Bolt** `projectile · single target → nearest` | 1 |
| **Thrust** `melee · cone (narrow) → nearest` | 1 |
| **Party heal** `allies (heal) · no geometry → self` | 1 |
| **Shield** `self (absorb) · no geometry → self` | 1 |
| `projectile · single target → fattest` | 1 |
| `instant ranged · single target → nearest` | 1 |
| **Ground hazard** `placed · ground area → densest crowd` | 1 |
| **Ward** `self (absorb + reflect) · no geometry → self` | 1 |
| `projectile · single target → objective priority` | 1 |
| `instant ranged · cone (narrow) → objective priority` | 1 |

**No access at all to:**

- delivery — `self (domain shift)`, `self (form)`, `summoned`
- geometry — `contagion`, `multi-target`
- targeting — `execute`

Missing 27 of the 43 full variants (delivery x geometry x targeting).

### Witch Doctor

26 actives across **13 of 43** variants.

| variant | count |
|---|---|
| **Blast cone** `instant ranged · fan (wide) → densest crowd` | 4 |
| `instant ranged · contagion → densest crowd` | 4 |
| **Summon** `summoned · no geometry → self` | 3 |
| **Swing** `melee · fan (wide) → nearest` | 2 |
| `projectile · single target → fattest` | 2 |
| **Bolt** `projectile · single target → nearest` | 2 |
| **Shield** `self (absorb) · no geometry → self` | 2 |
| **Ground hazard** `placed · ground area → densest crowd` | 2 |
| `instant ranged · line → farthest` | 1 |
| `projectile · single target → execute` | 1 |
| `instant ranged · single target → nearest` | 1 |
| **Ward** `self (absorb + reflect) · no geometry → self` | 1 |
| `projectile · single target → objective priority` | 1 |

**No access at all to:**

- delivery — `allies (heal)`, `self (domain shift)`, `self (form)`
- geometry — `cone (narrow)`, `multi-target`, `shotgun`
- targeting — *(aims every way there is)*

Missing 30 of the 43 full variants (delivery x geometry x targeting).

### Samurai

23 actives across **10 of 43** variants.

| variant | count |
|---|---|
| `melee · fan (wide) → objective priority` | 6 |
| `melee · cone (narrow) → objective priority` | 4 |
| **Cleave** `melee · fan (wide) → densest crowd` | 3 |
| **Shield** `self (absorb) · no geometry → self` | 2 |
| **Swing** `melee · fan (wide) → nearest` | 2 |
| `melee · cone (narrow) → execute` | 2 |
| **Ward** `self (absorb + reflect) · no geometry → self` | 1 |
| `self (absorb + reflect) · no geometry + self (absorb) · no geometry → self` | 1 |
| `melee · cone (narrow) → fattest` — **only this class** | 1 |
| `instant ranged · cone (narrow) → objective priority` | 1 |

**No access at all to:**

- delivery — `allies (heal)`, `placed`, `projectile`, `self (domain shift)`, `self (form)`, `summoned`
- geometry — `contagion`, `ground area`, `line`, `multi-target`, `shotgun`, `single target`
- targeting — `farthest`

Missing 33 of the 43 full variants (delivery x geometry x targeting).

### Monk

25 actives across **12 of 43** variants.

| variant | count |
|---|---|
| **Party heal** `allies (heal) · no geometry → self` | 4 |
| **Blast cone** `instant ranged · fan (wide) → densest crowd` | 4 |
| **Swing** `melee · fan (wide) → nearest` | 3 |
| **Ward** `self (absorb + reflect) · no geometry → self` | 3 |
| **Cleave** `melee · fan (wide) → densest crowd` | 2 |
| **Ground hazard** `placed · ground area → densest crowd` | 2 |
| `melee · fan (wide) → objective priority` | 2 |
| **Thrust** `melee · cone (narrow) → nearest` | 1 |
| `instant ranged · line → farthest` | 1 |
| `instant ranged · single target → nearest` | 1 |
| `melee · cone (narrow) → objective priority` | 1 |
| **Shield** `self (absorb) · no geometry → self` | 1 |

**No access at all to:**

- delivery — `projectile`, `self (domain shift)`, `self (form)`, `summoned`
- geometry — `contagion`, `multi-target`, `shotgun`
- targeting — `execute`, `fattest`

Missing 31 of the 43 full variants (delivery x geometry x targeting).

### Assassin

26 actives across **16 of 43** variants.

| variant | count |
|---|---|
| **Swing** `melee · fan (wide) → nearest` | 3 |
| `placed · ground area → farthest` — **only this class** | 3 |
| `projectile · single target → fattest` | 3 |
| **Bolt** `projectile · single target → nearest` | 2 |
| **Shield** `self (absorb) · no geometry → self` | 2 |
| `projectile · single target → execute` | 2 |
| `projectile · single target → objective priority` | 2 |
| `melee · fan (wide) → execute` — **only this class** | 1 |
| `instant ranged · line → farthest` | 1 |
| **Blast cone** `instant ranged · fan (wide) → densest crowd` | 1 |
| `instant ranged · single target → nearest` | 1 |
| **Ground hazard** `placed · ground area → densest crowd` | 1 |
| `projectile · single target → farthest` | 1 |
| `projectile · shotgun → farthest` — **only this class** | 1 |
| `projectile · multi-target → farthest` — **only this class** | 1 |
| `projectile · shotgun → execute` — **only this class** | 1 |

**No access at all to:**

- delivery — `allies (heal)`, `self (absorb + reflect)`, `self (domain shift)`, `self (form)`, `summoned`
- geometry — `cone (narrow)`, `contagion`
- targeting — *(aims every way there is)*

Missing 27 of the 43 full variants (delivery x geometry x targeting).

### Priest

26 actives across **13 of 43** variants.

| variant | count |
|---|---|
| **Blast cone** `instant ranged · fan (wide) → densest crowd` | 6 |
| **Ward** `self (absorb + reflect) · no geometry → self` | 3 |
| **Swing** `melee · fan (wide) → nearest` | 2 |
| `projectile · single target → fattest` | 2 |
| `instant ranged · line → farthest` | 2 |
| **Party heal** `allies (heal) · no geometry → self` | 2 |
| **Shield** `self (absorb) · no geometry → self` | 2 |
| `melee · fan (wide) → objective priority` | 2 |
| `melee · fan (wide) → fattest` | 1 |
| `projectile · single target → execute` | 1 |
| `instant ranged · single target → nearest` | 1 |
| **Ground hazard** `placed · ground area → densest crowd` | 1 |
| `projectile · single target → objective priority` | 1 |

**No access at all to:**

- delivery — `self (domain shift)`, `self (form)`, `summoned`
- geometry — `cone (narrow)`, `contagion`, `multi-target`, `shotgun`
- targeting — *(aims every way there is)*

Missing 30 of the 43 full variants (delivery x geometry x targeting).

### Savage

25 actives across **15 of 43** variants.

| variant | count |
|---|---|
| **Blast cone** `instant ranged · fan (wide) → densest crowd` | 4 |
| **Ward** `self (absorb + reflect) · no geometry → self` | 3 |
| `melee · fan (wide) → objective priority` | 3 |
| **Thrust** `melee · cone (narrow) → nearest` | 2 |
| `instant ranged · single target → nearest` | 2 |
| **Cleave** `melee · fan (wide) → densest crowd` | 2 |
| `melee · cone (narrow) → execute` | 1 |
| `instant ranged · line → farthest` | 1 |
| **Swing** `melee · fan (wide) → nearest` | 1 |
| **Party heal** `allies (heal) · no geometry → self` | 1 |
| `instant ranged · single target → fattest` — **only this class** | 1 |
| `instant ranged · contagion → fattest` | 1 |
| `projectile · single target → execute` | 1 |
| **Shield** `self (absorb) · no geometry → self` | 1 |
| **Ground hazard** `placed · ground area → densest crowd` | 1 |

**No access at all to:**

- delivery — `self (domain shift)`, `self (form)`, `summoned`
- geometry — `multi-target`, `shotgun`
- targeting — *(aims every way there is)*

Missing 28 of the 43 full variants (delivery x geometry x targeting).

### Hunter

26 actives across **16 of 43** variants.

| variant | count |
|---|---|
| **Blast cone** `instant ranged · fan (wide) → densest crowd` | 5 |
| **Summon** `summoned · no geometry → self` | 3 |
| **Bolt** `projectile · single target → nearest` | 2 |
| `instant ranged · line → farthest` | 2 |
| **Swing** `melee · fan (wide) → nearest` | 2 |
| `melee · fan (wide) → objective priority` | 2 |
| `projectile · shotgun → nearest` | 1 |
| **Shield** `self (absorb) · no geometry → self` | 1 |
| `projectile · single target → execute` | 1 |
| `projectile · shotgun → fattest` — **only this class** | 1 |
| **Party heal** `allies (heal) · no geometry → self` | 1 |
| **Ward** `self (absorb + reflect) · no geometry → self` | 1 |
| `instant ranged · single target → nearest` | 1 |
| `projectile · single target + summoned · no geometry → objective priority` — **only this class** | 1 |
| **Beam** `instant ranged · line → densest crowd` — **only this class** | 1 |
| `projectile · single target → objective priority` | 1 |

**No access at all to:**

- delivery — `placed`, `self (domain shift)`, `self (form)`
- geometry — `cone (narrow)`, `contagion`, `ground area`, `multi-target`
- targeting — *(aims every way there is)*

Missing 27 of the 43 full variants (delivery x geometry x targeting).

### Sundian

26 actives across **12 of 43** variants.

| variant | count |
|---|---|
| **Blast cone** `instant ranged · fan (wide) → densest crowd` | 7 |
| **Swing** `melee · fan (wide) → nearest` | 3 |
| `melee · fan (wide) → objective priority` | 3 |
| `instant ranged · line → farthest` | 2 |
| `projectile · single target → fattest` | 2 |
| **Shield** `self (absorb) · no geometry → self` | 2 |
| `projectile · single target → objective priority` | 2 |
| **Bolt** `projectile · single target → nearest` | 1 |
| **Ground hazard** `placed · ground area → densest crowd` | 1 |
| **Party heal** `allies (heal) · no geometry → self` | 1 |
| `instant ranged · contagion → densest crowd` | 1 |
| `instant ranged · single target → nearest` | 1 |

**No access at all to:**

- delivery — `self (absorb + reflect)`, `self (domain shift)`, `self (form)`, `summoned`
- geometry — `cone (narrow)`, `multi-target`, `shotgun`
- targeting — `execute`

Missing 31 of the 43 full variants (delivery x geometry x targeting).

---

## 3. Differentiation, answered honestly

For every variant that more than one class has: what actually differs.

**The comparison is WITHIN TIER, across classes, and the first version of
this was wrong to skip that.** Comparing every skill of a shape against every
other mixes tier progression into the answer: a tier-1 and a tier-10 swing
differ by 8x because one is ten tiers deeper, which says nothing about whether
two CLASSES differ. So for each variant, at each tier where two or more classes
own a skill, the spread across those classes is measured, and the variant is
reported by the median of those per-tier spreads.

DPS is `damage / cooldown` at rank 1 — the number a player feels, since a 2x
damage skill on a 2x cooldown is the same skill. A variant is *effectively the
same skill in every class* when the median cross-class DPS spread is under
x1.35 and the classes carry the same rider kinds.

| variant | classes | tiers compared | median cross-class DPS spread | rider sets / skills | verdict |
|---|---|---|---|---|---|
| **Blast cone** `instant ranged · fan (wide) → densest crowd` | 13 | 6 | x3.73 | 13 / 52 | differs |
| `melee · fan (wide) → objective priority` | 11 | 4 | x1.93 | 13 / 33 | differs |
| **Swing** `melee · fan (wide) → nearest` | 11 | 4 | x2.08 | 7 / 24 | differs |
| **Ward** `self (absorb + reflect) · no geometry → self` | 12 | 3 | x1.95 | 1 / 23 | differs |
| **Shield** `self (absorb) · no geometry → self` | 13 | 2 | x3.75 | 1 / 21 | differs |
| `instant ranged · line → farthest` | 12 | 5 | x2.05 | 8 / 19 | differs |
| **Ground hazard** `placed · ground area → densest crowd` | 11 | 4 | x6.12 | 2 / 16 | differs |
| `projectile · single target → objective priority` | 9 | 2 | x1.65 | 6 / 14 | differs |
| `projectile · single target → fattest` | 7 | 3 | x1.19 | 10 / 14 | differs |
| **Bolt** `projectile · single target → nearest` | 8 | 2 | x2.75 | 2 / 13 | differs |
| **Party heal** `allies (heal) · no geometry → self` | 9 | 4 | x1.99 | 1 / 13 | differs |
| **Cleave** `melee · fan (wide) → densest crowd` | 5 | 3 | x2.25 | 5 / 13 | differs |
| **Summon** `summoned · no geometry → self` | 4 | 0 | — | 1 / 12 | differs |
| `instant ranged · single target → nearest` | 10 | 2 | x1.99 | 1 / 11 | differs |
| `projectile · single target → execute` | 7 | 3 | x1.17 | 4 / 9 | differs |
| **Thrust** `melee · cone (narrow) → nearest` | 6 | 1 | x3.07 | 2 / 8 | differs |
| `melee · cone (narrow) → objective priority` | 3 | 1 | x1.22 | 2 / 6 | differs |
| `melee · fan (wide) → fattest` | 4 | 1 | x1.21 | 4 / 5 | differs |
| `instant ranged · contagion → densest crowd` | 2 | 0 | — | 1 / 5 | differs |
| **Volley** `projectile · shotgun → densest crowd` | 3 | 0 | — | 2 / 3 | differs |
| `instant ranged · contagion → fattest` | 3 | 1 | x1.84 | 1 / 3 | differs |
| `instant ranged · cone (narrow) → densest crowd` | 3 | 1 | x2.73 | 1 / 3 | differs |
| `projectile · shotgun → nearest` | 2 | 0 | — | 1 / 3 | differs |
| `melee · cone (narrow) → execute` | 2 | 0 | — | 2 / 3 | differs |
| `projectile · single target → farthest` | 2 | 0 | — | 2 / 2 | differs |
| `self (absorb + reflect) · no geometry + self (absorb) · no geometry → self` | 2 | 1 | x1.03 | 1 / 2 | **effectively the same skill** |
| `instant ranged · cone (narrow) → objective priority` | 2 | 1 | x1.32 | 1 / 2 | **effectively the same skill** |

**25 of 27 shared variants differ across classes; 2 do not.**

### The number this section exists to produce

Across every same-tier, same-shape, cross-class comparison in the game
(54 of them), the DPS spread between classes is:

| 25th | median | 75th | 90th | max |
|---|---|---|---|---|
| x1.21 | x1.85 | x2.75 | x4.00 | x7.89 |

**20 of 54 (37%) of those comparisons are within x1.35** — two classes
owning the same shape at the same tier, with damage-per-second close enough
that a player would not feel the difference from the numbers alone.

Across the whole roster, **155 of 356 actives (44%) carry at least one rider**
and 201 carry none — those are damage and a shape and nothing else.

---

## 4. Riders and effects

| rider | skills | classes | magnitude (min → max) | what it does |
|---|---|---|---|---|
| `slow` | 29 | 14 | 800 → 2600 | cuts movement speed for a duration |
| `knockback` | 24 | 12 | 150 → 420 | shoves it away |
| `multiPulse` | 21 | 13 | 2 → 3 | the skill lands more than once per fire |
| `stun` | 18 | 13 | 600 → 900 | stops the target dead |
| `weakenDamage` | 12 | 7 | 2000 → 3200 | the target deals less |
| `root` | 12 | 10 | 1100 → 7000 | pins it in place, still able to act |
| `drench` | 12 | 1 | 9000 → 9000 | stacks a mark the class spends later |
| `mark` | 9 | 1 | 6000 → 10000 | flags a target for the class engine |
| `taunt` | 8 | 6 | 1400 → 3200 | forces it to target the caster |
| `weakenDefense` | 7 | 6 | 2400 → 3200 | the target takes more |
| `impactDot` | 5 | 4 | 1600 → 3000 | burns over time on impact |
| `sluice` | 5 | 1 | 3 → 11 | spends drench stacks as a burst |
| `healPerHit` | 4 | 3 | 4 → 6 | heals the caster per hit |
| `mend` | 4 | 1 | 4 → 16 | heals the caster per hit |
| `splash` | 2 | 2 | 12 → 14 | damages around the impact |
| `defenseDown` | 1 | 1 | 2500 → 2500 | the target takes more |
| `doll` | 1 | 1 | 0 → 0 | binds the voodoo doll |
| `windUp` | 1 | 1 | 400 → 400 | delays the hit |

### Riders per class

| class | actives with a rider | distinct rider kinds | which |
|---|---|---|---|
| Blacksmith | 7/25 | 5 | knockback, multiPulse, slow, stun, taunt |
| Wizard | 7/26 | 6 | impactDot, multiPulse, slow, stun, weakenDamage, weakenDefense |
| Necromancer | 14/27 | 10 | defenseDown, impactDot, knockback, multiPulse, root, slow, splash, stun, taunt, weakenDamage |
| Druid | 11/23 | 5 | knockback, mend, multiPulse, slow, stun |
| Mage | 14/26 | 9 | impactDot, knockback, multiPulse, root, slow, stun, taunt, weakenDamage, weakenDefense |
| Bard | 12/26 | 7 | healPerHit, knockback, multiPulse, root, slow, stun, weakenDamage |
| Witch Doctor | 9/26 | 8 | doll, healPerHit, knockback, root, slow, stun, weakenDamage, weakenDefense |
| Samurai | 12/23 | 6 | knockback, multiPulse, slow, stun, weakenDefense, windUp |
| Monk | 8/25 | 6 | knockback, multiPulse, root, slow, stun, taunt |
| Assassin | 11/26 | 7 | impactDot, multiPulse, root, slow, splash, stun, weakenDefense |
| Priest | 14/26 | 7 | healPerHit, knockback, mark, multiPulse, root, slow, weakenDamage |
| Savage | 9/25 | 6 | knockback, multiPulse, root, slow, stun, taunt |
| Hunter | 8/26 | 7 | knockback, multiPulse, root, slow, stun, taunt, weakenDamage |
| Sundian | 19/26 | 8 | drench, knockback, multiPulse, root, slow, sluice, stun, weakenDefense |

---

## 5. Passives

**64 passives across 6 distinct shapes.**

| passive shape | keys | skills | classes | what it hooks |
|---|---|---|---|---|
| `engine scaling (<engine>ScaleWeight)` | 14 | 53 | 13 | raises what one point of a class engine is worth to every skill that reads it |
| `armorGrit` | 1 | 5 | 4 | flat Defense |
| `footingAccrualPct` | 1 | 4 | 1 | Footing builds faster |
| `armorVit` | 1 | 3 | 2 | flat max health |
| `footingGritBonus` | 1 | 1 | 1 | Defense per Footing stack |
| `reflectPerGrit` | 1 | 1 | 1 | reflects a share of blocked damage, scaled by Defense |

**53 of 64 passives (83%) are the same passive**: a weight on the class's
own engine. They differ by which engine and by how heavy, and by nothing else.

| class | passives | shapes |
|---|---|---|
| Blacksmith | 5 | engine scaling, armorGrit |
| Wizard | 4 | engine scaling |
| Necromancer | 3 | armorGrit, armorVit, reflectPerGrit |
| Druid | 7 | engine scaling, armorGrit, armorVit |
| Mage | 4 | engine scaling |
| Bard | 4 | engine scaling |
| Witch Doctor | 4 | engine scaling |
| Samurai | 7 | footingAccrualPct, footingGritBonus, engine scaling |
| Monk | 5 | engine scaling |
| Assassin | 4 | engine scaling |
| Priest | 4 | engine scaling |
| Savage | 5 | engine scaling, armorGrit |
| Hunter | 4 | engine scaling |
| Sundian | 4 | engine scaling |

---

## 6. Role support

Whether the skill set can carry a tank or a healer, or whether every class is
a damage dealer with different decoration.

| class | self absorb | ALLY heal | taunt | enemy-weaken | armor passives | hard/soft control |
|---|---|---|---|---|---|---|
| Blacksmith | 4 | 1 | 1 | 0 | 1 | 3 |
| Wizard | 4 | 1 | — | 2 | — | 2 |
| Necromancer | 2 | — | 1 | 3 | 3 | 5 |
| Druid | 3 | 1 | — | 0 | 1 | 3 |
| Mage | 5 | — | 3 | 2 | — | 6 |
| Bard | 2 | 1 | — | 2 | — | 6 |
| Witch Doctor | 3 | — | — | 1 | — | 4 |
| Samurai | 4 | — | — | 0 | 2 | 4 |
| Monk | 4 | 4 | 1 | 0 | — | 4 |
| Assassin | 2 | — | — | 0 | — | 6 |
| Priest | 5 | 2 | — | 1 | — | 2 |
| Savage | 4 | 1 | 1 | 0 | 2 | 4 |
| Hunter | 2 | 1 | 1 | 1 | — | 4 |
| Sundian | 2 | 1 | — | 0 | — | 6 |

### What the table says

**Protecting another player: there is exactly one mechanism, and it is healing.**
`shield` and `ward` write `p.shield` and `p.ward` — the CASTER's, always
(`js/compose.js`). No skill in the game applies absorb, mitigation or a
defensive buff to anybody else. `heal` is the sole exception: it loops
`sim.livePlayers()` inside a radius, so it reaches allies.

- **Ally healing** exists in 9 class(es): Blacksmith, Wizard, Druid, Bard, Monk, Priest, Savage, Hunter, Sundian.
- **Taunt** exists in 6 class(es): Blacksmith, Necromancer, Mage, Monk, Savage, Hunter. It is real — `taunt` sets
  `e.tauntT`/`e.tauntIdx` and `sim.tauntTarget` is re-read every frame by enemy
  AI (`js/entities/enemies.js:121`, `js/telegraphs.js:80`), so enemy targeting
  **can** be influenced.
- **Armor passives** exist in 5 class(es): Blacksmith, Necromancer, Druid, Samurai, Savage — and they buff the caster only.

### Is ally healing meaningful?

The magnitudes, at rank 1, against a measured target: net incoming on a
level-82 character in a region-8 room runs **3.7-8.9 HP/s**
(`docs/power-curve-phase2-measurement.md` §8).

| skill | class | heals | cooldown | HP/s | radius |
|---|---|---|---|---|---|
| Solace | Priest | 22 | 2.5s | **8.8** | 140 |
| Gathering | Monk | 26 | 3.0s | **8.7** | 210 |
| Mend the Seam | Blacksmith | 26 | 3.4s | **7.6** | — |
| Quiet the Body | Monk | 30 | 7.4s | **4.1** | — |
| Second Wind | Savage | 24 | 6.8s | **3.5** | — |
| Mend | Monk | 18 | 5.2s | **3.5** | — |
| Gathering Breath | Monk | 12 | 4.2s | **2.9** | — |
| Intercession | Priest | 14 | 5.0s | **2.8** | — |
| Feed the Pack | Hunter | 15 | 5.4s | **2.8** | — |
| Refrain | Bard | 15 | 5.6s | **2.7** | — |
| Arcane Recovery | Wizard | 16 | 6.0s | **2.7** | — |
| Brine Draught | Sundian | 14 | 5.6s | **2.5** | — |
| Rejuvenate | Druid | 16 | 9.0s | **1.8** | 260 |

**4 of 13 party heals out-pace the LOW end of one player's incoming on their own
and 0 out-pace the high end** — for ONE ally, before the healer's own damage taken.
**10 of 13 party heals declare no radius, and the range check does not
survive that.** `js/compose.js` guards with
`if (dx*dx + dy*dy > step.radius * step.radius) continue;` — with `radius`
undefined the right-hand side is `NaN`, every `>` against `NaN` is false, and
the `continue` never fires. Those ten heal **every living player at unlimited
range**:

- `smith_mend_the_seam` (Blacksmith) — 7.6 HP/s, whole party, any distance
- `monk_quiet_the_body` (Monk) — 4.1 HP/s, whole party, any distance
- `sav_second_wind` (Savage) — 3.5 HP/s, whole party, any distance
- `monk_mend` (Monk) — 3.5 HP/s, whole party, any distance
- `monk_gathering_breath` (Monk) — 2.9 HP/s, whole party, any distance
- `pri_intercession` (Priest) — 2.8 HP/s, whole party, any distance
- `hun_feed_the_pack` (Hunter) — 2.8 HP/s, whole party, any distance
- `bard_refrain` (Bard) — 2.7 HP/s, whole party, any distance
- `wiz_arcane_recovery` (Wizard) — 2.7 HP/s, whole party, any distance
- `sun_brine_draught` (Sundian) — 2.5 HP/s, whole party, any distance

Only three are actually radius-limited: Solace (140), Gathering (210), Rejuvenate (260).
So the positioning cost that ought to be the healer's expression is real for
three skills and absent from ten. Reported, not changed — this is a document.

### Can this support distinct party roles?

**Healer: yes, weakly. Tank: half of one. Everything else: no.**

- **Healer is real.** Ally healing exists, it reaches everyone in a radius, and
  at the top of the table it out-paces a single player's incoming. 9 classes have
  it, which makes it a common tool rather than a role — the Monk has four and
  the Priest two, and those two are the only ones with enough to build around.
- **Tank is half-built.** Taunt works and enemy AI honours it every frame, so a
  class CAN take the hits meant for someone else. But there is **no way to
  protect anyone**: every absorb, ward and armor passive in the game applies to
  the caster. A tank can attract damage and cannot mitigate it for the party,
  which is half a role.
- **Everything else is decoration.** Every class has 2-5 self-absorbs and 2-6
  control skills. Defensive tools are UNIVERSAL, so they do not distinguish
  anybody; they are baseline survivability wearing different names.

The honest summary: **the roster is fourteen damage dealers, nine of which can
also heal and six of which can also pull aggro.** The party-role vocabulary the
design wants — someone who holds the line so someone else can stand still —
needs one mechanic that does not exist: **a defensive effect applied to another
player.** `shield` and `ward` already take an amount, a duration and a target;
what they do not take is anybody but the caster.

