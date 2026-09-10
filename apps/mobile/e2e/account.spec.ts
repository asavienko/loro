import { expect, onboard, openFirstPhrase, test } from './fixtures'
import {
  ACCOUNT_LABEL,
  backFromCodeToEmail,
  finishSignIn,
  mockAccountService,
  openAccount,
  reachAccount,
  requestCode,
  signInWithProvider,
} from './accountFlow'
import { todayMarker } from './helpers'

async function returnToToday(page: Parameters<typeof openAccount>[0]): Promise<void> {
  await page.getByRole('button', { name: `${ACCOUNT_LABEL}, open the menu` }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Today', exact: true }).click()
  await expect(todayMarker(page)).toBeVisible()
}

test('an invalid sign-in code marks the field invalid for assistive tech', async ({ page }) => {
  await onboard(page)
  await reachAccount(page, 'invalid-code')
  await expect(page.getByRole('textbox', { name: 'Sign-in code' })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
})

test('named back from the code screen returns to the editable email entry', async ({ page }) => {
  await mockAccountService(page)
  await onboard(page)
  await openAccount(page)
  await requestCode(page)
  await backFromCodeToEmail(page)
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Send sign-in code', exact: true })).toBeEnabled()
})

test('optional email sign-in syncs and sign-out keeps durable local practice', async ({ page }) => {
  await mockAccountService(page)
  await onboard(page)
  await openAccount(page)
  await requestCode(page)
  await finishSignIn(page)
  await expect(page.getByText('Your progress is up to date.')).toBeVisible()
  const browserStorage = await page.evaluate(() => JSON.stringify({ localStorage, sessionStorage }))
  expect(browserStorage).not.toContain('e2e-refresh')
  expect(browserStorage).not.toContain('e2e-email-access')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Continue with email', exact: true })).toBeVisible()
  await returnToToday(page)
  await expect(page.getByRole('button', { name: /Stream, 10 phrases/ })).toBeVisible()
})

test('web reload retains progress while requiring a fresh sign-in', async ({ page }) => {
  await mockAccountService(page)
  await onboard(page)
  await openAccount(page)
  await requestCode(page)
  await finishSignIn(page)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Continue with email', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled()
  await returnToToday(page)
})

test('Google and email share the account sync session and preserve local phrase changes', async ({
  page,
}) => {
  const service = await mockAccountService(page)
  await onboard(page)
  await openFirstPhrase(page)
  await page.getByRole('radio', { name: 'Difficult', exact: true }).click()
  const phraseUrl = page.url()
  await openAccount(page)
  await signInWithProvider(page)
  await expect(page.getByText('Your progress is up to date.')).toBeVisible()
  expect(service.requests.filter((request) => request.path.endsWith('/sync/push'))).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        authorization: 'Bearer e2e-provider-access',
        deviceId: 'test-device',
      }),
    ]),
  )
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Continue with email', exact: true })).toBeVisible()
  await page.goto(phraseUrl)
  await expect(page.getByRole('radio', { name: 'Difficult', exact: true })).toBeChecked()
  await page.getByRole('radio', { name: 'Easy', exact: true }).click()
  await openAccount(page)
  await requestCode(page)
  await finishSignIn(page)
  await expect(page.getByText('Your progress is up to date.')).toBeVisible()
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
  await page.goto(phraseUrl)
  await expect(page.getByRole('radio', { name: 'Easy', exact: true })).toBeChecked()
  const browserStorage = await page.evaluate(() => JSON.stringify({ localStorage, sessionStorage }))
  expect(browserStorage).not.toContain('e2e-refresh')
  expect(browserStorage).not.toContain('e2e-provider-access')
  expect(browserStorage).not.toContain('e2e-email-access')
})

test('Apple sign-in uses the same authenticated sync session', async ({ page }) => {
  const service = await mockAccountService(page)
  await onboard(page)
  await openAccount(page)
  await signInWithProvider(page, 'Apple')
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
    await onboard(page)
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
    await returnToToday(page)
  })
}
