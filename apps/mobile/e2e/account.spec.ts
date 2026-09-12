import { completeOnboarding, expect, onboard, openFirstPhrase, signIn, test } from './fixtures'
import {
  backFromCodeToEmail,
  mockAccountService,
  openAccount,
  reachAccount,
  requestCode,
  signInWithProvider,
} from './accountFlow'
import { todayMarker } from './helpers'

test('an unsigned visitor cannot open Today', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/account/)
  await expect(page.getByRole('button', { name: 'Continue with email', exact: true })).toBeVisible()
  await expect(todayMarker(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /, open the menu$/ })).toHaveCount(0)
})

test('an invalid sign-in code marks the field invalid for assistive tech', async ({ page }) => {
  await reachAccount(page, 'invalid-code')
  await expect(page.getByRole('textbox', { name: 'Sign-in code' })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
})

test('named back from the code screen returns to the editable email entry', async ({ page }) => {
  await mockAccountService(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/account/)
  await requestCode(page)
  await backFromCodeToEmail(page)
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Send sign-in code', exact: true })).toBeEnabled()
})

test('email sign-in reaches practice and sign-out returns to the sign-in gate', async ({
  page,
}) => {
  await mockAccountService(page)
  await onboard(page)
  await openAccount(page)
  await expect(page.getByText('Your progress is up to date.')).toBeVisible()
  const localStorage = await page.evaluate(() =>
    JSON.stringify({ localStorage: window.localStorage }),
  )
  expect(localStorage).not.toContain('e2e-refresh')
  expect(localStorage).not.toContain('e2e-email-access')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Continue with email', exact: true })).toBeVisible()
  await page.goto('/')
  await expect(page).toHaveURL(/\/account/)
  await expect(todayMarker(page)).toHaveCount(0)
  await signIn(page)
  await expect(todayMarker(page)).toBeVisible()
  await expect(page.getByRole('button', { name: /Stream, 10 phrases/ })).toBeVisible()
})

test('web reload keeps the signed-in e2e session and durable progress', async ({ page }) => {
  await mockAccountService(page)
  await onboard(page)
  await expect(todayMarker(page)).toBeVisible()
  await page.reload()
  await expect(todayMarker(page)).toBeVisible()
  await expect(page.getByRole('button', { name: /Stream, 10 phrases/ })).toBeVisible()
})

test('Google and email share the account sync session and preserve local phrase changes', async ({
  page,
}) => {
  const service = await mockAccountService(page)
  await page.goto('/')
  await signInWithProvider(page)
  await completeOnboarding(page)
  await openFirstPhrase(page)
  await page.getByRole('radio', { name: 'Difficult', exact: true }).click()
  const phraseUrl = page.url()
  await expect(
    page.getByText(/repeats more, comes back sooner|Your progress is up to date/),
  ).toBeVisible()
  expect(service.requests.filter((request) => request.path.endsWith('/sync/push'))).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        authorization: 'Bearer e2e-provider-access',
        deviceId: 'test-device',
      }),
    ]),
  )
  await openAccount(page)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Continue with email', exact: true })).toBeVisible()
  await page.goto(phraseUrl)
  await expect(page).toHaveURL(/\/account/)
  await requestCode(page)
  await page.getByRole('textbox', { name: 'Sign-in code' }).fill('123456')
  await page.getByRole('button', { name: 'Verify and sign in', exact: true }).click()
  await expect(page.getByText('You’re signed in', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back to practice', exact: true }).click()
  await page.goto(phraseUrl)
  await expect(page.getByRole('radio', { name: 'Difficult', exact: true })).toBeChecked()
  await page.getByRole('radio', { name: 'Easy', exact: true }).click()
  expect(service.requests.filter((request) => request.path.endsWith('/sync/push'))).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        authorization: 'Bearer e2e-email-access',
        deviceId: 'test-device',
      }),
    ]),
  )
  const exchange = service.requests.find((request) => request.path.endsWith('/auth/exchange'))
  const verify = service.requests.find((request) =>
    request.path.endsWith('/auth/magic-link/verify'),
  )
  expect(exchange?.body).toEqual(
    expect.objectContaining({
      anon_id: expect.any(String),
      device: expect.objectContaining({ installation_id: expect.any(String), platform: 'web' }),
      code_verifier: expect.any(String),
      ticket: 't'.repeat(43),
    }),
  )
  expect(verify?.body).toEqual(
    expect.objectContaining({
      anon_id: (exchange?.body as { anon_id: string }).anon_id,
      device: (exchange?.body as { device: unknown }).device,
    }),
  )
  await expect(page.getByRole('radio', { name: 'Easy', exact: true })).toBeChecked()
  const localStorage = await page.evaluate(() =>
    JSON.stringify({ localStorage: window.localStorage }),
  )
  expect(localStorage).not.toContain('e2e-refresh')
  expect(localStorage).not.toContain('e2e-provider-access')
  expect(localStorage).not.toContain('e2e-email-access')
})

test('Apple sign-in uses the same authenticated sync session', async ({ page }) => {
  const service = await mockAccountService(page)
  await page.goto('/')
  await signInWithProvider(page, 'Apple')
  await completeOnboarding(page)
  await openAccount(page)
  await expect(page.getByText('Your progress is up to date.')).toBeVisible()
  expect(service.requests.map((request) => request.path)).toContain('/v1/auth/apple/start')
  expect(service.requests.filter((request) => request.path.endsWith('/sync/pull'))).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        authorization: 'Bearer e2e-provider-access',
        deviceId: 'test-device',
      }),
    ]),
  )
})

for (const [provider, scenario] of [
  ['Google', 'error'],
  ['Google', 'cancelled'],
  ['Apple', 'error'],
  ['Apple', 'cancelled'],
] as const) {
  test(`${provider} ${scenario === 'error' ? 'rejected callback state' : 'cancelled provider sign-in'} creates no exchange or app session`, async ({
    page,
  }) => {
    const service = await reachAccount(page, scenario, provider)
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Continue with Apple' })).toBeEnabled()
    await expect(
      page.getByRole('button', { name: 'Continue with email', exact: true }),
    ).toBeVisible()
    expect(service.requests.filter((request) => request.path.endsWith('/auth/exchange'))).toEqual(
      [],
    )
    expect(service.requests.filter((request) => request.path.includes('/sync/'))).toEqual([])
    await page.goto('/')
    await expect(page).toHaveURL(/\/account/)
  })
}
