import { motion } from 'motion/react'
import { Glyph, IconButton } from '../IconButton/IconButton'
import styles from './Menu.module.css'

interface MenuProps {
  best: number
  sound: boolean
  onPlay: () => void
  onToggleSound: () => void
}

const RULES = [
  { icon: '👆', text: 'Касание — сорваться с орбиты по касательной' },
  { icon: '🪐', text: 'Поймай орбиту следующей планеты' },
  { icon: '⏳', text: 'Не задерживайся: планета разрушается' },
  { icon: '✨', text: 'Вход по касательной — «Идеально» и комбо' },
  { icon: '☄️', text: 'Берегись астероидов, собирай звёзды' },
]

export function Menu({ best, sound, onPlay, onToggleSound }: MenuProps) {
  return (
    <motion.div className={styles.menu} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className={styles.top}>
        <IconButton label={sound ? 'Выключить звук' : 'Включить звук'} onClick={onToggleSound}>
          <Glyph name={sound ? 'soundOn' : 'soundOff'} />
        </IconButton>
      </div>

      <div className={styles.inner}>
        <motion.h1 className={styles.title} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          Орбита
        </motion.h1>
        <p className={styles.subtitle}>Аркада в одно касание</p>

        <motion.button
          type="button"
          className={styles.play}
          onClick={onPlay}
          onPointerDown={(e) => e.stopPropagation()}
          whileTap={{ scale: 0.95 }}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 18 }}
        >
          <Glyph name="play" /> Играть
        </motion.button>
        {best > 0 && <p className={styles.best}>Рекорд: {best}</p>}

        <ul className={styles.rules}>
          {RULES.map((r, i) => (
            <motion.li key={r.text} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.06 }}>
              <span aria-hidden="true">{r.icon}</span>
              {r.text}
            </motion.li>
          ))}
        </ul>
        <p className={styles.keys}>На компьютере: пробел — прыжок, P или Esc — пауза</p>
      </div>
    </motion.div>
  )
}
