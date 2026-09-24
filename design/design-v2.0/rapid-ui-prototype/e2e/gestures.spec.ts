// Gestures, driven with a pointer the way motion's drag handlers see a finger.
import { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

async function drag(page: Page, target: Locator, dx: number, dy: number) {
  const box = (await target.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x + (dx * i) / 10, y + (dy * i) / 10);
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
  await drag(page, queue.getByRole('button', { name: 'Play La cuenta, por favor now' }), -160, 0);
  await expect(queue.getByText('3 left')).toBeVisible();
  await drag(page, queue.getByRole('button', { name: 'Play Sin gluten, por favor now' }), 160, 0);
  await expect(queue.getByRole('button', { name: /Me pone|Sin gluten/ }).first()).toBeVisible();
  await expect(queue.locator('[aria-current="true"]')).toContainText('Gluten-free, please');
});

test('drag a queued phrase by its handle to reorder', async ({ page }) => {
  const queue = await openQueue(page);
  const last = queue.getByRole('button', { name: 'Move Sin gluten, por favor' });
  const first = queue.getByRole('button', { name: 'Move ¿Tienen leche de avena?' });
  const to = (await first.boundingBox())!;
  const from = (await last.boundingBox())!;
  await drag(page, last, 0, to.y - from.y - 10);
  await page.waitForTimeout(300);
  await expect(queue.getByRole('button', { name: /^Play .* now$/ }).first()).toHaveAccessibleName('Play Sin gluten, por favor now');
});

test('swipe the mini-player to change phrase', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play 5 phrases' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const mini = page.getByRole('button', { name: /^Now playing:/ });
  await drag(page, mini, -150, 0);
  await expect(mini).toContainText('Do you have oat milk?');
  await drag(page, mini, 150, 0);
  await expect(mini).toContainText('A cortado, please');
});

test('drag the player down by its title to close it; swipe the cover to change phrase', async ({ page }) => {
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
