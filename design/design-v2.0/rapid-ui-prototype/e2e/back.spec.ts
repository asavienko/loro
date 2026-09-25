// Back, Forward and reloads with overlays: each Back does one thing, and never nothing.
import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const player = (page: Page) => page.getByRole('dialog', { name: 'Now playing' });

async function openPlayer(page: Page) {
  // Into the set from Explore as a learner would (a second hash-only goto isn't always a
  // navigation in WebKit).
  await page.goto('/#/explore');
  await page.getByRole('button', { name: /Mercado/ }).first().click();
  await page.getByRole('button', { name: 'Play Mercado' }).click();
  await page.getByRole('button', { name: /^Now playing:/ }).click();
  await expect(player(page)).toBeVisible();
  await page.waitForTimeout(700);
}

test('Forward after Back leaves the player open, and Back still closes it', async ({ page }) => {
  await openPlayer(page);
  await player(page).getByRole('button', { name: 'Add to set…' }).click();
  await expect(page.getByRole('dialog', { name: 'Add to set' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Add to set' })).toHaveCount(0);
  await page.goForward();
  await page.waitForTimeout(500);
  await expect(player(page)).toBeVisible();
  await page.goBack();
  await expect(player(page)).toHaveCount(0);
  await expect(page).toHaveURL(/#\/set\/set-market/);
});

test('Forward after closing the player by Back opens nothing, and the next Back leaves the page', async ({ page }) => {
  await openPlayer(page);
  await page.goBack();
  await expect(player(page)).toHaveCount(0);
  await page.goForward();
  await page.waitForTimeout(500);
  await expect(player(page)).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/#\/explore/);
});

test('a set created from inside the player opens in its place', async ({ page }) => {
  await openPlayer(page);
  await player(page).getByRole('button', { name: 'Add to set…' }).click();
  await page.getByRole('button', { name: 'New set…' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Probe set');
  await page.getByLabel('Name', { exact: true }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Probe set', level: 1 })).toBeVisible();
  await expect(player(page)).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/#\/set\/set-market/);
  await page.goBack();
  await expect(page).toHaveURL(/#\/explore/);
});

test('switching course from Settings over the player closes the player, and the app answers', async ({ page }) => {
  await openPlayer(page);
  await player(page).getByRole('button', { name: /^Voice:/ }).click();
  await page.getByLabel('I’m learning').selectOption('bg-BG');
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Close' }).click();
  await expect(player(page)).toHaveCount(0);
  await expect(page.locator('main')).not.toHaveAttribute('inert');
  await expect(page).not.toHaveTitle(/Now playing/);
});

test('after a reload with a sheet open, the first Back leaves the page', async ({ page }) => {
  await page.goto('/#/explore');
  await page.getByRole('button', { name: /Mercado/ }).first().click();
  await page.getByRole('button', { name: /^More/ }).click();
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mercado', level: 1 })).toBeVisible();
  await page.waitForTimeout(300);
  await page.goBack();
  await expect(page).toHaveURL(/#\/explore/);
});

test("after a reload with a sheet open, the header's Back returns to the search", async ({ page }) => {
  await page.goto('/#/explore?q=mer');
  await page.getByRole('button', { name: /Mercado/ }).first().click();
  await page.getByRole('button', { name: /^More/ }).click();
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mercado', level: 1 })).toBeVisible();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Back/ }).first().click();
  await expect(page).toHaveURL(/#\/explore\?q=mer/);
});
