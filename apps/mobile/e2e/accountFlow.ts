/** F-01/F-04. Simulated provider transport only; production has no test identity or bypass. */
import { expect, type Page } from '@playwright/test'
import { expectResourceError } from './expectedResourceErrors'

export const ACCOUNT_LABEL = 'Sign in & sync'
export const ACCOUNT_API = 'https://auth.loro.test/v1'
const stamp = '0000000000100:000000:server'
const providerState = 's'.repeat(43)
export type AccountScenario =
  | 'discoveryError'
  | 'unavailable'
  | 'ready'
  | 'busy'
  | 'error'
  | 'cancelled'
  | 'signedIn'
  | 'localSignOut'
  | 'backendUnavailable'
  | 'backendChecking'
  | 'email'
  | 'code'
  | 'connected'
  | 'invalid-code'
  | 'sync-unavailable'
  | 'sync-rejected'
  | 'signed-out'

type ServiceMode = AccountScenario | 'success'
export interface AccountRequest {
  path: string
  body: unknown
  authorization: string | undefined
  deviceId: string | undefined
}
export interface AccountService {
  requests: AccountRequest[]
}

export async function mockAccountService(
  page: Page,
  mode: ServiceMode = 'success',
): Promise<AccountService> {
  // Whole-manifest sweeps reuse the context. Release its pending-provider popup first.
  for (const popup of page.context().pages()) {
    if (popup !== page) await popup.close()
  }
  // Replace the previous scenario's handlers. Playwright evaluates context routes in
  // registration order, so leaving an earlier mock installed makes a later state inherit its
  // response (for example, sync-unavailable instead of sync-rejected).
  await page.context().unroute(`${ACCOUNT_API}/**`)
  await page.context().unroute('https://provider.loro.test/**')
  const requests: AccountRequest[] = []
  await page.context().route(`${ACCOUNT_API}/**`, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const body: unknown = request.postData() ? request.postDataJSON() : null
    requests.push({
      path,
      body,
      authorization: request.headers().authorization,
      deviceId: request.headers()['x-loro-device'],
    })
    if (path.endsWith('/health/ready')) {
      if (mode === 'backendChecking') return
      await route.fulfill({
        json:
          mode === 'backendUnavailable'
            ? { status: 'degraded', checks: { content: 'ok', merge: 'unavailable' } }
            : { status: 'ok', checks: { content: 'ok', merge: 'ok' } },
      })
      return
    }
    if (path.endsWith('/auth/providers')) {
      await route.fulfill({
        json:
          mode === 'discoveryError'
            ? {}
            : { providers: mode === 'unavailable' ? [] : ['google', 'apple'] },
      })
      return
    }
    if (path.endsWith('/start')) {
      await route.fulfill({
        json: {
          authorization_url: `https://provider.loro.test/authorize?state=${providerState}`,
          state: providerState,
        },
      })
      return
    }
    if (path.endsWith('/auth/logout')) {
      await route.fulfill(
        mode === 'localSignOut'
          ? { status: 200, contentType: 'application/json', body: 'unreadable-response' }
          : { status: 204 },
      )
      return
    }
    if (mode === 'invalid-code' && path.endsWith('/auth/magic-link/verify')) {
      expectResourceError(page, request.url(), 401)
      await route.fulfill({ status: 401, json: { error: 'UNAUTHORIZED' } })
      return
    }
    if (mode === 'sync-unavailable' && path.includes('/sync/')) {
      expectResourceError(page, request.url(), 503)
      await route.fulfill({ status: 503, json: { error: 'UNAVAILABLE' } })
      return
    }
    if (path.endsWith('/auth/magic-link')) {
      await route.fulfill({ status: 202, json: { status: 'accepted' } })
      return
    }
    if (path.endsWith('/auth/magic-link/verify') || path.endsWith('/auth/exchange')) {
      await route.fulfill({
        json: {
          access_token: path.endsWith('/auth/exchange')
            ? 'e2e-provider-access'
            : 'e2e-email-access',
          refresh_token: 'e2e-refresh',
          expires_in: 900,
          device_id: 'test-device',
          user: { id: 'test-account', created_at: 100 },
          claim: { performed: true, mode: 'bind', claim_id: 'test-claim', upload_required: true },
        },
      })
      return
    }
    if (path.endsWith('/sync/push')) {
      await route.fulfill({
        json: {
          accepted:
            mode === 'sync-rejected'
              ? []
              : typeof body === 'object' &&
                  body !== null &&
                  'ops' in body &&
                  Array.isArray(body.ops)
                ? body.ops.map((op: { seq: number }) => op.seq)
                : [],
          rejected:
            mode === 'sync-rejected' &&
            typeof body === 'object' &&
            body !== null &&
            'ops' in body &&
            Array.isArray(body.ops)
              ? body.ops.map((op: { seq: number }, index: number) => ({
                  index,
                  seq: op.seq,
                  code: 'VALIDATION_FAILED',
                }))
              : [],
          conflicts: [],
          server_hlc: stamp,
          server_time: 100,
        },
      })
      return
    }
    if (path.endsWith('/sync/pull')) {
      await route.fulfill({
        json: {
          changes: [],
          next: 'test-cursor',
          has_more: false,
          server_hlc: stamp,
          server_time: 100,
        },
      })
      return
    }
    throw new Error(`Unexpected account request: ${request.method()} ${path}`)
  })
  await page.context().route('https://provider.loro.test/**', async (route) => {
    const callback = new URL('/account', page.url())
    callback.searchParams.set('state', mode === 'error' ? 'wrong' : providerState)
    callback.searchParams.set('ticket', 't'.repeat(43))
    await route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><body><a href="${callback.toString()}">Finish provider sign-in</a></body></html>`,
    })
  })
  return { requests }
}

export async function openAccount(page: Page): Promise<void> {
  await page.getByRole('button', { name: /, open the menu$/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: ACCOUNT_LABEL, exact: true }).click()
  await expect(page).toHaveURL(/\/account$/)
}
export async function requestCode(page: Page): Promise<void> {
  await page.getByRole('textbox', { name: 'Email address' }).fill('learner@example.com')
  await page.getByRole('button', { name: 'Send sign-in code', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Six-digit code' })).toBeVisible()
}
export async function finishSignIn(page: Page): Promise<void> {
  await page.getByRole('textbox', { name: 'Six-digit code' }).fill('123456')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('Your account is connected.')).toBeVisible()
}
export async function signInWithProvider(
  page: Page,
  provider: 'Google' | 'Apple' = 'Google',
  scenario: 'signedIn' | 'busy' | 'error' | 'cancelled' = 'signedIn',
): Promise<void> {
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: `Continue with ${provider}` }).click()
  const popup = await popupPromise
  await expect(popup.getByRole('link', { name: 'Finish provider sign-in' })).toBeVisible()
  if (scenario === 'busy') {
    await expect(page.getByText('Connecting…', { exact: true })).toBeVisible()
    return
  }
  if (scenario === 'cancelled') await popup.close()
  else await popup.getByRole('link', { name: 'Finish provider sign-in' }).click()
  if (scenario === 'error') await expect(page.getByText(/We could not complete/)).toBeVisible()
  else if (scenario === 'cancelled') await expect(page.getByText(/Sign-in cancelled/)).toBeVisible()
  else await expect(page.getByText('Your account is connected.')).toBeVisible()
}

export async function reachAccount(page: Page, scenario: AccountScenario): Promise<AccountService> {
  const service = await mockAccountService(page, scenario)
  if (scenario === 'sync-rejected') {
    await page
      .getByRole('button', { name: /0 percent automatic/ })
      .first()
      .click()
    await page.getByRole('radio', { name: 'Difficult', exact: true }).click()
    await page.goto('/')
  }
  await openAccount(page)
  if (scenario === 'backendUnavailable' || scenario === 'backendChecking') {
    await expect(
      page.getByText(
        scenario === 'backendUnavailable'
          ? 'Server unavailable. You can continue practising locally.'
          : 'Checking server connection…',
        { exact: true },
      ),
    ).toBeVisible()
    return service
  }
  await expect(page.getByText('Server connected.', { exact: true })).toBeVisible()
  if (scenario === 'discoveryError') {
    await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
    return service
  }
  const google = page.getByRole('button', { name: 'Continue with Google' })
  if (scenario === 'unavailable') {
    await expect(google).toBeDisabled()
    await expect(
      page.getByText(
        'Google and Apple sign-in are unavailable right now. You can sign in by email.',
      ),
    ).toBeVisible()
    return service
  }
  await expect(google).toBeEnabled()
  await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible()
  if (scenario === 'ready' || scenario === 'email') return service
  if (
    scenario === 'code' ||
    scenario === 'connected' ||
    scenario === 'invalid-code' ||
    scenario === 'sync-unavailable' ||
    scenario === 'sync-rejected' ||
    scenario === 'signed-out'
  ) {
    await requestCode(page)
    if (scenario === 'code') return service
    if (scenario === 'invalid-code') {
      await page.getByRole('textbox', { name: 'Six-digit code' }).fill('000000')
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      await expect(
        page.getByText('That code could not be verified. Check it or request another code.'),
      ).toBeVisible()
      return service
    }
    await finishSignIn(page)
    if (scenario === 'sync-unavailable') {
      await expect(
        page.getByText('Your progress is saved here. Sync will retry when you are connected.'),
      ).toBeVisible()
    } else if (scenario === 'sync-rejected') {
      await expect(
        page.getByText(
          /^\d+ saved changes? need(?:s)? review and remain(?:s)? safely on this device\.$/,
        ),
      ).toBeVisible()
    } else {
      await expect(page.getByText('Your progress is up to date.')).toBeVisible()
      if (scenario === 'signed-out') {
        await page.getByRole('button', { name: 'Sign out', exact: true }).click()
        await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible()
      }
    }
    return service
  }
  await signInWithProvider(page, 'Google', scenario === 'localSignOut' ? 'signedIn' : scenario)
  if (scenario === 'signedIn')
    await expect(page.getByText('Your progress is up to date.')).toBeVisible()
  if (scenario === 'localSignOut') {
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page.getByText(/You are signed out on this device/)).toBeVisible()
  }
  return service
}
