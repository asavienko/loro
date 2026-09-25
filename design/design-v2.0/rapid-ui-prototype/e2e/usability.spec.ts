// From a first-time and a returning learner's walkthrough: the answer stays hidden while you
// recall it, a tap never throws a queue away, and screens open on what's useful.
import { expect, sampleHistory, test } from './fixtures';

test("the set page hides the playing phrase's Spanish while you recall it", async ({ page }) => {
  await page.goto('/#/set/set-cafe?from=explore');
  await page.getByRole('button', { name: 'Play Café & Mañanas' }).click();
  // The first step is the prompt: the Spanish hasn't been heard yet.
  await page.getByRole('button', { name: 'Pause', exact: true }).first().click();
  await expect(page.locator('main').getByText('Me pone un cortado, por favor')).toHaveCount(0);
  // Its prompt shows in its place.
  await expect(page.locator('main').getByText('A cortado, please', { exact: false }).first()).toBeVisible();
});

test.describe('a returning learner with reviews due', () => {
  test.use({ seed: { log: sampleHistory(Date.now()) } });

  test('a phrase tapped in Explore plays now and keeps the review after it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^Play \d+ phrases · / }).first().click();
    await page.getByRole('button', { name: 'Pause', exact: true }).first().click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    const total = Number((await player.getByText(/^1 of (\d+)$/).textContent())!.match(/of (\d+)/)![1]);
    await page.getByRole('button', { name: 'Close player' }).click();
    await page.goto('/#/explore?q=estacion');
    await page.getByRole('button', { name: /^Play .*estación/ }).first().click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    // Next in the review (moved up if the review already had it), not a new 4-phrase queue.
    await expect(player.getByText(new RegExp(`^2 of (${total}|${total + 1})$`))).toBeVisible();
  });

  test('Library opens on the reviews that are due', async ({ page }) => {
    await page.goto('/#/library');
    await expect(page).toHaveURL(/#\/library$/);
    await expect(page.getByRole('tab', { name: 'Due' })).toHaveAttribute('aria-selected', 'true');
  });

  test("Home's next review line doesn't contradict the reviews due now", async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/After these: \d+ more phrases? /)).toBeVisible();
    await expect(page.getByText(/Next: \d+ phrases? /)).toHaveCount(0);
  });
});

test('a filter in Explore puts its results first', async ({ page }) => {
  await page.goto('/#/explore?tag=food');
  await expect(page.getByRole('heading', { name: /phrases?$/ }).first()).toBeVisible();
  // The topic tiles step aside, so the results sit under the filters.
  await expect(page.getByRole('heading', { name: 'Topics' })).toHaveCount(0);
});
