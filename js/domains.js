// THE DAMAGE TRIANGLE.
//
//   physical  beats  spiritual
//   mental    beats  physical
//   spiritual beats  mental
//
// Every skill declares a domain. Every enemy declares a domain. ALL damage
// routes through domainMult() — hazard ticks and plague ticks included. There
// is deliberately no unrouted damage path: the moment one exists, a build can
// be strong for reasons the triangle cannot explain, and the triangle stops
// being something a player can read off an enemy's rim colour.

export const DOMAINS = ['physical', 'mental', 'spiritual'];

// Rim colours. Rendered as a 4px ring on every enemy, always on — the triangle
// is only a decision if you can see which way it points without inspecting.
export const DOMAIN_COLOR = {
  physical: '#C0392B',    // red
  mental: '#2E6DA4',      // blue
  spiritual: '#7D4A9E',   // violet
};

export const ADVANTAGE_MULT = 1.25;
export const DISADVANTAGE_MULT = 0.80;

// attacker -> the domain it beats
const BEATS = {
  physical: 'spiritual',
  mental: 'physical',
  spiritual: 'mental',
};

export function isDomain(d) { return DOMAINS.includes(d); }

// The multiplier for an attack of `atk` domain landing on a `def` domain
// target. Unknown or absent domains are neutral rather than an error: an
// enemy added later without a domain should hit for its normal damage, not
// crash a fight or silently get a bonus.
export function domainMult(atk, def) {
  if (!atk || !def || atk === def) return 1;
  if (BEATS[atk] === def) return ADVANTAGE_MULT;
  if (BEATS[def] === atk) return DISADVANTAGE_MULT;
  return 1;
}

// For the debug overlay and the skill card: which way this matchup points.
export function domainLabel(atk, def) {
  const m = domainMult(atk, def);
  return m > 1 ? 'advantage' : m < 1 ? 'disadvantage' : 'neutral';
}
