// Screenshots of every screen for the review README (not assertions):
// SHOTS_DIR=../ui-ux-review npx playwright test e2e/shots.spec.ts
import { expect, test } from './fixtures';

const dir = process.env.SHOTS_DIR;
test.skip(!dir, 'set SHOTS_DIR to write screenshots');

test('screens', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/r3-home.png` });
  await page.getByRole('button', { name: /Play 5 phrases/ }).click();
  await page.getByRole('button', { name: /^Now playing:/ }).click();
  const player = page.getByRole('dialog', { name: 'Now playing' });
  await expect(player.getByText('Hear it in Spanish', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await player.getByRole('button', { name: 'Pause', exact: true }).click();
  await player.getByRole('button', { name: /^Easy/ }).click();
  await player.getByRole('button', { name: 'cortado' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/r3-player.png` });
  await page.getByRole('button', { name: 'Open queue' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/r3-queue.png` });
  await page.goBack();
  await page.goBack();
  await page.goto('/#/explore?q=por%20favor');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/r3-explore.png` });
  await page.goto('/#/library?view=learning');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/r3-library.png` });
  await page.goto('/#/set/set-cafe?from=explore');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/r3-set.png` });
});

test.describe('first run', () => {
  test.use({ seed: null });
  test('onboarding in Bulgarian', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Български' }).check();
    await page.getByRole('button', { name: 'Напред' }).click();
    await page.getByPlaceholder('Вашето име').fill('Мира');
    await page.getByRole('button', { name: 'Напред' }).click();
    await page.getByRole('button', { name: 'Напред' }).click();
    await page.getByRole('button', { name: 'Напред' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${dir}/r3-onboarding-bg.png` });
  });
});
