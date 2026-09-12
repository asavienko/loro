import { test, expect, onboard } from './fixtures'
import { enter } from './helpers'
import { STATES } from './states'

test('enlarged difficulty labels, queue phrases and detail actions remain readable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 })
  for (const name of ['add · difficulty sheet', 'stream · first phrase', 'phrase detail']) {
    const state = STATES.find((candidate) => candidate.name === name)
    expect(state).toBeDefined()
    await enter(page, state!, onboard)
    await page.evaluate(() => {
      for (const node of Array.from(
        document.querySelectorAll<HTMLElement>('[style*="font-size"]'),
      )) {
        for (const property of ['fontSize', 'lineHeight', 'letterSpacing'] as const) {
          const value = node.style[property]
          if (value.endsWith('px')) node.style[property] = `${Number.parseFloat(value) * 3.1}px`
        }
      }
    })
    if (name === 'add · difficulty sheet') {
      for (const radio of await page.getByRole('dialog').getByRole('radio').all()) {
        const fits = await radio.evaluate((node) => {
          const range = document.createRange()
          range.selectNodeContents(node)
          const text = range.getBoundingClientRect()
          const box = node.getBoundingClientRect()
          return text.left >= box.left && text.right <= box.right + 1
        })
        expect(fits).toBe(true)
      }
    } else if (name === 'stream · first phrase') {
      expect(
        (await page.getByText('¿Cómo llego al museo?', { exact: true }).boundingBox())?.width,
      ).toBeGreaterThan(200)
    } else {
      const learned = page.getByRole('button', { name: 'Mark learned', exact: true })
      await learned.scrollIntoViewIfNeeded()
      await expect(learned).toBeInViewport()
      const action = await page.getByRole('button', { name: /Practice now/ }).boundingBox()
      const status = await learned.boundingBox()
      expect(status!.y + status!.height).toBeLessThan(action!.y)
      await learned.click()
    }
  }
})

test('narrow Progress tiles align and Add phrases remain fully readable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await onboard(page)
  await page.getByRole('button', { name: 'Progress', exact: true }).click()
  const bounds = await Promise.all(
    ['phrases in stream: 10', 'reps done: 0', 'mastered: 0'].map((label) =>
      page.getByLabel(label, { exact: true }).boundingBox(),
    ),
  )
  expect(bounds.every((bound) => bound !== null)).toBe(true)
  expect(new Set(bounds.map((bound) => bound?.y)).size).toBe(1)
  expect(new Set(bounds.map((bound) => bound?.height)).size).toBe(1)
  await page.getByRole('button', { name: 'Progress, open the menu' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click()
  const phrase = page.getByText('¿Tienen una mesa para dos?', { exact: true })
  await expect(phrase).toBeVisible()
  const textMetrics = await phrase.evaluate((node) => {
    const box = node.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(node)
    return {
      overflow: getComputedStyle(node).textOverflow,
      width: node.clientWidth,
      scrollWidth: node.scrollWidth,
      // A phrase can fit on one line with Linux font metrics. Assert that every text
      // fragment is inside its box, including vertically, instead of requiring a wrap.
      fits: Array.from(range.getClientRects()).every(
        (text) =>
          text.left >= box.left - 1 &&
          text.right <= box.right + 1 &&
          text.top >= box.top - 1 &&
          text.bottom <= box.bottom + 1,
      ),
    }
  })
  expect(textMetrics.overflow).toBe('clip')
  expect(textMetrics.scrollWidth).toBeLessThanOrEqual(textMetrics.width + 1)
  expect(textMetrics.fits).toBe(true)
  // Enlarged labels move their controls to separate rows instead of splitting a word.
  for (const name of ['Discover', 'Browse']) {
    const label = page.getByRole('button', { name, exact: true }).getByText(name, { exact: true })
    await label.evaluate((node) => {
      const style = getComputedStyle(node)
      node.style.lineHeight = `${Number.parseFloat(style.lineHeight) * 3.1}px`
      node.style.fontSize = `${Number.parseFloat(style.fontSize) * 3.1}px`
    })
  }
  for (const name of ['Discover', 'Browse']) {
    const label = page.getByRole('button', { name, exact: true }).getByText(name, { exact: true })
    expect(
      await label.evaluate((node) => {
        const range = document.createRange()
        range.selectNodeContents(node)
        return range.getClientRects().length
      }),
    ).toBe(1)
  }
})

test('learner pages keep a readable centered column on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const routes = new Set<string>()
  for (const state of STATES) {
    if (routes.has(state.route)) continue
    routes.add(state.route)
    await enter(page, state, onboard)
    const bounds = await page.getByTestId('app-viewport').boundingBox()
    expect(bounds?.width, state.route).toBe(640)
    expect(bounds?.x, state.route).toBe(400)
  }
})

test('add sheet aligns with the learner column and remains usable on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await onboard(page)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('button', { name: /¿Tienen una mesa para dos/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const button = page.getByRole('button', { name: 'Add to my stream', exact: true })
  const bounds = await button.boundingBox()
  expect(bounds?.x).toBeGreaterThanOrEqual(400)
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(1040)
  await button.click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
})
