// Рекорд и настройки в localStorage. Хранилище может быть недоступно (приватный режим) — тогда просто не запоминаем.

const BEST_KEY = 'orbit:best'
const SOUND_KEY = 'orbit:sound'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // нет доступа — не страшно
  }
}

export const loadBest = () => Math.max(0, Number(read(BEST_KEY)) || 0)
export const saveBest = (score: number) => write(BEST_KEY, String(score))
export const loadSound = () => read(SOUND_KEY) !== 'off'
export const saveSound = (on: boolean) => write(SOUND_KEY, on ? 'on' : 'off')

/** Зерно уровня: из адреса (?seed=42 — для тестов и «одинаковых» забегов) или случайное */
export function seedFromUrl(): number | null {
  const raw = new URLSearchParams(location.search).get('seed')
  const n = raw === null ? NaN : Number(raw)
  return Number.isInteger(n) ? n : null
}
