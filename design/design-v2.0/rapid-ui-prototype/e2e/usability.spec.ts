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
    // The tapped phrase plays (the review already had it: Play went to it), and the review is
    // still the queue, not the phrase's 4-phrase set.
    await expect(page.getByRole('button', { name: /^Now playing: .*estación/ }).or(player.getByRole('heading', { name: /estación/ })).first()).toBeAttached();
    await expect(player.getByText(new RegExp(`^\\d+ of (${total}|${total + 1})$`))).toBeVisible();
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

  test('a finished review stops reading as due at once; Undo brings its phrase back (U-03)', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    const dueLine = page.getByText(/^\d+ phrases? (is|are) due/);
    const due = Number((await dueLine.textContent())!.match(/^(\d+)/)![1]);
    await page.getByRole('button', { name: /^Play \d+ phrases · / }).first().click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    await player.getByRole('button', { name: 'Pause', exact: true }).click();
    // Rate every phrase of the review, paused, so the loop can't move on under the test.
    for (let i = 1; i <= due; i++) {
      await expect(player.getByText(`${i} of ${due}`, { exact: true })).toBeVisible();
      await player.getByRole('button', { name: /^Easy/ }).click();
      await expect(player.getByText(/^Rated Easy — back /)).toBeVisible();
      if (i < due) await player.getByRole('button', { name: 'Next phrase', exact: true }).click();
    }
    const pointsBefore = await page.getByTestId('points').textContent();
    await page.getByRole('button', { name: 'Close player' }).click();

    // Home: the review is done, and the next one is in the future.
    await expect(page.getByRole('heading', { name: 'Review', exact: true })).toHaveCount(0);
    await expect(dueLine).toHaveCount(0);
    await expect(page.getByText(/Next: \d+ phrases? /)).toBeVisible();
    // Library: nothing due, and the rows say when each phrase comes back.
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await page.getByRole('tab', { name: 'Due' }).click();
    await expect(page.getByText('Nothing is due right now.')).toBeVisible();

    // Undo the last rating: that phrase is due again, everywhere, at once.
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    await player.getByRole('button', { name: 'Undo', exact: true }).click();
    await page.getByRole('button', { name: 'Close player' }).click();
    await expect(page.getByText('Nothing is due right now.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Play all (1)' })).toBeVisible();
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await expect(page.getByText('1 phrase is due', { exact: true })).toBeVisible();

    // The window closes: the ratings count (points) and not one figure moves.
    await page.clock.fastForward('06:00');
    await expect(page.getByTestId('points')).not.toHaveText(pointsBefore!);
    await expect(page.getByText('1 phrase is due', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await page.getByRole('tab', { name: 'Due' }).click();
    await expect(page.locator('[role="tabpanel"] li')).toHaveCount(1);
  });
});

test('a filter in Explore puts its results first', async ({ page }) => {
  await page.goto('/#/explore?tag=food');
  await expect(page.getByRole('heading', { name: /phrases?$/ }).first()).toBeVisible();
  // The topic tiles step aside, so the results sit under the filters.
  await expect(page.locator('#topics-heading')).toHaveCount(0);
});

test.describe('Play from Explore keeps the queue in order (regression)', () => {
  test('the phrase already playing replays, instead of the one after it', async ({ page }) => {
    await page.goto('/#/set/set-taxi?from=explore');
    await page.getByRole('button', { name: 'Play Taxi de Noche' }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).first().click();
    await page.goto('/#/set/set-cafe?from=explore');
    // Cafe's first phrase from Explore's search, while the taxi queue is going.
    await page.goto('/#/explore?q=cortado');
    await page.getByRole('button', { name: /^Play Me pone un cortado/ }).first().click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    await expect(player.getByText(/^2 of \d+$/)).toBeVisible();
    await page.getByRole('button', { name: 'Close player' }).click();
    await page.getByRole('button', { name: /^Play Me pone un cortado/ }).first().click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    await expect(player.getByText(/^2 of \d+$/)).toBeVisible();
  });

  test("the queue stays its set's: its page still shows it playing", async ({ page }) => {
    await page.goto('/#/explore');
    await page.getByRole('button', { name: 'Café & Mañanas' }).first().click();
    await page.getByRole('button', { name: 'Play Café & Mañanas' }).click();
    await page.evaluate(() => (window.location.hash = '#/explore?q=libre'));
    await page.getByRole('button', { name: /^Play ¿Está libre/ }).first().click();
    await page.evaluate(() => (window.location.hash = '#/set/set-cafe?from=explore'));
    await expect(page.getByRole('button', { name: 'Pause Café & Mañanas' })).toBeVisible();
  });
});

test('with a level filter on, a topic can still be added', async ({ page }) => {
  await page.goto('/#/explore?level=A1');
  await page.getByRole('group', { name: 'Topics' }).getByRole('button').first().click();
  await expect(page).toHaveURL(/topic=/);
  await expect(page).toHaveURL(/level=A1/);
});
