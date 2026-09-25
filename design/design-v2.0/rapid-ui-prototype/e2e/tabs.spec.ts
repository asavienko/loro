// Two tabs of the app: a rating (or its undo) given in one is never lost or reversed by the other.
import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/** What storage holds: ratings still in their window. */
const stored = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ pending: string[] }>((resolve) => {
        const open = indexedDB.open('loro-prototype', 1);
        open.onsuccess = () => {
          const get = open.result.transaction('kv').objectStore('kv').get('state');
          get.onsuccess = () => {
            const s = JSON.parse(get.result as string);
            resolve({
              pending: s.pending.filter((p: { undone?: boolean }) => !p.undone).map((p: { phraseId: string; grade: string }) => `${p.phraseId}:${p.grade}`),
            });
          };
        };
      }),
  );

async function rateHardInPlayer(page: Page) {
  await page.getByRole('button', { name: 'Play 5 phrases' }).click();
  await page.getByRole('button', { name: /^Now playing:/ }).click();
  const player = page.getByRole('dialog', { name: 'Now playing' });
  await player.getByRole('button', { name: 'Pause', exact: true }).click();
  await player.getByRole('button', { name: /^Hard/ }).click();
  return player;
}

test("a rating isn't lost when another tab saves over it and both close", async ({ page, context }) => {
  await page.clock.install();
  await page.goto('/');
  const other = await context.newPage();
  await other.clock.install();
  await other.goto('/#/set/set-market?from=explore');
  await page.bringToFront();
  await rateHardInPlayer(page);
  await page.clock.runFor(1000);
  await expect.poll(async () => (await stored(page)).pending).toContain('cafe-01:hard');
  // The other tab saves only a queue change.
  await other.bringToFront();
  await other.getByRole('button', { name: 'Play Mercado' }).click();
  await other.clock.runFor(1000);
  await other.waitForTimeout(300);
  await page.close({ runBeforeUnload: true });
  await other.close({ runBeforeUnload: true });
  const next = await context.newPage();
  await next.clock.install();
  await next.goto('/');
  await next.clock.runFor(2000);
  await next.clock.fastForward(6 * 60_000);
  await next.clock.runFor(20_000);
  // The rating counts: Home's Today line says so (committed or not, it wasn't lost).
  await expect(next.getByText(/· 1 rated$/)).toBeVisible();
});

test('an undo in one tab holds when another tab opened during the window', async ({ page, context }) => {
  await page.clock.install();
  await page.goto('/');
  const player = await rateHardInPlayer(page);
  await page.clock.runFor(1000);
  const other = await context.newPage();
  await other.clock.install();
  await other.goto('/');
  await other.clock.runFor(1000);
  await page.bringToFront();
  await player.getByRole('button', { name: 'Undo' }).click();
  await page.clock.runFor(1000);
  await other.waitForTimeout(500);
  // The other tab's window closes first, then this one's.
  await other.clock.fastForward(6 * 60_000);
  await other.clock.runFor(16_000);
  await page.clock.fastForward(6 * 60_000);
  await page.clock.runFor(16_000);
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByRole('heading', { name: '¡Hola, Ana!' })).toBeVisible();
  await expect(page.getByText(/· [1-9]\d* rated$/)).toHaveCount(0);
});

test('a tab on the old app after an update stops saving over the newer save, and says why', async ({ page }) => {
  await page.goto('/#/set/set-taxi?from=explore');
  await page.waitForTimeout(800);
  // Another tab, already updated, saves in a newer format.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open('loro-prototype', 1);
        open.onsuccess = () => {
          const store = open.result.transaction('kv', 'readwrite').objectStore('kv');
          const get = store.get('state');
          get.onsuccess = () => {
            const newer = { ...JSON.parse(get.result as string), version: 99, marker: 'newer' };
            store.put(JSON.stringify(newer), 'state').onsuccess = () => resolve();
          };
        };
      }),
  );
  await page.getByRole('button', { name: 'Like set' }).click();
  await expect(page.locator('.toast-layer').getByText('A newer version of Loro is open in another tab. Reload to keep saving here.')).toBeVisible();
  const kept = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const open = indexedDB.open('loro-prototype', 1);
        open.onsuccess = () => {
          const get = open.result.transaction('kv').objectStore('kv').get('state');
          get.onsuccess = () => resolve(JSON.parse(get.result as string).marker);
        };
      }),
  );
  expect(kept).toBe('newer');
});

test("a setting changed in one tab isn't reverted when another tab saves later", async ({ page, context }) => {
  await page.goto('/#/set/set-cafe?from=explore');
  const other = await context.newPage();
  await other.goto('/#/set/set-taxi?from=explore');
  await page.bringToFront();
  await page.getByRole('button', { name: /Set order/ }).click();
  await page.getByRole('radio', { name: 'A–Z' }).click();
  await expect(page.getByText('Plays in: A–Z')).toBeVisible();
  await page.waitForTimeout(800);
  await page.close({ runBeforeUnload: true });
  // The other tab, opened before the change, saves something else.
  await other.bringToFront();
  await other.getByRole('button', { name: 'Like set' }).click();
  await other.waitForTimeout(800);
  const next = await context.newPage();
  await next.goto('/#/set/set-cafe?from=explore');
  await expect(next.getByText('Plays in: A–Z')).toBeVisible();
});
