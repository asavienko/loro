/** F-08 / plan 72. Opt-in debug fixture; it is not a learner language or manifest state. */
import { test, expect } from './fixtures'
import { signIn, type SignInCopy } from './accountFlow'
import pseudo from '../src/lib/i18n/en-XA.json'
import { parse, TYPE } from '@formatjs/icu-messageformat-parser'
import type { Page } from '@playwright/test'

// These controls are literal-only ICU messages; compare rendered text, not escaped templates.
function label(key: keyof typeof pseudo): string {
  return parse(pseudo[key])
    .map((node) => {
      if (node.type !== TYPE.literal) throw new Error(`Expected a static label: ${key}`)
      return node.value
    })
    .join('')
}

async function expectPhoneWidth(page: Page, surface: string) {
  expect(
    await page.evaluate(() => {
      const root = document.scrollingElement!
      return root.scrollWidth <= root.clientWidth + 1
    }),
    `Expanded ${surface} must fit the phone width`,
  ).toBe(true)
}

test.skip(process.env.EXPO_PUBLIC_PSEUDO_LOCALE !== '1', 'Requires a pseudo-locale dev server')

const PSEUDO_SIGN_IN: SignInCopy = {
  emailMethod: label('account.emailMethod'),
  email: label('account.email'),
  send: label('account.send'),
  code: label('account.codeLabel'),
  verify: label('account.verify'),
  signedIn: label('account.confirmationTitle'),
  continue: label('account.backToPractice'),
}

test('expanded interface copy completes onboarding without transforming learning text', async ({
  page,
}) => {
  await signIn(page, PSEUDO_SIGN_IN)
  await expect(page.getByText(/¡Hola!/)).toBeVisible()
  await page.getByRole('button', { name: label('onboarding.cta.welcome'), exact: true }).click()
  for (const key of [
    'onboarding.steps.goal.options.curious.label',
    'onboarding.steps.level.options.beg.label',
    'onboarding.steps.mins.options.10.label',
  ] as const) {
    await page
      .getByRole('radio')
      .filter({ hasText: label(key) })
      .click()
    await page.getByRole('button', { name: label('onboarding.cta.next'), exact: true }).click()
  }
  await page.getByRole('checkbox').first().click()
  await page.getByRole('button', { name: label('onboarding.cta.next'), exact: true }).click()
  await page.getByRole('button', { name: label('onboarding.cta.ready'), exact: true }).click()
  await expect(page.getByText(label('today.title'), { exact: true }).first()).toBeVisible()
  await expectPhoneWidth(page, 'Today')
})

test('expanded Add controls retain their interactive labels and fit the phone width', async ({
  page,
}) => {
  await signIn(page, PSEUDO_SIGN_IN)
  await page.getByRole('button', { name: label('onboarding.cta.welcome'), exact: true }).click()
  for (const key of [
    'onboarding.steps.goal.options.curious.label',
    'onboarding.steps.level.options.beg.label',
    'onboarding.steps.mins.options.10.label',
  ] as const) {
    await page
      .getByRole('radio')
      .filter({ hasText: label(key) })
      .click()
    await page.getByRole('button', { name: label('onboarding.cta.next'), exact: true }).click()
  }
  await page.getByRole('checkbox').first().click()
  await page.getByRole('button', { name: label('onboarding.cta.next'), exact: true }).click()
  await page.getByRole('button', { name: label('onboarding.cta.ready'), exact: true }).click()

  await page.goto('/add')
  await expect(
    page.getByRole('button', { name: label('add.modes.discover'), exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: label('add.modes.browse'), exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: label('add.modes.import'), exact: true }),
  ).toBeVisible()
  await expectPhoneWidth(page, 'Add')
})
