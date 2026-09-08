import { expect, type Page } from '@playwright/test'
import { expectResourceError } from './expectedResourceErrors'
export const ACCOUNT_LABEL = 'Sign in & sync'
const stamp = '0000000000100:000000:server'
export async function mockAccountService(
  page: Page,
  mode: 'success' | 'invalid-code' | 'sync-unavailable' = 'success',
): Promise<void> {
  await page.route('http://127.0.0.1:3000/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const body: unknown = route.request().postDataJSON()
    if (mode === 'invalid-code' && path.endsWith('/auth/magic-link/verify')) {
      expectResourceError(page, route.request().url(), 401)
      await route.fulfill({ status: 401, json: { error: 'UNAUTHORIZED' } })
      return
    }
    if (mode === 'sync-unavailable' && path.includes('/sync/')) {
      expectResourceError(page, route.request().url(), 503)
      await route.fulfill({ status: 503, json: { error: 'UNAVAILABLE' } })
      return
    }
    const response = path.endsWith('/auth/magic-link')
      ? { status: 'accepted' }
      : path.endsWith('/auth/magic-link/verify')
        ? {
            access_token: 'e2e-access',
            refresh_token: 'e2e-refresh',
            expires_in: 900,
            device_id: 'test-device',
            user: { id: 'test-account', created_at: 100 },
            claim: { performed: true, mode: 'bind', claim_id: 'test-claim', upload_required: true },
          }
        : path.endsWith('/sync/push')
          ? {
              accepted:
                typeof body === 'object' &&
                body !== null &&
                'ops' in body &&
                Array.isArray(body.ops)
                  ? body.ops.map((op: { seq: number }) => op.seq)
                  : [],
              rejected: [],
              conflicts: [],
              server_hlc: stamp,
              server_time: 100,
            }
          : {
              changes: [],
              next: 'test-cursor',
              has_more: false,
              server_hlc: stamp,
              server_time: 100,
            }
    await route.fulfill({ status: path.endsWith('/auth/magic-link') ? 202 : 200, json: response })
  })
}
export async function openAccount(page: Page): Promise<void> {
  await page.getByRole('button', { name: /, open the menu$/ }).click()
  await page.getByRole('button', { name: ACCOUNT_LABEL, exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible()
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
