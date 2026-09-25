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
  });
}
