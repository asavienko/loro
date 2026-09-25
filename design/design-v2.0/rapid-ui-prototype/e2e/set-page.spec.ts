// The set page's Play (open decision 7): it resumes only a paused queue that is this whole set in
// the order shown, says so ("Resume", "Paused at 2 of 5"), and otherwise starts the set again in
// the order shown. The due-and-new queue is paused from its own button.
import { expect, sampleHistory, test } from './fixtures';

test.use({ seed: { log: sampleHistory(Date.now()) } });

const CAFE = '/#/set/set-cafe?from=explore';
const current = (page: import('@playwright/test').Page) => page.locator('main li:has([aria-current="true"])');

test('paused on this whole set: Play resumes where it stopped, and says so', async ({ page }) => {
  await page.goto(CAFE);
  await page.getByRole('button', { name: 'Play Café & Mañanas' }).click();
  await page.getByRole('button', { name: 'Pause Café & Mañanas' }).click();
  await page.getByRole('button', { name: 'Next phrase', exact: true }).click();
  await expect(page.getByText('Paused at 2 of 5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume Café & Mañanas' }).click();
  await expect(page.getByRole('button', { name: 'Pause Café & Mañanas' })).toBeVisible();
  // Still the second phrase, not the first again.
  await expect(current(page)).toHaveCount(1);
  expect(await page.locator('main li').nth(1).locator('[aria-current="true"]').count()).toBe(1);
  await expect(page.getByText(/^Paused at/)).toHaveCount(0);
});

test('after the sort changes, Play starts the set again in the new order', async ({ page }) => {
  await page.goto(CAFE);
  await page.getByRole('button', { name: 'Play Café & Mañanas' }).click();
  await page.getByRole('button', { name: 'Pause Café & Mañanas' }).click();
  await page.getByRole('button', { name: 'Next phrase', exact: true }).click();
  await page.getByRole('button', { name: /^Plays in: Set order/ }).click();
  await page.getByRole('radio', { name: 'A–Z' }).click();
  // The paused queue is no longer the order shown: no "Resume", no "Paused at".
  await expect(page.getByText(/^Paused at/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Play Café & Mañanas' }).click();
  await expect(page.getByRole('button', { name: 'Pause Café & Mañanas' })).toBeVisible();
  expect(await page.locator('main li').first().locator('[aria-current="true"]').count()).toBe(1);
});

test('the due-and-new queue pauses from its own button; the big Play then starts the whole set', async ({ page }) => {
  await page.goto(CAFE);
  await page.getByRole('button', { name: 'Play due and new (2)' }).click();
  // The page says which queue is playing: its own button pauses, the big one would play the set.
  await expect(page.getByRole('button', { name: 'Pause due and new' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play Café & Mañanas' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause due and new' }).click();
  await expect(page.getByRole('button', { name: 'Play due and new (2)' })).toBeVisible();
  await expect(page.getByText(/^Paused at/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Play Café & Mañanas' }).click();
  await expect(page.getByRole('button', { name: 'Pause Café & Mañanas' })).toBeVisible();
  expect(await page.locator('main li').first().locator('[aria-current="true"]').count()).toBe(1);
});

for (const [width, height] of [[390, 844], [320, 568], [1440, 900]] as const) {
  test(`"Play due and new" keeps clear of the big Play above it at ${width} px (Q-11)`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/#/set/set-cafe?from=explore');
    const play = (await page.getByRole('button', { name: 'Play Café & Mañanas' }).boundingBox())!;
    const dueNew = (await page.getByRole('button', { name: /^Play due and new/ }).boundingBox())!;
    expect(dueNew.y - (play.y + play.height)).toBeGreaterThanOrEqual(8);
  });
}

test('the play order is one control that also sorts, not a line and a second button', async ({ page }) => {
  await page.goto(CAFE);
  await expect(page.getByRole('button', { name: /Set order/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Set order/ })).toHaveAccessibleName('Plays in: Set order');
});

test('the phrase playing from another queue keeps its Spanish hidden here too, and is marked (R-02)', async ({ page }) => {
  await page.clock.install();
  await page.goto('/#/set/set-tapas?from=explore');
  await page.getByRole('button', { name: 'Play Tapas & Tabernas' }).click();
  // A café phrase tapped in Explore plays next, keeping the Tapas queue.
  await page.evaluate(() => (window.location.hash = '#/explore?q=cortado'));
  await page.getByRole('button', { name: 'Play Me pone un cortado, por favor' }).click();
  const mini = page.getByRole('button', { name: /^Now playing:/ });
  await expect(mini).toHaveAccessibleName('Now playing: A cortado, please');
  for (let t = 0; t < 20_000 && !/Your turn/.test((await page.locator('#root').textContent()) ?? ''); t += 100) await page.clock.runFor(100);
  await expect(page.getByText('Your turn — say it out loud in Spanish').first()).toBeVisible();
  await page.evaluate(() => (window.location.hash = '#/set/set-cafe?from=explore'));
  await expect(page.getByRole('heading', { name: 'Café & Mañanas', level: 1 })).toBeVisible();
  await expect(page.locator('main')).toContainText('Can we sit on the terrace?');
  await expect(page.locator('main')).not.toContainText('Me pone');
  await expect(current(page)).toHaveCount(1);
  await expect(current(page)).toContainText('A cortado, please');
  await expect(current(page)).toContainText('Spanish hidden until you hear it');
});

for (const [edit, key] of [['removed from', 'Delete'], ['moved in', 'ArrowDown']] as const) {
  test(`after a phrase is ${edit} Up next, Play starts the set again rather than resume the edited queue (R-03)`, async ({ page }) => {
    await page.goto(CAFE);
    await page.getByRole('button', { name: 'Play Café & Mañanas' }).click();
    await page.getByRole('button', { name: 'Pause Café & Mañanas' }).click();
    await expect(page.getByRole('button', { name: 'Resume Café & Mañanas' })).toBeVisible();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    await page.getByRole('button', { name: 'Open queue' }).click();
    const queue = page.getByRole('dialog', { name: 'Queue' });
    await queue.getByRole('button', { name: /^Move / }).first().press(key);
    await expect(queue.getByRole('button', { name: /^Move / }).first()).not.toHaveAccessibleName('Move Do you have oat milk?');
    await page.goBack();
    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Now playing' })).toHaveCount(0);
    // The paused queue is no longer this set in the order shown: no "Resume", no "Paused at".
    await expect(page.getByRole('button', { name: 'Play Café & Mañanas' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resume Café & Mañanas' })).toHaveCount(0);
    await expect(page.getByText(/^Paused at/)).toHaveCount(0);
    // Play starts the whole set again, in the order shown.
    await page.getByRole('button', { name: 'Play Café & Mañanas' }).click();
    await page.getByRole('button', { name: 'Pause Café & Mañanas' }).click();
    await expect(page.getByText('Paused at 1 of 5', { exact: true })).toBeVisible();
  });
}

test('a missed phrase coming back later in the queue still lets Play resume the set (R-03)', async ({ page }) => {
  await page.goto(CAFE);
  await page.getByRole('button', { name: 'Play Café & Mañanas' }).click();
  await page.getByRole('button', { name: 'Pause Café & Mañanas' }).click();
  await page.getByRole('button', { name: /^Now playing:/ }).click();
  const player = page.getByRole('dialog', { name: 'Now playing' });
  await player.getByRole('button', { name: /^Missed/ }).click();
  await expect(player.getByText('1 of 6', { exact: true })).toBeVisible();
  await player.getByRole('button', { name: 'Close player' }).click();
  await expect(page.getByRole('button', { name: 'Resume Café & Mañanas' })).toBeVisible();
});
