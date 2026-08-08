// THE ECONOMY GATE — §9.2 and §9.3, asserted by effect.
//
// Every constraint below is written down in the GDD and none of them was
// checkable until now. §13 rule 24: an exclusion asserted on a table is not an
// exclusion until something measures the effect — and §9.2 is mostly
// exclusions. "No cooldown reduction on any item." "A penalty may not roll into
// a stat the character has none of." "Nothing in the roll table may reach a
// cooldown, directly or by proxy." Each is a promise that a green suite could
// keep for months while the game quietly broke it.
//
// `validate_items` checks the same rules by NAME, which is cheap and catches an
// author typing `cooldown` into an id. This checks them by EFFECT, which is the
// only thing that catches a stat that reaches a cooldown through a path nobody
// named.
//
// Usage: node tools/econ_gate.mjs [--verbose]

import { Sim } from '../js/game.js';
import { ITEMS, ITEM_BY_ID } from '../js/content/items.js';
import { CONFIG, STAT_KEYS, ROLL_TABLE } from '../js/config.js';
import { SELECTABLE } from '../js/content/characters.js';
import { TREES } from '../js/skills.js';
import { spendSkillPoint } from '../js/skillsim.js';
import { ENEMIES } from '../js/content/enemies.js';

const VERBOSE = process.argv.includes('--verbose');
let failures = 0;
const fail = m => { failures++; console.error(`✗ ${m}`); };
const ok = m => console.log(`✓ ${m}`);

const SEED = 90210;
const CHAR = SELECTABLE[0].id;
const DUMMY = ENEMIES[0].id;

function stage(level = 30, seed = SEED) {
  const g = new Sim({ seed, party: [{ idx: 0, key: 'k', name: 'P', charId: CHAR, color: '#fff' }] });
  const p = g.players[0];
  p.level = level;
  for (const tid of Object.keys(TREES).filter(t => TREES[t].classId === CHAR)) {
    for (const s of [...TREES[tid].skills].sort((a, b) => a.tier - b.tier)) { p.skillPoints++; spendSkillPoint(g, p, s.id); }
  }
  const node = g.floor.nodes.find(x => !['shop', 'treasure', 'siege'].includes(x.kind));
  g._travelTo(node.id);
  for (const e of [...g.enemyPool]) if (e.active) { e.hp = 0; e.active = false; }
  p.hp = p.stats.vitality;
  return { g, p };
}

console.log(`econ gate — §9.2's roll constraints and §9.3's sinks, measured\n`);

// ---------------------------------------------------------------------------
// 1. NOTHING IN THE ROLL TABLE REACHES A COOLDOWN, DIRECTLY OR BY PROXY.
//
// The measurement is the count of skill FIRES over a fixed window against
// pinned, unkillable targets. Unkillable matters: if anything dies, ON_KILL
// arms, kill counters move, and the fire count changes for a reason that is not
// a cooldown. This is the check that would have caught "attack speed" being
// wired to Tempo — §9.5 ruled that Tempo's defect was the label rather than the
// code, and this is what makes that ruling verifiable instead of asserted.
{
  const fires = (penaltyStat) => {
    const { g, p } = stage();
    if (penaltyStat) g._applyPerm(p, { [penaltyStat]: -60 });
    const es = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const e = g.spawnEnemyById(DUMMY, p.x + Math.cos(a) * 60, p.y + Math.sin(a) * 60);
      if (e) { e.maxHp = e.hp = 1e12; e.speed = 0; e.spawnX = e.x; e.spawnY = e.y; es.push(e); }
    }
    let n = 0;
    const seen = new Set();
    for (let t = 0; t < 60 * 20; t++) {
      g.setInput(0, { mx: 0, my: 0 });
      g.tick();
      for (const e of es) { e.x = e.spawnX; e.y = e.spawnY; }
      for (const f of p.fireLog || []) { const k = f.id + '@' + f.t; if (!seen.has(k)) { seen.add(k); n++; } }
    }
    return n;
  };
  const base = fires(null);
  if (base < 5) fail(`the cooldown probe recorded only ${base} fires with no penalty — it cannot detect a change it cannot see`);
  else ok(`cooldown probe baseline: ${base} skill fires in 20 s against unkillable targets`);
  const moved = [];
  for (const k of ROLL_TABLE) {
    const n = fires(k);
    if (VERBOSE) console.log(`    −60 ${k}: ${n} fires (base ${base})`);
    if (n !== base) moved.push(`${k} ${base}→${n}`);
  }
  if (!moved.length) ok(`no stat in the roll table changes how often a skill fires — §9.2's cooldown ban holds by effect, across all ${ROLL_TABLE.length}`);
  else fail(`${moved.length} stat(s) in the roll table reach a cooldown: ${moved.join(', ')} — §9.2 bans that on every item, and a rollable penalty into one is cooldown reduction with a random target`);
}

// ---------------------------------------------------------------------------
// 2. A PENALTY MAY NOT ROLL INTO A STAT THE CHARACTER HAS NONE OF.
//
// Reducing a zero is free, and a shop full of free items has no trade-offs
// left. Eligibility is against the LIVE SHEET, so the check rolls against a
// character whose sheet is deliberately sparse.
{
  const { g, p } = stage(1);
  const zeroed = STAT_KEYS.filter(k => (p.stats[k] || 0) <= 0);
  const item = ITEMS.find(it => it.penalty);
  if (!item) { fail('no item in the catalog declares a `penalty` — §9.2 stat items are unbuilt'); }
  else if (!zeroed.length) { fail('the level-1 fixture has every stat above zero, so the zero-stat rule cannot be observed'); }
  else {
    const hits = {};
    let none = 0;
    for (let i = 0; i < 2000; i++) {
      const pen = g._rollPenalty(p, item);
      if (pen === null) { none++; continue; }
      hits[pen] = (hits[pen] || 0) + 1;
    }
    const illegal = Object.keys(hits).filter(k => zeroed.includes(k));
    if (!illegal.length) ok(`2000 rolls never landed on a stat the character has none of (${zeroed.join(', ')} were at zero and untouched)`);
    else fail(`penalty rolled into ${illegal.join(', ')} — stats this character has none of, which makes the item free (§9.2)`);
    const granted = Object.keys(item.stats || {});
    const selfHit = Object.keys(hits).filter(k => granted.includes(k));
    if (!selfHit.length) ok(`the penalty never rolls into the stat the item grants — an item that gave and took the same stat would be a smaller item, not a trade`);
    else fail(`penalty rolled into ${selfHit.join(', ')}, which the same item grants`);
    if (Object.keys(hits).length > 1) ok(`the roll is spread across ${Object.keys(hits).length} stats — there is no fixed opposition table to memorise (§9.2)`);
    else fail(`every roll landed on ${Object.keys(hits)[0]} — that is a fixed opposition table, and it is memorised after one run`);
  }
}

// ---------------------------------------------------------------------------
// 3. THE ROLL USES ITS OWN RNG STREAM (§13 rule 27).
//
// Asserted by effect, not by reading the code: two sims from one seed, one of
// which grants a stat item, must leave the SHARED stream in the same place. A
// new stochastic mechanic drawing from `rng` silently reprices every balance
// measurement taken before it existed — §4.2's sweep moved once already when
// the gold multiplier started drawing from the shared stream.
{
  const drain = (grant) => {
    const { g, p } = stage(30);
    if (grant) { const it = ITEMS.find(i => i.penalty); for (let i = 0; i < 20; i++) g._rollPenalty(p, it); }
    return [g.rng.float(), g.rng.float(), g.rng.float()].map(x => x.toFixed(9)).join(',');
  };
  const a = drain(false), b = drain(true);
  if (a === b) ok(`20 penalty rolls left the shared stream untouched — the economy draws from \`econRng\`, so buying something does not reprice every measurement`);
  else fail(`the penalty roll consumed from the shared stream (${a} vs ${b}) — §13 rule 27: a new stochastic mechanic gets its own stream`);
}

// ---------------------------------------------------------------------------
// 4. THE PENALTY IS REAL, AND AN UPGRADE SCALES BOTH HALVES.
//
// §9.3's upgrades must never become a way to buy the upside without the
// downside, which is what a level that scaled only the bonus would be.
{
  const it = ITEMS.find(i => i.penalty && Object.keys(i.stats).length === 1);
  if (!it) fail('no single-stat penalty item to measure an upgrade against');
  else {
    const { g, p } = stage(30);
    const before = { ...p.stats };
    g._grantItem(p, it.id);
    const st = p.itemState[it.id];
    const l1 = { ...p.stats };
    const gain1 = l1[Object.keys(it.stats)[0]] - before[Object.keys(it.stats)[0]];
    const pen1 = st.pen ? before[st.pen] - l1[st.pen] : 0;
    g._grantItem(p, it.id);                       // a second copy = an upgrade
    const l2 = { ...p.stats };
    const gain2 = l2[Object.keys(it.stats)[0]] - before[Object.keys(it.stats)[0]];
    const pen2 = st.pen ? before[st.pen] - l2[st.pen] : 0;
    if (p.itemState[it.id].lvl === 2) ok(`a second copy of ${it.id} upgraded it to level 2 rather than stacking a duplicate (§9.3)`);
    else fail(`a second copy of ${it.id} left it at level ${p.itemState[it.id].lvl} — §9.3 says a duplicate deepens the item`);
    if (gain2 > gain1) ok(`the upgrade deepened the bonus: +${gain1} → +${gain2} ${Object.keys(it.stats)[0]}`);
    else fail(`the upgrade did not change the bonus (${gain1} → ${gain2}) — an upgrade that changes nothing is the shop version of a dead stat`);
    if (!st.pen) fail(`${it.id} rolled no penalty on a level-30 sheet, so the upgrade's downside cannot be observed`);
    else if (pen2 > pen1) ok(`and the rolled penalty scaled with it: −${pen1} → −${pen2} ${st.pen}`);
    else fail(`the penalty did NOT scale with the upgrade (−${pen1} → −${pen2} ${st.pen}) — that makes upgrading a way to buy the upside without the downside`);
  }
}

// ---------------------------------------------------------------------------
// 5. §9.3 RESPEC: 1000 base, ×2.5 per use, NEVER RESETTING.
{
  const { g, p } = stage(30);
  const ladder = [];
  for (let i = 0; i < 4; i++) { p.respecs = i; ladder.push(g._respecCost(p)); }
  p.respecs = 0;
  const want = [1000, 2500, 6250, 15625];
  if (ladder.join(',') === want.join(',')) ok(`respec ladder is ${ladder.join(' → ')} — 1000 base, ×2.5 per use`);
  else fail(`respec ladder is ${ladder.join(' → ')}, expected ${want.join(' → ')}`);

  const spent = Object.values(p.skillRanks).reduce((a, b) => a + b, 0);
  p.materials = 100000;
  const r = g._respec(p);
  if (r.ok && p.skillPoints >= spent && !Object.keys(p.skillRanks).length) ok(`respec refunded all ${spent} points at once and cleared every rank — never per-point (§9.3)`);
  else fail(`respec did not refund the whole build: ${JSON.stringify(r)}, points ${p.skillPoints}, ranks left ${Object.keys(p.skillRanks).length}`);

  // NEVER RESETTING is the whole mechanic: it must survive a floor change.
  const after = g._respecCost(p);
  g._startFloor(g.floorNum + 1);
  if (g._respecCost(p) === after && after === 2500) ok(`the next respec costs ${after} and stays ${g._respecCost(p)} across a floor change — the cost never resets`);
  else fail(`respec cost reset across a floor: ${after} → ${g._respecCost(p)}`);
}

// ---------------------------------------------------------------------------
// 6. §9.3 REROLLS ESCALATE WITHIN A VISIT, and start fresh at the next shop.
{
  const { g, p } = stage(30);
  p.materials = 100000;
  g._openShop(p);
  // `uiAction` dispatches on `msg.kind`. Sending `{t:'reroll'}` was silently
  // ignored, so the cost never moved and the gate reported the game's price
  // escalation broken — a probe addressing the wrong field measures a game
  // where the player never pressed the button (§13 rule 26).
  const costs = [];
  for (let i = 0; i < 4; i++) { costs.push(g._rerollCost(p)); g.uiAction(p.idx, { kind: 'reroll' }); }
  const rising = costs.every((c, i) => i === 0 || c > costs[i - 1]);
  if (rising) ok(`reroll cost escalates within a visit: ${costs.join(' → ')}`);
  else fail(`reroll cost does not escalate within a visit: ${costs.join(' → ')} — §9.1's price escalation is the lever that matters most`);
  g.currentNode = (g.currentNode ?? 0) + 1;      // a different shop
  g._openShop(p);
  if (g._rerollCost(p) === costs[0]) ok(`and it resets at the next shop (${g._rerollCost(p)}) — escalation is within a visit, not across a run`);
  else fail(`reroll cost carried across shops: ${g._rerollCost(p)} vs a fresh ${costs[0]}`);
}

// ---------------------------------------------------------------------------
// 7. §9.2 LATE-GAME WEIGHTING moves the pool, and it is DATA ON THE ITEM.
//
// The structural half of the claim is checked too: the shop must hold no region
// table. If `_pickWeighted` ever needs to know which items belong to which
// region, this is where that coupling would first show up.
{
  const weighted = ITEMS.filter(it => it.lateWeight > 0);
  if (!weighted.length) fail('no item declares `lateWeight` — §9.2 late-game weighting is unbuilt');
  else {
    const share = (region) => {
      const { g, p } = stage(30);
      g.regionIndex = region;
      let late = 0;
      const pool = ITEMS.filter(it => it.rarity === 'rare');
      for (let i = 0; i < 4000; i++) if ((g._pickWeighted(g.rng, pool).lateWeight || 0) >= 0.6) late++;
      return late / 4000;
    };
    const early = share(0), last = share(7);
    if (last > early * 1.15) ok(`late-weighted rares are ${(early * 100).toFixed(1)}% of region-1 rolls and ${(last * 100).toFixed(1)}% of region-8 rolls — the weighting is measurable, not declared`);
    else fail(`late-weighted share barely moved across the run: ${(early * 100).toFixed(1)}% → ${(last * 100).toFixed(1)}%`);
    if (VERBOSE) console.log(`    ${weighted.length} of ${ITEMS.length} items carry a lateWeight`);
  }
}

console.log(failures ? `\n${failures} ECON GATE FAILURE(S)` : '\nTHE ECONOMY OBEYS EVERY CONSTRAINT §9.2 AND §9.3 WRITE DOWN');
process.exit(failures ? 1 : 0);
