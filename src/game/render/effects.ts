// Визуальные эффекты: частицы, шлейф, всплывающие очки, тряска. Живут отдельно от мира —
// на игровую логику не влияют, поэтому могут использовать Math.random.
import type { GameEvent, World } from '../types'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  hue: number
  light: number
}

interface FloatingText {
  x: number
  y: number
  text: string
  life: number
  hue: number
  big: boolean
}

const TRAIL_LENGTH = 22

export class Effects {
  particles: Particle[] = []
  texts: FloatingText[] = []
  trail: { x: number; y: number }[] = []
  shake = 0
  flash = 0

  reset() {
    this.particles = []
    this.texts = []
    this.trail = []
    this.shake = 0
    this.flash = 0
  }

  burst(x: number, y: number, count: number, hue: number, speed: number, light = 65) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const v = speed * (0.3 + Math.random() * 0.7)
      const life = 0.4 + Math.random() * 0.6
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, maxLife: life, size: 2 + Math.random() * 4, hue, light })
    }
  }

  /** Реакция на игровые события */
  handle(events: GameEvent[]) {
    for (const e of events) {
      if (e.type === 'capture' && e.points > 0) {
        this.burst(e.x, e.y, e.perfect ? 34 : 18, e.hue, e.perfect ? 420 : 260)
        this.texts.push({ x: e.x, y: e.y - 30, text: e.perfect ? `+${e.points} Идеально!` : `+${e.points}`, life: 1.1, hue: e.hue, big: e.perfect })
        if (e.perfect) this.shake = Math.max(this.shake, 6)
      } else if (e.type === 'star') {
        this.burst(e.x, e.y, 16, 48, 300, 70)
        this.texts.push({ x: e.x, y: e.y - 24, text: '+2 ★', life: 0.9, hue: 48, big: false })
      } else if (e.type === 'over') {
        this.burst(e.x, e.y, 70, e.reason === 'asteroid' ? 20 : 200, 620, 70)
        this.shake = 22
        this.flash = 1
      }
    }
  }

  update(dt: number, world: World) {
    for (const p of this.particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 1 - dt * 2.2
      p.vy *= 1 - dt * 2.2
      p.life -= dt
    }
    this.particles = this.particles.filter((p) => p.life > 0)

    for (const t of this.texts) {
      t.y -= 60 * dt
      t.life -= dt
    }
    this.texts = this.texts.filter((t) => t.life > 0)

    if (world.player.state !== 'dead') {
      this.trail.push({ x: world.player.x, y: world.player.y })
      if (this.trail.length > TRAIL_LENGTH) this.trail.shift()
    } else if (this.trail.length) {
      this.trail.shift()
    }

    this.shake = Math.max(0, this.shake - dt * 50)
    this.flash = Math.max(0, this.flash - dt * 2.5)
  }
}
