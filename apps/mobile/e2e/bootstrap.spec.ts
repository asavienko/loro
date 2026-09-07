import { test, expect, onboard } from './fixtures'
import { reachBootstrap, reachWriteFailure } from './bootstrapFlow'

test('P2-04: startup holds learner routes until local initialization completes', async ({
  page,
}) => {
  await reachBootstrap(page, 'loading')
  await expect(page.getByRole('button', { name: "Let's go →" })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /open the menu/ })).toHaveCount(0)
})

test('P2-04: failed startup keeps routes closed and can retry without resetting data', async ({
  page,
}) => {
  await reachBootstrap(page, 'error')
  await expect(page.getByRole('button', { name: "Let's go →" })).toHaveCount(0)
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('button', { name: "Let's go →" })).toBeVisible()
})

test('P2-04: failed course save retains the selection and retries the original action', async ({
  page,
}) => {
  await onboard(page)
  await reachWriteFailure(page)
  await expect(page).toHaveURL(/\/languages$/)
  const selection = page
    .getByRole('radiogroup', { name: 'I want to learn' })
    .getByRole('radio', { name: 'Български' })
  await expect(selection).toBeChecked()
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click()
  await expect(selection).toBeChecked()
  await page.getByRole('button', { name: 'Save languages' }).click()
  await expect(page.getByText('Pick a few starter packs')).toBeVisible()
})

test('P2-04: startup scenarios remain deterministic in a sequential manifest sweep', async ({
  page,
}) => {
  for (const scenario of ['loading', 'error', 'loading', 'error'] as const) {
    await reachBootstrap(page, scenario)
    if (scenario === 'error') {
      await page.getByRole('button', { name: 'Try again', exact: true }).click()
      await expect(page.getByRole('button', { name: "Let's go →" })).toBeVisible()
    }
  }
})
