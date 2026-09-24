import type { Page } from '@playwright/test'
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

/** HTML hub/sign-out nav `text-lg font-semibold tracking-tight` — not title3 20. */
async function expectHubNavTitle(page: Page, label: string) {
  const nav = page.getByTestId('account-nav-title')
  await expect(nav).toHaveText(label)
  const face = nav.locator('[style*="font-size"]').first()
  await expect(face).toHaveCSS('font-size', '18px')
  await expect(face).toHaveCSS('line-height', '28px')
  await expect(face).toHaveCSS('font-weight', '600')
  await expect(face).toHaveCSS('letter-spacing', '-0.45px')
}

/** Idle / connecting / cancelled / error / unavailable share these HTML sizes. */
async function expectSharedHubChrome(
  page: Page,
  badge: 'raised' | 'soft' = 'raised',
  helperPing = false,
) {
  const emblem = await page.getByTestId('account-emblem').boundingBox()
  expect(Math.round(emblem?.width ?? 0)).toBe(112)
  expect(Math.round(emblem?.height ?? 0)).toBe(112)
  await expect(page.getByTestId('account-emblem-tile')).toHaveCSS('width', '80px')
  await expect(page.getByTestId('account-emblem-tile')).toHaveCSS('height', '80px')
  await expect(page.getByTestId('account-emblem-badge')).toHaveCSS('width', '32px')
  await expect(page.getByTestId('account-emblem-badge')).toHaveCSS('height', '32px')
  const method = await page.getByTestId('account-method-tile').first().boundingBox()
  expect(Math.round(method?.height ?? 0)).toBe(48)
  await expect(page.getByTestId('sign-in-hub')).toHaveCSS('padding-left', '24px')
  await expect(page.getByTestId('sign-in-hub')).toHaveCSS('padding-top', '24px')
  const hubTitle = page.getByTestId('account-hub-title').locator('[style*="font-size"]').first()
  await expect(hubTitle).toHaveCSS('font-size', '24px')
  await expect(hubTitle).toHaveCSS('line-height', '32px')
  await expect(hubTitle).toHaveCSS('font-weight', '700')
  await expect(hubTitle).toHaveCSS('letter-spacing', '-0.6px')
  await expectHubNavTitle(page, 'Sign in & sync')
  const todayFace = page.getByTestId('account-nav-today').locator('[style*="letter-spacing"]').first()
  await expect(todayFace).toHaveText('Today')
  await expect(todayFace).toHaveCSS('font-size', '14px')
  await expect(todayFace).toHaveCSS('font-weight', '600')
  await expect(todayFace).toHaveCSS('letter-spacing', '-0.35px')
  await expect(page.getByText('9:41')).toHaveCount(0)
  const emblemTileShadow = await page
    .getByTestId('account-emblem-tile')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(emblemTileShadow).toContain('35, 30, 24')
  expect(emblemTileShadow).toContain('0.05')
  const emblemBadgeShadow = await page
    .getByTestId('account-emblem-badge')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(emblemBadgeShadow).toContain('35, 30, 24')
  if (badge === 'raised') expect(emblemBadgeShadow).toContain('0.1')
  else {
    expect(emblemBadgeShadow).toContain('0.05')
    expect(emblemBadgeShadow).not.toContain('0.1')
  }
  await expect(page.getByTestId('account-connecting-ping')).toHaveCount(helperPing ? 1 : 0)
  if (helperPing) {
    const ping = page.getByTestId('account-connecting-ping')
    await expect(ping).toHaveCSS('width', '10px')
    await expect(ping).toHaveCSS('height', '10px')
    await expect(ping.getByTestId('pulse-ring')).toBeVisible()
  } else {
    await expect(page.getByTestId('sign-in-hub').getByTestId('pulse-ring')).toHaveCount(0)
  }
}

/** HTML Apple SVG `mb-0.5`. Unavailable letter  has no nudge. */
async function expectAppleMarkNudge(page: Page, name: string, offset: 0 | 2) {
  const mark = page.getByRole('button', { name, exact: true }).getByTestId('account-method-mark')
  await expect(mark).toHaveCSS('margin-bottom', `${offset}px`)
}

/** HTML idle/cancelled/error email mark is terracotta; the label stays espresso. */
async function expectEmailMarkTerracotta(page: Page) {
  const tile = page.getByRole('button', { name: 'Continue with email', exact: true })
  const markColor = await tile.getByTestId('account-method-mark').evaluate((node) => {
    const text = node.querySelector('[style*="color"]') ?? node
    return getComputedStyle(text).color
  })
  const labelColor = await tile
    .getByTestId('account-method-label')
    .locator('[style*="color"]')
    .first()
    .evaluate((node) => getComputedStyle(node).color)
  expect(markColor).toContain('127, 37, 0')
  expect(labelColor).not.toContain('127, 37, 0')
}

test('the idle sign-in hub shows keep-practising and cannot skip the gate', async ({ page }) => {
  await mockAccountService(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/account/)
  await expect(
    page.getByRole('link', { name: 'Keep practising without an account', exact: true }),
  ).toBeVisible()
  const keepFace = page.getByTestId('account-keep-practising').locator('[style*="font-weight"]').first()
  await expect(keepFace).toHaveCSS('font-size', '14px')
  await expect(keepFace).toHaveCSS('font-weight', '500')
  await expect(keepFace).toHaveCSS('letter-spacing', 'normal')
  await expect(keepFace).toHaveCSS('text-decoration-line', 'underline')
  await expect(keepFace).toHaveCSS('text-underline-offset', '4px')
  const deviceFace = page
    .getByTestId('account-device-progress')
    .locator('[style*="letter-spacing"]')
    .first()
  await expect(deviceFace).toHaveText('Your progress stays safely stored on this device.')
  await expect(deviceFace).toHaveCSS('font-size', '12px')
  await expect(deviceFace).toHaveCSS('font-weight', '400')
  await expect(deviceFace).toHaveCSS('letter-spacing', 'normal')
  const mark = page.getByTestId('account-method-mark').first()
  await expect(mark).toBeVisible()
  const markBox = await mark.boundingBox()
  expect(Math.round(markBox?.width ?? 0)).toBe(16)
  expect(Math.round(markBox?.height ?? 0)).toBe(16)
  await expectSharedHubChrome(page)
  await expect(page.getByTestId('account-emblem-bird')).toBeVisible()
  await expect(page.getByTestId('account-emblem-bolt')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCSS(
    'border-radius',
    '12px',
  )
  const methodLabel = page.getByTestId('account-method-label').first().locator('[style*="letter-spacing"]').first()
  await expect(methodLabel).toHaveCSS('font-size', '14px')
  await expect(methodLabel).toHaveCSS('font-weight', '600')
  await expect(methodLabel).toHaveCSS('letter-spacing', 'normal')
  await expect(
    page.getByRole('button', { name: 'Continue with Google' }).getByText('Continue with Google'),
  ).toHaveCSS('font-size', '14px')
  const idleGoogleShadow = await page
    .getByRole('button', { name: 'Continue with Google' })
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(idleGoogleShadow).toContain('35, 30, 24')
  expect(idleGoogleShadow).toContain('0.03')
  const idleAppleShadow = await page
    .getByRole('button', { name: 'Continue with Apple' })
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(idleAppleShadow).toContain('35, 30, 24')
  expect(idleAppleShadow).toContain('0.08')
  await expectAppleMarkNudge(page, 'Continue with Apple', 2)
  const idleEmailShadow = await page
    .getByRole('button', { name: 'Continue with email', exact: true })
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(idleEmailShadow === 'none' || idleEmailShadow === '').toBe(true)
  await expectEmailMarkTerracotta(page)
  const idleEmailLabel = page
    .getByRole('button', { name: 'Continue with email', exact: true })
    .getByTestId('account-method-label')
    .locator('[style*="letter-spacing"]')
    .first()
  await expect(idleEmailLabel).toHaveCSS('letter-spacing', 'normal')
  await expect(idleEmailLabel).toHaveCSS('font-weight', '600')
  await page.getByRole('link', { name: 'Keep practising without an account', exact: true }).click()
  await expect(page).toHaveURL(/\/account/)
  await expect(todayMarker(page)).toHaveCount(0)
})

test('the connecting hub shares idle chrome without 9:41', async ({ page }) => {
  await reachAccount(page, 'busy')
  await expect(page.getByText('Connecting to account', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Authorizing in the secure authentication sheet...', { exact: true }),
  ).toBeVisible()
  const connectingBody = page.getByTestId('account-hub-body').locator('[style*="font-size"]').first()
  await expect(connectingBody).toHaveCSS('font-size', '14px')
  await expect(connectingBody).toHaveCSS('line-height', '22.75px')
  expect(Math.round((await connectingBody.boundingBox())?.height ?? 0)).toBeLessThanOrEqual(24)
  await expectSharedHubChrome(page, 'raised', true)
  await expect(page.getByTestId('account-connecting-card')).toHaveCSS('margin-top', '20px')
  await expect(page.getByTestId('account-connecting-card')).toHaveCSS('padding-top', '16px')
  await expect(page.getByTestId('account-connecting-card')).toHaveCSS('padding-left', '16px')
  const connectingCardShadow = await page
    .getByTestId('account-connecting-card')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(connectingCardShadow === 'none' || connectingCardShadow === '').toBe(true)
  const cancel = page.getByRole('button', { name: 'Cancel sign-in', exact: true })
  expect(Math.round((await cancel.boundingBox())?.height ?? 0)).toBe(40)
  await expect(cancel).toHaveCSS('border-radius', '8px')
  await expect(cancel.getByText('Cancel sign-in')).toHaveCSS('font-size', '12px')
  const connectingCancel = page
    .getByTestId('account-connecting-cancel')
    .locator('[style*="letter-spacing"]')
    .first()
  await expect(connectingCancel).toHaveCSS('font-weight', '600')
  await expect(connectingCancel).toHaveCSS('letter-spacing', 'normal')
  await expect(connectingCancel).toHaveCSS('font-size', '12px')
  const connectingHelp = page
    .getByTestId('account-connecting-help')
    .locator('[style*="letter-spacing"]')
    .first()
  await expect(connectingHelp).toHaveText('Complete sign-in in the browser window.')
  await expect(connectingHelp).toHaveCSS('font-size', '12px')
  await expect(connectingHelp).toHaveCSS('font-weight', '500')
  await expect(connectingHelp).toHaveCSS('letter-spacing', 'normal')
  await expect(page.getByTestId('account-emblem-spinner')).toBeVisible()
  const connectingShadow = await page
    .getByTestId('account-method-tile')
    .first()
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(connectingShadow).toContain('inset')
  expect(connectingShadow).toContain('28, 28, 25')
  for (const name of ['Continue with Apple', 'Continue with email'] as const) {
    const sibling = page.getByRole('button', { name, exact: true })
    await expect(sibling).toBeDisabled()
    const chrome = await sibling.evaluate((node) => {
      const style = getComputedStyle(node)
      return { opacity: style.opacity, background: style.backgroundColor }
    })
    expect(chrome.opacity).toBe('0.5')
    expect(chrome.background).toBe('rgb(246, 243, 238)')
  }
  await expectAppleMarkNudge(page, 'Continue with Apple', 2)
  const connectingKeep = page
    .getByTestId('account-keep-practising')
    .locator('[style*="font-weight"]')
    .first()
  await expect(connectingKeep).toHaveCSS('text-decoration-line', 'none')
})

test('the unavailable hub shares idle chrome without 9:41', async ({ page }) => {
  await reachAccount(page, 'unavailable')
  await expectSharedHubChrome(page, 'soft')
  const unavailableTilt = await page.getByTestId('account-emblem-tile').evaluate((node) => {
    const { a, b } = new DOMMatrix(getComputedStyle(node).transform)
    return Math.round(Math.atan2(b, a) * (180 / Math.PI))
  })
  expect(unavailableTilt).toBe(-3)
  await expect(page.getByTestId('account-method-stack')).toHaveCSS('margin-top', '16px')
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeDisabled()
  const methodBadge = page.getByTestId('account-method-badge').first()
  await expect(methodBadge.getByText('Unavailable', { exact: true })).toBeVisible()
  await expect(methodBadge.locator('[style*="letter-spacing"]').first()).toHaveCSS(
    'letter-spacing',
    '0.55px',
  )
  await expect(methodBadge.locator('[style*="letter-spacing"]').first()).toHaveCSS(
    'text-transform',
    'uppercase',
  )
  await expect(methodBadge.locator('[style*="font-size"]').first()).toHaveCSS('font-size', '11px')
  await expect(page.getByRole('button', { name: 'Continue with email', exact: true })).toBeEnabled()
  const emailPrimaryShadow = await page
    .getByRole('button', { name: 'Continue with email', exact: true })
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(emailPrimaryShadow).toContain('200, 90, 50')
  expect(emailPrimaryShadow).toContain('0.25')
  await expect(
    page.getByText('Sign in to keep your phrases and progress together across devices.', {
      exact: true,
    }),
  ).toBeVisible()
  const socialTitle = page
    .getByTestId('account-social-down-title')
    .locator('[style*="letter-spacing"]')
    .first()
  await expect(socialTitle).toHaveText('Social sign-in is temporarily down')
  await expect(socialTitle).toHaveCSS('font-size', '12px')
  await expect(socialTitle).toHaveCSS('font-weight', '700')
  await expect(socialTitle).toHaveCSS('letter-spacing', '-0.3px')
  const socialBody = page
    .getByTestId('account-social-down-body')
    .locator('[style*="letter-spacing"]')
    .first()
  await expect(socialBody).toHaveText(
    'Google and Apple login services are unavailable right now. You can continue seamlessly with your email address.',
  )
  await expect(socialBody).toHaveCSS('font-size', '12px')
  await expect(socialBody).toHaveCSS('font-weight', '400')
  await expect(socialBody).toHaveCSS('letter-spacing', 'normal')
  const socialNoticeShadow = await page
    .getByTestId('account-social-notice')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(socialNoticeShadow).toContain('35, 30, 24')
  expect(socialNoticeShadow).toContain('0.05')
  for (const name of ['Continue with Google', 'Continue with Apple'] as const) {
    const down = page.getByRole('button', { name, exact: true })
    const chrome = await down.evaluate((node) => {
      const style = getComputedStyle(node)
      return { opacity: style.opacity, background: style.backgroundColor }
    })
    expect(chrome.opacity).toBe('0.6')
    expect(chrome.background).toBe('rgb(246, 243, 238)')
    const downLabel = down.getByTestId('account-method-label').locator('[style*="letter-spacing"]').first()
    await expect(downLabel).toHaveCSS('font-weight', '500')
    await expect(downLabel).toHaveCSS('letter-spacing', 'normal')
    await expect(downLabel).toHaveCSS('font-size', '14px')
  }
  await expectAppleMarkNudge(page, 'Continue with Apple', 0)
  const emailLabel = page
    .getByRole('button', { name: 'Continue with email', exact: true })
    .getByTestId('account-method-label')
    .locator('[style*="letter-spacing"]')
    .first()
  await expect(emailLabel).toHaveCSS('font-weight', '600')
  await expect(emailLabel).toHaveCSS('letter-spacing', '-0.35px')
  await expect(emailLabel).toHaveCSS('font-size', '14px')
})

test('sign-out confirmation can stay signed in', async ({ page }) => {
  await mockAccountService(page)
  await onboard(page)
  await openAccount(page)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByText('Sign out of Loro?', { exact: true })).toBeVisible()
  const signOutEmblem = await page.getByTestId('account-emblem').boundingBox()
  expect(Math.round(signOutEmblem?.width ?? 0)).toBe(96)
  expect(Math.round(signOutEmblem?.height ?? 0)).toBe(96)
  await expect(page.getByTestId('account-emblem-tile')).toHaveCSS('width', '64px')
  await expect(page.getByTestId('account-emblem-tile')).toHaveCSS('height', '64px')
  await expect(page.getByTestId('account-emblem-badge')).toHaveCSS('width', '28px')
  await expect(page.getByTestId('account-emblem-badge')).toHaveCSS('height', '28px')
  await expect(page.getByTestId('account-emblem')).toHaveCSS('margin-top', '8px')
  await expect(page.getByTestId('account-emblem')).toHaveCSS('margin-bottom', '8px')
  const signOutTileShadow = await page
    .getByTestId('account-emblem-tile')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(signOutTileShadow).toContain('0.05')
  const signOutBadgeShadow = await page
    .getByTestId('account-emblem-badge')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(signOutBadgeShadow).toContain('0.1')
  const signOutTilt = await page.getByTestId('account-emblem-tile').evaluate((node) => {
    const { a, b } = new DOMMatrix(getComputedStyle(node).transform)
    return Math.round(Math.atan2(b, a) * (180 / Math.PI))
  })
  expect(signOutTilt).toBe(-3)
  await expect(page.getByTestId('account-emblem-shield')).toBeVisible()
  await expect(page.getByTestId('account-emblem-logout')).toBeVisible()
  const signOutArrival = page.getByTestId('sign-out-confirm').getByTestId('arrival').first()
  await expect.poll(async () =>
    signOutArrival.evaluate((node) => getComputedStyle(node).opacity),
  ).toBe('1')
  await expect(page.getByText('learner@example.com')).toBeVisible()
  await expect(page.getByText(/14-day/)).toHaveCount(0)
  await expect(page.getByText('Your study streak is preserved on this phone.')).toBeVisible()
  const safeTitle = page
    .getByTestId('account-sign-out-safe-title')
    .locator('[style*="letter-spacing"]')
    .first()
  await expect(safeTitle).toHaveText('Your progress is safe on this device')
  await expect(safeTitle).toHaveCSS('font-size', '14px')
  await expect(safeTitle).toHaveCSS('font-weight', '600')
  await expect(safeTitle).toHaveCSS('letter-spacing', 'normal')
  const safeLine = page
    .getByTestId('account-sign-out-safe')
    .first()
    .getByText('Curated vocabulary list and audio reviews remain saved locally.')
  await expect(safeLine).toHaveCSS('font-size', '12px')
  await expect(page.getByTestId('sign-out-confirm')).toHaveCSS('padding-left', '24px')
  await expect(page.getByTestId('sign-out-confirm')).toHaveCSS('padding-top', '24px')
  await expect(page.getByTestId('sign-out-actions')).toHaveCSS('margin-top', '20px')
  const leave = await page.getByRole('button', { name: 'Sign out on this device', exact: true }).boundingBox()
  expect(Math.round(leave?.height ?? 0)).toBe(48)
  const hubTitle = page.getByTestId('account-hub-title').locator('[style*="font-size"]').first()
  await expect(hubTitle).toHaveCSS('font-size', '24px')
  await expect(hubTitle).toHaveCSS('line-height', '32px')
  await expectHubNavTitle(page, 'Sign out confirmation')
  const stayShadow = await page
    .getByRole('button', { name: 'Stay signed in', exact: true })
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(stayShadow).toContain('200, 90, 50')
  expect(stayShadow).toContain('0.25')
  const leaveShadow = await page
    .getByRole('button', { name: 'Sign out on this device', exact: true })
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(leaveShadow === 'none' || leaveShadow === '').toBe(true)
  const stayFace = page
    .getByRole('button', { name: 'Stay signed in', exact: true })
    .getByText('Stay signed in')
  await expect(stayFace).toHaveCSS('font-size', '14px')
  await expect(stayFace).toHaveCSS('font-weight', '600')
  await expect(stayFace).toHaveCSS('letter-spacing', 'normal')
  const leaveFace = page
    .getByRole('button', { name: 'Sign out on this device', exact: true })
    .getByText('Sign out on this device')
  await expect(leaveFace).toHaveCSS('font-size', '14px')
  await expect(leaveFace).toHaveCSS('font-weight', '600')
  await expect(leaveFace).toHaveCSS('letter-spacing', 'normal')
  await expect(page.getByText('9:41')).toHaveCount(0)
  const signOutNote = page
    .getByTestId('account-sign-out-note')
    .locator('[style*="letter-spacing"]')
    .first()
  await expect(signOutNote).toHaveText('Loro is offline-first. Your learning records are always yours.')
  await expect(signOutNote).toHaveCSS('font-size', '12px')
  await expect(signOutNote).toHaveCSS('font-weight', '400')
  await expect(signOutNote).toHaveCSS('letter-spacing', 'normal')
  await page.getByRole('button', { name: 'Stay signed in', exact: true }).click()
  await expect(page.getByText('Your progress is up to date.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
})

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
  await page.getByRole('button', { name: 'Sign out on this device', exact: true }).click()
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
  await page.getByRole('button', { name: 'Sign out on this device', exact: true }).click()
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
    await expect(
      page.getByRole('button', {
        name: scenario === 'error' ? 'Try with Apple instead' : 'Continue with Apple',
      }),
    ).toBeEnabled()
    await expect(
      page.getByRole('button', { name: 'Continue with email', exact: true }),
    ).toBeVisible()
    await expectSharedHubChrome(page)
    const hubBody = page.getByTestId('account-hub-body').locator('[style*="font-size"]').first()
    await expect(hubBody).toHaveCSS('font-size', '14px')
    await expect(hubBody).toHaveCSS('line-height', '22.75px')
    if (scenario === 'cancelled') {
      await expect(page.getByText('Sign-in was cancelled', { exact: true })).toBeVisible()
      await expect(
        page.getByText(
          'You dismissed the sign-in window. No changes were made to your account.',
          { exact: true },
        ),
      ).toBeVisible()
      await expect(
        page.getByText("Pick a sign-in option below to retry whenever you're ready.", {
          exact: true,
        }),
      ).toBeVisible()
      await expect(page.getByTestId('account-cancelled-notice')).toHaveCSS('margin-top', '16px')
      await expect(page.getByTestId('account-cancelled-notice')).toHaveCSS('padding-top', '14px')
      await expect(page.getByTestId('account-cancelled-notice')).toHaveCSS('padding-left', '14px')
      await expect(page.getByTestId('account-cancelled-notice')).toHaveCSS('gap', '10px')
      await expect(page.getByTestId('account-cancelled-notice')).toHaveCSS(
        'justify-content',
        'center',
      )
      await expect(page.getByTestId('account-cancelled-info')).toHaveCSS('width', '16px')
      await expect(page.getByTestId('account-cancelled-info')).toHaveCSS('height', '16px')
      const cancelledHint = page
        .getByTestId('account-cancelled-notice-face')
        .locator('[style*="letter-spacing"]')
        .first()
      await expect(cancelledHint).toHaveText(
        "Pick a sign-in option below to retry whenever you're ready.",
      )
      await expect(cancelledHint).toHaveCSS('font-size', '12px')
      await expect(cancelledHint).toHaveCSS('font-weight', '400')
      await expect(cancelledHint).toHaveCSS('letter-spacing', 'normal')
      await expect(page.getByTestId('account-method-stack')).toHaveCSS('margin-top', '20px')
      await expectAppleMarkNudge(page, 'Continue with Apple', 2)
      await expectEmailMarkTerracotta(page)
    }
    if (scenario === 'error') {
      const errorTile = await page
        .getByTestId('account-emblem-tile')
        .evaluate((node) => getComputedStyle(node).backgroundColor)
      expect(errorTile).toContain('246, 243, 238')
      expect(errorTile).not.toContain('255, 219, 208')
      await expect(page.getByText("Couldn't sign you in", { exact: true })).toBeVisible()
      await expect(
        page.getByText(
          'An error occurred while connecting to the authorization server. Please try again or switch methods.',
          { exact: true },
        ),
      ).toBeVisible()
      await expect(
        page.getByText('Authentication timed out. Your offline records remain safe.', {
          exact: true,
        }),
      ).toBeVisible()
      await expect(page.getByTestId('account-error-notice')).toHaveCSS('margin-top', '20px')
      await expect(page.getByTestId('account-error-notice')).toHaveCSS('padding-top', '14px')
      await expect(page.getByTestId('account-error-notice')).toHaveCSS('gap', '12px')
      await expect(page.getByTestId('account-error-notice')).toHaveCSS(
        'justify-content',
        'flex-start',
      )
      const errorSafe = page
        .getByTestId('account-error-notice-face')
        .locator('[style*="letter-spacing"]')
        .first()
      await expect(errorSafe).toHaveText('Authentication timed out. Your offline records remain safe.')
      await expect(errorSafe).toHaveCSS('font-size', '12px')
      await expect(errorSafe).toHaveCSS('font-weight', '500')
      await expect(errorSafe).toHaveCSS('letter-spacing', 'normal')
      await expect(page.getByTestId('account-method-stack')).toHaveCSS('margin-top', '16px')
      await expect(page.getByRole('button', { name: 'Retry Google Sign-in', exact: true })).toHaveCSS(
        'border-top-width',
        '2px',
      )
      const retryShadow = await page
        .getByRole('button', { name: 'Retry Google Sign-in', exact: true })
        .evaluate((node) => getComputedStyle(node).boxShadow)
      expect(retryShadow).toContain('200, 90, 50')
      expect(retryShadow).toContain('0.15')
      const errorAppleShadow = await page
        .getByRole('button', { name: 'Try with Apple instead', exact: true })
        .evaluate((node) => getComputedStyle(node).boxShadow)
      expect(errorAppleShadow).toContain('35, 30, 24')
      expect(errorAppleShadow).toContain('0.05')
      expect(errorAppleShadow).not.toContain('0.08')
      const errorEmailShadow = await page
        .getByRole('button', { name: 'Continue with email', exact: true })
        .evaluate((node) => getComputedStyle(node).boxShadow)
      expect(errorEmailShadow === 'none' || errorEmailShadow === '').toBe(true)
      await expectAppleMarkNudge(page, 'Try with Apple instead', 2)
      await expectEmailMarkTerracotta(page)
    }
    expect(service.requests.filter((request) => request.path.endsWith('/auth/exchange'))).toEqual(
      [],
    )
    expect(service.requests.filter((request) => request.path.includes('/sync/'))).toEqual([])
    await page.goto('/')
    await expect(page).toHaveURL(/\/account/)
  })
}
