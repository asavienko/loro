import { mockAccountService } from './accountFlow'
import { atInstant } from './clock'
import { expect, onboard, test } from './fixtures'
import { back, open, todayMarker } from './helpers'

test('cold learner links provide a home escape without browser history', async ({ page }) => {
  for (const route of [
    '/add',
    '/progress',
    '/practice/stream',
    '/practice/refrain',
    '/phrase/missing',
  ] as const) {
    await page.goto(route)
    const home = page.getByRole('button', { name: 'Today', exact: true })
    await expect(home).toBeVisible()
    await expect(home).toBeInViewport()
    await home.click()
    // This app is not set up yet: the resolved home starts onboarding rather than a blank Today.
    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByRole('button', { name: "Let's go →" })).toBeVisible()
  }
})

test('unknown and planned deep links return through the safe home gate', async ({ page }) => {
  for (const route of ['/not-a-route', '/practice/review'] as const) {
    await page.goto(route)
    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByRole('button', { name: "Let's go →" })).toBeVisible()
  }

  await onboard(page)
  for (const route of ['/not-a-route', '/practice/review'] as const) {
    await page.goto(route)
    await expect(page).toHaveURL(/\/$/)
    await expect(todayMarker(page)).toBeVisible()
  }
})

test('Add retains Back to Today when entered from the app', async ({ page }) => {
  await onboard(page)
  await open(page, 'Add')
  await back(page)
  await expect(todayMarker(page)).toBeVisible()
})

test('the shared menu connects every built hub and returns from phrase detail', async ({
  page,
}) => {
  await onboard(page)
  for (const [label, path] of [
    ['Add', '/add'],
    ['Progress', '/progress'],
    ['Settings', '/settings'],
    ['Listen', '/listen-export'],
    ['Stream', '/practice/stream'],
    ['The Refrain', '/practice/refrain'],
    ['Today', '/'],
  ] as const) {
    await page.getByRole('button', { name: /, open the menu$/ }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByRole('button', { name: /Chat|Trips/ })).toHaveCount(0)
    await sheet.getByRole('button', { name: label, exact: true }).click()
    await expect(page).toHaveURL((url) => url.pathname === path)
    await expect(sheet).toBeHidden()
  }
  await page
    .getByRole('button', { name: /percent automatic/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Phrase, open the menu' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Today', exact: true }).click()
  await expect(todayMarker(page)).toBeVisible()
})

test('the menu dismisses with Escape and restores keyboard focus', async ({ page }) => {
  await onboard(page)
  await open(page, 'Add')
  const handle = page.getByRole('button', { name: 'Add, open the menu' })
  await handle.focus()
  await handle.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(handle).toBeFocused()
})

test('pull gestures open the menu and dismiss only the sheet', async ({ page }) => {
  await onboard(page)
  const touch = await page.context().newCDPSession(page)
  for (const input of ['mouse', 'touch'] as const) {
    const drag = async (id: string, dx: number, dy: number, cancel = false) => {
      const bounds = await page.getByTestId(id).boundingBox()
      if (!bounds) throw new Error(`Missing gesture handle: ${id}`)
      const x = bounds.x + bounds.width / 2
      const y = bounds.y + bounds.height / 2
      if (input === 'mouse') {
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(x + dx, y + dy, { steps: 12 })
        await page.mouse.up()
      } else {
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y }],
        })
        for (let step = 1; step <= 12; step++) {
          await touch.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: x + (dx * step) / 12, y: y + (dy * step) / 12 }],
          })
        }
        await touch.send('Input.dispatchTouchEvent', {
          type: cancel ? 'touchCancel' : 'touchEnd',
          touchPoints: [],
        })
      }
    }
    await drag('navigation-pull-handle', 0, 70)
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await drag('sheet-pull-handle', 0, 20)
    await expect(dialog).toBeVisible()
    await drag('sheet-pull-handle', 70, 0)
    await expect(dialog).toBeVisible()
    if (input === 'touch') {
      await drag('sheet-pull-handle', 0, 70, true)
      await expect(dialog).toBeVisible()
    }
    await drag('sheet-pull-handle', 0, 70)
    await expect(dialog).toBeHidden()
    await expect(todayMarker(page)).toBeVisible()
  }
  await touch.detach()
  await page.getByRole('button', { name: /, open the menu$/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('More retains ordinary parent returns and uses the Refrain exit policy for active work', async ({
  page,
}) => {
  await atInstant(page, '2026-04-06T10:00')
  await mockAccountService(page)
  await onboard(page)
  await page.getByRole('button', { name: /, open the menu$/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'More', exact: true }).click()
  for (const [label, path] of [
    ['Sign in & sync', '/account'],
    ['Speak', '/practice/speak'],
    ['Stream', '/practice/stream'],
    ['Add', '/add'],
    ['Progress', '/progress'],
    ['Listen', '/listen-export'],
    ['Settings', '/settings'],
    ['Languages', '/languages'],
  ] as const) {
    await expect(page).toHaveURL(/\/more$/)
    await expect(page.getByRole('button', { name: /Chat|Trips|Phrasebook/ })).toHaveCount(0)
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await back(page)
  }
  await page.getByRole('button', { name: 'The Refrain', exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/practice/refrain')
  await expect(page.getByText('No difficult phrases yet')).toBeVisible()
  await back(page)
  await expect(page).toHaveURL(/\/more$/)
})

test('a Refrain exit pauses durably for Today to resume, or ends without losing earned work', async ({
  page,
}) => {
  await atInstant(page, '2026-04-06T10:00')
  await onboard(page)
  await page.getByRole('button', { name: /Start the .* wave/ }).click()
  await page.getByRole('button', { name: 'Practice this phrase' }).click()
  await expect(page.getByRole('button', { name: 'Say it', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Say it', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Chorus it', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Leave practice', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Pause the wave', exact: true }).click()
  await expect(todayMarker(page)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume practice', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Resume practice', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Resume practice', exact: true }).click()
  await expect(page).toHaveURL(
    (url) => url.pathname === '/practice/refrain' && url.searchParams.has('phrase'),
  )
  await expect(page.getByRole('button', { name: 'Chorus it', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Leave practice', exact: true }).click()
  await page.getByRole('button', { name: 'End it here', exact: true }).click()
  await expect(todayMarker(page)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume practice', exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Resume practice', exact: true })).toHaveCount(0)
})
