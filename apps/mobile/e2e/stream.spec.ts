import { expect, onboard, test } from './fixtures'
import { mockTtsStatus } from './learnerApiFlow'

test('adaptive stream rerates, reorders, transports, loves, and learns phrases', async ({
  page,
}) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Stream' }).click()

  await expect(page.getByText("How's this one?")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Previous' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next phrase' })).toBeVisible()
  await expect(page.getByText(/Audio is not available yet/)).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveCount(0)

  await page.getByRole('radio', { name: 'Difficult' }).click()
  await expect(page.getByRole('alert')).toContainText('repeats more, comes back sooner')
  await page.getByRole('button', { name: 'Love this phrase' }).click()
  await expect(page.getByRole('button', { name: 'Remove from loved' })).toBeVisible()

  await expect(page.getByText('This wave')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Practice this phrase' })).toBeVisible()
  await expect(page.getByText('1 / 5')).toBeVisible()
  await page.getByRole('button', { name: 'Next phrase' }).click()
  await expect(page.getByText('2 / 5')).toBeVisible()
  await page.getByRole('button', { name: 'Previous' }).click()
  await expect(page.getByText('1 / 5')).toBeVisible()
  await page.getByRole('button', { name: 'Next phrase' }).click()
  await expect(page.getByText('2 / 5')).toBeVisible()

  await page.getByRole('button', { name: 'Mark learned' }).click()
  await expect(page.getByText('Learned 1')).toBeVisible()
})

test('stream play uses server voice when the TTS status is ready', async ({ page }) => {
  await onboard(page)
  mockTtsStatus(page, true)
  await page.getByRole('button', { name: 'Stream' }).click()
  await expect(page.getByText('Server voice · generated for this phrase')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play phrase', exact: true })).toBeEnabled()
})

test('P3-03: the stream claims no playback it cannot do', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Stream' }).click()

  // The 35% bar over silence and the pips stuck at zero are both gone, and this is the
  // assertion that fails if either comes back before plan 62 owns real playback position.
  // The unnamed form of the bar is `aria-hidden`, so it is invisible to a role locator —
  // `render.spec.ts` catches that one by its geometry.
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  // Equalizer means sound is happening. Web stream has no playable audio, so it stays off.
  await expect(page.getByTestId('equalizer')).toHaveCount(0)

  // Nothing wears a play glyph. The centre control is the queue's forward move and says so.
  await expect(page.getByText('►', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Next phrase' })).toBeVisible()

  await expect(page.getByText(/Audio is not available yet/)).toBeVisible()
})

test('adaptive stream reaches its all-learned empty state', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Stream' }).click()

  for (let remaining = 10; remaining > 0; remaining -= 1) {
    await page.getByRole('button', { name: 'Mark learned' }).click()
  }

  await expect(page.getByText('Your stream is empty')).toBeVisible()
  await expect(page.getByText('Add phrases to build your stream')).toBeVisible()
  await page.getByRole('button', { name: 'Add phrases', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Search phrases' })).toBeVisible()
})

test('manual phrase browsing wraps the queue without recording practice', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Stream' }).click()
  for (let phrase = 0; phrase < 5; phrase += 1) {
    await page.getByRole('button', { name: 'Next phrase' }).click()
  }
  await expect(page.getByText('1 / 5')).toBeVisible()
  await page.getByRole('link', { name: /back/i }).click()
  await expect(page.getByText('0 reps today', { exact: true })).toBeVisible()
})
