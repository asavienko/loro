import { expect, type Page } from '@playwright/test'
import { signIn } from './accountFlow'
import { LANGUAGE_NAMES, type NativeLanguage, type TargetLocale } from '@loro/core'
import en from '../src/lib/i18n/en.json'
import bg from '../src/lib/i18n/bg.json'
import ru from '../src/lib/i18n/ru.json'

export const localeText = { en, bg, ru }
/** Real UI setup shared by the pair matrix and accessibility/text-scale states. */
export async function onboardPair(
  page: Page,
  native: NativeLanguage,
  target: TargetLocale,
): Promise<void> {
  const text = localeText[native]
  await signIn(page)
  await page.goto('/onboarding')
  await page
    .getByRole('radiogroup', { name: en['languages.native'] })
    .getByRole('radio', { name: LANGUAGE_NAMES[native], exact: true })
    .click()
  await page
    .getByRole('radiogroup', { name: text['languages.target'] })
    .getByRole('radio', { name: LANGUAGE_NAMES[target], exact: true })
    .click()
  await page.getByRole('button', { name: text['onboarding.cta.welcome'] }).click()
  for (const label of [
    text['onboarding.steps.goal.options.curious.label'],
    text['onboarding.steps.level.options.beg.label'],
    text['onboarding.steps.mins.options.10.label'],
  ]) {
    await page.getByRole('radio', { name: new RegExp(`^${label}`) }).click()
    await page.getByRole('button', { name: text['onboarding.cta.next'], exact: true }).click()
  }
  await page.getByRole('checkbox').first().click()
  await page.getByRole('button', { name: text['onboarding.cta.next'], exact: true }).click()
  await page.getByRole('button', { name: text['onboarding.cta.ready'] }).click()
  await expect(page.getByText(text['today.title'], { exact: true }).first()).toBeVisible()
}
