import { expect, onboard, test } from './fixtures'

test('P2-02..P2-24: discovers, tags, adds, associates, and undoes a phrase', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Add' }).click()

  await expect(page.getByText('10 in stream')).toBeVisible()
  const search = page.getByRole('textbox', { name: 'Search phrases' })
  await search.fill('alergico')
  await expect(page.getByRole('button', { name: /Soy alérgico a los frutos secos/ })).toBeVisible()

  await search.fill('not in this catalog')
  await expect(page.getByText('No matches in the library')).toBeVisible()
  await expect(page.getByText(/Nothing more to suggest here/)).toBeVisible()

  await search.fill('')
  await page.getByRole('button', { name: 'Dinner reservation' }).click()
  await expect(page.getByText('For: Dinner reservation')).toBeVisible()

  const phrase = page.getByRole('button', { name: /¿Tienen una mesa para dos/ })
  await phrase.click()
  await expect(page.getByText('How hard is it for you?')).toBeVisible()
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByRole('button', { name: 'Add to my stream' })).toBeHidden()

  await phrase.click()
  await page.getByRole('radio', { name: 'Difficult' }).click()
  await page.getByRole('checkbox', { name: 'Pronunciation' }).click()
  await page.getByRole('checkbox', { name: 'Very useful' }).click()
  await page.getByRole('button', { name: 'Add to my stream' }).click()

  await expect(page.getByRole('alert')).toContainText('Added — here are more like it')
  await expect(page.getByText('11 in stream')).toBeVisible()
  await expect(page.getByText('More like Dining')).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('10 in stream')).toBeVisible()
})

test('P2-08: browses all themes, drills into one, and returns to the grid', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Add' }).click()
  await page.getByRole('button', { name: 'browse' }).click()

  for (const theme of [
    'Café',
    'Dining',
    'Travel',
    'Directions',
    'Shopping',
    'Small talk',
    'Survival',
    'Hotel',
  ]) {
    await expect(page.getByRole('button', { name: new RegExp(`^${theme},`) })).toBeVisible()
  }

  await page.getByRole('button', { name: /^Dining,/ }).click()
  await expect(page.getByRole('button', { name: 'Back to themes' })).toBeVisible()
  // The drilled list names itself and says how much is left, as the authored header does
  // (`Loro.dc.html:306`). Without it the list was anonymous while the tile it opened had just
  // stated a count.
  await expect(page.getByText('Dining · 4 left')).toBeVisible()
  await expect(page.getByRole('button', { name: /¿Qué me recomienda/ })).toBeVisible()
  await page.getByRole('button', { name: 'Back to themes' }).click()
  await expect(page.getByRole('button', { name: /^Hotel,/ })).toBeVisible()
})

test('P2-08: a finished theme says it is finished, not that the library is empty', async ({
  page,
}) => {
  // Onboarding seeds Café & ordering, which is every Café phrase in the catalog — so the tile
  // reads "all added ✓" and drilling in is the empty case.
  await onboard(page)
  await page.getByRole('button', { name: 'Add' }).click()
  await page.getByRole('button', { name: 'browse' }).click()
  await expect(page.getByRole('button', { name: 'Café, all added ✓' })).toBeVisible()

  await page.getByRole('button', { name: /^Café,/ }).click()
  await expect(page.getByText('Café · 0 left')).toBeVisible()
  await expect(page.getByText(/You have every phrase in this theme/)).toBeVisible()

  // NOT the discover copy: it sends the learner to a search field and a scenario strip, and
  // browse mode renders neither — a screen describing controls it is not showing.
  await expect(page.getByText(/Nothing more to suggest here/)).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Search phrases' })).toHaveCount(0)
})
