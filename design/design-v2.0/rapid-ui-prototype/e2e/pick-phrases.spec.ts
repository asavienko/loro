// Your own set grows from its own page (U-10): "Add phrases" opens a picker with Explore's word
// search and an Add / Added toggle per phrase; Done closes it.
import { expect, test } from './fixtures';

async function newSet(page: import('@playwright/test').Page, name: string) {
  await page.goto('/#/library?view=ownSets');
  await page.getByRole('button', { name: 'New set' }).click();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
}

test('add phrases to your set from the set, with search and Add / Added toggles', async ({ page }) => {
  await newSet(page, 'Trip');
  await expect(page.getByText('Add phrases from their details (⋮) or from the player.')).toBeVisible();
  await page.getByRole('button', { name: 'Add phrases' }).click();
  const picker = page.getByRole('dialog', { name: 'Add phrases' });
  // Explore's matching: every word, in any order, from the start of a word.
  await picker.getByRole('searchbox', { name: 'Search phrases' }).fill('favor cuenta');
  const bill = picker.getByRole('button', { name: 'Add La cuenta, por favor' });
  await expect(bill).toHaveAttribute('aria-pressed', 'false');
  await expect(picker.getByRole('button', { name: /^Add Me pone un cortado/ })).toHaveCount(0);
  await bill.click();
  await expect(picker.getByRole('button', { name: 'Added La cuenta, por favor' })).toHaveAttribute('aria-pressed', 'true');
  await picker.getByRole('searchbox').fill('metro');
  await picker.getByRole('button', { name: /^Add ¿Dónde está la estación de metro\?/ }).click();
  // A second tap takes it out again.
  await picker.getByRole('searchbox').fill('estacion');
  await picker.getByRole('button', { name: /^Added ¿Dónde está la estación de metro\?/ }).click();
  await picker.getByRole('button', { name: /^Add ¿Dónde está la estación de metro\?/ }).click();
  await picker.getByRole('button', { name: 'Done' }).click();
  await expect(picker).toHaveCount(0);
  // The set holds both, in the order they were added, and still offers more.
  const rows = page.getByRole('main').getByRole('listitem');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('La cuenta, por favor');
  await expect(rows.nth(1)).toContainText('¿Dónde está la estación de metro?');
  await expect(page.getByRole('button', { name: 'Add phrases' })).toBeVisible();
});

test('a search with no phrase says so', async ({ page }) => {
  await newSet(page, 'Trip');
  await page.getByRole('button', { name: 'Add phrases' }).click();
  const picker = page.getByRole('dialog', { name: 'Add phrases' });
  await picker.getByRole('searchbox').fill('wifi');
  await expect(picker.getByText('No phrases match “wifi”.')).toBeVisible();
});

test('course sets have no picker: their phrases are fixed', async ({ page }) => {
  await page.goto('/#/set/set-cafe?from=explore');
  await expect(page.getByRole('heading', { name: 'Café & Mañanas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add phrases' })).toHaveCount(0);
});
