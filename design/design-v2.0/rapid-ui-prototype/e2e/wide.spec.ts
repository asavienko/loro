// A desktop window (1440×900): the top bars line up with the content they sit over.
import { expect, expectAccessible, sampleHistory, test } from './fixtures';

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
  const player = page.getByRole('dialog', { name: 'Now playing' });
  const queue = (await player.getByRole('button', { name: 'Open queue' }).boundingBox())!;
  // The grades span the controls' column (speed is a narrower, centred row).
  const easy = (await player.getByRole('button', { name: /^Easy/ }).boundingBox())!;
  expect(Math.abs(queue.x + queue.width - (easy.x + easy.width))).toBeLessThan(24);
});

test.describe('a portrait tablet (768×1024)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });
  test('the player keeps one column, the cover centred above the controls', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    // Measure once the player has finished sliding up.
    await expect(player).toHaveCSS('transform', 'none');
    const flag = (await player.getByRole('img', { name: 'Spanish' }).boundingBox())!;
    const pause = (await player.getByRole('button', { name: 'Pause', exact: true }).boundingBox())!;
    expect(flag.y).toBeLessThan(pause.y - 200);
    expect(Math.abs(pause.x + pause.width / 2 - 384)).toBeLessThan(24);
  });
});

const openPlayer = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
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

for (const hash of ['/', '/#/explore', '/#/library', '/#/set/set-cafe?from=explore']) {
  test(`desktop accessibility: ${hash}`, async ({ page }) => {
    await page.goto(hash);
    await page.waitForTimeout(300);
    await expectAccessible(page);
  });
}

test('desktop accessibility: the player, with a control hovered', async ({ page }) => {
  const player = await openPlayer(page);
  await player.getByRole('button', { name: /^Easy/ }).hover();
  await expectAccessible(page);
});

test.describe('high contrast (forced colours)', () => {
  test('the hidden phrase and the chosen grade and speed stay visible', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    const player = await openPlayer(page);
    const bar = player.locator('h2 [aria-hidden="true"] > span').first();
    expect(await bar.evaluate((e) => getComputedStyle(e).borderTopStyle)).toBe('dashed');
    await player.getByRole('button', { name: /^Easy/ }).click();
    for (const chosen of [player.getByRole('button', { name: /^Easy/ }), player.getByRole('radio', { checked: true })]) {
      expect(await chosen.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('solid');
    }
    await expectAccessible(page);
  });
});

test.describe('with a dark system theme', () => {
  test.use({ colorScheme: 'dark' });
  test('native controls stay light, like the page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Ana: settings' }).click();
    const select = page.getByLabel('I’m learning');
    expect(await select.evaluate((e) => getComputedStyle(e).colorScheme)).toBe('light');
  });
});

test.describe('a navigation rail on a wide screen (V-11)', () => {
  for (const [w, h] of [[1440, 900], [1024, 768]] as const) {
    test(`at ${w}×${h} the tabs are a rail on the left; the header, the page and the mini-player sit right of it`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/#/explore');
      await page.getByRole('button', { name: /^Play Café/ }).first().click();
      await page.goto('/');
      const rail = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())!;
      expect(rail.x).toBe(0);
      expect(rail.width).toBeLessThanOrEqual(96);
      expect(rail.height).toBeGreaterThan(h - 2);
      const home = (await page.getByRole('button', { name: 'Home', exact: true }).boundingBox())!;
      const explore = (await page.getByRole('button', { name: 'Explore', exact: true }).boundingBox())!;
      expect(explore.y).toBeGreaterThan(home.y + home.height - 1);
      expect(Math.abs(explore.x - home.x)).toBeLessThan(2);
      const right = rail.x + rail.width;
      expect((await page.locator('header').boundingBox())!.x).toBeGreaterThanOrEqual(right - 1);
      expect((await page.getByRole('region', { name: 'Review' }).boundingBox())!.x).toBeGreaterThan(right);
      const mini = (await page.getByRole('button', { name: /^Now playing:/ }).boundingBox())!;
      expect(mini.x).toBeGreaterThan(right);
      expect(mini.y + mini.height).toBeGreaterThan(h - 100);
      await expectAccessible(page);
    });
  }

  test('Home has two columns: what to play on the left, the shelves on the right', async ({ page }) => {
    await page.goto('/');
    const hero = (await page.getByRole('region', { name: 'Review' }).boundingBox())!;
    const shelves = (await page.getByRole('heading', { name: 'Jump back in' }).boundingBox())!;
    expect(shelves.x).toBeGreaterThan(hero.x + hero.width);
    expect(Math.abs(shelves.y - hero.y)).toBeLessThan(60);
    // The header lines up with the page's column.
    const avatar = (await page.getByRole('button', { name: 'Ana: settings' }).boundingBox())!;
    expect(Math.abs(avatar.x - hero.x)).toBeLessThan(24);
  });

  test('at 200% text Home goes back to one column instead of spilling sideways', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/');
    await page.addStyleTag({ content: 'html { font-size: 200% }' });
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
    const hero = (await page.getByRole('region', { name: 'Review' }).boundingBox())!;
    const shelves = (await page.getByRole('heading', { name: 'Jump back in' }).boundingBox())!;
    expect(shelves.y).toBeGreaterThan(hero.y + hero.height);
  });

  test.describe('a portrait tablet (768×1024)', () => {
    test.use({ viewport: { width: 768, height: 1024 } });
    test('keeps the tab bar at the bottom and Home in one reading column', async ({ page }) => {
      await page.goto('/');
      const bar = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())!;
      expect(bar.width).toBe(768);
      expect(bar.y + bar.height).toBeGreaterThan(1022);
      const hero = (await page.getByRole('region', { name: 'Review' }).boundingBox())!;
      const shelves = (await page.getByRole('heading', { name: 'Jump back in' }).boundingBox())!;
      expect(shelves.y).toBeGreaterThan(hero.y + hero.height);
      expect(hero.width).toBeLessThanOrEqual(672);
      const avatar = (await page.getByRole('button', { name: 'Ana: settings' }).boundingBox())!;
      expect(Math.abs(avatar.x - hero.x)).toBeLessThan(24);
    });
  });
});
