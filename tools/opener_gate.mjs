// Rank-1 opener versus the three map-1 bodies.
//
// MAP 1 IS NEUTRAL. Enemies there take ×1 from every damage type
// (`onboardingDomainNeutral`). This gate scores that room, so the triangle's
// ×0.80 and ×1.25 are not applied. Level-1 Ferocity, engine stacks at 0, no
// crit. A hit is one impact of the opener's first damage step. A summon's
// swing is not the opener.
//
// HORDE PACE (user ruling 2 Nov 2026, pace-spec.md §5). The bodies are no
// longer hard-coded: they are map 1's live table (`_onboardingTable()` on a
// real map-1 Sim, maxHp after every multiplier) and each body's role comes
// from the roster (`enemyRole`).
//
// BURST. ONE hit must kill every map-1 FODDER body, and at most FOUR hits the
// map-1 special (the Cedar Warden). The packet is what `damageEnemy`
// subtracts: rank 1, then round, minimum 1. (Was: two hits for every body, at
// 8 / 9 / 9 HP — the slow game's trickle.)
//
// DOT. A plague opener has no impact packet. One cast's total damage over
// its full duration must be at least the toughest map-1 FODDER body. Kill speed
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

import { Sim } from '../js/game.js';
import { isOnboardingNode } from '../js/arenas.js';
import { enemyRole } from '../js/content/regions-enemies.js';

// Map 1's live bodies: a solo Standard Sim enters the onboarding node and
// spawns one of each id in its table. maxHp is the number damageEnemy fights.
const BODIES = (() => {
  const g = new Sim({ seed: 777, regionIndex: 1, party: [{ idx: 0, key: 'k', name: 'P', charId: 'toh_samurai', color: '#fff' }] });
  const p = g.players[0];
  if (p.openingOffer) g.uiAction(0, { kind: 'opening', id: p.openingOffer[0].id });
  const starts = g.reachableNodes();
  g._travelTo(starts.find(id => isOnboardingNode(1, g.floor.nodes[id])) ?? starts[0]);
  return g._onboardingTable().map(id => {
    const e = g.spawnEnemyById(id, g.W / 2, g.H / 2);
    const role = enemyRole(e.def);
    return { id, name: e.def.name, hp: Math.round(e.maxHp * 100) / 100, domain: e.def.domain, role, cap: role === 'fodder' ? 1 : 4 };
  });
})();
const FODDER = BODIES.filter(b => b.role === 'fodder');
// The plague rule's body: the toughest fodder (a plague cast clears fodder).
const WARDEN = FODDER.reduce((a, b) => (b.hp > a.hp ? b : a), FODDER[0]);

const IMPACT = new Set(['bolt', 'strike', 'cone', 'line', 'drain', 'channel']);

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
console.log(`bodies (live map-1 maxHp): ${BODIES.map(b => `${b.name} ${b.hp} [${b.role}, ≤${b.cap} hit${b.cap > 1 ? 's' : ''}]`).join(', ')}`);
console.log(`burst: fodder 1 hit, special ≤4. dot: one cast's full-duration total is at least a ${WARDEN.name}'s ${WARDEN.hp} HP\n`);

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
        if (r.hits > r.body.cap) mark = '\tFLAG';
        console.log(`  ${r.body.name}\t${r.body.hp}hp\t${pkt}\thits ${r.hits === Infinity ? 'never' : r.hits}${mark}`);
      }
    }
    if (rule === 'dot') {
      const w = rows.find(r => r.body.id === WARDEN.id);
      if (!w.dead) flags.push(`${sk.name} (${sk.id}) full-duration total ${w.total.toFixed(1)} is under a ${WARDEN.name}'s ${WARDEN.hp}`);
    } else {
      const over = rows.filter(r => r.hits > r.body.cap);
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
