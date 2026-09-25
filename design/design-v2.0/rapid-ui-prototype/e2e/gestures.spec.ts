// Gestures, driven with a pointer the way motion's drag handlers see a finger.
import { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

async function drag(page: Page, target: Locator, dx: number, dy: number) {
  const box = (await target.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  // At a finger's pace, a frame per step: faster, WebKit's frames don't keep up and a
  // reorder drag doesn't register.
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(x + (dx * i) / 20, y + (dy * i) / 20);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

async function openQueue(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play 5 phrases' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: /^Now playing:/ }).click();
  await page.getByRole('button', { name: 'Open queue' }).click();
  await page.waitForTimeout(500);
  return page.getByRole('dialog', { name: 'Queue' });
}

test('swipe a queued phrase left to remove it, right to play it now', async ({ page }) => {
  const queue = await openQueue(page);
  await expect(queue.getByText('4 left')).toBeVisible();
  const hint = queue.getByText(/^Swipe right to play now/);
  await expect(hint).toBeVisible();
  await drag(page, queue.getByRole('button', { name: 'Play The bill, please now' }), -160, 0);
  await expect(queue.getByText('3 left')).toBeVisible();
  // It has done its job: the hint folds away (and stays folded, a device setting).
  await expect(hint).toHaveCount(0);
  await drag(page, queue.getByRole('button', { name: 'Play Gluten-free, please now' }), 160, 0);
  await expect(queue.getByRole('button', { name: /Me pone|Sin gluten/ }).first()).toBeVisible();
  await expect(queue.locator('[aria-current="true"]')).toContainText('Gluten-free, please');
});

test('drag a queued phrase by its handle to reorder', async ({ page }) => {
  const queue = await openQueue(page);
  const last = queue.getByRole('button', { name: 'Move Gluten-free, please' });
  const first = queue.getByRole('button', { name: 'Move Do you have oat milk?' });
  const to = (await first.boundingBox())!;
  const from = (await last.boundingBox())!;
  await drag(page, last, 0, to.y - from.y - 10);
  await page.waitForTimeout(300);
  await expect(queue.getByRole('button', { name: /^Play .* now$/ }).first()).toHaveAccessibleName('Play Gluten-free, please now');
  // A drag is not a tap: it doesn't also open the row's options.
  await expect(page.getByRole('dialog', { name: 'Gluten-free, please' })).toHaveCount(0);
});

test('a tap on the handle offers the same moves without dragging (WCAG 2.5.7)', async ({ page }) => {
  const queue = await openQueue(page);
  await queue.getByRole('button', { name: 'Move The bill, please' }).tap();
  const options = page.getByRole('dialog', { name: 'The bill, please' });
  await options.getByRole('button', { name: 'Move up' }).tap();
  await expect(page.getByRole('status')).toHaveText('Moved to position 1 of 4');
  await expect(options).toHaveCount(0);
  await queue.getByRole('button', { name: 'Move The bill, please' }).tap();
  await expect(options.getByRole('button', { name: 'Move up' })).toBeDisabled();
  await options.getByRole('button', { name: 'Remove from queue' }).tap();
  await expect(queue.getByText('3 left')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
});

// In Firefox a mouse drag on these two surfaces moves them but never ends (onDragEnd doesn't
// fire), while the queue's drags work; touch on Firefox for Android is untested here.
const FIREFOX_DRAG = 'Firefox: a mouse drag on the mini-player and player never ends; check touch on a device';

test('swipe the mini-player to change phrase', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', FIREFOX_DRAG);
  await page.goto('/');
  await page.getByRole('button', { name: 'Play 5 phrases' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const mini = page.getByRole('button', { name: /^Now playing:/ });
  await drag(page, mini, -150, 0);
  await expect(mini).toContainText('Do you have oat milk?');
  await drag(page, mini, 150, 0);
  await expect(mini).toContainText('A cortado, please');
});

test('drag the player down by its title to close it; swipe the cover to change phrase', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', FIREFOX_DRAG);
  await page.goto('/');
  await page.getByRole('button', { name: 'Play 5 phrases' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: /^Now playing:/ }).click();
  const player = page.getByRole('dialog', { name: 'Now playing' });
  await page.waitForTimeout(600);
  await drag(page, player.getByText('1 of 5'), 0, 0); // a tap on the title does nothing
  await expect(player).toBeVisible();
  const cover = player.getByRole('img', { name: 'Spanish' });
  await drag(page, cover, -160, 0);
  await expect(player.getByText('2 of 5')).toBeVisible();
  await drag(page, player.getByRole('heading', { name: 'Café & Mañanas' }), 0, 300);
  await expect(player).toHaveCount(0);
});

test('media keys: seek back replays the phrase, seek forward moves on', async ({ page }) => {
  await page.addInitScript(() => {
    const handlers: Record<string, () => void> = {};
    Object.defineProperty(navigator, 'mediaSession', {
      value: { metadata: null, playbackState: 'none', setActionHandler: (a: string, h: () => void) => (handlers[a] = h) },
    });
    (window as unknown as { __media: typeof handlers }).__media = handlers;
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Play 5 phrases' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const mini = page.getByRole('button', { name: /^Now playing:/ });
  await page.evaluate(() => (window as unknown as { __media: Record<string, () => void> }).__media.seekforward());
  await expect(mini).toContainText('Do you have oat milk?');
  await page.evaluate(() => (window as unknown as { __media: Record<string, () => void> }).__media.seekbackward());
  await expect(mini).toContainText('Do you have oat milk?');
  await page.evaluate(() => (window as unknown as { __media: Record<string, () => void> }).__media.previoustrack());
  await expect(mini).toContainText('A cortado, please');
});

test("a queue row's options stay with that phrase while playback moves on", async ({ page }) => {
  const queue = await openQueue(page);
  await queue.getByRole('button', { name: 'Move Gluten-free, please' }).tap();
  const options = page.getByRole('dialog', { name: 'Gluten-free, please' });
  await expect(options).toBeVisible();
  // Playback moves on underneath the open sheet.
  await page.evaluate(() => document.querySelector<HTMLElement>('[data-player]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
  await page.waitForTimeout(300);
  await expect(options).toBeVisible();
  await options.getByRole('button', { name: 'Remove from queue' }).tap();
  await expect(queue.getByRole('button', { name: 'Play Gluten-free, please now' })).toHaveCount(0);
});
