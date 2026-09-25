// The shared components keep their shape: header order, and room for the title at large text.
import { expect, sampleHistory, test } from './fixtures';

test.use({ seed: { log: sampleHistory(Date.now()) } });

test('the header reads avatar, then the page title, then the points', async ({ page }) => {
  await page.goto('/#/library');
  const avatar = (await page.getByRole('button', { name: 'Ana: settings' }).boundingBox())!;
  const title = (await page.locator('header h1').boundingBox())!;
  const points = (await page.getByTestId('points').boundingBox())!;
  expect(avatar.x + avatar.width).toBeLessThanOrEqual(title.x);
  expect(title.x + title.width).toBeLessThanOrEqual(points.x);
});

test('at 200% text the header title keeps room: "pts" gives way first', async ({ page }) => {
  await page.goto('/#/library');
  await page.addStyleTag({ content: 'html { font-size: 200% }' });
  await page.waitForTimeout(200);
  const title = (await page.locator('header h1').boundingBox())!;
  expect(title.width).toBeGreaterThanOrEqual(100);
  // The word is hidden, not the meaning: the chip still names the points.
  await expect(page.getByTestId('points')).toContainText(/\d+ points/);
});

test('at 200% text the mini-player gives its title room: the cover gives way', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
  await page.addStyleTag({ content: 'html { font-size: 200% }' });
  await page.waitForTimeout(300);
  const mini = page.getByRole('button', { name: /^Now playing:/ });
  const title = (await mini.locator('[lang]').first().boundingBox())!;
  expect(title.width).toBeGreaterThanOrEqual(120);
});
