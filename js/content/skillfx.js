// Skill-fire presentation. Purely cosmetic: nothing here is read by the sim,
// the snapshot, or the wire. The renderer looks a skill id up and decides
// WHAT to draw; the primitives still decide WHAT HIT.
//
// 18 shapes (the alphabet) × 14 class materials × a tree accent. A spectator
// should read shape first (what happened), material second (which class),
// accent third (which tree). Skills that share all three may share a drawing.

import { SKILL_BY_ID, TREES } from '../skills.js';

export const SHAPE = {
  slash: 'slash',
  cleave: 'cleave',
  thrust: 'thrust',
  bolt: 'bolt',
  spread: 'spread',
  beam: 'beam',
  smite: 'smite',
  shockwave: 'shockwave',
  puddle: 'puddle',
  ring: 'ring',
  corridor: 'corridor',
  trap: 'trap',
  detonate: 'detonate',
  tether: 'tether',
  blight: 'blight',
  summonBurst: 'summonBurst',
  healPulse: 'healPulse',
  wardShell: 'wardShell',
};

// How the renderer treats a shape. `arc`/`beam` ride the existing geometry
// channels (now with a real arc width). Everything else is spawned from
// skillFires so a fire is shown as a fire even when its primitive emits
// nothing of its own.
export const SHAPE_ROLE = {
  slash: 'arc',
  cleave: 'arc',
  thrust: 'arc',
  bolt: 'bolt',
  spread: 'bolt',
  beam: 'beam',
  smite: 'cast',
  shockwave: 'cast',
  puddle: 'zone',
  ring: 'cast',
  corridor: 'beam',
  trap: 'cast',
  detonate: 'cast',
  tether: 'cast',
  blight: 'cast',
  summonBurst: 'cast',
  healPulse: 'cast',
  wardShell: 'cast',
};

export const SHAPE_DUR = {
  slash: 0.34,
  cleave: 0.38,
  thrust: 0.28,
  bolt: 0.20,        // muzzle only; the bolt itself is the entity
  spread: 0.22,
  beam: 0.42,
  smite: 0.45,
  shockwave: 0.50,
  puddle: 0.40,      // spawn pop; the zone persists on its own
  ring: 0.48,
  corridor: 0.42,
  trap: 0.40,
  detonate: 0.45,
  tether: 0.40,
  blight: 0.50,
  summonBurst: 0.45,
  healPulse: 0.50,
  wardShell: 0.55,
};

const FAN = Math.PI / 2;     // 1.57 — skilltext's fan/cone split
const WIDE = 2.2;            // a committed sweep
const STAB = 1.25;           // a thrust, not a cut

export const CLASS_KITS = {
  toh_samurai:      { fill: '#e8dcc8', edge: '#0d0706', accent: '#c0392b', core: '#fff6e8', particle: 'shard' },
  toh_wizard:       { fill: '#c4b5fd', edge: '#12081c', accent: '#fb923c', core: '#f5f3ff', particle: 'spark' },
  toh_savage:       { fill: '#7a1f1f', edge: '#140404', accent: '#ff5d3a', core: '#ffb4a2', particle: 'blood' },
  toh_monk:         { fill: '#e8c547', edge: '#1a1404', accent: '#f5f0d8', core: '#fff8d0', particle: 'dust' },
  toh_blacksmith:   { fill: '#ffab4f', edge: '#1a0c04', accent: '#7dd3fc', core: '#ffe0b0', particle: 'spark' },
  toh_assassin:     { fill: '#5b5678', edge: '#08080f', accent: '#a3e635', core: '#c4c1d6', particle: 'glint' },
  toh_hunter:       { fill: '#c4a574', edge: '#1a1208', accent: '#f59e0b', core: '#fde8c8', particle: 'fletch' },
  toh_mage:         { fill: '#67e8f9', edge: '#04141a', accent: '#312e81', core: '#e0faff', particle: 'crystal' },
  toh_priest:       { fill: '#f5e6a3', edge: '#1a1408', accent: '#fafafa', core: '#fffbeb', particle: 'ray' },
  toh_bard:         { fill: '#fb7185', edge: '#1a0810', accent: '#fde047', core: '#ffe4e6', particle: 'note' },
  toh_necromancer:  { fill: '#4d7c0f', edge: '#0a1004', accent: '#a3e635', core: '#d9f99d', particle: 'bone' },
  toh_witch_doctor: { fill: '#3f6212', edge: '#0c1408', accent: '#c4b5fd', core: '#bbf7d0', particle: 'thread' },
  toh_sundian:      { fill: '#2dd4bf', edge: '#04201c', accent: '#f0fdfa', core: '#ccfbf1', particle: 'spray' },
  toh_druid:        { fill: '#4d7c0f', edge: '#0a1404', accent: '#a3e635', core: '#ecfccb', particle: 'leaf' },
};

export const TREE_ACCENT = {
  samurai_tactics:  '#c0392b',
  samurai_agility:  '#2ec4b6',
  samurai_armor:    '#d4a017',
  wizard_arcana:    '#fb923c',
  wizard_attunement:'#c4b5fd',
  wizard_dissonance:'#5eead4',
  sav_primal_fury:  '#ff5d3a',
  sav_bloodbound:   '#7a1f1f',
  sav_aftermath:    '#fb923c',
  monk_chi:         '#e8c547',
  monk_empty_hand:  '#f5f0d8',
  monk_stonegarden: '#a8a29e',
  smith_forge:      '#ffab4f',
  smith_crystal:    '#7dd3fc',
  smith_anvil:      '#d4a017',
  asn_killbox:      '#a3e635',
  asn_shadow:       '#7c6a9a',
  asn_range:        '#94a3b8',
  hun_longshot:     '#f59e0b',
  hun_houndmaster:  '#c4a574',
  hun_pincer:       '#fb923c',
  mage_crystalblade:'#67e8f9',
  mage_collapse:    '#312e81',
  mage_refraction:  '#818cf8',
  priest_judgment:  '#f5e6a3',
  priest_grace:     '#fafafa',
  priest_reckoning: '#f59e0b',
  bard_cadence:     '#fde047',
  bard_ensemble:    '#fb7185',
  bard_requiem:     '#c084fc',
  necro_dark_matter:'#a3e635',
  necro_marrow:     '#4d7c0f',
  necro_summons:    '#d9f99d',
  wd_blight:        '#3f6212',
  wd_effigy:        '#c4b5fd',
  wd_swarm:         '#bbf7d0',
  sun_reef:         '#2dd4bf',
  sun_tidewrack:    '#5eead4',
  sun_undertow:     '#0e7490',
  druid_beasts:     '#a3e635',
  druid_wildkin:    '#4d7c0f',
  druid_restoration:'#86efac',
};

const CLASS_SHORT = {
  toh_samurai: 'sam', toh_wizard: 'wiz', toh_savage: 'sav', toh_monk: 'mnk',
  toh_blacksmith: 'smt', toh_assassin: 'asn', toh_hunter: 'hun', toh_mage: 'mag',
  toh_priest: 'pri', toh_bard: 'brd', toh_necromancer: 'ncr', toh_witch_doctor: 'wd',
  toh_sundian: 'sun', toh_druid: 'dru',
};

const DOMAIN_BOLT = {
  physical:  '#e85d2a',
  mental:    '#5b8fd9',
  spiritual: '#c084fc',
};

const FALLBACK_KIT = { fill: '#d0d4e8', edge: '#0c0d13', accent: '#ffffff', core: '#ffffff', particle: 'spark' };

export function classifyShape(skill) {
  if (!skill || skill.type === 'passive') return null;
  const step = (skill.compose || []).find(s => s && s.kind) || (skill.compose || [])[0];
  if (!step) return null;
  const kind = step.kind;
  if (kind === 'strike') {
    const arc = step.arc || 1.5;
    const reach = step.reach || 0;
    if (arc >= WIDE) return SHAPE.cleave;
    if (arc <= STAB && reach >= 115) return SHAPE.thrust;
    return SHAPE.slash;
  }
  if (kind === 'cone') {
    const ang = step.angle || step.arc || FAN;
    return ang >= FAN ? SHAPE.cleave : SHAPE.slash;
  }
  if (kind === 'bolt') return (step.count || 1) > 1 ? SHAPE.spread : SHAPE.bolt;
  if (kind === 'line') return SHAPE.beam;
  if (kind === 'hazard') return SHAPE.puddle;
  if (kind === 'trap') return SHAPE.trap;
  if (kind === 'heal') return SHAPE.healPulse;
  if (kind === 'shield' || kind === 'ward') return SHAPE.wardShell;
  if (kind === 'drain') return SHAPE.tether;
  if (kind === 'plague') return SHAPE.blight;
  if (kind === 'summon') return SHAPE.summonBurst;
  if (kind === 'shift') return SHAPE.shockwave;
  if (kind === 'form') return SHAPE.wardShell;
  if (kind === 'channel') return SHAPE.beam;
  if (kind === 'gravity_pull') return SHAPE.ring;
  if (kind === 'aura') return SHAPE.ring;
  return SHAPE.smite;
}

// CACHED, BECAUSE THIS IS CALLED FROM TWO PER-FRAME LOOPS. The renderer's
// projectile pass looks a spec up for every bolt it draws, and `viewFromSim`
// does it again for the same bolt when it builds the frame's view — so an
// uncached `fxSpec` allocated a fresh fifteen-field object twice per
// projectile per frame. Measured at 297 ns and one object per call: 36,000
// objects a second at 300 live projectiles, for a pure function of a skill id
// over a catalog that cannot change at runtime.
//
// The returned spec is therefore SHARED and frozen. Nothing reads it as
// anything but presentation constants today, and a caller that starts writing
// to one would otherwise be scribbling on every other holder of the same skill.
const SPEC_CACHE = new Map();

export function fxSpec(skillOrId) {
  const skill = typeof skillOrId === 'string' ? SKILL_BY_ID[skillOrId] : skillOrId;
  if (!skill) return null;
  // Keyed on the id rather than the object: both call shapes must land on the
  // same entry, or the cache would miss for half the callers and quietly hold
  // two specs for one skill.
  const key = skill.id;
  if (key !== undefined && SPEC_CACHE.has(key)) return SPEC_CACHE.get(key);
  const spec = buildSpec(skill);
  if (key !== undefined) SPEC_CACHE.set(key, spec);
  return spec;
}

function buildSpec(skill) {
  const shape = classifyShape(skill);
  if (!shape) return null;
  const tree = TREES[skill.tree];
  const classId = tree ? tree.classId : null;
  const kit = (classId && CLASS_KITS[classId]) || FALLBACK_KIT;
  const accent = TREE_ACCENT[skill.tree] || kit.accent;
  const short = CLASS_SHORT[classId] || 'fx';
  const boltColor = DOMAIN_BOLT[skill.domain] || accent;
  return Object.freeze({
    skillId: skill.id,
    classId,
    tree: skill.tree,
    domain: skill.domain,
    shape,
    role: SHAPE_ROLE[shape] || 'cast',
    dur: SHAPE_DUR[shape] || 0.35,
    kit,
    accent,
    color: accent,
    boltColor,
    spriteId: `fx.${short}_${shape}`,
    reach: ((skill.compose || [])[0] || {}).reach
      || ((skill.compose || [])[0] || {}).range
      || ((skill.compose || [])[0] || {}).length
      || ((skill.trigger || {}).range)
      || ((skill.trigger || {}).radius)
      || 80,
    arc: ((skill.compose || [])[0] || {}).arc
      || ((skill.compose || [])[0] || {}).angle
      || 1.5,
    width: ((skill.compose || [])[0] || {}).width || 10,
  });
}

// Sprite ids we actually author files for. Missing files fall back to the
// canvas drawing — same contract as every other sprite. Built from the live
// catalog so a new class×shape cannot be forgotten.
export const SKILL_FX_SPRITE_IDS = (() => {
  const ids = new Set([
    'fx.impact', 'fx.muzzle',
    'fx.sam_thrust', 'fx.sam_smite', 'fx.sam_shockwave', 'fx.wiz_smite',
  ]);
  for (const sk of Object.values(SKILL_BY_ID)) {
    const spec = fxSpec(sk);
    if (spec && spec.spriteId) ids.add(spec.spriteId);
  }
  return [...ids].sort();
})();
