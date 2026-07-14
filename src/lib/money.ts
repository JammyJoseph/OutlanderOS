// Currency rounding. Budget maths is done in floats, so qty × rate produces
// noise (3 × 33.33 = 99.99000000000001) that accumulates across a budget's
// totals and — worse — makes two equal amounts compare as different. Every
// currency value is rounded to 2dp before it is stored or compared.
export function money(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
