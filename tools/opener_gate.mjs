// Rank-1 opener versus the three map-1 bodies.
//
// MAP 1 IS NEUTRAL. Enemies there take ×1 from every damage type
// (`onboardingDomainNeutral`). This gate scores that room, so the triangle's
// ×0.80 and ×1.25 are not applied. Level-1 Ferocity, engine stacks at 0, no
// crit. A hit is one impact of the opener's first damage step. A summon's
// swing is not the opener.
//
// BURST. Two hits must kill every map-1 body. The packet is what
// `damageEnemy` subtracts: rank 1, then round, minimum 1.
//
// DOT. A plague opener has no impact packet. One cast's total damage over
// its full duration must be at least a Cedar Warden's map-1 HP. Kill speed
// does not matter: the check is the application (`rankedDamage` at rank 1,
// times Attunement), not the ticks that land before the cooldown is ready.
// Ferocity does not scale a plague. Map 1 multiplies by 1.
//
//   node tools/opener_gate.mjs

import { TREES, TREES_BY_CLASS } from '../js/skills.js';
import { stepDamage, rankedDamage } from '../js/compose.js';
import { ferocityMult } from '../js/skillsim.js';
import { STAT_BASE } from '../js/config.js';
import { TOH_BY_ID } from '../js/content/characters-toh.js';

const BODIES = [
  { id: 'pnw_thornhound', name: 'Thornhound', hp: 8, domain: 'physical' },
  { id: 'pnw_sapling', name: 'Sapling', hp: 9, domain: 'physical' },
  { id: 'pnw_cedar_warden', name: 'Cedar Warden', hp: 9, domain: 'spiritual' },
];
const WARDEN = BODIES[2];

const IMPACT = new Set(['bolt', 'strike', 'cone', 'line', 'drain', 'channel']);
const HIT_CAP = 2;

function sheet(classId) {
  const stats = (TOH_BY_ID[classId] && TOH_BY_ID[classId].stats) || {};
  return {
    ferocity: (STAT_BASE.ferocity || 0) + (stats.ferocity || 0),
    attunement: (STAT_BASE.attunement || 0) + (stats.attunement || 0),
  };
}

function caster(ferocity) {
  return { stats: { ferocity }, engines: {} };
}

// Map 1 multiplier is 1 for every matchup. The argument stays so a reader
// can see the domain was considered and then dropped.
function map1Mult(_atk, _def) { return 1; }

function impactPacket(skill, step, ferocity, defDomain) {
  const raw = stepDamage(step, skill, 1, caster(ferocity));
  const amt = raw * map1Mult(skill.domain, defDomain) * ferocityMult(caster(ferocity));
  return Math.max(1, Math.round(amt));
}

function hitsOf(hp, packet) {
  let left = hp, n = 0;
  while (left > 0 && n < 99) { left -= packet; n++; }
  return n;
}

// The whole application, at rank 1. This is what `applyPlague` stores and
// then pays out across the duration. Attunement scales it. The map-1
// multiplier is 1, so a disadvantage matchup does not shrink the total.
function plagueTotal(skill, step, attunement) {
  const raw = rankedDamage(step.damage, skill, 1) * (1 + attunement / 100);
  return raw * map1Mult(skill.domain, WARDEN.domain);
}

function score(skill, classId) {
  const { ferocity, attunement } = sheet(classId);
  const step = (skill.compose || []).find(s => IMPACT.has(s.kind) && Number.isFinite(s.damage));
  if (step) {
    const rows = BODIES.map(b => {
      const packet = impactPacket(skill, step, ferocity, b.domain);
      return { body: b, packet, hits: hitsOf(b.hp, packet), kind: step.kind };
    });
    return { rows, ferocity, rule: 'burst' };
  }
  const plague = (skill.compose || []).find(s => s.kind === 'plague' && Number.isFinite(s.damage));
  if (plague) {
    const total = plagueTotal(skill, plague, attunement);
    const rows = BODIES.map(b => ({
      body: b, packet: null, total, kind: 'dot',
      dead: total + 1e-9 >= b.hp,
    }));
    return { rows, ferocity, attunement, rule: 'dot' };
  }
  const rows = BODIES.map(b => ({ body: b, packet: null, hits: Infinity, kind: 'none' }));
  return { rows, ferocity, rule: 'none' };
}

const flags = [];
console.log('OPENER GATE — map 1, rank 1, ×1 from every damage type, no crit, no engine stacks');
console.log('bodies: Thornhound 8, Sapling 9, Cedar Warden 9');
console.log('burst: 2 hits. dot: one cast\'s full-duration total is at least a Cedar Warden\'s 9 HP\n');

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
    const { rows, ferocity, rule } = score(sk, classId);
    console.log(`${classId}\t${tid}\t${sk.name}\t${sk.id}\t${sk.domain}\tferocity ${ferocity}\t${rule}`);
    for (const r of rows) {
      const pkt = r.packet == null ? r.kind : `${r.kind} ${r.packet}`;
      let mark = '';
      if (rule === 'dot') {
        if (r.body.id === WARDEN.id && !r.dead) mark = '\tFLAG';
        const word = r.dead ? 'covers' : 'short';
        console.log(`  ${r.body.name}\t${r.body.hp}hp\ttotal ${r.total.toFixed(1)}\t${word}${mark}`);
      } else {
        if (r.hits > HIT_CAP) mark = '\tFLAG';
        console.log(`  ${r.body.name}\t${r.body.hp}hp\t${pkt}\thits ${r.hits === Infinity ? 'never' : r.hits}${mark}`);
      }
    }
    if (rule === 'dot') {
      const w = rows.find(r => r.body.id === WARDEN.id);
      if (!w.dead) flags.push(`${sk.name} (${sk.id}) full-duration total ${w.total.toFixed(1)} is under a Cedar Warden's ${WARDEN.hp}`);
    } else {
      const over = rows.filter(r => r.hits > HIT_CAP);
      if (over.length) flags.push(`${sk.name} (${sk.id}) ${over.map(r => `${r.body.name} ${r.hits === Infinity ? 'never' : r.hits}`).join(', ')}`);
    }
  }
}

console.log('');
if (!flags.length) {
  console.log(`OK\t${openers} openers pass the map-1 rule`);
  process.exit(0);
}
console.log(`FLAG\t${flags.length} opener${flags.length === 1 ? '' : 's'}`);
for (const f of flags) console.log(`  ${f}`);
process.exit(1);
