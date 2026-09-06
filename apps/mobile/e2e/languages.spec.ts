import { expect, test, onboard } from './fixtures'
import { NATIVE_LANGUAGES, TARGET_LOCALES, supportsPair } from '@loro/core'
import { localeText as resources, onboardPair } from './languageFlow'

for (const native of NATIVE_LANGUAGES)
  for (const target of TARGET_LOCALES) {
    if (!supportsPair(native, target)) continue
    test(`F-08: ${native} → ${target} onboarding, content and practice`, async ({ page }) => {
      const text = resources[native]
      await onboardPair(page, native, target)
      await page.getByRole('button', { name: text['today.rail.add'], exact: true }).click()
      await expect(page.getByRole('textbox', { name: text['a11y.add.searchInput'] })).toBeVisible()
      // Add a real suggestion through the sheet, then inspect practice and progress.
      await page
        .getByRole('button')
        .filter({ has: page.locator(`[lang="${target}"]`) })
        .first()
        .click()
      await page.getByRole('button', { name: text['add.confirm'], exact: true }).click()
      await page.getByRole('link', { name: text['a11y.common.back'], exact: true }).click()
      await page.getByRole('button', { name: new RegExp(`^${text['common.stream']},`) }).click()
      await expect(page.locator(`[lang="${target}"]:visible`).first()).toBeVisible()
      await expect(page.getByText(text['stream.audioNote'])).toBeVisible()
      await page.getByRole('link', { name: text['a11y.common.back'], exact: true }).click()
      await page.getByRole('button', { name: text['common.progress'], exact: true }).click()
      await expect(page.getByText(text['progress.mastery.title'])).toBeVisible()
    })
  }

test('F-08: switching courses restores the Spanish collection', async ({ page }) => {
  await onboard(page)
  const openLanguages = async (): Promise<void> => {
    await page.getByRole('button', { name: /Today, open the menu/ }).click()
    await page.getByRole('button', { name: 'Languages', exact: true }).click()
  }
  await openLanguages()
  await page
    .getByRole('radiogroup', { name: 'I want to learn' })
    .getByRole('radio', { name: 'Български' })
    .click()
  await page.getByRole('button', { name: 'Save languages' }).click()
  await expect(page.getByText('Pick a few starter packs')).toBeVisible()
  await page.getByRole('checkbox').first().click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Start learning 🎧' }).click()
  await expect(page.getByRole('button', { name: 'Stream, 4 phrases' })).toBeVisible()
  await openLanguages()
  await page
    .getByRole('radiogroup', { name: 'I want to learn' })
    .getByRole('radio', { name: 'Español' })
    .click()
  await page.getByRole('button', { name: 'Save languages' }).click()
  await expect(page.getByRole('button', { name: 'Stream, 10 phrases' })).toBeVisible()
})
