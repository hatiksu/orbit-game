// Детерминированный генератор случайных чисел (mulberry32).
// Состояние — одно число, хранится прямо в мире, поэтому игру можно воспроизвести по зерну.

export function nextRandom(state: number): [value: number, nextState: number] {
  let t = (state + 0x6d2b79f5) | 0
  let r = Math.imul(t ^ (t >>> 15), t | 1)
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
  t = t + 0x6d2b79f5
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t | 0]
}

/** Удобная обёртка: берёт случайное число из мира и сдвигает его состояние. */
export function random(world: { rng: number }): number {
  const [v, s] = nextRandom(world.rng)
  world.rng = s
  return v
}

export const range = (world: { rng: number }, min: number, max: number) => min + random(world) * (max - min)

export const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t))
