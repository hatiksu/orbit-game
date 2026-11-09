import { motion } from 'motion/react'
import styles from './PauseOverlay.module.css'

interface PauseOverlayProps {
  onResume: () => void
  onMenu: () => void
}

export function PauseOverlay({ onResume, onMenu }: PauseOverlayProps) {
  return (
    <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={(e) => e.stopPropagation()}>
      <div className={styles.card} role="dialog" aria-label="Пауза">
        <h2 className={styles.title}>Пауза</h2>
        <button type="button" className={styles.primary} onClick={onResume} autoFocus>
          Продолжить
        </button>
        <button type="button" className={styles.secondary} onClick={onMenu}>
          Выйти в меню
        </button>
      </div>
    </motion.div>
  )
}
