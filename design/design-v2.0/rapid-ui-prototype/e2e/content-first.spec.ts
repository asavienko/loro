// Content first: on a phone, the first set or phrase of Explore, Library and a set page shows on the
// first screen, above the mini-player, rather than under a stack of filters and figures.
import { Page } from '@playwright/test';
import { expect, sampleHistory, test } from './fixtures';

test.use({ seed: { log: sampleHistory(Date.now()) } });

/** Something paused in the mini-player: the usual state of the bottom of the screen. */
async function withMiniPlayer(page: Page) {
  await page.goto('/#/set/set-taxi?from=explore');
  await page.getByRole('button', { name: 'Play Taxi de Noche' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).first().click();
}

/** Opens a route as a link would, then measures against the mini-player's top edge. */
async function open(page: Page, hash: string) {
  await page.evaluate((h) => (window.location.hash = h), hash);
  await page.waitForTimeout(300);
  return (await page.getByRole('button', { name: /^Now playing:/ }).boundingBox())!.y;
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test.describe(`${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('Explore shows its first set on the first screen', async ({ page }) => {
      await withMiniPlayer(page);
      const miniTop = await open(page, '#/explore');
      const card = (await page.locator('section[aria-labelledby="set-results"] li').first().boundingBox())!;
      const cover = card.width; // the cover is the card's square
      // At least half the cover on a small phone; the whole card, title and all, on a larger one.
      expect(card.y + (viewport.width > 360 ? card.height : cover / 2)).toBeLessThanOrEqual(miniTop);
    });

    test("a chosen topic's sets come first, headed by the topic (U-08)", async ({ page }) => {
      await withMiniPlayer(page);
      const miniTop = await open(page, '#/explore?topic=getting-around');
      const heading = page.getByRole('heading', { name: 'Getting around · 2 sets' });
      await expect(heading).toBeVisible();
      const card = (await page.locator('section[aria-labelledby="set-results"] li').first().boundingBox())!;
      expect(card.y + card.height).toBeLessThanOrEqual(miniTop);
      // The finer filters follow the results.
      const levels = (await page.getByRole('group', { name: 'Levels' }).boundingBox())!;
      expect(levels.y).toBeGreaterThan(card.y);
    });

    test('Library opens on its list: the first phrase above the mini-player (V-02)', async ({ page }) => {
      await withMiniPlayer(page);
      const miniTop = await open(page, '#/library');
      const row = (await page.getByRole('tabpanel').getByRole('listitem').first().boundingBox())!;
      expect(row.y + row.height).toBeLessThanOrEqual(miniTop);
      // The figures are still there, under Progress.
      await expect(page.getByRole('heading', { name: 'Progress' })).toBeAttached();
      await expect(page.getByRole('button', { name: /^Learned 3/ })).toBeAttached();
    });

    test('a set page shows its first phrase above the mini-player (V-04)', async ({ page }) => {
      await withMiniPlayer(page);
      const miniTop = await open(page, '#/set/set-cafe?from=explore');
      const row = (await page.getByRole('main').getByRole('listitem').first().boundingBox())!;
      expect(row.y + row.height).toBeLessThanOrEqual(miniTop);
      // Cover and title side by side, whatever the title's length.
      const cover = (await page.locator('main section span.block.overflow-hidden[aria-hidden="true"]').first().boundingBox())!;
      const title = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
      expect(title.x).toBeGreaterThanOrEqual(cover.x + cover.width);
    });

    test("Home's Learned lands on the Learned list, its chip and first phrase in view", async ({ page }) => {
      await withMiniPlayer(page);
      await page.goto('/');
      await page.getByRole('button', { name: /^Learned/ }).first().click();
      const tab = page.getByRole('tab', { name: 'Learned' });
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(tab).toBeInViewport({ ratio: 1 });
      const miniTop = (await page.getByRole('button', { name: /^Now playing:/ }).boundingBox())!.y;
      const row = (await page.getByRole('tabpanel').getByRole('listitem').first().boundingBox())!;
      expect(row.y + row.height).toBeLessThanOrEqual(miniTop);
    });
  });
}

test('a figure in Progress opens its list and brings it into view', async ({ page }) => {
  await page.goto('/#/library?view=due');
  await page.getByRole('button', { name: /^Learned 3/ }).click();
  await expect(page.getByRole('tab', { name: 'Learned' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel').getByRole('listitem').first()).toBeInViewport();
});
