import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { Sound } from '../game/audio'
import { Effects } from '../game/render/effects'
import { render, type View } from '../game/render/renderer'
import type { OverReason, World } from '../game/types'
import { createWorld, update } from '../game/world'
import { loadBest, loadSound, saveBest, saveSound, seedFromUrl } from '../lib/storage'

export type Screen = 'menu' | 'playing' | 'paused' | 'over'

export interface GameState {
  screen: Screen
  score: number
  combo: number
  best: number
  /** Новый рекорд в только что закончившейся игре */
  record: boolean
  overReason?: OverReason
  sound: boolean
}

const newSeed = () => seedFromUrl() ?? Math.floor(Math.random() * 2 ** 31)

/**
 * Игровой цикл: requestAnimationFrame → шаг мира → эффекты и звук → отрисовка.
 * React-состояние обновляется только когда меняются очки или экран — не каждый кадр.
 */
export function useGame(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const world = useRef<World>(createWorld(newSeed()))
  const fx = useRef(new Effects())
  const sound = useRef(new Sound())
  const pendingLaunch = useRef(false)
  const screenRef = useRef<Screen>('menu')
  const view = useRef<View>({ width: 1, height: 1, dpr: 1 })

  const [state, setState] = useState<GameState>(() => ({
    screen: 'menu',
    score: 0,
    combo: 0,
    best: loadBest(),
    record: false,
    sound: loadSound(),
  }))

  useEffect(() => {
    sound.current.enabled = state.sound
  }, [state.sound])

  // Отладка и E2E-тесты: ?debug в адресе открывает доступ к состоянию мира (только чтение)
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('debug')) return
    Object.assign(window, { __orbit: { world: () => world.current } })
  }, [])

  const setScreen = useCallback((screen: Screen) => {
    screenRef.current = screen
    setState((s) => ({ ...s, screen }))
  }, [])

  // Размер холста с учётом плотности пикселей экрана
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const { width, height } = canvas.getBoundingClientRect()
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      view.current = { width, height, dpr }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [canvasRef])

  // Главный цикл
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let raf = 0
    let last = performance.now()

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const w = world.current

      if (screenRef.current === 'playing') {
        const launch = pendingLaunch.current
        pendingLaunch.current = false
        update(w, dt, { launch })

        if (w.events.length) {
          fx.current.handle(w.events)
          sound.current.handle(w.events)
          for (const e of w.events) {
            if (e.type === 'capture' && e.perfect) navigator.vibrate?.(12)
            if (e.type === 'over') navigator.vibrate?.([40, 30, 60])
          }
          setState((s) => (s.score === w.score && s.combo === w.combo ? s : { ...s, score: w.score, combo: w.combo }))
        }

        if (w.status === 'over') {
          const best = loadBest()
          const record = w.score > best
          if (record) saveBest(w.score)
          screenRef.current = 'over'
          setState((s) => ({ ...s, screen: 'over', score: w.score, best: Math.max(best, w.score), record, overReason: w.overReason }))
        }
      }

      // В меню игрок просто кружит по орбите — таймер разрушения не тикает
      if (screenRef.current === 'menu') {
        w.orbitTime = 0
        update(w, dt, { launch: false })
      }

      // Эффекты доигрывают и на экране конца игры
      if (screenRef.current !== 'paused') fx.current.update(dt, w)
      render(ctx, w, fx.current, view.current, now / 1000)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [canvasRef])

  const start = useCallback(() => {
    sound.current.unlock()
    world.current = createWorld(newSeed())
    fx.current.reset()
    pendingLaunch.current = false
    setState((s) => ({ ...s, score: 0, combo: 0, record: false, overReason: undefined }))
    setScreen('playing')
  }, [setScreen])

  const launch = useCallback(() => {
    if (screenRef.current !== 'playing') return
    sound.current.unlock()
    pendingLaunch.current = true
  }, [])

  const pause = useCallback(() => {
    if (screenRef.current === 'playing') setScreen('paused')
  }, [setScreen])

  const resume = useCallback(() => {
    if (screenRef.current === 'paused') setScreen('playing')
  }, [setScreen])

  const toMenu = useCallback(() => setScreen('menu'), [setScreen])

  const toggleSound = useCallback(() => {
    setState((s) => {
      saveSound(!s.sound)
      return { ...s, sound: !s.sound }
    })
  }, [])

  // Свернули вкладку или телефон — ставим на паузу
  useEffect(() => {
    const onHide = () => document.hidden && pause()
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [pause])

  return { state, start, launch, pause, resume, toMenu, toggleSound }
}
