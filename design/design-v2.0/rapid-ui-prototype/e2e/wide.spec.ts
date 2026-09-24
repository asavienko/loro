// A desktop window (1440×900): the top bars line up with the content they sit over.
import { expect, sampleHistory, test } from './fixtures';

test.use({ viewport: { width: 1440, height: 900 }, seed: { log: sampleHistory(Date.now()) } });

test("the set page's Back lines up with its column", async ({ page }) => {
  await page.goto('/#/set/set-cafe?from=explore');
  const back = (await page.getByRole('button', { name: /^Back/ }).first().boundingBox())!;
  const section = (await page.locator('main section').first().boundingBox())!;
  expect(Math.abs(back.x - section.x)).toBeLessThan(24);
});

test("the player's header lines up with its body", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
  await page.getByRole('button', { name: /^Now playing:/ }).click();
  const player = page.getByRole('dialog', { name: 'Now playing' });
  const queue = (await player.getByRole('button', { name: 'Open queue' }).boundingBox())!;
  const speed = (await player.getByRole('radiogroup', { name: 'Speed' }).boundingBox())!;
  expect(Math.abs(queue.x + queue.width - (speed.x + speed.width))).toBeLessThan(24);
});
