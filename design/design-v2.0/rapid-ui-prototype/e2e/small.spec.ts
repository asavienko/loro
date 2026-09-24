// A small phone (320×568): nothing scrolls sideways and the player's controls can be reached.
import { expect, sampleHistory, test } from './fixtures';

test.use({ viewport: { width: 320, height: 568 }, seed: { log: sampleHistory(Date.now()) } });

for (const hash of ['/', '/#/explore', '/#/library', '/#/library?view=ownSets', '/#/set/set-cafe?from=explore']) {
  test(`no sideways scroll: ${hash}`, async ({ page }) => {
    await page.goto(hash);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .filter((e) => e.getBoundingClientRect().right > 321 && !e.closest('.truncate, .scroll-row'))
        .map((e) => `${e.tagName}.${String(e.className).slice(0, 50)}`)
        .slice(0, 5),
    );
    expect(overflow).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });
}

test('the player fits, and Pause is reachable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
  await page.getByRole('button', { name: /^Now playing:/ }).click();
  await page.waitForTimeout(700);
  const player = page.getByRole('dialog', { name: 'Now playing' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const pause = player.getByRole('button', { name: 'Pause', exact: true });
  const box = (await pause.boundingBox())!;
  expect(box.y + box.height, 'Pause is visible without scrolling').toBeLessThanOrEqual(568);
  await pause.click();
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});

test.describe('phone landscape (568×320)', () => {
  test.use({ viewport: { width: 568, height: 320 } });

  test('Pause and the ratings are reachable without scrolling', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    await page.waitForTimeout(700);
    const player = page.getByRole('dialog', { name: 'Now playing' });
    for (const name of ['Pause', 'Next phrase']) {
      const box = (await player.getByRole('button', { name, exact: true }).boundingBox())!;
      expect(box.y + box.height, `${name} is visible`).toBeLessThanOrEqual(320);
    }
    const easy = (await player.getByRole('button', { name: /^Easy/ }).boundingBox())!;
    expect(easy.y + easy.height, 'Easy is visible').toBeLessThanOrEqual(320);
  });
});

test.describe('large text (150%) on a 360 px phone', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test('the step pills and rating buttons hold their labels', async ({ page }) => {
    await page.goto('/');
    await page.addStyleTag({ content: 'html { font-size: 150% !important }' });
    await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    await page.waitForTimeout(700);
    const player = page.getByRole('dialog', { name: 'Now playing' });
    const spilled = await player.evaluate((root) =>
      [...root.querySelectorAll('ol[aria-label] > li, [aria-keyshortcuts="1"], [aria-keyshortcuts="2"], [aria-keyshortcuts="3"]')]
        .filter((e) => e.scrollWidth > e.clientWidth + 1)
        .map((e) => e.textContent),
    );
    expect(spilled).toEqual([]);
  });

  for (const hash of ['/#/explore', '/#/set/set-cafe?from=explore']) {
    test(`set titles and phrases are shown whole: ${hash}`, async ({ page }) => {
      await page.goto(hash);
      await page.addStyleTag({ content: 'html { font-size: 150% !important }' });
      await page.waitForTimeout(300);
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll('main .line-clamp-2')]
          .filter((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)
          .map((e) => e.textContent),
      );
      expect(clipped).toEqual([]);
      expect(await page.locator('main .line-clamp-2').count()).toBeGreaterThan(3);
    });
  }
});
