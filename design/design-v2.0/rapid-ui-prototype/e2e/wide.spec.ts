// A desktop window (1440×900): the top bars line up with the content they sit over.
import { expect, sampleHistory, test } from './fixtures';

// A desktop with a mouse, not the suite's default iPhone emulation.
test.use({ viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false, seed: { log: sampleHistory(Date.now()) } });

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

test.describe('a portrait tablet (768×1024)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });
  test('the player keeps one column, the cover centred above the controls', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    const flag = (await player.getByRole('img', { name: 'Spanish' }).boundingBox())!;
    const pause = (await player.getByRole('button', { name: 'Pause', exact: true }).boundingBox())!;
    expect(flag.y).toBeLessThan(pause.y - 200);
    expect(Math.abs(pause.x + pause.width / 2 - 384)).toBeLessThan(24);
  });
});

const openPlayer = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
  await page.getByRole('button', { name: /^Now playing:/ }).click();
  return page.getByRole('dialog', { name: 'Now playing' });
};

test('with a mouse, the player names its keyboard shortcuts', async ({ page }) => {
  const player = await openPlayer(page);
  await expect(player.getByText(/^Keys: Space play or pause/)).toBeVisible();
});

test.describe('on a touch phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('the keyboard hint stays hidden', async ({ page }) => {
    const player = await openPlayer(page);
    await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await expect(player.getByText(/^Keys:/)).toBeHidden();
  });
});

test('with a mouse, buttons show the hand cursor and answer hover', async ({ page }) => {
  await page.goto('/');
  const explore = page.getByRole('button', { name: 'Explore' });
  expect(await explore.evaluate((e) => getComputedStyle(e).cursor)).toBe('pointer');
  expect(await explore.evaluate((e) => getComputedStyle(e).backgroundImage)).toBe('none');
  await explore.hover();
  expect(await explore.evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('gradient');
});
