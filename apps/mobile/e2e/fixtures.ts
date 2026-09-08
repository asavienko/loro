import { test as base, expect, type Page } from '@playwright/test'
import { todayMarker } from './states'
import { consumeExpectedResourceError } from './expectedResourceErrors'

export const test = base.extend<{ consoleHealth: undefined }>({
  consoleHealth: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error' && !consumeExpectedResourceError(page, message))
          errors.push(`console: ${message.text()}`)
      })
      page.on('pageerror', (error) => {
        errors.push(`page: ${error.message}`)
      })

      await use(undefined)
      expect(errors, 'the app emitted browser errors').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

interface OnboardingChoices {
  goal?: 'A trip coming up' | 'Real conversations' | 'Moving abroad' | 'Just curious'
  level?: 'Starting out' | 'Some basics' | 'Fairly confident'
  minutes?: '5 minutes' | '10 minutes' | '20 minutes'
  packs?: (
    | 'Café & ordering'
    | 'Getting around'
    | 'Eating out'
    | 'Small talk'
    | 'Shopping'
    | 'Survival basics'
  )[]
}

/**
 * Establish durable state through the learner-visible first-run flow, including its
 * real repository writes and canonical selection.
 */
export async function onboard(page: Page, choices: OnboardingChoices = {}): Promise<void> {
  const {
    goal = 'Just curious',
    level = 'Starting out',
    minutes = '10 minutes',
    packs = ['Café & ordering', 'Getting around'],
  } = choices

  await page.goto('/')
  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByRole('button', { name: "Let's go →" }).click()

  await chooseAndContinue(page, 'radio', goal)
  await chooseAndContinue(page, 'radio', level)
  await chooseAndContinue(page, 'radio', minutes)

  const continueButton = page.getByRole('button', { name: 'Continue' })
  await expect(continueButton).toBeDisabled()
  for (const pack of packs) {
    await page.getByRole('checkbox', { name: new RegExp(`^${escapeRegex(pack)}\\.`) }).click()
  }
  await expect(continueButton).toBeEnabled()
  await continueButton.click()

  await expect(page.getByText("You're all set")).toBeVisible()
  await page.getByRole('button', { name: 'Start learning 🎧' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(todayMarker(page)).toBeVisible()
}

export async function openFirstPhrase(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: /0 percent automatic/ })
    .first()
    .click()
  await expect(page).toHaveURL(/\/phrase\//)
  await expect(page.getByRole('button', { name: 'Practice now →' })).toBeVisible()
}

async function chooseAndContinue(
  page: Page,
  role: 'radio' | 'checkbox',
  label: string,
): Promise<void> {
  const continueButton = page.getByRole('button', { name: 'Continue' })
  await expect(continueButton).toBeDisabled()
  await page.getByRole(role, { name: new RegExp(`^${escapeRegex(label)}\\.`) }).click()
  await expect(continueButton).toBeEnabled()
  await continueButton.click()
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
