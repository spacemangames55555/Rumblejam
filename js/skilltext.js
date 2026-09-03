// THE MECHANICAL LINE — what a skill does, generated from its own definition.
//
// A player choosing where to spend a point has to be able to compare two skills.
// That was impossible: 216 of 420 descriptions carried hand-typed numbers and
// 204 carried none at all, so half the tree was poetry and the other half was
// poetry with stale arithmetic in it. Nothing here is authored. Every figure is
// read off `skill.compose`, `skill.cooldown`, `skill.trigger` and `skill.ranks`
// at the rank being displayed, so it cannot drift when a tuning block moves —
// the same failure that put 154 hardcoded stat names in content files (§13
// rule 12: derive it or it is wrong on the next edit).
//
// CONVENTIONS, chosen once and used everywhere.
//
//   FIRE RATE is stated as a COOLDOWN IN SECONDS, not as activations per
//   second. Two reasons. It is the field the def actually holds, so it is
//   correct by construction and needs no reciprocal; and a per-second figure
//   would imply a sustained rate that the trigger may not permit — a skill on a
//   0.9 s cooldown whose trigger is `PROXIMITY count 4` does not fire 1.1 times
//   a second, and printing that number would be a confident lie. The cooldown
//   is the honest half: it is what the skill costs when it is ready.
//
//   NEXT RANK is shown as `now → next` on every rank-scaled figure, and only on
//   those. A figure that does not move with rank shows one number, so the arrow
//   itself carries information: what the point buys is exactly what changes.
//
//   AN UNLEARNED SKILL (rank 0) displays RANK 1, because rank 0 never fires —
//   `stepDamage` is only ever called with the rank a learned skill holds. What
//   a player wants before spending is what the point buys, which is rank 1.
//
// WHAT IS DELIBERATELY NOT FOLDED IN. `engineScale` and the player's own
// multipliers (`summonMult`, the post-dodge `_atkBuff`, Ingenuity on a minion's
// swing) all scale a step at fire time and all depend on live state. A number
// that moved while a player read it would be worse than one that is stated with
// its conditions, so an engine-scaled step prints its BASE and names the engine
// and the per-point rate beside it.
import { rankedDamage, rankedDuration } from './compose.js';
import { rankCooldown } from './skills.js';
import { scalePerFor } from './enginescale.js';
import { STAT_NAME } from './config.js';

const MS = 1000;                     // structural: step params are milliseconds
const NARROW = Math.PI / 2;          // structural: the right angle that splits narrow from wide

// ---------------------------------------------------------------- vocabulary
//
// THE FIVE NAMES THE BRIEF SPECIFIED, AND THE FOUR IT DID NOT HAVE. Reported
// rather than forced: a `line` is not a narrow cone (it does not widen, and
// what it hits is decided by a rectangle), a persistent ground zone is not a
// shape the caster aims, a contagion picks its own next target, and a summon
// has no geometry at all. Mislabelling any of them would make the description
// worse than terse — it would make it wrong. See docs/skill-descriptions.md.
export const SHAPES = {
  SINGLE: 'single target',
  CONE: 'cone (narrow)',
  FAN: 'fan (wide)',
  MULTI: 'multi-target',
  SHOTGUN: 'shotgun',
  // added by this patch, each because a real skill needs it
  LINE: 'line',                      // 20 skills: a rectangle, not a widening cone
  GROUND: 'ground area',             // 21 skills: trap/hazard, persists where it lands
  CONTAGION: 'contagion',            // 8 skills: spreads target to target on its own
  BEAM: 'beam',                      // `channel`: one locked target, held over time
  NONE: null,                        // heal/shield/ward/summon/shift/form: no enemy geometry
};
export const SHAPE_ADDED = [SHAPES.LINE, SHAPES.GROUND, SHAPES.CONTAGION];

// Shape is read off GEOMETRY, not off the primitive's name. `strike` arcs run
// 1.2–3.0 rad and `cone` angles run 1.1–3.0 — the two primitives overlap almost
// entirely, so keying the word to the primitive would call a 2.9 rad strike a
// cone and a 1.1 rad cone a fan. The angle is the thing a player sees.
export function shapeOfStep(step) {
  switch (step.kind) {
    case 'strike': case 'cone': {
      const a = step.angle ?? step.arc;
      if (a === undefined) return SHAPES.SINGLE;
      return a < NARROW ? SHAPES.CONE : SHAPES.FAN;
    }
    case 'bolt':
      // `step.radius` ON A BOLT IS DEAD DATA. Eighteen bolts declare one and
      // the primitive never reads it — js/compose.js's only `step.radius` uses
      // are trap (:415, :419), hazard (:431, :435) and heal (:451). Reading it
      // here would call eighteen single-target bolts "multi-target" on the
      // strength of a field the sim ignores, which is the misleading-rather-
      // than-terse failure this patch is meant to catch. Reported in
      // docs/skill-descriptions.md; not silently honoured.
      if ((step.count || 1) > 1) return SHAPES.SHOTGUN;
      return step.riders && step.riders.splash ? SHAPES.MULTI : SHAPES.SINGLE;
    case 'drain': return SHAPES.SINGLE;
    case 'line': return SHAPES.LINE;
    case 'trap': case 'hazard': return SHAPES.GROUND;
    case 'plague': return SHAPES.CONTAGION;
    // A CHANNEL IS A BEAM AND NOT A SINGLE TARGET, and the difference is the
    // one the player has to see: the same enemy, held, for as long as it lives
    // and stays in range. `gravity_pull` and `aura` have no enemy geometry of
    // their own — a pull moves bodies and an aura is a field that follows —
    // so they fall through to NONE with the other caster-writing steps.
    case 'channel': return SHAPES.BEAM;
    default: return SHAPES.NONE;     // heal, shield, ward, summon, shift, form
  }
}

// Reach for a step, under whichever name the primitive gave it.
//
// `radius` IS DELIBERATELY NOT A RANGE, and the first version of this treated it
// as one. A summon's `radius` is the minion's BODY, so the Hound read "Range
// 12"; a hazard's `radius` is the size of the puddle, so Blight read "Range
// 120" for a zone it drops at up to its trigger's 260. Both are the misleading
// failure this patch exists to prevent, caught on the first smoke run. Radius is
// reported separately, under its own word.
export function rangeOfStep(step) {
  if (step.range !== undefined) return step.range;
  if (step.reach !== undefined) return step.reach;
  if (step.length !== undefined) return step.length;
  return null;
}

// The size of the thing, where the thing has one. Not every `radius` qualifies:
// a summon's is its hitbox and tells a player nothing.
export function radiusOfStep(step) {
  switch (step.kind) {
    // exactly the three primitives whose `radius` the sim actually reads
    case 'trap': case 'hazard': case 'heal': return step.radius ?? null;
    default: return null;
  }
}

const n1 = v => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));
const secs = ms => `${(ms / MS).toFixed(ms / MS < 1 ? 2 : 1)}s`;

// A PAIR THAT ALWAYS SHOWS ITS DIFFERENCE. The point of `now → next` is to make
// the cost of a point visible, and a fixed precision defeats that whenever the
// step is small: a rank-4 Call Wolf buys 82 ms of cooldown, which renders
// "2.7s → 2.7s" at one decimal and then gets dropped as a no-op arrow. Precision
// rises until the two differ, so the arrow is never a lie by rounding and never
// disappears on a skill whose only rank scaling is its cooldown.
function secsPair(nowMs, nextMs) {
  for (const d of [1, 2, 3]) {
    const a = `${(nowMs / MS).toFixed(nowMs / MS < 1 ? Math.max(2, d) : d)}s`;
    const b = `${(nextMs / MS).toFixed(nowMs / MS < 1 ? Math.max(2, d) : d)}s`;
    if (a !== b) return [a, b];
  }
  const a = secs(nowMs);
  return [a, a];                     // genuinely identical: `field` drops the arrow
}
const pctLess = mult => `${Math.round((1 - mult) * 100)}%`;

// ---------------------------------------------------------------- riders
//
// Magnitude and duration for each, in the rider's own units. A rider with no
// entry here is REPORTED by the gate rather than silently dropped — an unlisted
// rider is a mechanic the player cannot see.
const RIDERS = {
  pierce: v => `passes through ${v} more ${v === 1 ? 'enemy' : 'enemies'}`,
  // The distance is the CASTER'S, not the target's — the only rider that moves
  // the person who cast it.
  carry: v => `you are carried ${v === true ? 'the full length' : `${v}px`} along it`,
  stun: v => `stun ${secs(v)}`,
  root: v => `root ${secs(v)}`,
  taunt: v => `taunt ${secs(v)}`,
  knockback: v => `knockback ${n1(v)}`,
  multiPulse: v => `${v} pulses`,
  windUp: v => `wind-up ${secs(v)}`,
  mend: v => `heal ${n1(v)} per hit`,
  healPerHit: v => `heal ${n1(v)} per hit`,
  slow: v => `slow to ${Math.round(v.mult * 100)}% speed for ${secs(v.dur)}`,
  weakenDamage: v => `target deals ${pctLess(v.mult)} less for ${secs(v.dur)}`,
  weakenDefense: v => `target takes ${Math.round((v.mult - 1) * 100)}% more for ${secs(v.dur)}`,
  defenseDown: v => `target takes ${Math.round((v.mult - 1) * 100)}% more for ${secs(v.dur)}`,
  drench: v => `drench ${v.stacks} (cap ${v.cap}) for ${secs(v.dur)}`,
  sluice: v => `spend drench for ${n1(v.per)} each`,
  mark: v => `mark ${secs(v.dur)}${v.heal ? `, heal ${n1(v.heal)}` : ''}${v.radius ? `, radius ${v.radius}` : ''}`,
  splash: (v, sk, rk) => `splash ${n1(rankedDamage(v.damage, sk, rk))} in radius ${v.radius}`,
  impactDot: (v, sk, rk) => `burn ${n1(rankedDamage(v.damage, sk, rk))} over ${secs(v.dur)}`,
  doll: () => 'binds the voodoo doll',
};
export const RIDER_KINDS = Object.keys(RIDERS);

// ---------------------------------------------------------------- the fields
//
// Returned as structured entries rather than a finished string so the gate can
// assert on `key` and the UI can style `now`/`next` separately. A field carries
// `next` only when rank actually moves it.
function field(key, label, now, next) {
  return next !== undefined && next !== null && next !== now
    ? { key, label, now, next }
    : { key, label, now };
}

// Everything a skill states, in the brief's order:
// damage, fire rate, range, shape, damage over time, riders.
export function mechanics(skill, rank = 1) {
  const rk = Math.max(1, rank | 0);
  const nx = rk + 1;
  const fields = [];
  const warnings = [];
  const steps = skill.compose || [];

  // --- damage, per hit, at this rank ---
  const dmgSteps = steps.filter(s => (s.damage || 0) > 0);
  if (dmgSteps.length) {
    const now = dmgSteps.reduce((a, s) => a + rankedDamage(s.damage, skill, rk), 0);
    const next = dmgSteps.reduce((a, s) => a + rankedDamage(s.damage, skill, nx), 0);
    const per = dmgSteps.some(s => (s.count || 1) > 1 || s.riders?.multiPulse);
    fields.push(field('damage', per ? 'Damage each' : 'Damage', n1(now), n1(next)));
  }
  // heal / absorb are the same question for a support skill
  const amtSteps = steps.filter(s => (s.amount || 0) > 0);
  if (amtSteps.length) {
    const kind = amtSteps[0].kind;
    const label = kind === 'heal' ? 'Heals' : kind === 'ward' ? 'Ward' : 'Absorbs';
    const now = amtSteps.reduce((a, s) => a + rankedDamage(s.amount, skill, rk), 0);
    const next = amtSteps.reduce((a, s) => a + rankedDamage(s.amount, skill, nx), 0);
    fields.push(field('amount', label, n1(now), n1(next)));
  }

  // --- fire rate, as a cooldown in seconds (see the header for why) ---
  if (skill.cooldown) {
    const [a, b] = secsPair(rankCooldown(skill.cooldown, rk), rankCooldown(skill.cooldown, nx));
    fields.push(field('cooldown', 'Cooldown', a, b));
  }

  // --- range ---
  //
  // A step's own reach where it has one; otherwise the trigger's, which is how
  // far a placed thing can be placed. A skill with neither states no range, and
  // the gate reports it rather than inventing one.
  const ranges = steps.map(rangeOfStep).filter(v => v !== null && v !== undefined);
  const t = skill.trigger || {};
  // A PLACED zone reaches as far as its selector looks, and `trap`/`hazard`
  // both compute that as `trigger.radius || trigger.range || step.radius`
  // (js/compose.js:415, :431). Read off the same expression rather than
  // re-derived, so the number cannot disagree with where the zone lands.
  const placed = steps.find(s => s.kind === 'trap' || s.kind === 'hazard');
  const range = ranges.length ? Math.max(...ranges)
    : placed ? (t.radius ?? t.range ?? placed.radius ?? null)
      : (t.range ?? null);
  const radii = steps.map(radiusOfStep).filter(v => v !== null && v !== undefined);
  const radius = radii.length ? Math.max(...radii) : null;
  // A zone whose placement reach and own size are the same number is the common
  // case for a hazard dropped at your feet, and printing "Range 120 · Radius
  // 120" reads like a bug rather than like two facts. One field, both words.
  const same = range !== null && radius !== null && Math.round(range) === Math.round(radius);
  if (range !== null) fields.push(field('range', same ? 'Range / radius' : 'Range', String(Math.round(range))));
  if (radius !== null && !same) fields.push(field('radius', 'Radius', String(Math.round(radius))));

  // --- shape ---
  const shapes = [...new Set(steps.map(shapeOfStep).filter(Boolean))];
  if (shapes.length) fields.push(field('shape', 'Shape', shapes.join(' + ')));

  // --- damage over time: per tick, interval, duration ---
  for (const s of steps) {
    if (s.kind === 'hazard' || s.kind === 'trap') {
      const dur = rankedDuration(s.duration, skill, rk), durN = rankedDuration(s.duration, skill, nx);
      const tick = s.tickMs;
      fields.push(field('dot', 'Over time',
        `${n1(rankedDamage(s.damage, skill, rk))} a tick${tick ? ` every ${secs(tick)}` : ''} for ${secs(dur)}`,
        `${n1(rankedDamage(s.damage, skill, nx))} a tick${tick ? ` every ${secs(tick)}` : ''} for ${secs(durN)}`));
    } else if (s.kind === 'plague') {
      const dur = rankedDuration(s.duration, skill, rk), durN = rankedDuration(s.duration, skill, nx);
      fields.push(field('dot', 'Over time',
        `${n1(rankedDamage(s.damage, skill, rk))} over ${secs(dur)}`,
        `${n1(rankedDamage(s.damage, skill, nx))} over ${secs(durN)}`));
      if (s.spreadRadius) fields.push(field('spread', 'Spreads', `radius ${s.spreadRadius}`));
    } else if ((s.kind === 'shield' || s.kind === 'ward') && s.duration) {
      const dur = rankedDuration(s.duration, skill, rk), durN = rankedDuration(s.duration, skill, nx);
      fields.push(field('duration', 'Lasts', secs(dur), secs(durN)));
      if (s.reflectPct) fields.push(field('reflect', 'Reflects', `${Math.round(s.reflectPct * 100)}%`));
    }
  }

  // --- the rest of what a step does that a player must know ---
  for (const s of steps) {
    if (s.kind === 'drain' && s.healPct) fields.push(field('drain', 'Returns', `${Math.round(s.healPct * 100)}% as health`));
    if (s.kind === 'summon') {
      // A MINION'S HP AND SWING BOTH RIDE THE SKILL'S RANK, and the first
      // version of this printed the raw bases. HP scales through
      // `rankedDuration` rather than `rankedDamage` (js/minions.js:292 — the
      // `duration` increment is what the Druid's depth was tuned against), and
      // the swing goes through `stepDamage` with `m.rank` (js/minions.js:500).
      // Mirrored exactly, so a rank-6 wolf is not advertised as a rank-1 one.
      const hp = rankedDuration(s.hp, skill, rk), hpN = rankedDuration(s.hp, skill, nx);
      fields.push(field('summon', 'Summons',
        `${s.count || 1} ${s.archetype}${s.maxAlive ? ` (max ${s.maxAlive})` : ''}, ${n1(hp)} HP`,
        `${s.count || 1} ${s.archetype}${s.maxAlive ? ` (max ${s.maxAlive})` : ''}, ${n1(hpN)} HP`));
      if (s.attack && s.attack.damage) {
        // `attackCd` is MILLISECONDS — js/minions.js:298 divides it by 1000.
        // Four summons declare it in seconds instead (0.9, 1, 1.1, 1.1 against
        // the other ten's 900-1600), so their minions swing about a thousand
        // times too fast. Rendered as it is stored rather than quietly
        // corrected: a description that hid the anomaly would have made this
        // patch complicit in it. See docs/skill-descriptions.md.
        fields.push(field('summonAttack', 'Its attack',
          `${n1(rankedDamage(s.attack.damage, skill, rk))} every ${secs(s.attackCd)}`,
          `${n1(rankedDamage(s.attack.damage, skill, nx))} every ${secs(s.attackCd)}`));
      }
    }
    if (s.kind === 'shift') fields.push(field('shift', 'Shifts to', String(s.domain)));
    if (s.kind === 'form') {
      fields.push(field('form', 'Form', `${s.form} for ${secs(rankedDuration(s.duration, skill, rk))}`));
    }
    if ((s.count || 1) > 1 && s.kind === 'bolt') fields.push(field('count', 'Projectiles', String(s.count)));
    // an engine-scaled step is stated with its condition rather than folded in
    if (s.scaleWith) {
      fields.push(field('scaling', 'Scales with',
        `${s.scaleWith}, +${(scalePerFor(s) * 100).toFixed(1)}% per point`));
    }
  }

  // --- persistent state: a slotted active that never fires ---
  //
  // `persist` IS THE THIRD DOOR into a player's sheet, beside `compose` and
  // `passive`, and it needs its own reader for the reason the other two have
  // one: nothing in it is a step, so every loop above sees an empty skill and
  // prints nothing. Marrownaut shipped as a blank node at level 3 — a purchase
  // a player was asked to make with no text under it at all.
  //
  // READ OFF `persist`, NOT OFF AN ID. The next persistent active gets its
  // description from this block without anybody remembering to come back, which
  // is the same rule the rest of the file follows: derive it or it is wrong on
  // the next edit.
  //
  // THE ORDER IS THE ORDER THE QUESTIONS ARRIVE IN. What does holding it get me,
  // what does it do to my sheet, what does it do to the room, and what does it
  // cost to keep. The absent fields are the headline for this kind of skill —
  // there is no cooldown and no duration to print — so "holds while slotted" is
  // stated outright rather than left as a gap the player has to notice.
  const q = skill.persist;
  if (q) {
    if (q.shield) {
      // The one figure here that moves with rank. `enterPersistent` runs the
      // declared amount through this same `rankedDamage` at the door, so the
      // number a player reads is the number that lands.
      fields.push(field('amount', 'Absorbs',
        n1(rankedDamage(q.shield.amount, skill, rk)),
        n1(rankedDamage(q.shield.amount, skill, nx))));
    }
    if (q.form) {
      // Stat keys go through STAT_NAME rather than being spelled here — six of
      // these were renamed once already and 154 hardcoded copies had to be
      // found afterwards.
      const st = Object.entries(q.stats || {})
        .map(([k, v]) => `${v > 0 ? '+' : ''}${n1(v)} ${STAT_NAME[k] || k}`);
      fields.push(field('form', 'Form', st.length ? `${q.form} — ${st.join(', ')}` : String(q.form)));
    }
    if (q.aura) {
      const a = q.aura;
      const parts = [`${Math.round(a.radius + (a.radiusPerRank || 0) * (rk - 1))}px around you`];
      // A PULL IS NOT DAMAGE and the description must not imply it is. This
      // field deals nothing by design — that is what keeps a permanent aggro
      // aura on the right side of the statue test — so the text names what it
      // does to enemy attention and stays silent about damage it never deals.
      if (a.taunt) parts.push(`pulls enemies onto you every ${secs(a.pulseMs || 400)}`);
      if (a.damage) parts.push(`${n1(a.damage)} damage every ${secs(a.pulseMs || 400)}`);
      if (a.ampPct) parts.push(`enemies inside take ${Math.round(a.ampPct * 100)}% more damage from you and yours`);
      if (a.slow) parts.push(`slows what it catches to ${Math.round(a.slow.mult * 100)}% for ${secs(a.slow.dur)}`);
      const next = a.radiusPerRank
        ? [`${Math.round(a.radius + a.radiusPerRank * (nx - 1))}px around you`, ...parts.slice(1)].join(', ')
        : undefined;
      fields.push(field('aura', 'Field', parts.join(', '), next));
    }
    if (q.shield && q.shield.scaleWith) {
      fields.push(field('scaling', 'Scales with',
        `${q.shield.scaleWith}, +${(scalePerFor(q.shield) * 100).toFixed(1)}% per point`));
    }
    fields.push(field('holds', 'Holds', 'while slotted — no cooldown, no trigger, no duration'));
  }

  // --- riders ---
  const bits = [];
  for (const s of steps) {
    for (const [k, v] of Object.entries(s.riders || {})) {
      if (!RIDERS[k]) { warnings.push(`rider '${k}' has no description rule`); continue; }
      const text = RIDERS[k](v, skill, rk);
      if (text && !bits.includes(text)) bits.push(text);
    }
  }
  if (bits.length) fields.push(field('riders', 'Also', bits.join('; ')));

  return { rank: rk, nextRank: nx, fields, warnings, shapes };
}

// A single plain string, for anywhere that cannot render structure (the gate's
// own assertions read `fields`, not this).
export function mechanicalLine(skill, rank = 1) {
  const m = mechanics(skill, rank);
  return m.fields
    .map(f => `${f.label} ${f.now}${f.next !== undefined ? ` → ${f.next}` : ''}`)
    .join(' · ');
}

// ---------------------------------------------------------------- passives
//
// Same plain style, from `skill.passive`. Each key states what it does and its
// magnitude; an unlisted key is reported by the gate rather than skipped.
const PASSIVE_TEXT = {
  summonDmg: v => `your summons deal ${n1(v)}% more damage`,
  summonHp: v => `your summons have ${n1(v)}% more health`,
  armorGrit: v => `+${n1(v)} Defense`,
  armorVit: v => `+${n1(v)} max health`,
  footingGritBonus: v => `+${n1(v)} Defense per Footing stack`,
  footingAccrualPct: v => `Footing builds ${Math.round(v * 100)}% faster`,
  reflectPerGrit: v => `reflects ${(v * 100).toFixed(1)}% of blocked damage per Defense`,
  // A FIELD READS AS A FIELD, and the gap is part of what the player is being
  // told. An always-on aura that pulses every few seconds plays nothing like a
  // patch of ground that hurts continuously, and the interval is the difference
  // between them — so it is stated rather than folded into a rate.
  aura: v => {
    const parts = [`a field around you, ${Math.round(v.radius)}px`];
    if (v.damage) parts.push(`${n1(v.damage)} damage every ${(v.pulseMs / 1000).toFixed(1)}s`);
    else if (v.dps) parts.push(`${n1(v.dps)} damage per second`);
    if (v.ampPct) parts.push(`enemies inside take ${Math.round(v.ampPct * 100)}% more damage from you and yours`);
    if (v.slow) parts.push(`slows what it catches to ${Math.round(v.slow.mult * 100)}% for ${(v.slow.dur / 1000).toFixed(1)}s`);
    return parts.join(', ');
  },
};
// Every `<engine>ScaleWeight` reads the same way, so it is derived rather than
// listed fourteen times — a list would be correct until the fifteenth engine.
const SCALE_WEIGHT = /^(.+)ScaleWeight$/;

export function passiveText(skill) {
  const out = [], warnings = [];
  for (const [k, v] of Object.entries(skill.passive || {})) {
    const m = SCALE_WEIGHT.exec(k);
    if (m) {
      out.push(`every ${m[1]} point is worth ${(scalePerFor({ scaleWith: m[1], scaleWeight: v }) * 100).toFixed(1)}% more to skills that read it`);
    } else if (PASSIVE_TEXT[k]) {
      out.push(PASSIVE_TEXT[k](v));
    } else {
      warnings.push(`passive key '${k}' has no description rule`);
    }
  }
  return { text: out.join('; '), warnings };
}
