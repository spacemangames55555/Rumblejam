// THE SIM EVERY HARNESS SHOULD CONSTRUCT — a real Sim that answers its own
// §5.6 opening card before it walks into a room.
//
// WHY THIS EXISTS. `_floorOpeningAbility` is the anti-softlock floor, and it is
// loud on purpose: if it fires in a real run, a player was offered an opening
// ability and never got to answer it, which is a defect worth shouting about.
// One run of the suites emitted 1005 `[DEFECT] opening-floor` lines — 507 from
// sim_test alone — because the harnesses construct characters and march them
// into arenas without ever making the pick. Not one of those lines was about
// the game. A real defect signal arriving in that stream would never be read.
//
// The floor stays exactly as loud as it is. §13 rule 17: a fixture that arrives
// unprovisioned has the FIXTURE's bug, and the fix is to provision the fixture,
// never to quieten the alarm that noticed.
//
// WHY AT TRAVEL AND NOT AT CONSTRUCTION, AND WHY THE CONDITION IS THE FLOOR'S
// OWN. Answering unconditionally in the constructor was the first version and
// it was wrong. It silenced every line, but a fixture that hand-builds a
// character got its opening pick auto-slotted into slot 0 before it ever ran,
// and at level 1 there is exactly one slot. sim_test's necromancer summon check
// went from 2 minions to 1, the druid pack from 10 deaths to 7, the token check
// from 3 claims to 1 — all still green, all measuring less than they were
// written to measure. A change made to quiet noise must not move what a gate
// reads, and that one moved eight of them.
//
// So the fixture answers at the last honest moment instead, under the same
// question the floor asks: am I about to walk in with nothing? A fixture that
// provisions itself answers "no" and is untouched. A fixture that never
// provisions gets `openingPicks(p)[0]` — the identical skill the floor would
// have spent, on the identical tick, since `_enterArena` is called from inside
// `_travelTo` — so the outcome is unchanged and the only thing that disappears
// is a defect report that was never about the game. Proven rather than assumed:
// sim_test's full output is byte-identical across the change apart from one
// wall-clock timing figure.
//
// That equivalence is the whole point. Matching the floor's condition is what
// makes this measurement-neutral, and a noise fix that quietly re-tuned the
// suite would be worse than the noise it removed.
//
// A subclass rather than a factory because a factory only covers the call sites
// somebody remembered to convert, and the next `new Sim(` written in a harness
// would silently go back to arriving empty-handed.
import { Sim as RealSim } from '../js/game.js';
import { hasDamagingSlotted, answerOpening } from '../js/skillsim.js';

export class FixtureSim extends RealSim {
  _travelTo(id) {
    for (const p of this.livePlayers()) {
      if (p.openingOffer && !hasDamagingSlotted(p)) answerOpening(this, p);
    }
    return super._travelTo(id);
  }
}
