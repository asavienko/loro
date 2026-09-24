/** F-01/F-04. Simulated provider transport only; production has no test identity or bypass. */
import { expect, type Page, type Route } from '@playwright/test'
import { expectResourceError } from './expectedResourceErrors'
import { fillField } from './helpers'
import { fulfillLearnerPreview } from './learnerApiFlow'

export const ACCOUNT_LABEL = 'Sign in & sync'
export const ACCOUNT_API = 'https://auth.loro.test/v1'

/** Metro inlines `apps/mobile/.env` (`http://localhost:3000/v1`) into the web bundle. */
function isE2eAccountApi(url: URL): boolean {
  if (url.hostname === 'auth.loro.test') return true
  return url.port === '3000' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
}

const ACCOUNT_ROUTE_GLOBS = [
  `${ACCOUNT_API}/**`,
  '**/auth.loro.test/**',
  'http://localhost:3000/**',
  'http://127.0.0.1:3000/**',
  '**/localhost:3000/**',
  '**/127.0.0.1:3000/**',
] as const
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
  | 'email'
  | 'code'
  | 'connected'
  | 'invalid-code'
  | 'sync-unavailable'
  | 'sync-rejected'
  | 'signed-out'
  | 'signOutConfirm'

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
  for (const glob of ACCOUNT_ROUTE_GLOBS) await page.context().unroute(glob)
  await page.context().unroute(isE2eAccountApi)
  await page.context().unroute('https://provider.loro.test/**')
  const requests: AccountRequest[] = []
  const fulfillAccount = async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (!isE2eAccountApi(url)) {
      await route.continue()
      return
    }
    const path = url.pathname
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204 })
      return
    }
    const body: unknown = request.postData() ? request.postDataJSON() : null
    requests.push({
      path,
      body,
      authorization: request.headers().authorization,
      deviceId: request.headers()['x-loro-device'],
    })
    if (path.endsWith('/health/ready')) {
      await route.fulfill({
        json: { status: 'ok', checks: { content: 'ok', merge: 'ok' } },
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
    if (path.endsWith('/auth/capabilities')) {
      await route.fulfill({
        json: { apple: true, google: true, email: true },
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
    if (path.endsWith('/auth/refresh')) {
      const token =
        typeof body === 'object' && body !== null && 'refresh_token' in body
          ? String(body.refresh_token)
          : ''
      const provider = token.includes('provider')
      await route.fulfill({
        json: {
          access_token: provider ? 'e2e-provider-access' : 'e2e-email-access',
          refresh_token: token || 'e2e-email-refresh',
          expires_in: 900,
        },
      })
      return
    }
    if (path.endsWith('/auth/magic-link/verify') || path.endsWith('/auth/exchange')) {
      const provider = path.endsWith('/auth/exchange')
      await route.fulfill({
        json: {
          access_token: provider ? 'e2e-provider-access' : 'e2e-email-access',
          refresh_token: provider ? 'e2e-provider-refresh' : 'e2e-email-refresh',
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
    if (await fulfillLearnerPreview(route, page, path, request.method(), body)) return
    throw new Error(`Unexpected account request: ${request.method()} ${path}`)
  }
  await page.context().route(isE2eAccountApi, fulfillAccount)
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

export interface SignInCopy {
  emailMethod: string
  email: string
  send: string
  code: string
  verify: string
  signedIn: string
  continue: string
}

const ENGLISH_SIGN_IN: SignInCopy = {
  emailMethod: 'Continue with email',
  email: 'Email address',
  send: 'Send sign-in code',
  code: 'Sign-in code',
  verify: 'Verify and sign in',
  signedIn: 'You’re signed in',
  continue: 'Back to practice',
}

/** First-run email sign-in. Lands on onboarding when the device is not yet set up. */
export async function signIn(page: Page, labels: SignInCopy = ENGLISH_SIGN_IN): Promise<void> {
  if (!/\/account(?:\?|$)/.test(new URL(page.url(), 'http://localhost').pathname)) {
    await page.goto('/')
  }
  await expect(page).toHaveURL(/\/account/)
  await page.getByRole('button', { name: labels.emailMethod, exact: true }).click()
  await fillField(page, labels.email, 'learner@example.com')
  await page.getByRole('button', { name: labels.send, exact: true }).click()
  await expect(page.getByRole('textbox', { name: labels.code })).toBeVisible()
  await fillField(page, labels.code, '123456')
  await page.getByRole('button', { name: labels.verify, exact: true }).click()
  await expect(page.getByText(labels.signedIn, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: labels.continue, exact: true }).click()
}

export async function signInThenGoto(page: Page, path: string): Promise<void> {
  await signIn(page)
  await page.goto(path)
}
export async function requestCode(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Continue with email', exact: true }).click()
  await fillField(page, 'Email address', 'learner@example.com')
  await page.getByRole('button', { name: 'Send sign-in code', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Sign-in code' })).toBeVisible()
}
export async function backFromCodeToEmail(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Email address', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Sign-in code' })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Email address' })).toHaveValue(
    'learner@example.com',
  )
}
export async function finishSignIn(page: Page, expectSync = true): Promise<void> {
  await fillField(page, 'Sign-in code', '123456')
  await page.getByRole('button', { name: 'Verify and sign in', exact: true }).click()
  await expect(page.getByText('You’re signed in', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back to practice', exact: true }).click()
  await openAccount(page)
  if (expectSync) await expect(page.getByText('Your progress is up to date.')).toBeVisible()
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
    await expect(page.getByText(`Connecting to ${provider}…`, { exact: true })).toBeVisible()
    return
  }
  if (scenario === 'cancelled') await popup.close()
  else await popup.getByRole('link', { name: 'Finish provider sign-in' }).click()
  if (scenario === 'error') await expect(page.getByText(/Couldn’t sign you in|Couldn't sign you in/)).toBeVisible()
  else if (scenario === 'cancelled')
    await expect(page.getByText(/Sign-in was cancelled/)).toBeVisible()
  else {
    await expect(page.getByText('You’re signed in', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Back to practice', exact: true }).click()
    if ((await page.getByRole('button', { name: /, open the menu$/ }).count()) > 0) {
      await openAccount(page)
      await expect(page.getByText('Your progress is up to date.')).toBeVisible()
    }
  }
}

export async function reachAccount(
  page: Page,
  scenario: AccountScenario,
  provider: 'Google' | 'Apple' = 'Google',
): Promise<AccountService> {
  const service = await mockAccountService(page, scenario)
  const onLearnerHome = await page.getByRole('button', { name: /, open the menu$/ }).count()
  if (onLearnerHome === 0) {
    await page.goto('/')
    await expect(page).toHaveURL(/\/account/)
  } else {
    if (scenario === 'sync-rejected') {
      await page
        .getByRole('button', { name: /0 percent automatic/ })
        .first()
        .click()
      await page.getByRole('radio', { name: 'Difficult', exact: true }).click()
      await page.goto('/')
    }
    await openAccount(page)
    if (
      scenario === 'signedIn' ||
      scenario === 'connected' ||
      scenario === 'sync-unavailable' ||
      scenario === 'sync-rejected' ||
      scenario === 'localSignOut' ||
      scenario === 'signed-out' ||
      scenario === 'signOutConfirm'
    ) {
      if (scenario === 'sync-unavailable' || scenario === 'sync-rejected') {
        await page.getByRole('button', { name: 'Sync now', exact: true }).click()
      }
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
      } else if (
        scenario === 'signed-out' ||
        scenario === 'localSignOut' ||
        scenario === 'signOutConfirm'
      ) {
        await page.getByRole('button', { name: 'Sign out', exact: true }).click()
        await expect(page.getByText('Sign out of Loro?', { exact: true })).toBeVisible()
        if (scenario === 'signOutConfirm') return service
        await page.getByRole('button', { name: 'Sign out on this device', exact: true }).click()
        if (scenario === 'localSignOut') {
          await expect(page.getByText(/You are signed out on this device/)).toBeVisible()
        } else {
          await expect(
            page.getByRole('button', { name: 'Continue with email', exact: true }),
          ).toBeVisible()
        }
      } else {
        await expect(page.getByText('Your progress is up to date.')).toBeVisible()
      }
      return service
    }
  }
  if (scenario === 'discoveryError') {
    await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
    return service
  }
  const google = page.getByRole('button', { name: 'Continue with Google' })
  if (scenario === 'unavailable') {
    await expect(google).toBeDisabled()
    await expect(
      page.getByText(
        'Google and Apple login services are unavailable right now. You can continue seamlessly with your email address.',
      ),
    ).toBeVisible()
    return service
  }
  await expect(google).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Continue with email', exact: true })).toBeEnabled()
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
      await fillField(page, 'Sign-in code', '000000')
      await page.getByRole('button', { name: 'Verify and sign in', exact: true }).click()
      await expect(
        page.getByText('That code didn’t work. Try again or request a new one.'),
      ).toBeVisible()
      await expect(page.getByRole('textbox', { name: 'Sign-in code' })).toHaveAttribute(
        'aria-invalid',
        'true',
      )
      return service
    }
    await finishSignIn(page, scenario !== 'sync-unavailable' && scenario !== 'sync-rejected')
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
      if (scenario === 'signed-out') {
        await page.getByRole('button', { name: 'Sign out', exact: true }).click()
        await page.getByRole('button', { name: 'Sign out on this device', exact: true }).click()
        await expect(
          page.getByRole('button', { name: 'Continue with email', exact: true }),
        ).toBeVisible()
      }
    }
    return service
  }
  if (scenario === 'signOutConfirm') {
    await signInWithProvider(page, provider, 'signedIn')
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page.getByText('Sign out of Loro?', { exact: true })).toBeVisible()
    return service
  }
  await signInWithProvider(page, provider, scenario === 'localSignOut' ? 'signedIn' : scenario)
  if (scenario === 'signedIn')
    await expect(page.getByText('Your progress is up to date.')).toBeVisible()
  if (scenario === 'localSignOut') {
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await page.getByRole('button', { name: 'Sign out on this device', exact: true }).click()
    await expect(page.getByText(/You are signed out on this device/)).toBeVisible()
  }
  return service
}
