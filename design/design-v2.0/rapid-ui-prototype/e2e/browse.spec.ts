import { expect, test } from './fixtures';

test.describe('explore', () => {
  test('search highlights matches and survives opening a set', async ({ page }) => {
    await page.goto('/#/explore');
    await page.getByRole('searchbox', { name: 'Search phrases, notes and topics' }).fill('cuenta');
    await expect(page).toHaveURL(/q=cuenta/);
    await expect(page.locator('mark', { hasText: 'cuenta' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Café & Mañanas' }).first().click();
    await expect(page.getByRole('heading', { name: 'Café & Mañanas' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('searchbox')).toHaveValue('cuenta');
  });

  test('a topic becomes a removable filter chip', async ({ page }) => {
    await page.goto('/#/explore');
    await page.getByRole('button', { name: /Getting around/ }).click();
    await expect(page.getByRole('heading', { name: 'Filtered sets · 2' })).toBeVisible();
    await page.getByRole('button', { name: 'Remove filter: Getting around' }).click();
    await expect(page.getByRole('heading', { name: 'All sets' })).toBeVisible();
  });
});

test.describe('library', () => {
  test('your own phrase, in your own set', async ({ page }) => {
    await page.goto('/#/library?view=mine');
    await page.getByRole('button', { name: 'Add your phrase' }).click();
    await page.getByLabel('In Spanish').fill('¿Hay wifi?');
    await page.getByLabel('In English').fill('Is there wifi?');
    await page.getByRole('button', { name: 'Add phrase' }).click();
    await expect(page.getByRole('button', { name: 'Play ¿Hay wifi?' })).toBeVisible();
    await page.getByRole('button', { name: 'Details for ¿Hay wifi?' }).click();
    await page.getByRole('button', { name: 'Add to set…' }).click();
    await page.getByRole('button', { name: 'New set…' }).click();
    await page.getByLabel('Name').fill('Travel bits');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('heading', { name: 'Travel bits' })).toBeVisible();
    await expect(page.getByText('Your set')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play ¿Hay wifi?' })).toBeVisible();
  });

  test('deleting your own phrase from its details', async ({ page }) => {
    await page.goto('/#/library?view=mine');
    await page.getByRole('button', { name: 'Add your phrase' }).click();
    await page.getByLabel('In Spanish').fill('Hola');
    await page.getByLabel('In English').fill('Hi');
    await page.getByRole('button', { name: 'Add phrase' }).click();
    await page.getByRole('button', { name: 'Details for Hola' }).click();
    await page.getByRole('button', { name: 'Delete phrase' }).click();
    await expect(page.getByText('Add a phrase of your own and it plays like any other.')).toBeVisible();
  });

  test('a like shows under Liked, and Play all plays it', async ({ page }) => {
    await page.goto('/#/set/set-taxi?from=explore');
    await page.getByRole('button', { name: 'Details for ¿Está libre?' }).click();
    await page.getByRole('button', { name: 'Like', exact: true }).click();
    await page.getByRole('button', { name: 'Close' }).click();
    await page.goto('/#/library?view=liked');
    await page.getByRole('button', { name: 'Play all (1)' }).click();
    await expect(page.getByRole('button', { name: /^Now playing:/ })).toBeVisible();
  });
});

test.describe('persistence', () => {
  test('a reload keeps the page and the queue', async ({ page }) => {
    await page.goto('/#/set/set-market?from=explore');
    await page.getByRole('button', { name: 'Play Mercado' }).click();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Mercado' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Now playing:/ })).toBeVisible();
  });
});

test.describe('sets you make', () => {
  test('save the queue as a set, rename it, delete it', async ({ page }) => {
    await page.goto('/#/set/set-market?from=explore');
    await page.getByRole('button', { name: 'Play Mercado' }).click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    await page.getByRole('button', { name: 'Open queue' }).click();
    await page.getByRole('button', { name: 'Save as set' }).click();
    await expect(page.getByRole('status')).toHaveText('Saved as Mercado · My queue');
    await page.goBack();
    await page.goBack();
    await page.goto('/#/library?view=ownSets');
    await page.getByRole('button', { name: /Mercado · My queue/ }).click();
    await expect(page.getByText('Your set')).toBeVisible();
    await page.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('button', { name: 'Rename set' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Market run');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'Market run' })).toBeVisible();
    await page.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('button', { name: 'Delete set' }).click();
    await expect(page).toHaveURL(/view=ownSets/);
    await expect(page.getByText('Make a set to group phrases your way.')).toBeVisible();
  });

  test('the sort is remembered per set', async ({ page }) => {
    await page.goto('/#/set/set-cafe?from=explore');
    await page.getByRole('button', { name: 'Set order' }).click();
    await page.getByRole('radio', { name: 'A–Z' }).click();
    await expect(page.getByText('Plays in: A–Z')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Plays in: A–Z')).toBeVisible();
    await page.goto('/#/set/set-tapas?from=explore');
    await expect(page.getByText('Plays in: Set order')).toBeVisible();
  });

  test('an unknown set link says so', async ({ page }) => {
    await page.goto('/#/set/set-nowhere?from=explore');
    await expect(page.getByText('This set isn’t available.')).toBeVisible();
  });
});

test('a save that fails is announced, not silently dropped', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const full = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    IDBObjectStore.prototype.put = full;
    Storage.prototype.setItem = full;
  });
  await page.getByRole('button', { name: 'Play 5 phrases' }).click();
  await expect(page.getByRole('status')).toHaveText('This device’s storage for Loro is full, so new progress isn’t being saved.');
});

test('reduced motion: no looping animation, sheets still open and close', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/set/set-cafe?from=explore');
  await page.getByRole('button', { name: 'Play Café & Mañanas' }).click();
  const iterations = await page.locator('.eq-bar-1').first().evaluate((el) => getComputedStyle(el).animationIterationCount);
  expect(iterations).toBe('1');
  await page.getByRole('button', { name: 'Details for La cuenta, por favor' }).click();
  await expect(page.getByRole('dialog', { name: 'Café & Mañanas' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Café & Mañanas' })).toHaveCount(0);
});

test('progress moves from localStorage into IndexedDB', async ({ page }) => {
  await page.goto('/#/set/set-taxi?from=explore');
  await page.getByRole('button', { name: 'Like set' }).click();
  await page.waitForTimeout(800);
  const where = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('loro-prototype');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const value = await new Promise<unknown>((resolve) => {
      const g = db.transaction('kv').objectStore('kv').get('state');
      g.onsuccess = () => resolve(g.result);
    });
    return { idb: typeof value === 'string' && value.includes('set:set-taxi'), local: localStorage.getItem('loro.prototype.state') };
  });
  expect(where).toEqual({ idb: true, local: null });
});
