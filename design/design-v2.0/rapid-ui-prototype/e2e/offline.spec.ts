// Only meaningful against the production build (PREVIEW=1), where the
// service worker precaches the app.
import { expect, test } from './fixtures';

test.skip(process.env.PREVIEW !== '1', 'needs the production build: PREVIEW=1');

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // The service worker takes control on the next load.
  await page.reload();
  await expect(page.getByRole('heading', { name: '¡Hola, Ana!' })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '¡Hola, Ana!' })).toBeVisible();
  await page.goto('/#/set/set-cafe?from=explore');
  await expect(page.getByRole('heading', { name: 'Café & Mañanas' })).toBeVisible();
  // The scheduler (Rust WASM) runs offline too: a rating previews an interval.
  await page.getByRole('button', { name: 'Play Café & Mañanas' }).click();
  await page.getByRole('button', { name: /^Now playing:/ }).click();
  await expect(page.getByRole('button', { name: /^Easy/ })).toContainText(/day/);
  // No icon ligature shows as text: the icon font is local.
  const iconFont = await page.evaluate(() => document.fonts.check('24px "Material Symbols Outlined"'));
  expect(iconFont).toBe(true);
});
