// Player-facing counts. Pickups pay whole numbers; the unpaid fraction stays
// on the player and never reaches this. Whole numbers stay whole. If a
// fraction does arrive, it shows one decimal instead of a repeating 1/0.6.

export function fmtCount(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0';
  const text = (Math.round(x * 10) / 10).toFixed(1);
  return text.endsWith('.0') ? text.slice(0, -2) : text;
}
