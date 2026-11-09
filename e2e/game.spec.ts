import { expect, test, type Page } from '@playwright/test'

// Фиксированный уровень (?seed) и доступ к состоянию мира (?debug) — тесты воспроизводимы
const URL = './?seed=42&debug'

const overDialog = (page: Page) => page.getByRole('dialog', { name: 'Игра окончена' })

/**
 * Автопилот прямо в браузере: следит за миром и «касается экрана», когда касательная
 * к орбите смотрит в следующую планету. Так проверяем настоящий путь ввода — через касание.
 */
async function autopilot(page: Page, seconds: number) {
  await page.evaluate(async (ms) => {
    type P = { id: number; x: number; y: number; r: number; orbitR: number; spin: number }
    const api = (window as unknown as { __orbit: { world: () => { player: Record<string, number | string>; planets: P[]; visited: number[]; status: string } } }).__orbit
    const main = document.querySelector('main')!
    const end = performance.now() + ms
    let cooldown = 0
    while (performance.now() < end) {
      await new Promise((r) => requestAnimationFrame(r))
      const w = api.world()
      if (w.status !== 'playing') break
      const me = w.player
      if (me.state !== 'orbit' || performance.now() < cooldown) continue
      const cur = w.planets.find((p) => p.id === me.planetId)!
      const target = w.planets.filter((p) => !w.visited.includes(p.id) && p.y < cur.y).sort((a, b) => b.y - a.y)[0]
      if (!target) continue
      const angle = me.angle as number
      const tx = -Math.sin(angle) * cur.spin
      const ty = Math.cos(angle) * cur.spin
      const rx = target.x - (me.x as number)
      const ry = target.y - (me.y as number)
      if (rx * tx + ry * ty <= 0) continue
      const miss = Math.abs(rx * ty - ry * tx)
      // Целимся между поверхностью планеты и краем её орбиты
      if (miss < target.orbitR - 15 && miss > target.r + 15) {
        main.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
        cooldown = performance.now() + 400
      }
    }
  }, seconds * 1000)
}

test('меню: название, кнопка и правила', async ({ page }) => {
  await page.goto(URL)
  await expect(page.getByRole('heading', { name: 'Орбита' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Играть' })).toBeVisible()
  await expect(page.getByText('Поймай орбиту следующей планеты')).toBeVisible()
})

test('если медлить, планета разрушается и игра заканчивается', async ({ page }) => {
  await page.goto(URL)
  await page.getByRole('button', { name: 'Играть' }).click()
  await expect(page.getByLabel('Пауза')).toBeVisible()
  await expect(overDialog(page)).toBeVisible({ timeout: 12_000 })
  await expect(overDialog(page)).toContainText('Планета разрушилась')
  await expect(page.getByTestId('final-score')).toHaveText('0')
})

test('касания по экрану: игрок перелетает между планетами и набирает очки, рекорд сохраняется', async ({ page }) => {
  await page.goto(URL)
  await page.getByRole('button', { name: 'Играть' }).click()
  await autopilot(page, 8)
  const score = await page.evaluate(() => (window as unknown as { __orbit: { world: () => { score: number } } }).__orbit.world().score)
  expect(score).toBeGreaterThanOrEqual(3)

  // Доводим игру до конца и проверяем рекорд
  await expect(overDialog(page)).toBeVisible({ timeout: 15_000 })
  const final = Number(await page.getByTestId('final-score').textContent())
  expect(final).toBeGreaterThanOrEqual(score)
  await expect(overDialog(page)).toContainText('Новый рекорд')

  await page.reload()
  await expect(page.getByText(`Рекорд: ${final}`)).toBeVisible()
})

test('пауза кнопкой и клавишей, продолжение, выход в меню', async ({ page }) => {
  await page.goto(URL)
  await page.getByRole('button', { name: 'Играть' }).click()
  await page.getByLabel('Пауза').click()
  const pause = page.getByRole('dialog', { name: 'Пауза' })
  await expect(pause).toBeVisible()
  await page.getByRole('button', { name: 'Продолжить' }).click()
  await expect(pause).toBeHidden()

  await page.keyboard.press('Escape')
  await expect(pause).toBeVisible()
  await page.getByRole('button', { name: 'Выйти в меню' }).click()
  await expect(page.getByRole('button', { name: 'Играть' })).toBeVisible()
})

test('пробел запускает игру и прыжок', async ({ page }) => {
  await page.goto(URL)
  await expect(page.getByRole('button', { name: 'Играть' })).toBeVisible()
  await page.keyboard.press('Space')
  await expect(page.getByLabel('Пауза')).toBeVisible()
  await page.keyboard.press('Space')
  // Первая касательная уводит в сторону — игрок улетает
  await expect(overDialog(page)).toBeVisible({ timeout: 6_000 })
  await expect(overDialog(page)).toContainText('Улетел в открытый космос')
  await page.getByRole('button', { name: 'Ещё раз' }).click()
  await expect(page.getByLabel('Пауза')).toBeVisible()
})

test('звук выключается и это запоминается', async ({ page }) => {
  await page.goto(URL)
  await page.getByRole('button', { name: 'Выключить звук' }).click()
  await expect(page.getByRole('button', { name: 'Включить звук' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Включить звук' })).toBeVisible()
})

test('игра открывается без интернета после первого запуска', async ({ page, context }) => {
  await page.goto(URL)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Орбита' })).toBeVisible()
  await context.setOffline(false)
})
