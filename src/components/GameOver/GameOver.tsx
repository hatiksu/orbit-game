import { motion } from 'motion/react'
import type { OverReason } from '../../game/types'
import styles from './GameOver.module.css'

interface GameOverProps {
  score: number
  best: number
  record: boolean
  reason?: OverReason
  onRetry: () => void
  onMenu: () => void
}

const REASONS: Record<OverReason, string> = {
  lost: 'Улетел в открытый космос',
  collapse: 'Планета разрушилась — не медли',
  asteroid: 'Столкновение с астероидом',
}

export function GameOver({ score, best, record, reason, onRetry, onMenu }: GameOverProps) {
  return (
    <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.5 }}>
      <motion.div
        className={styles.card}
        role="dialog"
        aria-label="Игра окончена"
        initial={{ y: 30, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 22 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {record ? <p className={styles.record}>🏆 Новый рекорд!</p> : <p className={styles.reason}>{reason ? REASONS[reason] : 'Игра окончена'}</p>}
        <p className={styles.label}>Счёт</p>
        <p className={styles.score} data-testid="final-score">
          {score}
        </p>
        <p className={styles.best}>Рекорд: {best}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onRetry} autoFocus>
            Ещё раз
          </button>
          <button type="button" className={styles.secondary} onClick={onMenu}>
            В меню
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
