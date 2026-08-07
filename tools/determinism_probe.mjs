// Does the sim reproduce from its seed? Run two identical Sims side by side and
// report the first tick where the enemy field disagrees.
//
//   node tools/determinism_probe.mjs [seed] [charId] [ticks]
//
// Today the answer is NO, and that is a recorded defect rather than a surprise:
// see docs/KNOWN-DEFECTS.md #1. `rushMove()` in js/entities/enemies.js picks its
// stall detour with Math.random(), so two runs of one seed part company as soon
// as a rushing enemy gets stuck on something.
//
// This lives in tools/ rather than in the test suite on purpose. It is not a
// gate — it would fail every run — it is the instrument you use when you fix
// the defect, and the thing that tells you afterwards whether you actually did.
// Turn it into a gate once it passes.
//
// Exit code is 0 when the two runs match and 1 when they diverge, so it can be
// dropped straight into a gate the day it starts passing.


const SEED = Number(process.argv[2]) || 4242;
const CHAR = process.argv[3] || 'toh_druid';
const TICKS = Number(process.argv[4]) || 900;

const { Sim } = await import('../js/game.js');

function arena(seed, charId) {
  const s = new Sim({ seed, party: [{ idx: 0, key: 'k', name: 'P', charId, color: '#fff' }] });
  const node = s.floor.nodes.find(n => n.kind === 'combat') || s.floor.nodes.find(n => !['shop', 'treasure'].includes(n.kind));
  node.kind = 'combat'; node.template = 'open_expanse';
  s._travelTo(node.id);
  const p = s.players[0];
  if (p.boonOffer && p.boonOffer.length) s.uiAction(0, { kind: 'boon', id: p.boonOffer[0].id });
  return s;
}

// A positional hash of the whole enemy field, per tick. Coarse enough to ignore
// float noise that does not exist (there is none — this is the same code twice)
// and fine enough that a single enemy one unit out of place shows up.
function trace(seed, charId, ticks) {
  const s = arena(seed, charId);
  const out = new Array(ticks);
  for (let i = 0; i < ticks; i++) {
    s.tick();
    let h = 0;
    for (const e of s.enemyPool) {
      if (!e.active) continue;
      h = (h * 31 + Math.round(e.x * 100)) | 0;
      h = (h * 31 + Math.round(e.y * 100)) | 0;
      h = (h * 31 + Math.round(e.hp)) | 0;
    }
    out[i] = h;
  }
  return out;
}

const a = trace(SEED, CHAR, TICKS);
const b = trace(SEED, CHAR, TICKS);

let at = -1;
for (let i = 0; i < TICKS; i++) if (a[i] !== b[i]) { at = i; break; }

console.log(`seed ${SEED} · ${CHAR} · ${TICKS} ticks (${(TICKS / 60).toFixed(1)}s)`);
if (at < 0) {
  console.log('✓ the two runs are identical for the whole window — the sim reproduces from its seed');
  process.exit(0);
}
console.log(`✗ diverged at tick ${at} (${(at / 60).toFixed(2)}s) of ${TICKS}`);
console.log('  see docs/KNOWN-DEFECTS.md #1 — rushMove() in js/entities/enemies.js draws from Math.random()');
console.log('  a party with no Hunter and no beast still diverges, so this is not the beast\'s RNG');
process.exit(1);
