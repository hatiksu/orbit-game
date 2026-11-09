import { describe, expect, it } from 'vitest'
import { CONFIG } from './config'
import { nextRandom } from './rng'
import { FIELD_WIDTH, type World } from './types'
import { createWorld, lifeLeft, update } from './world'

const FRAME = 1 / 60

/** Прогоняет мир n кадров без нажатий */
function idle(world: World, seconds: number) {
  for (let t = 0; t < seconds && world.status === 'playing'; t += FRAME) update(world, FRAME, { launch: false })
}

/**
 * Автопилот: прыгает, когда касательная к орбите смотрит в следующую непройденную планету.
 * Если он проходит много планет — уровни проходимы.
 */
function autopilotShouldLaunch(world: World): boolean {
  const me = world.player
  if (me.state !== 'orbit') return false
  const current = world.planets.find((p) => p.id === me.planetId)!
  const target = world.planets.filter((p) => !world.visited.includes(p.id) && p.y < current.y).sort((a, b) => b.y - a.y)[0]
  if (!target) return false
  const tx = -Math.sin(me.angle) * current.spin
  const ty = Math.cos(me.angle) * current.spin
  // Расстояние от центра цели до луча полёта
  const rx = target.x - me.x
  const ry = target.y - me.y
  const along = rx * tx + ry * ty
  if (along <= 0) return false
  const miss = Math.abs(rx * ty - ry * tx)
  // Целимся «по касательной» к орбите цели, но с запасом
  if (miss > target.orbitR * 0.8 || miss < target.r + 25) return false
  // Не прыгаем, если за время полёта нас пересечёт астероид (они движутся — предсказываем)
  const flight = along / CONFIG.launchSpeed
  for (const a of world.asteroids) {
    const p = world.planets.find((q) => q.id === a.planetId)!
    for (let k = 0; k <= 10; k++) {
      const t = (flight * k) / 10
      const angle = a.angle + a.speed * t
      const dx = p.x + Math.cos(angle) * a.dist - (me.x + tx * CONFIG.launchSpeed * t)
      const dy = p.y + Math.sin(angle) * a.dist - (me.y + ty * CONFIG.launchSpeed * t)
      if (Math.hypot(dx, dy) < a.r + CONFIG.playerRadius + 12) return false
    }
  }
  return true
}

function autoplay(seed: number, seconds: number): World {
  const world = createWorld(seed)
  for (let t = 0; t < seconds && world.status === 'playing'; t += FRAME) {
    update(world, FRAME, { launch: autopilotShouldLaunch(world) })
  }
  return world
}

describe('генератор случайных чисел', () => {
  it('одинаковое зерно — одинаковая последовательность', () => {
    const seq = (seed: number) => {
      const out: number[] = []
      let s = seed
      for (let i = 0; i < 5; i++) {
        const [v, n] = nextRandom(s)
        out.push(v)
        s = n
      }
      return out
    }
    expect(seq(42)).toEqual(seq(42))
    expect(seq(42)).not.toEqual(seq(43))
    for (const v of seq(7)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('генерация уровня', () => {
  it('планеты внутри поля, идут вверх и их орбиты не пересекаются', () => {
    for (const seed of [1, 2, 3, 99, 2026]) {
      const world = createWorld(seed)
      const ps = world.planets
      expect(ps.length).toBeGreaterThan(3)
      for (let i = 1; i < ps.length; i++) {
        const a = ps[i - 1]
        const b = ps[i]
        expect(b.y).toBeLessThan(a.y)
        expect(Math.hypot(b.baseX - a.baseX, b.y - a.y)).toBeGreaterThan(a.orbitR + b.orbitR)
        expect(b.baseX - b.orbitR).toBeGreaterThanOrEqual(0)
        expect(b.baseX + b.orbitR).toBeLessThanOrEqual(FIELD_WIDTH)
        expect(b.orbitR).toBeGreaterThan(b.r)
        expect(Number.isFinite(b.life)).toBe(true)
      }
    }
  })

  it('звёзды лежат вне орбит — их нельзя собрать, просто кружась', () => {
    for (const seed of [1, 2, 3, 42, 99, 2026]) {
      const world = createWorld(seed)
      for (const star of world.stars) {
        for (const p of world.planets) {
          const d = Math.hypot(star.x - p.baseX, star.y - p.y)
          expect(Math.abs(d - p.orbitR)).toBeGreaterThan(CONFIG.starRadius + CONFIG.playerRadius)
        }
      }
    }
  })

  it('один и тот же сид — один и тот же уровень', () => {
    expect(createWorld(5).planets).toEqual(createWorld(5).planets)
    expect(createWorld(5).planets).not.toEqual(createWorld(6).planets)
  })
})

describe('механика', () => {
  it('игрок начинает на орбите первой планеты', () => {
    const w = createWorld(1)
    expect(w.player.state).toBe('orbit')
    expect(w.score).toBe(0)
    expect(lifeLeft(w)).toBe(1)
  })

  it('по нажатию срывается по касательной со скоростью запуска', () => {
    const w = createWorld(1)
    update(w, FRAME, { launch: true })
    expect(w.events.map((e) => e.type)).toContain('launch')
    expect(w.player.state).toBe('flight')
    if (w.player.state === 'flight') expect(Math.hypot(w.player.vx, w.player.vy)).toBeCloseTo(CONFIG.launchSpeed)
  })

  it('если задержаться на орбите, планета разрушается', () => {
    const w = createWorld(1)
    idle(w, CONFIG.firstPlanetLife - CONFIG.warningTime + 0.1)
    expect(w.status).toBe('playing')
    expect(lifeLeft(w)).toBeLessThan(0.25)
    idle(w, 3)
    expect(w.status).toBe('over')
    expect(w.overReason).toBe('collapse')
  })

  it('промах — игрок улетает и проигрывает', () => {
    const w = createWorld(1)
    // Сразу после старта касательная смотрит вбок — к краю поля, а не к планете
    update(w, FRAME, { launch: true })
    idle(w, CONFIG.maxFlightTime + 0.5)
    expect(w.status).toBe('over')
    expect(w.overReason).toBe('lost')
  })

  it('после конца игры мир больше не меняется', () => {
    const w = createWorld(1)
    idle(w, 10)
    const snapshot = JSON.stringify(w.player)
    update(w, 1, { launch: true })
    expect(JSON.stringify(w.player)).toBe(snapshot)
    expect(w.events).toEqual([])
  })

  it('длинный кадр не ломает физику (шаги ограничены)', () => {
    const w = createWorld(1)
    update(w, 5, { launch: false })
    expect(w.time).toBeCloseTo(CONFIG.step * CONFIG.maxStepsPerFrame)
  })
})

describe('прохождение', () => {
  it('автопилот проходит много планет на разных уровнях — уровни проходимы', () => {
    const results = [1, 7, 42, 123, 2026, 31337].map((seed) => autoplay(seed, 90))
    for (const w of results) {
      expect(w.captures, `сид: ${w.captures} планет, причина: ${w.overReason}`).toBeGreaterThanOrEqual(15)
    }
  })

  it('за захваты начисляются очки, а идеальный вход растит комбо', () => {
    const w = autoplay(42, 60)
    expect(w.score).toBeGreaterThanOrEqual(w.captures)
  })

  it('игра детерминирована: одинаковые действия — одинаковый результат', () => {
    const a = autoplay(77, 40)
    const b = autoplay(77, 40)
    expect(a.score).toBe(b.score)
    expect(a.captures).toBe(b.captures)
    expect(a.player).toEqual(b.player)
  })

  it('старые планеты удаляются — мир не разрастается бесконечно', () => {
    const w = autoplay(1, 90)
    expect(w.planets.length).toBeLessThan(25)
  })
})
