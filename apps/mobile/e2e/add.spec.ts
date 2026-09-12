import { expect, onboard, test } from './fixtures'
import { fillField } from './helpers'

test('P2-02..P2-24: discovers, tags, adds, associates, and undoes a phrase', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Add' }).click()

  await expect(page.getByText('10 in stream')).toBeVisible()
  const search = page.getByRole('textbox', { name: 'Search phrases' })
  await fillField(page, 'Search phrases', 'alergico')
  await expect(page.getByRole('button', { name: /Soy alérgico a los frutos secos/ })).toBeVisible()

  await search.fill('not in this catalog')
  await expect(page.getByText('No matches in the library')).toBeVisible()
  await expect(page.getByText('Add your own')).toBeVisible()
  await expect(page.getByText(/Nothing more to suggest here/)).toHaveCount(0)

  await search.fill('dinner tonight')
  await expect(page.getByRole('button', { name: 'Phrases for Dinner reservation' })).toBeVisible()

  await search.fill('pharmacy')
  await expect(
    page.getByText('Looking for phrases…').or(page.getByText('Suggested for this')),
  ).toBeVisible()
  await expect(page.getByText('Suggested for this')).toBeVisible()
  await expect(page.getByText('Suggested — not from the library')).toBeVisible()
  const suggested = page.getByRole('button', { name: /farmacia de guardia/ })
  await suggested.click()
  await expect(page.getByRole('textbox', { name: 'Phrase to add' })).toBeVisible()
  await page.getByRole('button', { name: 'Add to my stream' }).click()
  await expect(page.getByRole('alert')).toContainText('Added')
  await page.getByRole('button', { name: 'Undo' }).click()

  await search.fill('not in this catalog')
  await page.getByRole('button', { name: /Add .* as your own phrase/ }).click()
  await fillField(page, 'Meaning', 'A phrase I need')
  await page.getByRole('button', { name: 'Add to my stream' }).click()
  await expect(page.getByText('11 in stream')).toBeVisible()
  await expect(page.getByText('Add your own')).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('10 in stream')).toBeVisible()

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
  await expect(page.getByText('More like “¿Tienen una mesa para dos?”')).toBeVisible()
  const recommend = page.getByRole('button', { name: /¿Qué me recomienda/ })
  const delicious = page.getByRole('button', { name: /Estaba delicioso/ })
  const allergic = page.getByRole('button', { name: /Soy alérgico a los frutos secos/ })
  await expect(recommend).toBeVisible()
  const recommendBox = await recommend.boundingBox()
  const deliciousBox = await delicious.boundingBox()
  const allergicBox = await allergic.boundingBox()
  expect(recommendBox).toBeTruthy()
  expect(deliciousBox).toBeTruthy()
  expect(allergicBox).toBeTruthy()
  expect(recommendBox!.y).toBeLessThan(deliciousBox!.y)
  expect(deliciousBox!.y).toBeLessThan(allergicBox!.y)
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

test('P2-09/P2-10: reviews an offline import before persisting each accepted own phrase', async ({
  page,
}) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Add' }).click()
  await page.getByRole('button', { name: 'import' }).click()
  const input = page.getByRole('textbox', { name: 'Phrases to import' })
  await input.fill('¿Dónde está la estación? | Where is the station?\nIncomplete')
  await page.getByRole('button', { name: 'Review phrases' }).click()

  await expect(page.getByText('Add both a phrase and its meaning.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add 1 reviewed phrase' })).toBeVisible()
  await page.getByRole('button', { name: 'Add 1 reviewed phrase' }).click()

  await expect(page.getByText('11 in stream')).toBeVisible()
  // The row is now an own phrase in the same stream projection, while the incomplete line
  // was never saved. A reload in persistence coverage proves the durable half.
  await page.getByRole('button', { name: 'import' }).click()
  await input.fill('¿Donde esta la estacion? | Duplicate')
  await page.getByRole('button', { name: 'Review phrases' }).click()
  await expect(
    page.getByText('Already in your stream. Edit it to keep it as a separate phrase.'),
  ).toBeVisible()
})

test('P2-09: imports a browser text file through the bounded reader', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Add' }).click()
  await page.getByRole('button', { name: 'import' }).click()
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Choose a text file' }).click()
  const chooser = await chooserPromise
  await chooser.setFiles({
    name: 'phrases.tsv',
    mimeType: 'text/tab-separated-values',
    buffer: Buffer.from('Hola\tHello'),
  })
  await expect(page.getByRole('textbox', { name: 'Phrases to import' })).toHaveValue('Hola\tHello')
})

test('P2-09/P2-10: oversized import preserves the draft and recovers with a smaller batch', async ({
  page,
}) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Add' }).click()
  await page.getByRole('button', { name: 'import' }).click()
  const input = page.getByRole('textbox', { name: 'Phrases to import' })
  const oversized = Array.from({ length: 51 }, (_, index) => `Hola ${index} | Hi`).join('\n')
  await input.fill(oversized)
  await page.getByRole('button', { name: 'Review phrases' }).click()
  await expect(page.getByRole('alert')).toContainText('Your text is still here')
  await expect(input).toHaveValue(oversized)
  await expect(page.getByRole('button', { name: /Add .* reviewed phrase/ })).toHaveCount(0)
  await input.fill('Buenas noches | Good night')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: 'Review phrases' }).click()
  await page.getByRole('button', { name: 'Add 1 reviewed phrase' }).click()
  await expect(page.getByText('11 in stream')).toBeVisible()
})

test('P2-09/P2-10: edited import fields keep their draft and cannot bypass sync-safe limits', async ({
  page,
}) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Add' }).click()
  await page.getByRole('button', { name: 'import' }).click()
  await page.getByRole('textbox', { name: 'Phrases to import' }).fill('Hola | Hello')
  await page.getByRole('button', { name: 'Review phrases' }).click()
  const target = page.getByRole('textbox', { name: 'Imported phrase on line 1', exact: true })
  const overLimit = 'a'.repeat(2_001)
  await target.fill(overLimit)
  await expect(page.getByText(/can each have up to 2000 characters/)).toBeVisible()
  await expect(target).toHaveValue(overLimit)
  await expect(page.getByRole('button', { name: 'Add 0 reviewed phrases' })).toBeDisabled()
  await target.fill('Hola de nuevo')
  await expect(page.getByText(/can each have up to 2000 characters/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Add 1 reviewed phrase' }).click()
  await expect(page.getByText('11 in stream')).toBeVisible()
})

test('P2-09/P2-10: a partial import save retains rejected edited rows for correction', async ({
  page,
}) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Add' }).click()
  await page.getByRole('button', { name: 'import' }).click()
  const overLimit = 'a'.repeat(2_001)
  await page
    .getByRole('textbox', { name: 'Phrases to import' })
    .fill(`Hola nueva | New hello\nHola nueva | Duplicate\nIncomplete\n${overLimit} | Meaning`)
  await page.getByRole('button', { name: 'Review phrases' }).click()
  const incompleteTarget = page.getByRole('textbox', {
    name: 'Imported phrase on line 3',
    exact: true,
  })
  // The review permits a separator inside an edited target. Its retained input must encode that
  // value without turning part of the phrase into the meaning on the next review.
  await incompleteTarget.fill('Edited | draft that must survive')
  await page.getByRole('button', { name: 'Add 1 reviewed phrase' }).click()

  await expect(page.getByText('11 in stream')).toBeVisible()
  await expect(incompleteTarget).toHaveValue('Edited | draft that must survive')
  await expect(
    page.getByRole('textbox', { name: 'Imported phrase on line 2', exact: true }),
  ).toHaveValue('Hola nueva')
  await expect(
    page.getByRole('textbox', { name: 'Imported phrase on line 4', exact: true }),
  ).toHaveValue(overLimit)

  await page.getByRole('button', { name: 'Review phrases' }).click()
  await expect(
    page.getByRole('textbox', { name: 'Imported phrase on line 2', exact: true }),
  ).toHaveValue('Edited | draft that must survive')

  await page
    .getByRole('textbox', { name: 'Meaning for imported phrase on line 2', exact: true })
    .fill('Saved after correction')
  await page.getByRole('button', { name: 'Add 1 reviewed phrase' }).click()
  await expect(page.getByText('12 in stream')).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'Imported phrase on line 2', exact: true }),
  ).toHaveCount(0)
})
