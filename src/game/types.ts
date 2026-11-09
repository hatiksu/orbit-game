// Типы игрового мира. Мир — обычные данные без DOM: его можно сохранить, сравнить и проверить в тестах.

/** Мир в «игровых единицах»: ширина поля всегда 1000, высота зависит от экрана. Ось Y направлена вниз, игрок летит вверх. */
export const FIELD_WIDTH = 1000

export interface Planet {
  id: number
  /** Базовая позиция (для движущихся планет x меняется от неё) */
  baseX: number
  x: number
  y: number
  /** Радиус самой планеты */
  r: number
  /** Радиус орбиты, по которой летает игрок */
  orbitR: number
  /** Направление вращения игрока вокруг этой планеты: 1 — по часовой, −1 — против */
  spin: 1 | -1
  /** Угловая скорость, рад/с */
  omega: number
  /** Сколько секунд можно провести на орбите, прежде чем планета разрушится */
  life: number
  /** Оттенок для рендера (0–360) */
  hue: number
  /** Покачивание по горизонтали (для поздних планет) */
  sway?: { amp: number; speed: number; phase: number }
}

export interface Star {
  id: number
  x: number
  y: number
  taken: boolean
}

export interface Asteroid {
  id: number
  planetId: number
  angle: number
  dist: number
  /** Угловая скорость, рад/с (знак — направление) */
  speed: number
  r: number
  x: number
  y: number
}

export type Player =
  | { state: 'orbit'; planetId: number; angle: number; x: number; y: number }
  | { state: 'flight'; fromPlanetId: number; x: number; y: number; vx: number; vy: number; flightTime: number }
  | { state: 'dead'; x: number; y: number }

export type OverReason = 'lost' | 'collapse' | 'asteroid'

export type GameEvent =
  | { type: 'launch' }
  | { type: 'capture'; planetId: number; points: number; perfect: boolean; combo: number; x: number; y: number; hue: number }
  | { type: 'star'; x: number; y: number }
  | { type: 'warning'; planetId: number }
  | { type: 'over'; reason: OverReason; x: number; y: number }

export interface World {
  /** Состояние генератора случайных чисел — мир полностью воспроизводим */
  rng: number
  time: number
  planets: Planet[]
  stars: Star[]
  asteroids: Asteroid[]
  player: Player
  score: number
  combo: number
  /** Сколько планет пройдено (для сложности) */
  captures: number
  /** Время на текущей орбите, с */
  orbitTime: number
  /** Камера следует за игроком: y верхней точки обзора в мировых координатах смещается плавно */
  cameraY: number
  visited: number[]
  nextId: number
  /** Сколько планет сгенерировано — по нему растёт сложность новых планет */
  generated: number
  /** Накопитель для фиксированного шага физики */
  acc: number
  status: 'playing' | 'over'
  overReason?: OverReason
  /** События за последний вызов update — для звука, частиц и вибрации */
  events: GameEvent[]
  warned: boolean
}

export interface Input {
  /** Игрок нажал «сорваться с орбиты» с прошлого кадра */
  launch: boolean
}
