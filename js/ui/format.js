// Player-facing counts. The sim keeps the exact material total and spends that.
// Map 1 drops are worth 1/0.6, so a few of them print as a long repeating
// decimal. Whole numbers stay whole. A fraction shows one decimal.

export function fmtCount(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0';
  const text = (Math.round(x * 10) / 10).toFixed(1);
  return text.endsWith('.0') ? text.slice(0, -2) : text;
}
