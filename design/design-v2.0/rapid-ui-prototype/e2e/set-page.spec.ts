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
