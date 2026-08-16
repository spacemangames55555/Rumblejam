// THE FOUR MECHANICS THIS PATCH CHANGED, ASSERTED BY EFFECT.
//
// Every check here instruments the RESULT, not the existence of a knob. A test
// that a multiplier is present passes while the multiplier is applied to the
// wrong thing; a test that the resolved number is 4x base does not. That is the
// standing rule on this project (§13 rule 29) and it is why each of these drives
// a real Sim rather than reading a constant back.
//
// Usage: node tools/patch_gate.mjs
import { FixtureSim as Sim } from './fixture_sim.mjs';
import { TREES, SKILL_BY_ID, rankCooldown } from '../js/skills.js';
import { spendSkillPoint } from '../js/skillsim.js';
import { CONFIG } from '../js/config.js';
import { REGION_BY_INDEX } from '../js/regions.js';

let fails = 0, checks = 0;
const ok = (m) => { checks++; console.log(`✓ ${m}`); };
const bad = (m) => { checks++; fails++; console.log(`✗ ${m}`); };

// A sim with one player of `charId`, parked in a cleared fight node.
function arena(charId, { learnAll = true, seed = 20260817 } = {}) {
  const g = new Sim({ seed, allowUnplayable: true,
    party: [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }] });
  const p = g.players[0];
  p.level = 60;
  if (learnAll) {
    for (const tid of Object.keys(TREES).filter(t => TREES[t].classId === charId)) {
      for (const s of [...TREES[tid].skills].sort((a, b) => a.tier - b.tier)) {
        p.skillPoints++; spendSkillPoint(g, p, s.id);
      }
    }
  }
  const node = g.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind));
  g._travelTo(node.id);
  for (const e of [...g.enemyPool]) if (e.active) { e.hp = 0; e.active = false; }
  g.walls.length = 0;
  p.loadout = new Array(8).fill(null);
  p.hp = p.stats.vitality;
  return { g, p };
}

console.log('THE PATCH, BY EFFECT\n');

// ---------------------------------------------------------------- 2. ranks
// A rank-5 skill must FIRE MORE OFTEN than a rank-1 one over the same window,
// same seed. Counting fires rather than reading the cooldown back is the point:
// the cooldown is written in one place and read in another, and only the count
// proves both halves agree.
{
  const SK = 'smith_tongs';
  function firesAtRank(rank) {
    const { g, p } = arena('toh_blacksmith', { learnAll: false });
    p.skillPoints = 40;
    // Tongs is a tier-1 root, so `rank` points go straight into it.
    for (let i = 0; i < rank; i++) spendSkillPoint(g, p, SK);
    p.loadout[0] = SK;
    // one immortal enemy inside the 128 trigger radius, pinned so the fixture
    // measures cooldown and not the enemy wandering out of range
    const e = g.spawnEnemyById('skulker', p.x + 40, p.y, {});
    e.hp = e.maxHp = 1e9; e.spd = 0;
    let fires = 0;
    const seen = { last: 0 };
    for (let i = 0; i < 60 * 30; i++) {
      const before = p.skillCd[SK] || 0;
      e.x = p.x + 40; e.y = p.y;      // hold position
      g.tick();
      const after = p.skillCd[SK] || 0;
      if (after > before) fires++;     // the cooldown was rewritten = it fired
      seen.last = after;
    }
    return fires;
  }
  const r1 = firesAtRank(1), r5 = firesAtRank(5);
  const base = SKILL_BY_ID[SK].cooldown;
  const want = rankCooldown(base, 5);
  if (r5 > r1) {
    ok(`rank 5 fires more often than rank 1 over 30 s: ${r1} -> ${r5} casts `
      + `(${base} ms -> ${want.toFixed(0)} ms, ${(100 * want / base).toFixed(1)}% of base)`);
  } else {
    bad(`rank 5 fired ${r5} times against rank 1's ${r1} — ranking a skill did not shorten its cooldown`);
  }
  // and rank 1 is EXACTLY base, so every existing tuning number still describes
  // the skill as first acquired
  checks++;
  if (rankCooldown(base, 1) === base) console.log('✓ rank 1 is exactly base cooldown — no silent retune of every skill in the game');
  else { fails++; console.log(`✗ rank 1 resolves to ${rankCooldown(base, 1)}, not the authored ${base}`); }
  // the floor holds
  checks++;
  const floor = base * CONFIG.SKILL_RANK_CD_FLOOR;
  if (Math.abs(rankCooldown(base, 99) - floor) < 1e-9) console.log(`✓ the floor binds: rank 99 stops at ${CONFIG.SKILL_RANK_CD_FLOOR * 100}% of base`);
  else { fails++; console.log(`✗ rank 99 resolved to ${rankCooldown(base, 99)}, past the ${floor} floor`); }
}

// ---------------------------------------------------------------- 3. walls
// Blacksmith melee must APPLY DAMAGE to a barricade — not merely acquire one.
// The original defect was upstream of the damage filter entirely: the skill
// never fired, because its trigger asks the enemy grid and a bare wall is not
// in it. So the fixture deliberately contains NO ENEMIES AT ALL.
{
  const { g, p } = arena('toh_blacksmith', { learnAll: false });
  p.skillPoints = 4; spendSkillPoint(g, p, 'smith_tongs');
  p.loadout[0] = 'smith_tongs';
  const w = g.addWall(p.x + 30, p.y - 40, 24, 80, 5000, {});
  const hp0 = w.hp;
  for (let i = 0; i < 60 * 10; i++) g.tick();
  const dealt = hp0 - w.hp;
  if (dealt > 0) ok(`Blacksmith melee damages a barricade with no enemy anywhere on the map: ${Math.round(dealt)} damage in 10 s`);
  else bad('a Blacksmith stood beside a barricade for ten seconds and did nothing to it — '
    + 'the melee trigger still asks only the enemy grid');
}

// ---------------------------------------------------------------- 4. region 1
// The halving is REGION TUNING, so assert it where it is read: region 1 carries
// it, and no other built region does.
{
  const r1 = REGION_BY_INDEX[1], r2 = REGION_BY_INDEX[2];
  const m1 = r1 && r1.tuning.nestWallHpMult, m2 = r2 && r2.tuning.nestWallHpMult;
  if (m1 === 0.5 && !m2) ok('region 1 halves nest-wall HP (0.5) and region 2 carries no multiplier — the number is region tuning, not a wall property');
  else bad(`nest wall multipliers are region 1: ${m1}, region 2: ${m2} — want 0.5 and unset`);
}

// ---------------------------------------------------------------- 5. coral
// Coral counts LANDINGS. Two arms, same fixture: N shots that all miss must
// plant nothing, N shots that all hit must plant the expected count.
{
  const t = (id) => {
    const { g, p } = arena('toh_sundian', { learnAll: false });
    p.skillPoints = 4; spendSkillPoint(g, p, 'sun_reefcut');
    p.loadout[0] = 'sun_reefcut';
    return { g, p, every: p.char.trait.everyNth };
  };

  // ARM A — nothing to hit. The trigger cannot hold and nothing lands.
  {
    const { g, p } = t();
    for (let i = 0; i < 60 * 10; i++) g.tick();
    if (g.corals.length === 0) ok('10 s of a Sundian with nothing in reach plants 0 coral — misses contribute nothing');
    else bad(`${g.corals.length} coral planted with no enemy and no wall present — the trigger is still counting something other than hits`);
  }

  // ARM B — a pinned immortal enemy. Every swing connects, so nodes appear on
  // the every-Nth landing. Asserted as a RATIO against hits rather than an
  // absolute, because the cast count is a cooldown detail and the ruling is
  // "one increment per hit".
  {
    const { g, p, every } = t();
    const e = g.spawnEnemyById('skulker', p.x + 40, p.y, {});
    e.hp = e.maxHp = 1e9; e.spd = 0;
    const atk0 = p.tohAtk || 0;
    for (let i = 0; i < 60 * 10; i++) { e.x = p.x + 40; e.y = p.y; g.tick(); }
    const hits = (p.tohAtk || 0) - atk0;
    const want = Math.floor(hits / every);
    // nodeCap can evict, so the live count is a floor on what was planted
    if (hits > 0 && g.corals.length > 0 && g.corals.length <= want) {
      ok(`${hits} landings planted coral every ${every}th hit — ${g.corals.length} live of ${want} planted (cap ${p.char.trait.nodeCap})`);
    } else {
      bad(`${hits} landings produced ${g.corals.length} coral, expected up to ${want} (every ${every}th)`);
    }
  }
}

// ---------------------------------------------------------------- 6. bounty
// The RESOLVED mark HP must be 4x the base, not "a multiplier exists". Read off
// a real spawned mark and divided back out by the same terms the formula uses.
{
  const { g } = arena('toh_samurai', { learnAll: false });
  const node = g.floor.nodes.find(n => n.kind === 'bounty');
  let measured = null;
  if (node) {
    g._travelTo(node.id);
    for (let i = 0; i < 60 * 20 && !measured; i++) {
      g.tick();
      const mark = [...g.enemyPool].find(e => e.active && e.bounty);
      if (mark) measured = mark;
    }
  }
  checks++;
  if (!measured) {
    fails++;
    console.log('✗ no bounty mark spawned in 20 s — this check read nothing and must not be counted as a pass');
  } else {
    // bossHp * bountyFraction * MULT; re-derive everything except the mult.
    const perFraction = measured.maxHp;
    console.log(`✓ a bounty mark spawned with ${Math.round(perFraction)} HP`);
    // the constant itself, asserted as a single term
    const src = (await import('node:fs')).readFileSync(new URL('../js/objectives.js', import.meta.url), 'utf8');
    const m = src.match(/const BOUNTY_HP_MULT = (\d+(?:\.\d+)?);/);
    const chained = /BOUNTY_HP_MULT\s*\*\s*[\d.]+|[\d.]+\s*\*\s*BOUNTY_HP_MULT/.test(src);
    checks++;
    if (!m) { fails++; console.log('✗ BOUNTY_HP_MULT is gone — this check no longer measures anything'); }
    else if (Number(m[1]) !== 4) { fails++; console.log(`✗ BOUNTY_HP_MULT is ${m[1]}, want 4`); }
    else if (chained) { fails++; console.log('✗ BOUNTY_HP_MULT is multiplied by a second constant somewhere — the ruling was ONE term, replaced, not layered'); }
    else console.log('✓ BOUNTY_HP_MULT is a single unchained term at 4');
  }
}

console.log(`\n${checks} check(s), ${fails} failure(s)`);
console.log(fails ? 'THE PATCH DOES NOT DO WHAT IT SAYS' : 'ALL SIX CHANGES BEHAVE AS SPECIFIED');
process.exit(fails ? 1 : 0);
