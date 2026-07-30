import { expect, test } from './fixtures'

test(
  'P1-01..P1-09: completes all six onboarding steps and seeds the stream',
  {
    tag: '@smoke',
  },
  async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByText("¡Hola! I'm Loro")).toBeVisible()
    await expect(page.getByText('Learn Spanish by the phrase')).toBeVisible()
    await page.getByRole('button', { name: "Let's go →" }).click()

    const continueButton = page.getByRole('button', { name: 'Continue' })
    await expect(continueButton).toBeDisabled()
    await page.getByRole('radio', { name: /A trip coming up/ }).click()
    await continueButton.click()

    await page.getByRole('button', { name: 'Back' }).click()
    await expect(continueButton).toBeEnabled()
    await page.getByRole('radio', { name: /Just curious/ }).click()
    await continueButton.click()

    await expect(continueButton).toBeDisabled()
    await page.getByRole('radio', { name: /Starting out/ }).click()
    await continueButton.click()

    await expect(continueButton).toBeDisabled()
    await page.getByRole('radio', { name: /10 minutes/ }).click()
    await continueButton.click()

    await expect(continueButton).toBeDisabled()
    await page.getByRole('checkbox', { name: /Café & ordering/ }).click()
    await page.getByRole('checkbox', { name: /Getting around/ }).click()
    await continueButton.click()

    await expect(page.getByText("You're all set")).toBeVisible()
    await expect(page.getByText('10 phrases are in your stream')).toBeVisible()
    await expect(page.getByText('curious', { exact: true })).toBeVisible()
    await expect(page.getByText('10 min', { exact: true })).toBeVisible()
    await expect(page.getByText('2 selected', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Start learning 🎧' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('Today', { exact: true })).toBeVisible()
    await expect(page.getByText('10', { exact: true })).toHaveCount(1)
    await expect(page.getByText('in your stream', { exact: true })).toBeVisible()
  },
)
