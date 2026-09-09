/** F-08 / plan 72. Opt-in debug fixture; it is not a learner language or manifest state. */
import { test, expect } from './fixtures'
import pseudo from '../src/lib/i18n/en-XA.json'
import { parse, TYPE } from '@formatjs/icu-messageformat-parser'

// These controls are literal-only ICU messages; compare rendered text, not escaped templates.
function label(key: keyof typeof pseudo): string {
  return parse(pseudo[key])
    .map((node) => {
      if (node.type !== TYPE.literal) throw new Error(`Expected a static label: ${key}`)
      return node.value
    })
    .join('')
}

test.skip(process.env.EXPO_PUBLIC_PSEUDO_LOCALE !== '1', 'Requires a pseudo-locale dev server')

test('expanded interface copy completes onboarding without transforming learning text', async ({
  page,
}) => {
  await page.goto('/onboarding')
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
  expect(
    await page.evaluate(() => {
      const root = document.scrollingElement!
      return root.scrollWidth <= root.clientWidth + 1
    }),
    'Expanded Today must fit the phone width',
  ).toBe(true)
})
