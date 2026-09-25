// The shared components keep their shape: header order, and room for the title at large text.
import { expect, sampleHistory, test } from './fixtures';

test.use({ seed: { log: sampleHistory(Date.now()) } });

test('the header reads avatar, then the page title, then the points', async ({ page }) => {
  await page.goto('/#/library');
  const avatar = (await page.getByRole('button', { name: 'Ana: settings' }).boundingBox())!;
  const title = (await page.locator('header h1').boundingBox())!;
  const points = (await page.getByTestId('points').boundingBox())!;
  expect(avatar.x + avatar.width).toBeLessThanOrEqual(title.x);
  expect(title.x + title.width).toBeLessThanOrEqual(points.x);
});

test('at 200% text the header title keeps room: "pts" gives way first', async ({ page }) => {
  await page.goto('/#/library');
  await page.addStyleTag({ content: 'html { font-size: 200% }' });
  await page.waitForTimeout(200);
  const title = (await page.locator('header h1').boundingBox())!;
  expect(title.width).toBeGreaterThanOrEqual(100);
  // The word is hidden, not the meaning: the chip still names the points.
  await expect(page.getByTestId('points')).toContainText(/\d+ points/);
});

test('at 200% text the mini-player gives its title room: the cover gives way', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
  await page.getByRole('button', { name: 'Close player' }).click(); // Home's Play opens the player
  await page.addStyleTag({ content: 'html { font-size: 200% }' });
  await page.waitForTimeout(300);
  const mini = page.getByRole('button', { name: /^Now playing:/ });
  const title = (await mini.locator('[lang]').first().boundingBox())!;
  expect(title.width).toBeGreaterThanOrEqual(120);
});

test('with reduced motion the playing row keeps a still equaliser, not three dots', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/set/set-cafe?from=home');
  await page.getByRole('button', { name: 'Play Café & Mañanas' }).click();
  const bars = page.locator('[aria-current="true"] [class*="eq-bar-"]');
  await expect(bars).toHaveCount(3);
  await page.waitForTimeout(300);
  const boxes = await bars.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ w: r.width, h: r.height })));
  for (const box of boxes) expect(box.w).toBeGreaterThanOrEqual(3);
  // Three different heights read as "playing"; three 3 px dots did not.
  expect(Math.max(...boxes.map((b) => b.h))).toBeGreaterThanOrEqual(12);
  expect(new Set(boxes.map((b) => Math.round(b.h))).size).toBe(3);
});

const TERRACOTTA = 'rgb(159, 60, 22)'; // primary-container
const INK = 'rgb(49, 48, 45)'; // inverse-surface

/** The drawn covers on the page (a clipped square holding a glyph), and those whose glyph pokes out of it. */
const covers = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const all = [...document.querySelectorAll<HTMLElement>('span.block.overflow-hidden[aria-hidden="true"]')].filter(
      (cover) => cover.getBoundingClientRect().width > 0 && cover.querySelector('.material-symbols-outlined'),
    );
    const cropped = all.filter((cover) => {
      const box = cover.getBoundingClientRect();
      const glyph = cover.querySelector('.material-symbols-outlined')!.getBoundingClientRect();
      return glyph.left < box.left - 1 || glyph.right > box.right + 1 || glyph.top < box.top - 1 || glyph.bottom > box.bottom + 1;
    });
    return { count: all.length, cropped: cropped.map((cover) => `${Math.round(cover.getBoundingClientRect().width)} px cover`) };
  });

test('covers show their whole icon, from the 44 px mini-player to the grid', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
  await page.getByRole('button', { name: 'Close player' }).click(); // Home's Play opens the player
  await expect(page.getByRole('button', { name: /^Now playing:/ })).toBeVisible();
  const home = await covers(page);
  expect(home.count).toBeGreaterThanOrEqual(4);
  expect(home.cropped).toEqual([]);
  await page.goto('/#/explore');
  await expect(page.getByRole('heading', { name: 'All sets' })).toBeVisible();
  const explore = await covers(page);
  expect(explore.count).toBeGreaterThanOrEqual(6);
  expect(explore.cropped).toEqual([]);
});

test('covers in one topic share a colour but not a shape', async ({ page }) => {
  await page.goto('/#/explore?topic=eating-out');
  const shapes = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('main li span.block.overflow-hidden[aria-hidden="true"]')].map((cover) => {
      const shape = getComputedStyle(cover.firstElementChild as HTMLElement);
      return `${shape.borderRadius} ${shape.clipPath} ${shape.height}`;
    }),
  );
  expect(shapes.length).toBeGreaterThanOrEqual(2);
  expect(new Set(shapes).size).toBe(shapes.length);
});

test('a chosen filter is ink, and terracotta is left for Play', async ({ page }) => {
  await page.goto('/#/library?view=due');
  const chosen = page.getByRole('tab', { selected: true }).locator('span').first();
  await expect(chosen).toHaveCSS('background-color', INK);
  await expect(page.getByRole('button', { name: /^Play all/ })).toHaveCSS('background-color', TERRACOTTA);
  await page.goto('/#/explore?topic=eating-out');
  await expect(page.getByRole('button', { name: /^Remove filter/ }).locator('span').first()).toHaveCSS('background-color', INK);
  // A set card's quick play is quiet: paper with a terracotta icon, not a terracotta disc.
  await expect(page.getByRole('button', { name: /^Play Café/ }).first()).not.toHaveCSS('background-color', TERRACOTTA);
});
