import { expect, onboard, test } from './fixtures'
import {
  LISTEN_FIXTURE_NOTE,
  LISTEN_GENERATE,
  LISTEN_LISTEN,
  LISTEN_SHARE,
  LISTEN_STOP,
  LISTEN_STATUS,
  openListenExport,
  openListenScenario,
} from './listenFlow'

test('the listen companion is a Phrases utility with honest unavailable generate, cache, and share', async ({
  page,
}) => {
  await onboard(page)
  await openListenExport(page)
  await expect(page.getByRole('button', { name: LISTEN_GENERATE })).toBeDisabled()
  await expect(page.getByRole('button', { name: LISTEN_LISTEN })).toBeDisabled()
  await expect(page.getByRole('button', { name: LISTEN_SHARE })).toBeDisabled()
  await expect(page.getByText(LISTEN_STATUS['voices-unapproved'], { exact: true })).toHaveCount(0)
  // Web streams cloud download URLs (`remotePlayback`), so a missing native cache
  // is not the blocker. The preview API URL is set; stub TTS is not ready.
  await expect(page.getByText(LISTEN_STATUS['not-configured'], { exact: true })).toBeVisible()
  await expect(page.getByText('On-device listening cache is not available here.')).toHaveCount(0)
  await expect(
    page.getByText('Ready to generate licensed listening takes into the on-device cache.'),
  ).toHaveCount(0)
  await expect(page.getByText('Sara Martin 1')).toBeVisible()
  await expect(page.getByText('Dante', { exact: true })).toBeVisible()
  await expect(page.getByText(LISTEN_STATUS['share-unavailable'])).toHaveCount(0)
  await expect(page.getByText(LISTEN_FIXTURE_NOTE)).toHaveCount(0)
  await expect(page.getByText('No licensed listening voices are approved yet.')).toHaveCount(0)
})

test('Q-22 share stays unavailable while the share-ready fixture can show the gated control', async ({
  page,
}) => {
  await onboard(page)
  await openListenScenario(page, 'share-unavailable')
  await expect(page.getByRole('button', { name: LISTEN_SHARE })).toBeDisabled()
  await expect(page.getByText(LISTEN_STATUS['share-unavailable'], { exact: true })).toBeVisible()
  await openListenScenario(page, 'share-ready')
  await expect(page.getByRole('button', { name: LISTEN_SHARE })).toBeEnabled()
  await expect(page.getByText(LISTEN_STATUS['share-ready'], { exact: true })).toBeVisible()
  await expect(page.getByText(LISTEN_FIXTURE_NOTE)).toBeVisible()
})

test('ready-to-listen enables cache playback without enabling share', async ({ page }) => {
  await onboard(page)
  await openListenScenario(page, 'ready-to-listen')
  await expect(page.getByRole('button', { name: LISTEN_LISTEN })).toBeEnabled()
  await expect(page.getByRole('button', { name: LISTEN_SHARE })).toBeDisabled()
  await expect(page.getByRole('button', { name: LISTEN_GENERATE })).toBeDisabled()
})

test('playing restyles honest transport as play/stop with the equalizer', async ({ page }) => {
  await onboard(page)
  await openListenScenario(page, 'playing')
  await expect(page.getByRole('button', { name: LISTEN_STOP })).toBeEnabled()
  await expect(page.getByTestId('equalizer')).toBeVisible()
  await expect(page.getByText('Madrid Morning Session')).toHaveCount(0)
  await expect(page.getByText(/kbps/i)).toHaveCount(0)
})
