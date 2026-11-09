// Звуки синтезируются Web Audio API прямо в браузере — без аудиофайлов.
import type { GameEvent } from './types'

export class Sound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  enabled = true

  /** Браузеры разрешают звук только после действия пользователя — вызываем из обработчика нажатия */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.35
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private tone(freq: number, endFreq: number, duration: number, type: OscillatorType, volume = 1, delay = 0) {
    if (!this.enabled || !this.ctx || !this.master) return
    const t = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(gain).connect(this.master)
    osc.start(t)
    osc.stop(t + duration + 0.05)
  }

  handle(events: GameEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'launch':
          this.tone(520, 180, 0.14, 'triangle', 0.5)
          break
        case 'capture': {
          if (e.points === 0) {
            this.tone(330, 330, 0.08, 'sine', 0.3)
            break
          }
          // С каждым идеальным захватом подряд звук выше
          const base = 440 * Math.pow(2, Math.min(e.combo, 12) / 12)
          this.tone(base, base * 1.01, 0.18, 'sine', 0.6)
          if (e.perfect) this.tone(base * 1.5, base * 1.5, 0.22, 'sine', 0.4, 0.07)
          break
        }
        case 'star':
          this.tone(1320, 1320, 0.1, 'square', 0.18)
          this.tone(1760, 1760, 0.16, 'square', 0.18, 0.06)
          break
        case 'warning':
          this.tone(880, 860, 0.08, 'square', 0.15)
          this.tone(880, 860, 0.08, 'square', 0.15, 0.16)
          break
        case 'over':
          this.tone(220, 40, 0.6, 'sawtooth', 0.5)
          this.tone(110, 30, 0.8, 'square', 0.25, 0.05)
          break
      }
    }
  }
}
