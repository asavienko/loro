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

test('with reduced motion the playing row keeps a still equaliser, not three dots', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/set/set-cafe?from=home');
  await page.getByRole('button', { name: 'Play Café & Mañanas' }).click();
  const bars = page.locator('[aria-current="true"] [class*="eq-bar-"]');
  await expect(bars).toHaveCount(3);
  await page.waitForTimeout(300);
  const boxes = await bars.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ w: r.width, h: r.height })));
  for (const box of boxes) expect(box.w).toBeGreaterThanOrEqual(3);
  // Three different heights read as "playing"; three 3 px dots did not.
  expect(Math.max(...boxes.map((b) => b.h))).toBeGreaterThanOrEqual(12);
  expect(new Set(boxes.map((b) => Math.round(b.h))).size).toBe(3);
});
