// Player-facing counts. Pickups pay whole numbers; the unpaid fraction stays
// on the player and never reaches this. Whole numbers stay whole. If a
// fraction does arrive, floor it to one decimal so the number on screen is
// never higher than what the player can spend. Rounding up made an exact
// 11.96 read "12" while a 12-cost item stayed greyed out.

export function fmtCount(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0';
  // The nudge lives only inside the floor, so an exact tenth (and a whole
  // number) stays itself instead of slipping down from binary noise.
  const text = (Math.floor(x * 10 + 1e-9) / 10).toFixed(1);
  return text.endsWith('.0') ? text.slice(0, -2) : text;
}
