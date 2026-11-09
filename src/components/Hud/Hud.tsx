import { AnimatePresence, motion } from 'motion/react'
import { Glyph, IconButton } from '../IconButton/IconButton'
import styles from './Hud.module.css'

interface HudProps {
  score: number
  best: number
  combo: number
  sound: boolean
  onPause: () => void
  onToggleSound: () => void
}

/** Счёт, рекорд и комбо поверх игры. Сам HUD «прозрачен» для нажатий — прыжок работает по всему экрану. */
export function Hud({ score, best, combo, sound, onPause, onToggleSound }: HudProps) {
  return (
    <div className={styles.hud}>
      <div className={styles.left}>
        <IconButton label="Пауза" onClick={onPause}>
          <Glyph name="pause" />
        </IconButton>
      </div>

      <div className={styles.center} aria-live="polite">
        <motion.span key={score} className={styles.score} initial={{ scale: 1.35 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
          {score}
        </motion.span>
        <span className={styles.best}>Рекорд {Math.max(best, score)}</span>
        <AnimatePresence>
          {combo > 1 && (
            <motion.span key="combo" className={styles.combo} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              Комбо ×{combo}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className={styles.right}>
        <IconButton label={sound ? 'Выключить звук' : 'Включить звук'} onClick={onToggleSound}>
          <Glyph name={sound ? 'soundOn' : 'soundOff'} />
        </IconButton>
      </div>
    </div>
  )
}
