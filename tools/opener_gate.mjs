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
// DOT. A plague opener has no impact packet. One cast must kill a Cedar
// Warden before that opener's cooldown is ready again. The window is the
// plague ticks that land while the cooldown is still up, including the tick
// on the cast frame and excluding the tick that lands after the cooldown has
// already hit zero (statuses run after the fire check). Rank 1 cooldown is
// the base. Plague damage is the whole application, paid as ticks the way
// `tickSkillStatuses` pays them. Attunement scales it. Ferocity does not.
//
//   node tools/opener_gate.mjs

import { TREES, TREES_BY_CLASS, rankCooldown } from '../js/skills.js';
import { stepDamage, rankedDamage, rankedDuration } from '../js/compose.js';
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
const DT = 1 / 60;
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

// How many plague ticks land before the cooldown is ready again.
function dotTicksBeforeReady(cooldownMs) {
  const cd = rankCooldown(cooldownMs, 1) / 1000;
  let remain = cd, ticks = 1;
  while (remain - DT > 1e-9) { remain -= DT; ticks++; }
  return ticks;
}

// One cast. Returns ticks paid and whether `hp` reached 0 inside the window.
function plagueCast(skill, step, attunement, hp) {
  const total = rankedDamage(step.damage, skill, 1) * (1 + attunement / 100);
  const dur = rankedDuration(step.duration, skill, 1) / 1000;
  const dps = total / Math.max(0.1, dur);
  const ticks = dotTicksBeforeReady(skill.cooldown || 0);
  let left = hp, acc = 0, paid = 0;
  for (let i = 0; i < ticks && left > 0; i++) {
    acc += dps * DT;
    if (acc >= 1) {
      const d = Math.floor(acc);
      acc -= d;
      left -= Math.max(1, Math.round(d * map1Mult(skill.domain, 'spiritual')));
      paid++;
    }
  }
  return { dead: left <= 0, left, paid, ticks, total };
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
    const rows = BODIES.map(b => {
      const r = plagueCast(skill, plague, attunement, b.hp);
      return { body: b, packet: null, hits: r.dead ? r.paid : Infinity, kind: 'dot', dead: r.dead, ticks: r.ticks };
    });
    return { rows, ferocity, attunement, rule: 'dot' };
  }
  const rows = BODIES.map(b => ({ body: b, packet: null, hits: Infinity, kind: 'none' }));
  return { rows, ferocity, rule: 'none' };
}

const flags = [];
console.log('OPENER GATE — map 1, rank 1, ×1 from every damage type, no crit, no engine stacks');
console.log('bodies: Thornhound 8, Sapling 9, Cedar Warden 9');
console.log('burst: 2 hits. dot: one cast kills a Cedar Warden before the cooldown is ready\n');

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
        const word = r.dead ? `dead in ${r.hits} payments` : 'alive at cooldown';
        console.log(`  ${r.body.name}\t${r.body.hp}hp\t${pkt}\t${word}${mark}`);
      } else {
        if (r.hits > HIT_CAP) mark = '\tFLAG';
        console.log(`  ${r.body.name}\t${r.body.hp}hp\t${pkt}\thits ${r.hits === Infinity ? 'never' : r.hits}${mark}`);
      }
    }
    if (rule === 'dot') {
      const w = rows.find(r => r.body.id === WARDEN.id);
      if (!w.dead) flags.push(`${sk.name} (${sk.id}) Cedar Warden still up when the cooldown is ready`);
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
