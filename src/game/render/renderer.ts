// Отрисовка мира на Canvas 2D: неоновые планеты, шлейф, частицы, параллакс звёздного неба.
import { CONFIG } from '../config'
import { FIELD_WIDTH, type Asteroid, type Planet, type World } from '../types'
import { lifeLeft } from '../world'
import type { Effects } from './effects'

export interface View {
  /** Размер холста в CSS-пикселях */
  width: number
  height: number
  dpr: number
}

/** Масштаб и смещение: поле 1000 единиц вписывается по ширине, на широких экранах — по высоте */
export function projection(view: View) {
  const scale = Math.min(view.width / FIELD_WIDTH, view.height / 1350)
  const offsetX = (view.width - FIELD_WIDTH * scale) / 2
  // Текущая планета держится чуть ниже середины экрана
  const anchorY = view.height * 0.7
  return { scale, offsetX, anchorY }
}

// ---------- Кеш спрайтов свечения (дешевле, чем shadowBlur) ----------

const glowCache = new Map<string, HTMLCanvasElement>()

function glow(hue: number, light: number): HTMLCanvasElement {
  const key = `${hue}:${light}`
  let c = glowCache.get(key)
  if (!c) {
    c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, `hsla(${hue}, 95%, ${light}%, 0.9)`)
    grad.addColorStop(0.25, `hsla(${hue}, 95%, ${light}%, 0.35)`)
    grad.addColorStop(1, `hsla(${hue}, 95%, ${light}%, 0)`)
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    glowCache.set(key, c)
  }
  return c
}

// ---------- Звёздное небо ----------

interface SkyStar {
  x: number
  y: number
  size: number
  depth: number
  twinkle: number
}

let sky: SkyStar[] = []
let skyKey = ''

function ensureSky(view: View) {
  const key = `${Math.round(view.width)}x${Math.round(view.height)}`
  if (key === skyKey) return
  skyKey = key
  const count = Math.round((view.width * view.height) / 3500)
  sky = Array.from({ length: count }, () => ({
    x: Math.random() * view.width,
    y: Math.random() * view.height,
    size: Math.random() * 1.6 + 0.3,
    depth: [0.08, 0.18, 0.35][Math.floor(Math.random() * 3)],
    twinkle: Math.random() * Math.PI * 2,
  }))
}

// Форма астероида — неровный многоугольник, стабильный для каждого id
function asteroidShape(a: Asteroid): number[] {
  const pts: number[] = []
  let s = a.id * 9301 + 49297
  for (let i = 0; i < 9; i++) {
    s = (s * 9301 + 49297) % 233280
    pts.push(0.72 + (s / 233280) * 0.38)
  }
  return pts
}

export function render(ctx: CanvasRenderingContext2D, world: World, fx: Effects, view: View, time: number) {
  const { scale, offsetX, anchorY } = projection(view)
  const sx = (x: number) => offsetX + x * scale
  const sy = (y: number) => (y - world.cameraY) * scale + anchorY

  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0)

  // Фон
  const bg = ctx.createLinearGradient(0, 0, 0, view.height)
  bg.addColorStop(0, '#05040f')
  bg.addColorStop(1, '#0d0820')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, view.width, view.height)

  // Параллакс: дальние звёзды смещаются медленнее
  ensureSky(view)
  for (const s of sky) {
    const y = (((s.y - world.cameraY * s.depth * scale) % view.height) + view.height) % view.height
    const a = 0.35 + 0.35 * Math.sin(time * 1.5 + s.twinkle)
    ctx.fillStyle = `rgba(200, 210, 255, ${a})`
    ctx.fillRect(s.x, y, s.size, s.size)
  }

  // Тряска камеры
  if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake)

  // Границы поля на широком экране
  if (offsetX > 4) {
    ctx.strokeStyle = 'rgba(124, 92, 255, 0.12)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(sx(0), 0)
    ctx.lineTo(sx(0), view.height)
    ctx.moveTo(sx(FIELD_WIDTH), 0)
    ctx.lineTo(sx(FIELD_WIDTH), view.height)
    ctx.stroke()
  }

  const visible = (y: number, r: number) => sy(y) + r * scale > -50 && sy(y) - r * scale < view.height + 50
  const currentId = world.player.state === 'orbit' ? world.player.planetId : -1
  const life = lifeLeft(world)

  // Орбиты и планеты
  for (const p of world.planets) {
    if (!visible(p.y, p.orbitR + 80)) continue
    drawPlanet(ctx, p, sx(p.x), sy(p.y), scale, world.visited.includes(p.id), p.id === currentId ? life : null, time)
  }

  // Звёзды-бонусы
  for (const s of world.stars) {
    if (s.taken || !visible(s.y, 40)) continue
    const x = sx(s.x)
    const y = sy(s.y)
    const r = CONFIG.starRadius * scale
    ctx.globalCompositeOperation = 'lighter'
    ctx.drawImage(glow(48, 65), x - r * 3, y - r * 3, r * 6, r * 6)
    ctx.globalCompositeOperation = 'source-over'
    drawStarShape(ctx, x, y, r, r * 0.45, time * 1.5 + s.id)
    ctx.fillStyle = '#ffd95a'
    ctx.fill()
  }

  // Астероиды
  for (const a of world.asteroids) {
    if (!visible(a.y, 40)) continue
    const x = sx(a.x)
    const y = sy(a.y)
    const r = a.r * scale
    ctx.globalCompositeOperation = 'lighter'
    ctx.drawImage(glow(8, 50), x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2)
    ctx.globalCompositeOperation = 'source-over'
    const shape = asteroidShape(a)
    ctx.beginPath()
    shape.forEach((k, i) => {
      const ang = (i / shape.length) * Math.PI * 2 + a.angle * 2
      const px = x + Math.cos(ang) * r * k
      const py = y + Math.sin(ang) * r * k
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.closePath()
    ctx.fillStyle = '#6b5f73'
    ctx.fill()
    ctx.strokeStyle = '#ff7a59'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  // Шлейф игрока
  ctx.globalCompositeOperation = 'lighter'
  fx.trail.forEach((t, i) => {
    const k = i / fx.trail.length
    const r = CONFIG.playerRadius * scale * (0.4 + k * 0.9)
    ctx.globalAlpha = k * 0.6
    ctx.drawImage(glow(190, 70), sx(t.x) - r * 2, sy(t.y) - r * 2, r * 4, r * 4)
  })
  ctx.globalAlpha = 1

  // Игрок
  if (world.player.state !== 'dead') {
    const x = sx(world.player.x)
    const y = sy(world.player.y)
    const r = CONFIG.playerRadius * scale
    ctx.drawImage(glow(190, 75), x - r * 4, y - r * 4, r * 8, r * 8)
    ctx.globalCompositeOperation = 'source-over'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = '#eafcff'
    ctx.fill()
  }

  // Частицы
  ctx.globalCompositeOperation = 'lighter'
  for (const p of fx.particles) {
    const k = p.life / p.maxLife
    const size = p.size * scale * 2.4 * (0.5 + k)
    ctx.globalAlpha = k
    ctx.drawImage(glow(p.hue, p.light), sx(p.x) - size, sy(p.y) - size, size * 2, size * 2)
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'

  // Всплывающие очки
  ctx.textAlign = 'center'
  for (const t of fx.texts) {
    const k = Math.min(1, t.life / 0.4)
    const pop = 1 + Math.max(0, (t.life - 0.85) * 2)
    ctx.globalAlpha = k
    ctx.font = `700 ${Math.round((t.big ? 34 : 26) * scale * pop * 1.4)}px Unbounded, Inter, sans-serif`
    ctx.fillStyle = `hsl(${t.hue}, 95%, 78%)`
    ctx.fillText(t.text, sx(t.x), sy(t.y))
  }
  ctx.globalAlpha = 1

  // Предупреждение: планета вот-вот разрушится — красная пульсация по краям
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0)
  if (world.status === 'playing' && world.player.state === 'orbit' && life < 0.3) {
    const pulse = 0.25 + 0.25 * Math.sin(time * 14)
    const v = ctx.createRadialGradient(view.width / 2, view.height / 2, Math.min(view.width, view.height) * 0.35, view.width / 2, view.height / 2, Math.max(view.width, view.height) * 0.75)
    v.addColorStop(0, 'rgba(255, 40, 60, 0)')
    v.addColorStop(1, `rgba(255, 40, 60, ${pulse})`)
    ctx.fillStyle = v
    ctx.fillRect(0, 0, view.width, view.height)
  }

  // Вспышка при проигрыше
  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${fx.flash * 0.35})`
    ctx.fillRect(0, 0, view.width, view.height)
  }
}

function drawPlanet(ctx: CanvasRenderingContext2D, p: Planet, x: number, y: number, scale: number, visited: boolean, life: number | null, time: number) {
  const r = p.r * scale
  const orbit = p.orbitR * scale

  // Орбита
  ctx.setLineDash([6 * scale + 2, 10 * scale + 4])
  ctx.lineDashOffset = -time * 20 * p.spin
  ctx.strokeStyle = `hsla(${p.hue}, 90%, 72%, ${visited && life === null ? 0.12 : 0.35})`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, orbit, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // Таймер разрушения на текущей планете
  if (life !== null) {
    const danger = life < 0.3
    ctx.strokeStyle = danger ? `hsl(${355}, 95%, ${60 + 15 * Math.sin(time * 18)}%)` : `hsla(${p.hue}, 95%, 80%, 0.95)`
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(x, y, orbit, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * life)
    ctx.stroke()
    ctx.lineCap = 'butt'
  }

  // Свечение атмосферы
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = visited && life === null ? 0.35 : 0.8
  ctx.drawImage(glow(p.hue, 60), x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'

  // Тело планеты с объёмом
  const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r)
  const shrink = life !== null && life < 0.3 ? 1 - (0.3 - life) * 0.4 : 1
  body.addColorStop(0, `hsl(${p.hue}, 80%, ${visited && life === null ? 45 : 72}%)`)
  body.addColorStop(1, `hsl(${(p.hue + 30) % 360}, 70%, ${visited && life === null ? 12 : 22}%)`)
  ctx.beginPath()
  ctx.arc(x, y, r * shrink, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.fill()

  // Полоски на поверхности
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = `hsla(${p.hue}, 90%, 85%, 0.15)`
  ctx.lineWidth = r * 0.12
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath()
    ctx.ellipse(x, y + i * r * 0.38, r * 1.1, r * 0.12, 0.2, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

function drawStarShape(ctx: CanvasRenderingContext2D, x: number, y: number, outer: number, inner: number, rotation: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer
    const a = rotation + (i * Math.PI) / 5 - Math.PI / 2
    const px = x + Math.cos(a) * r
    const py = y + Math.sin(a) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}
