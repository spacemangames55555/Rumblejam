// DOES THE SECOND HOUND ADD A HOUND?
//
// `hun_second_hound` shared `archetype: 'wolf'` with `hun_hound` and declared
// `maxAlive: 1`. The ceiling counts the ARCHETYPE, not the skill, so the first
// hound filled the quota and the second could never add anything: a purchasable
// node that did nothing.
//
// THE LOADOUT IS NOT THE GATE, and the first version of this probe assumed it
// was. A summon declaring `revives: true` is restored at every room start from
// every LEARNED skill — `startRoomMinions` iterates `p.skillRanks`, not
// `p.loadout` — because a persistent summon is a property of owning the node,
// the same way a passive is. Both hounds declare `revives`. So the question this
// probe has to ask is not "what does slotting it do" but "what does OWNING it
// do", and the two runs below differ only in whether the node is bought.
//
//   node tools/second_hound_probe.mjs

import { Sim } from '../js/game.js';
import { SKILL_BY_ID } from '../js/skills.js';
import { spendSkillPoint } from '../js/skillsim.js';

function chainTo(id) {
  const out = [];
  let cur = SKILL_BY_ID[id];
  while (cur) { out.unshift(cur.id); cur = cur.prereq ? SKILL_BY_ID[cur.prereq] : null; }
  return out;
}

function run(upTo, seconds = 20) {
  const g = new Sim({ seed: 909, party: [{ idx: 0, key: 'k', name: 'P', charId: 'toh_hunter', color: '#fff' }] });
  const p = g.players[0];
  p.level = 30;
  for (const id of chainTo(upTo)) { p.skillPoints++; spendSkillPoint(g, p, id); }
  const node = g.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind));
  g._travelTo(node.id);
  let peak = 0;
  for (let i = 0; i < seconds * 60; i++) {
    g.tick(1 / 60);
    const w = (p.minions || []).filter(m => m.arch === 'wolf').length;
    if (w > peak) peak = w;
  }
  return { peak, blocked: p.minionStats ? p.minionStats.dupArchetype : null };
}

console.log('SECOND HOUND — peak simultaneous hounds over 20s, by what the Hunter owns\n');
const a = run('hun_hound');
const b = run('hun_second_hound');
console.log(`  owns Hound only            ${a.peak} hound(s)   (blocked by the archetype ceiling: ${a.blocked})`);
console.log(`  owns Hound + Second Hound  ${b.peak} hound(s)   (blocked: ${b.blocked})`);
const pass = a.peak === 1 && b.peak === 2;
console.log(`\n${pass ? 'PASS — buying Second Hound adds a second hound, and Hound alone still fields one'
  : `FAIL — expected 1 then 2, measured ${a.peak} then ${b.peak}`}`);
process.exit(pass ? 0 : 1);
