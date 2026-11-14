// THE NINE HEALING FIELDS, AUTHORED AND NOT YET PLACED.
//
// Casey ruled all nine ship as timed fields at their documents' own values, and
// every value below is the document's. What is NOT settled is where each one
// goes, and that is why this file is referenced by no tree: putting them in
// costs nine shipped nodes, and which nine is not a decision this pass gets to
// make quietly. See HOMELESS, below.
//
// TWO THINGS BLOCK PLACEMENT, both measured rather than assumed.
//
// 1. THERE IS NO BUILT COUNTERPART FOR ANY OF THE NINE. They are gaps — nothing
//    was built for them, which is why they sit in the no-fit list. `tree_align`
//    pairs eight of the nine at WEAK confidence, which its own output calls
//    worthless for exactly this kind of claim. Placing each at its document's
//    axis position inside Casey's ruled tree pair is the defensible answer, and
//    the cost of doing it is listed per skill below: nine shipped nodes deleted
//    and nine prereq edges repointed. Among them are `wd_contagion`, whose
//    spread radius Casey ruled on 2026-09-05; `bard_refrain`, the Bard's only
//    heal; and `pri_benediction`, a tier-10 capstone.
//
// 2. NONE OF THE NINE CAN FIRE ON ITS DOCUMENTED TRIGGER. Seven say
//    "COOLDOWN_READY when 2+ friendlies are below X%" and two say
//    "ALLY_HP_BELOW_X". Neither kind exists: all eleven declared TRIGGER_KINDS
//    are self-facing or enemy-facing, and there is no ally-condition trigger in
//    the engine at all. The heal-targeting pass built ally SELECTION for instant
//    heals; triggers are a separate system and were not part of it. Every
//    `trigger` below is therefore a PLACEHOLDER, marked as such, and picking the
//    real one is a ruling — substituting one quietly is how the six silent
//    substitutions this session has been auditing came to exist.
//
// The FIELD PARAMETERS are not blocked by either of those and are exact. The
// gate drives each one and measures what it actually pays out.

export const HEALING_FIELDS = [
  {
    id: 'dru_sage_burn', name: 'Sage Burn', doc: 'druid / Nature\'s Restoration, axis 7',
    wouldDisplace: 'dru_husk (druid_restoration[7], t4 shield)',
    cooldown: 4000,   // PACE: slow
    field: { radius: 110, tickMs: 1000, duration: 30000, heal: 4 },
    docTrigger: 'COOLDOWN_READY when 2+ friendlies below 75% within 110px',
  },
  {
    id: 'dru_healing_spores', name: 'Healing Spores', doc: 'druid / Nature\'s Restoration, axis 8',
    wouldDisplace: 'dru_hidebind (druid_restoration[8], t6 passive)',
    cooldown: 8000,   // PACE: very slow
    field: { radius: 200, tickMs: 1000, duration: 30000, heal: 5 },
    docTrigger: 'COOLDOWN_READY when 2+ friendlies below 75% within 200px',
  },
  {
    id: 'bard_hum_of_the_ancients', name: 'Hum of the Ancients', doc: 'bard / Songs, axis 2',
    wouldDisplace: 'bard_refrain (bard_ensemble[2], t2 heal — the Bard\'s only heal)',
    cooldown: 8000,
    field: { radius: 110, tickMs: 1000, duration: 20000, heal: 3 },
    docTrigger: 'COOLDOWN_READY when 2+ friendlies below 80% within 110px',
  },
  {
    id: 'wd_healing_totem', name: 'Healing Totem', doc: 'witchdoctor / Swarm, axis 3',
    wouldDisplace: 'wd_contagion (wd_swarm[3], t4 plague — spread radius ruled 2026-09-05)',
    cooldown: 4000,
    field: { radius: 130, tickMs: 800, duration: 12000, heal: 4 },
    docTrigger: 'COOLDOWN_READY when 2+ friendlies below 75% within 130px',
  },
  {
    // THE ONE ZONE THAT DOES BOTH, and the case the mechanism was shaped around.
    id: 'wd_tribal_ritual', name: 'Tribal Ritual', doc: 'witchdoctor / Swarm, axis 9',
    wouldDisplace: 'wd_gravecall (wd_swarm[9], t8 summon)',
    cooldown: 8000,
    field: { radius: 150, tickMs: 500, duration: 6000, heal: 5 },
    // `weakenDamage` is the engine's name for the document's "weaken 20%".
    riders: { weakenDamage: { pct: 20, dur: 6000 } },
    docTrigger: 'ALLY_HP_BELOW_X (60%) with 2+ friendlies in radius',
  },
  {
    // RADIUS NOT IN THE DOCUMENT. 140 is Casey's, set in this spec — the median
    // of the Priest's three stated fields (120, 140, 200). The document says
    // only "placed at caster" and "within the placement radius"; nothing in it
    // implies a different number.
    id: 'pri_radiant_aura', name: 'Radiant Aura', doc: 'priest / Reckoning, axis 5',
    wouldDisplace: 'pri_compline (priest_reckoning[5], t8 shield)',
    cooldown: 4000,
    field: { radius: 140, tickMs: 1000, duration: 12000, heal: 3 },
    docTrigger: 'COOLDOWN_READY when 2+ friendlies below 80% within the placement radius',
  },
  {
    id: 'pri_sanctified_ground', name: 'Sanctified Ground', doc: 'priest / Judgment, axis 6',
    wouldDisplace: 'pri_sentence (priest_judgment[6], t8 bolt)',
    cooldown: 4000,
    field: { radius: 140, tickMs: 1000, duration: 5000, heal: 4 },
    docTrigger: 'COOLDOWN_READY when 2+ friendlies below 75% within 140px',
  },
  {
    id: 'pri_hymn_of_mending', name: 'Hymn of Mending', doc: 'priest / Grace, axis 8',
    wouldDisplace: 'pri_vigil (priest_grace[8], t8 ward)',
    cooldown: 8000,
    field: { radius: 120, tickMs: 1000, duration: 12000, heal: 4 },
    docTrigger: 'COOLDOWN_READY when 2+ friendlies below 70% within 120px',
  },
  {
    // THE 60 CONVICTION COST IS NOT BUILT AND IS NOT THE HEAL-WITH-A-COST GAP.
    // Conviction is a proposed Priest engine, 0-100, with feeds and CONSUMES —
    // a depleting pool. The built Priest engine is `marks`, and the document
    // says outright that `marks` is superseded, so this is a class-engine
    // replacement rather than a skill detail. More to the point, "no depleting
    // resources" is settled: Ruling 3 is VOID precisely because both depleting
    // engines were cut, and no class in the roster has one. The field is
    // authored without the cost, as the spec directs.
    id: 'pri_grace_incarnate', name: 'Grace Incarnate', doc: 'priest / Grace, axis 10',
    wouldDisplace: 'pri_benediction (priest_grace[10], t10 cone — a capstone)',
    cooldown: 25000,  // PACE: capstone
    field: { radius: 200, tickMs: 700, duration: 6000, heal: 6 },
    docTrigger: 'ALLY_HP_BELOW_X (40%) with 3+ friendlies hurt in radius, gated on 60 Conviction',
    unbuilt: '60 Conviction — a depleting pool, and the roster has none',
  },
];

// The compose step each one becomes, which is the part that IS settled. Every
// field is at-caster: seven documents say so in their SHAPE line and the other
// two (Sanctified Ground, Grace Incarnate) declare `CAST: self`, which resolves
// to the same place. There is no non-at-caster field among the nine.
export function fieldStep(f) {
  return {
    kind: 'hazard', atCaster: true, damage: 0,
    heal: f.field.heal, radius: f.field.radius,
    tickMs: f.field.tickMs, duration: f.field.duration,
    ...(f.riders ? { riders: f.riders } : {}),
  };
}
