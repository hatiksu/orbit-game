// Генерация уровня: цепочка планет вверх, звёзды между ними и астероиды на поздних этапах.
import { CONFIG } from './config'
import { lerp, random, range } from './rng'
import { FIELD_WIDTH, type Planet, type World } from './types'

export const difficulty = (captures: number) => Math.min(1, captures / CONFIG.maxDifficultyAt)

/** Первая планета — крупная, медленная и живёт дольше, чтобы освоиться */
export function firstPlanet(world: World): Planet {
  return {
    id: world.nextId++,
    baseX: FIELD_WIDTH / 2,
    x: FIELD_WIDTH / 2,
    y: 0,
    r: 80,
    orbitR: 160,
    spin: 1,
    omega: 1.7,
    life: CONFIG.firstPlanetLife,
    hue: 265,
  }
}

/** Добавляет следующую планету над последней. Расстояние гарантирует, что орбиты не пересекаются. */
export function addPlanet(world: World) {
  const prev = world.planets[world.planets.length - 1]
  const index = world.generated++
  const d = difficulty(index)

  const r = range(world, lerp(62, 40, d), lerp(78, 54, d))
  const orbitR = r + range(world, lerp(70, 52, d), lerp(90, 66, d))
  const gap = prev.orbitR + orbitR + range(world, lerp(110, 180, d), lerp(170, 260, d))

  // Сдвиг по горизонтали — в пределах поля, но не прямо над предыдущей
  const margin = orbitR + 30
  let x = range(world, margin, FIELD_WIDTH - margin)
  const minShift = lerp(120, 220, d)
  if (Math.abs(x - prev.baseX) < minShift) x = prev.baseX + (x < prev.baseX ? -minShift : minShift)
  x = Math.min(FIELD_WIDTH - margin, Math.max(margin, x))
  const dx = x - prev.baseX
  const y = prev.y - Math.sqrt(Math.max(gap * gap - dx * dx, (gap * 0.6) ** 2))

  const planet: Planet = {
    id: world.nextId++,
    baseX: x,
    x,
    y,
    r,
    orbitR,
    spin: random(world) < 0.5 ? 1 : -1,
    omega: range(world, lerp(1.8, 2.8, d), lerp(2.2, 3.4, d)),
    life: range(world, lerp(5.5, 3.2, d), lerp(6.5, 4, d)),
    hue: Math.floor(range(world, 0, 360)),
  }

  // С середины игры часть планет покачивается
  if (d > 0.35 && random(world) < lerp(0, 0.55, (d - 0.35) / 0.65)) {
    planet.sway = { amp: range(world, 40, lerp(60, 140, d)), speed: range(world, 0.6, 1.4), phase: range(world, 0, Math.PI * 2) }
    planet.sway.amp = Math.min(planet.sway.amp, x - margin, FIELD_WIDTH - margin - x)
    if (planet.sway.amp < 20) delete planet.sway
  }

  world.planets.push(planet)

  // Звезда — в свободном пространстве между орбитами, чуть в стороне от прямой.
  // Её нельзя собрать, просто кружась по орбите: нужно лететь.
  if (random(world) < 0.75) {
    const dist = Math.hypot(planet.x - prev.baseX, planet.y - prev.y) || 1
    const clear = CONFIG.starRadius + CONFIG.playerRadius + 14
    const from = prev.orbitR + clear
    const to = dist - orbitR - clear
    if (to > from) {
      const along = range(world, from, to)
      const off = range(world, -40, 40)
      const ux = (planet.x - prev.baseX) / dist
      const uy = (planet.y - prev.y) / dist
      world.stars.push({
        id: world.nextId++,
        x: prev.baseX + ux * along - uy * off,
        y: prev.y + uy * along + ux * off,
        taken: false,
      })
    }
  }

  // Астероиды кружат вокруг планеты снаружи орбиты игрока — нужно выбрать момент для прыжка
  if (index >= 4 && random(world) < lerp(0.15, 0.6, d)) {
    const count = d > 0.6 && random(world) < 0.4 ? 2 : 1
    for (let i = 0; i < count; i++) {
      const angle = range(world, 0, Math.PI * 2)
      const dist = orbitR + range(world, 42, 70)
      world.asteroids.push({
        id: world.nextId++,
        planetId: planet.id,
        angle,
        dist,
        speed: -planet.spin * range(world, 0.7, lerp(1.1, 1.8, d)),
        r: range(world, 12, 18),
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
      })
    }
  }
}
