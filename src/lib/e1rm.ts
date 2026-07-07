// 推定1RM (Epley式): e1RM = weight × (1 + reps / 30)
// reps <= 1 のときは weight をそのまま返す
export function e1rm(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

export function roundTo(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
