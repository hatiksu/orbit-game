// Ядро игры: создание мира и шаг симуляции. Чистые функции над данными — без DOM, звука и рендера.
import { CONFIG } from './config'
import { addPlanet, firstPlanet } from './generator'
import { FIELD_WIDTH, type Input, type OverReason, type Planet, type World } from './types'

export function createWorld(seed: number): World {
  const world: World = {
    rng: seed | 0,
    time: 0,
    planets: [],
    stars: [],
    asteroids: [],
    player: { state: 'dead', x: 0, y: 0 },
    score: 0,
    combo: 0,
    captures: 0,
    orbitTime: 0,
    cameraY: 0,
    visited: [],
    nextId: 0,
    generated: 1,
    acc: 0,
    status: 'playing',
    events: [],
    warned: false,
  }
  const start = firstPlanet(world)
  world.planets.push(start)
  world.visited.push(start.id)
  world.player = orbitPosition(start, -Math.PI / 2)
  world.cameraY = start.y
  fillAhead(world)
  return world
}

function orbitPosition(p: Planet, angle: number) {
  return { state: 'orbit' as const, planetId: p.id, angle, x: p.x + Math.cos(angle) * p.orbitR, y: p.y + Math.sin(angle) * p.orbitR }
}

const planetById = (world: World, id: number) => world.planets.find((p) => p.id === id)

function fillAhead(world: World) {
  while (world.planets[world.planets.length - 1].y > world.cameraY - CONFIG.lookAhead) addPlanet(world)
}

function cleanup(world: World) {
  const limit = world.cameraY + CONFIG.cleanupBehind
  const current = world.player.state === 'orbit' ? world.player.planetId : -1
  world.planets = world.planets.filter((p) => p.y < limit || p.id === current)
  world.stars = world.stars.filter((s) => s.y < limit && !s.taken)
  const alive = new Set(world.planets.map((p) => p.id))
  world.asteroids = world.asteroids.filter((a) => alive.has(a.planetId))
}

function gameOver(world: World, reason: OverReason) {
  const { x, y } = world.player
  world.player = { state: 'dead', x, y }
  world.status = 'over'
  world.overReason = reason
  world.events.push({ type: 'over', reason, x, y })
}

/** Один фиксированный шаг физики */
function step(world: World, launch: boolean) {
  const dt = CONFIG.step
  world.time += dt

  // Движение планет и астероидов
  for (const p of world.planets) {
    if (p.sway) p.x = p.baseX + Math.sin(world.time * p.sway.speed + p.sway.phase) * p.sway.amp
  }
  for (const a of world.asteroids) {
    const p = planetById(world, a.planetId)
    if (!p) continue
    a.angle += a.speed * dt
    a.x = p.x + Math.cos(a.angle) * a.dist
    a.y = p.y + Math.sin(a.angle) * a.dist
  }

  const player = world.player

  if (player.state === 'orbit') {
    const p = planetById(world, player.planetId)!
    if (launch) {
      // Срываемся по касательной к орбите
      const tx = -Math.sin(player.angle) * p.spin
      const ty = Math.cos(player.angle) * p.spin
      world.player = { state: 'flight', fromPlanetId: p.id, x: player.x, y: player.y, vx: tx * CONFIG.launchSpeed, vy: ty * CONFIG.launchSpeed, flightTime: 0 }
      world.events.push({ type: 'launch' })
    } else {
      player.angle += p.omega * p.spin * dt
      player.x = p.x + Math.cos(player.angle) * p.orbitR
      player.y = p.y + Math.sin(player.angle) * p.orbitR
      world.orbitTime += dt
      if (!world.warned && world.orbitTime > p.life - CONFIG.warningTime) {
        world.warned = true
        world.events.push({ type: 'warning', planetId: p.id })
      }
      if (world.orbitTime >= p.life) return gameOver(world, 'collapse')
    }
  } else if (player.state === 'flight') {
    player.x += player.vx * dt
    player.y += player.vy * dt
    player.flightTime += dt

    // Захват орбиты
    for (const p of world.planets) {
      if (p.id === player.fromPlanetId && player.flightTime < CONFIG.recaptureDelay) continue
      const dx = player.x - p.x
      const dy = player.y - p.y
      const dist = Math.hypot(dx, dy)
      if (dist > p.orbitR) continue

      // Насколько вход был «по касательной»: 0 — идеально вдоль орбиты, 1 — прямо в центр
      const radial = Math.abs((dx * player.vx + dy * player.vy) / (dist * Math.hypot(player.vx, player.vy) || 1))
      // Направление вращения задаёт сторона, с которой зашли
      const cross = dx * player.vy - dy * player.vx
      p.spin = cross >= 0 ? 1 : -1
      const angle = Math.atan2(dy, dx)
      world.player = orbitPosition(p, angle)
      world.orbitTime = 0
      world.warned = false

      const isNew = !world.visited.includes(p.id)
      let points = 0
      let perfect = false
      if (isNew) {
        world.visited.push(p.id)
        world.captures++
        perfect = radial < CONFIG.perfectEntry
        world.combo = perfect ? world.combo + 1 : 0
        points = 1 + (perfect ? world.combo : 0)
        world.score += points
      }
      world.events.push({ type: 'capture', planetId: p.id, points, perfect, combo: world.combo, x: world.player.x, y: world.player.y, hue: p.hue })
      break
    }

    if (world.player.state === 'flight') {
      const f = world.player
      const out = f.x < -CONFIG.sideMargin || f.x > FIELD_WIDTH + CONFIG.sideMargin || f.flightTime > CONFIG.maxFlightTime
      if (out) return gameOver(world, 'lost')
    }
  } else {
    return
  }

  // Звёзды и астероиды
  const pr = CONFIG.playerRadius
  const me = world.player
  for (const s of world.stars) {
    if (!s.taken && Math.hypot(s.x - me.x, s.y - me.y) < CONFIG.starRadius + pr) {
      s.taken = true
      world.score += CONFIG.starPoints
      world.events.push({ type: 'star', x: s.x, y: s.y })
    }
  }
  for (const a of world.asteroids) {
    if (Math.hypot(a.x - me.x, a.y - me.y) < a.r + pr) return gameOver(world, 'asteroid')
  }

  // Камера плавно тянется к текущей планете (или к игроку в полёте)
  const anchor = me.state === 'orbit' ? planetById(world, me.planetId)!.y : me.y
  world.cameraY += (anchor - world.cameraY) * Math.min(1, dt * 4)
}

/**
 * Продвигает мир на dt секунд реального времени фиксированными шагами.
 * Нажатие применяется на первом шаге. Возвращает тот же мир (изменённый) для удобства.
 */
export function update(world: World, dt: number, input: Input): World {
  world.events = []
  if (world.status !== 'playing') return world
  world.acc = Math.min(world.acc + dt, CONFIG.step * CONFIG.maxStepsPerFrame)
  let launch = input.launch
  // Нажатие засчитываем даже если кадр был совсем коротким
  if (launch && world.acc < CONFIG.step) world.acc = CONFIG.step
  while (world.acc >= CONFIG.step && world.status === 'playing') {
    step(world, launch)
    launch = false
    world.acc -= CONFIG.step
  }
  if (world.status === 'playing') {
    fillAhead(world)
    cleanup(world)
  }
  return world
}

/** Доля оставшейся «жизни» текущей планеты (1 — только прилетели, 0 — разрушается) */
export function lifeLeft(world: World): number {
  if (world.player.state !== 'orbit') return 1
  const p = planetById(world, world.player.planetId)
  return p ? Math.max(0, 1 - world.orbitTime / p.life) : 1
}
