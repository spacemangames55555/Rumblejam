// Rank-1 opener versus the three map-1 bodies.
//
// Every class, each of its trees, that tree's tier-1 skill. One hit is one
// impact of the opener's first damage step (bolt, strike, cone, line, drain,
// or one channel tick): rank 1, level-1 sheet, engine stacks at 0 so a
// `scaleWith` step contributes ×1, no crit, no items. The packet is the same
// number `skillDamage` hands `damageEnemy` — domain multiplier, then Ferocity,
// then round, minimum 1. Map-1 HP is the live solo figure (Thornhound 8,
// Sapling 9, Cedar Warden 9). A summon's swing is not the opener.
//
// A plague opener has no impact packet. Its `damage` is the whole application,
// paid out as ticks the way `tickSkillStatuses` pays them, and each payment
// that lands is a hit.
//
// Flags any opener that needs more than 2 hits on any of the three bodies.
// Report only: this file does not retune.
//
//   node tools/opener_gate.mjs

import { TREES, TREES_BY_CLASS } from '../js/skills.js';
import { stepDamage, rankedDamage, rankedDuration } from '../js/compose.js';
import { domainMult } from '../js/domains.js';
import { ferocityMult } from '../js/skillsim.js';
import { STAT_BASE } from '../js/config.js';
import { TOH_BY_ID } from '../js/content/characters-toh.js';

const BODIES = [
  { id: 'pnw_thornhound', name: 'Thornhound', hp: 8, domain: 'physical' },
  { id: 'pnw_sapling', name: 'Sapling', hp: 9, domain: 'physical' },
  { id: 'pnw_cedar_warden', name: 'Cedar Warden', hp: 9, domain: 'spiritual' },
];

// One application of `step.damage` lands as one hit. Channel is included
// because each of its ticks is that same packet.
const IMPACT = new Set(['bolt', 'strike', 'cone', 'line', 'drain', 'channel']);
const DT = 1 / 60;
const HIT_CAP = 2;

function sheet(classId) {
  const stats = (TOH_BY_ID[classId] && TOH_BY_ID[classId].stats) || {};
  return {
    ferocity: (STAT_BASE.ferocity || 0) + (stats.ferocity || 0),
    attunement: (STAT_BASE.attunement || 0) + (stats.attunement || 0),
  };
}

// Level-1 caster with nothing banked. `engineScale` reads `engines` and
// returns 1 at 0 stacks; Ferocity is the only sheet term on an impact.
function caster(ferocity) {
  return { stats: { ferocity }, engines: {} };
}

function impactPacket(skill, step, ferocity, defDomain) {
  const raw = stepDamage(step, skill, 1, caster(ferocity));
  const amt = raw * domainMult(skill.domain, defDomain) * ferocityMult(caster(ferocity));
  return Math.max(1, Math.round(amt));
}

function hitsOf(hp, packet) {
  let left = hp, n = 0;
  while (left > 0 && n < 99) { left -= packet; n++; }
  return n;
}

// One plague application, then another if the first expires, matching
// `applyPlague` (damage is the total, Attunement scales it, Ferocity does
// not) and the tick loop (floor the accumulator, then domain, then round).
function plagueHits(skill, step, attunement, body) {
  const total = rankedDamage(step.damage, skill, 1) * (1 + attunement / 100);
  const dur = rankedDuration(step.duration, skill, 1) / 1000;
  const castDps = total / Math.max(0.1, dur);
  const mult = domainMult(skill.domain, body.domain);
  let hp = body.hp, dps = 0, tLeft = 0, acc = 0, hits = 0, casts = 0;
  let guard = 0;
  while (hp > 0 && hits < 400 && guard++ < 200000) {
    if (tLeft <= 0) {
      dps += castDps;
      tLeft = dur;
      casts++;
      if (casts > 6) break;
    }
    tLeft -= DT;
    acc += dps * DT;
    if (acc >= 1) {
      const d = Math.floor(acc);
      acc -= d;
      hp -= Math.max(1, Math.round(d * mult));
      hits++;
    }
    if (tLeft <= 0) { dps = 0; acc = 0; }
  }
  return { hits: hp <= 0 ? hits : Infinity, casts, kind: 'dot' };
}

function score(skill, classId) {
  const { ferocity, attunement } = sheet(classId);
  const step = (skill.compose || []).find(s => IMPACT.has(s.kind) && Number.isFinite(s.damage));
  const rows = [];
  if (step) {
    for (const b of BODIES) {
      const packet = impactPacket(skill, step, ferocity, b.domain);
      rows.push({ body: b, packet, hits: hitsOf(b.hp, packet), kind: step.kind });
    }
    return { step, rows, ferocity };
  }
  const plague = (skill.compose || []).find(s => s.kind === 'plague' && Number.isFinite(s.damage));
  if (plague) {
    for (const b of BODIES) {
      const r = plagueHits(skill, plague, attunement, b);
      rows.push({ body: b, packet: null, hits: r.hits, kind: 'dot', casts: r.casts });
    }
    return { step: plague, rows, ferocity, attunement };
  }
  for (const b of BODIES) rows.push({ body: b, packet: null, hits: Infinity, kind: 'none' });
  return { step: null, rows, ferocity };
}

const flags = [];
console.log('OPENER GATE — rank 1, level-1 Ferocity, no crit, no engine stacks');
console.log('bodies: Thornhound 8 physical, Sapling 9 physical, Cedar Warden 9 spiritual');
console.log('a hit is one impact of the tree\'s tier-1 opener\n');

let openers = 0;
for (const [classId, treeIds] of Object.entries(TREES_BY_CLASS)) {
  for (const tid of treeIds) {
    const tree = TREES[tid];
    const sk = tree.skills.find(s => s.tier === 1);
    if (!sk) {
      flags.push(`${classId} ${tid} has no tier-1 skill`);
      console.log(`FLAG\t${classId}\t${tid}\tno tier-1`);
      continue;
    }
    openers++;
    const { rows, ferocity } = score(sk, classId);
    const over = rows.filter(r => r.hits > HIT_CAP);
    console.log(`${classId}\t${tid}\t${sk.name}\t${sk.id}\t${sk.domain}\tferocity ${ferocity}`);
    for (const r of rows) {
      const pkt = r.packet == null ? r.kind : `${r.kind} ${r.packet}`;
      const mark = r.hits > HIT_CAP ? '\tFLAG' : '';
      console.log(`  ${r.body.name}\t${r.body.hp}hp\t${pkt}\thits ${r.hits === Infinity ? 'never' : r.hits}${mark}`);
    }
    if (over.length) {
      const detail = over.map(r => `${r.body.name} ${r.hits === Infinity ? 'never' : r.hits}`).join(', ');
      flags.push(`${sk.name} (${sk.id}) ${detail}`);
    }
  }
}

console.log('');
if (!flags.length) {
  console.log(`OK\t${openers} openers kill every map-1 body in ${HIT_CAP} hits`);
  process.exit(0);
}
console.log(`FLAG\t${flags.length} opener${flags.length === 1 ? '' : 's'} need more than ${HIT_CAP} hits`);
for (const f of flags) console.log(`  ${f}`);
process.exit(1);
