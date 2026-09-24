// Screenshots of every screen for the review README (not assertions).
import { test } from './fixtures';

const dir = process.env.SHOTS_DIR;
test.skip(!dir, 'set SHOTS_DIR to write screenshots');

test('screens', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/home.png` });
  await page.getByRole('button', { name: /Play 5 phrases/ }).click();
  await page.getByRole('button', { name: /Now playing:/ }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${dir}/player.png` });
  await page.getByRole('button', { name: 'Open queue' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/queue.png` });
  await page.goBack();
  await page.goBack();
  await page.goto('/#/explore');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/explore.png` });
  await page.goto('/#/library');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/library.png`, fullPage: true });
  await page.goto('/#/set/set-cafe?from=explore');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/set.png` });
});
