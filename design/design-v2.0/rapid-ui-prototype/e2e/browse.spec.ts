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
