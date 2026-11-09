import type { ReactNode } from 'react'
import styles from './IconButton.module.css'

interface IconButtonProps {
  label: string
  onClick: () => void
  children: ReactNode
}

export function IconButton({ label, onClick, children }: IconButtonProps) {
  return (
    <button
      type="button"
      className={styles.button}
      aria-label={label}
      title={label}
      onClick={onClick}
      // Нажатие на кнопку не должно засчитываться как прыжок
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </button>
  )
}

const paths = {
  pause: 'M7 5h3v14H7zM14 5h3v14h-3z',
  play: 'M8 5v14l11-7z',
  soundOn: 'M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z',
  soundOff: 'M4 9v6h4l5 4V5L8 9H4zm12.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z',
} as const

export function Glyph({ name }: { name: keyof typeof paths }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}
