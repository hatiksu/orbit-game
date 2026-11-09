import { useEffect, useRef } from 'react'
import { AnimatePresence, MotionConfig } from 'motion/react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { GameOver } from './components/GameOver/GameOver'
import { Hud } from './components/Hud/Hud'
import { Menu } from './components/Menu/Menu'
import { PauseOverlay } from './components/PauseOverlay/PauseOverlay'
import { useGame } from './hooks/useGame'
import styles from './App.module.css'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { state, start, launch, pause, resume, toMenu, toggleSound } = useGame(canvasRef)
  // Офлайн-режим: Service Worker кеширует игру после первого запуска
  useRegisterSW({ immediate: true })

  // Клавиатура: пробел/Enter — прыжок или старт, P/Esc — пауза
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'Space' || e.code === 'Enter') {
        if ((e.target as HTMLElement).closest('button')) return
        e.preventDefault()
        if (state.screen === 'playing') launch()
        else if (state.screen === 'menu' || state.screen === 'over') start()
        else if (state.screen === 'paused') resume()
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        if (state.screen === 'playing') pause()
        else if (state.screen === 'paused') resume()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.screen, launch, start, pause, resume])

  return (
    <MotionConfig reducedMotion="user">
      <main
        className={styles.game}
        // Касание в любом месте — прыжок (кнопки останавливают всплытие сами)
        onPointerDown={(e) => {
          if (e.button !== 0) return
          if (state.screen === 'playing') launch()
        }}
      >
        <canvas ref={canvasRef} className={styles.canvas} aria-label="Игровое поле" role="img" />

        {state.screen === 'playing' && (
          <Hud score={state.score} best={state.best} combo={state.combo} sound={state.sound} onPause={pause} onToggleSound={toggleSound} />
        )}

        <AnimatePresence>
          {state.screen === 'menu' && <Menu key="menu" best={state.best} sound={state.sound} onPlay={start} onToggleSound={toggleSound} />}
          {state.screen === 'paused' && <PauseOverlay key="pause" onResume={resume} onMenu={toMenu} />}
          {state.screen === 'over' && (
            <GameOver key="over" score={state.score} best={state.best} record={state.record} reason={state.overReason} onRetry={start} onMenu={toMenu} />
          )}
        </AnimatePresence>
      </main>
    </MotionConfig>
  )
}
