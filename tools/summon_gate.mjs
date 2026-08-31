// THE SUMMON GATE — do a class's summons coexist, or do they crowd each other?
//
//   node tools/summon_gate.mjs
//
// WHAT IT CATCHES, because this shipped: `necro_unleash_the_monster` declared
// `slotted: true`, and `slotsFilled()` counts every slotted minion regardless
// of archetype. `summonSlots` is minted by exactly ONE skill in the game — the
// skeleton, at 1 per rank — so the Monster spent a currency it does not mint.
// At skeleton rank 1 that made the two MUTUALLY EXCLUSIVE IN BOTH DIRECTIONS,
// and which one lost depended on which fired first: the skeleton triggers on
// ON_TOKEN and the Monster on COOLDOWN_READY. A symptom that swaps sides
// between runs is the kind a playtester reports as two different bugs.
//
// SO BOTH ORDERS ARE ASSERTED. Testing one would have passed on the shipped
// build half the time.
//
// It also asserts the SYSTEM rule the fix rests on — that the slot pool is
// skeletons-only — because the defect was not a wrong number, it was a second
// skill quietly joining a pool sized for one.

import { FixtureSim } from './fixture_sim.mjs';
import { spawnMinions, slotsFilled, summonSlotsFor } from '../js/minions.js';
import { SKILL_BY_ID, ALL_SKILLS } from '../js/skills.js';

let failures = 0;
const ok = m => console.log(`✓ ${m}`);
const fail = m => { failures++; console.error(`✗ ${m}`); };

const SKEL = 'necro_summon_skeleton', MON = 'necro_unleash_the_monster';
const stepOf = id => SKILL_BY_ID[id].compose[0];

function summoner(charId, ranks) {
  const sim = new FixtureSim({ seed: 5, regionIndex: 1, allowUnplayable: true,
    party: [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }] });
  const p = sim.players[0];
  p.minions.length = 0;
  p.skillRanks = { ...ranks };
  p.summonSlots = summonSlotsFor(p, p.skillRanks, SKILL_BY_ID);
  return { sim, p };
}
const countBy = p => p.minions.reduce((a, m) => (a[m.arch] = (a[m.arch] || 0) + 1, a), {});
const cast = (sim, p, id, rank, times = 1) => {
  for (let i = 0; i < times; i++) spawnMinions(sim, p, SKILL_BY_ID[id], stepOf(id), rank);
};

// ---- 1. BOTH ORDERS at skeleton rank 1, which is where the pool is tightest --
for (const [label, order] of [['monster first', [MON, SKEL]], ['skeletons first', [SKEL, MON]]]) {
  const { sim, p } = summoner('toh_necromancer', { [SKEL]: 1, [MON]: 1 });
  for (const id of order) cast(sim, p, id, 1, id === SKEL ? 4 : 1);
  const c = countBy(p);
  if (c.golem >= 1 && c.skeleton >= 1) {
    ok(`${label}: the Monster and a skeleton stand together at skeleton rank 1 — ${JSON.stringify(c)}`);
  } else {
    fail(`${label}: they are mutually exclusive at skeleton rank 1 — ${JSON.stringify(c)} `
      + `(slots ${slotsFilled(p)}/${p.summonSlots}, ${p.minionStats.noSlot} refused for no slot)`);
  }
}

// ---- 2. the Monster costs no slot, at any rank -----------------------------
{
  const bad = [];
  for (const rank of [1, 2, 3, 5]) {
    const a = summoner('toh_necromancer', { [SKEL]: rank, [MON]: 1 });
    cast(a.sim, a.p, SKEL, rank, 12);
    const skelAlone = countBy(a.p).skeleton || 0;

    const b = summoner('toh_necromancer', { [SKEL]: rank, [MON]: 1 });
    cast(b.sim, b.p, MON, 1);
    cast(b.sim, b.p, SKEL, rank, 12);
    const skelWithMon = countBy(b.p).skeleton || 0;
    if (skelAlone !== skelWithMon) bad.push(`rank ${rank}: ${skelAlone} alone vs ${skelWithMon} with the Monster`);
  }
  if (bad.length) fail(`the Monster still costs skeletons — ${bad.join('; ')}`);
  else ok('the Monster costs no skeleton at ranks 1, 2, 3 and 5 — the standing pack is the same either way');
}

// ---- 3. ...and its own cap of 1 still holds --------------------------------
{
  const { sim, p } = summoner('toh_necromancer', { [SKEL]: 3, [MON]: 1 });
  cast(sim, p, MON, 1, 5);
  const n = countBy(p).golem || 0;
  if (n === 1) ok('the Monster is still capped at one — a pet, not a swarm (5 casts, 1 standing)');
  else fail(`the Monster's own cap broke: ${n} standing after 5 casts, want 1`);
}

// ---- 4. skeletons still scale with rank ------------------------------------
{
  const got = [1, 2, 3, 5].map(r => {
    const { sim, p } = summoner('toh_necromancer', { [SKEL]: r, [MON]: 1 });
    cast(sim, p, SKEL, r, 12);
    return countBy(p).skeleton || 0;
  });
  if (JSON.stringify(got) === JSON.stringify([1, 2, 3, 5])) {
    ok(`the skeleton pack is still exactly its rank: ranks 1/2/3/5 field ${got.join('/')}`);
  } else {
    fail(`skeleton capacity no longer tracks rank: ranks 1/2/3/5 field ${got.join('/')}, want 1/2/3/5`);
  }
}

// ---- 5. THE SYSTEM RULE: the slot pool is skeletons-only -------------------
// The defect was a second skill joining a pool sized for one, so the invariant
// is asserted directly rather than left to the two cases above.
{
  const minters = ALL_SKILLS.filter(sk => sk.rankGrants === 'summonSlots').map(sk => sk.id);
  const drawers = ALL_SKILLS.filter(sk => (sk.compose || []).some(st => st.kind === 'summon' && st.slotted)).map(sk => sk.id);
  if (minters.length === 1 && drawers.length === 1 && minters[0] === drawers[0]) {
    ok(`the slot pool is minted and drawn by the same single skill (${minters[0]}) — nothing else can spend it`);
  } else {
    fail(`the summon-slot pool is minted by [${minters.join(', ')}] and drawn by [${drawers.join(', ')}] — `
      + 'a skill that spends slots it does not mint takes capacity from the one that does, which is exactly '
      + 'how the Monster crowded out every skeleton');
  }
}

// ---- 6. THE CONTROL: the Druid uses a different mechanism and still works ---
// If this fails alongside the others the problem is the harness, not the class.
{
  const ids = ALL_SKILLS.filter(sk => sk.id.startsWith('druid_') && (sk.compose || []).some(st => st.kind === 'summon')).map(sk => sk.id);
  const { sim, p } = summoner('toh_druid', Object.fromEntries(ids.map(i => [i, 1])));
  for (const id of ids) cast(sim, p, id, 1, 3);
  const c = countBy(p);
  const kinds = Object.keys(c).length;
  if (kinds === ids.length && Object.values(c).every(v => v === 1)) {
    ok(`the Druid's ${kinds} animals still coexist, one of each — ${JSON.stringify(c)} (per-archetype caps, no slot pool)`);
  } else {
    fail(`the Druid's pack is wrong: ${JSON.stringify(c)} from ${ids.length} summon skill(s)`);
  }
}

console.log(failures ? `\n${failures} SUMMON GATE FAILURE(S)` : '\nA CLASS\'S SUMMONS STAND TOGETHER');
process.exit(failures ? 1 : 0);
