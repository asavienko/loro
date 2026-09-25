// The phrase sheets: details lead with Play and a compact grid, so the notes start on screen;
// your own phrase's sheet has a title; a phrase you add offers to play it.
import { Page } from '@playwright/test';
import { expect, sampleHistory, test } from './fixtures';

const TERRACOTTA = 'rgb(159, 60, 22)'; // primary-container

async function addOwnPhrase(page: Page) {
  await page.goto('/#/library?view=mine');
  await page.getByRole('button', { name: 'Add your phrase' }).click();
  await page.getByLabel('In Spanish').fill('¿Hay wifi?');
  await page.getByLabel('In English').fill('Is there wifi?');
  await page.getByRole('button', { name: 'Add phrase' }).click();
}

test.describe('phrase details', () => {
  test.use({ seed: { log: sampleHistory(Date.now()) } });

  test('Play leads, the frequent actions are a grid, and the notes start on screen (V-12)', async ({ page }) => {
    await page.goto('/#/set/set-cafe?from=explore');
    await page.getByRole('button', { name: 'Details for ¿Tienen leche de avena?' }).click();
    const sheet = page.getByRole('dialog', { name: 'Café & Mañanas' });
    await expect(sheet.getByRole('button', { name: 'Play', exact: true })).toHaveCSS('background-color', TERRACOTTA);
    for (const name of ['Play next', 'Add to queue', 'Like', 'Add to set…']) {
      await expect(sheet.getByRole('button', { name, exact: true })).not.toHaveCSS('background-color', TERRACOTTA);
    }
    await page.waitForTimeout(500); // the sheet slides up
    // Two tiles to a row.
    const next = (await sheet.getByRole('button', { name: 'Play next' }).boundingBox())!;
    const queue = (await sheet.getByRole('button', { name: 'Add to queue' }).boundingBox())!;
    expect(Math.abs(next.y - queue.y)).toBeLessThan(2);
    await expect(sheet.getByRole('tabpanel').locator('p').first()).toBeInViewport();
    // Like is a toggle.
    await sheet.getByRole('button', { name: 'Like', exact: true }).click();
    await expect(sheet.getByRole('button', { name: 'Liked', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
});

test('your own phrase: the sheet is titled "Your phrase", its rare actions after the rest (U-13)', async ({ page }) => {
  await addOwnPhrase(page);
  await page.getByRole('button', { name: 'Details for ¿Hay wifi?' }).click();
  const sheet = page.getByRole('dialog', { name: 'Your phrase' });
  await expect(sheet.getByRole('heading', { name: 'Your phrase' })).toBeVisible();
  await page.waitForTimeout(500); // the sheet slides up
  const addToSet = (await sheet.getByRole('button', { name: 'Add to set…' }).boundingBox())!;
  const edit = (await sheet.getByRole('button', { name: 'Edit phrase' }).boundingBox())!;
  expect(edit.y).toBeGreaterThan(addToSet.y);
});

test('"Phrase added" offers Play, which plays the new phrase (U-17)', async ({ page }) => {
  await addOwnPhrase(page);
  const toast = page.locator('.toast-layer');
  await expect(toast.getByText('Phrase added')).toBeVisible();
  await toast.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Now playing:/ })).toBeVisible();
  await page.getByRole('button', { name: /^Now playing:/ }).click();
  await expect(page.getByRole('dialog', { name: 'Now playing' }).getByText('Is there wifi?').first()).toBeVisible();
});

test.describe('adding a phrase from another Library list', () => {
  test.use({ seed: { log: sampleHistory(Date.now()) } });

  for (const [scale, width, height] of [[100, 390, 844], [200, 320, 568]] as const) {
    test(`shows it under Mine, in view, with Play still offered (Q-07) at ${scale}% text on ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/#/library?view=due');
      if (scale !== 100) await page.addStyleTag({ content: `html { font-size: ${scale}% }` });
      await page.getByRole('button', { name: 'Add a phrase or set' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Add your phrase' }).click();
      await page.getByLabel('In Spanish').fill('¿Hay wifi?');
      await page.getByLabel('In English').fill('Is there wifi?');
      await page.getByRole('button', { name: 'Add phrase' }).click();
      await expect(page.getByRole('tab', { name: 'Mine' })).toHaveAttribute('aria-selected', 'true');
      await expect(page).toHaveURL(/#\/library\?view=mine$/);
      // The whole row: its phrase and its status, not just the edge of it above the tab bar.
      await expect(page.getByRole('button', { name: 'Play ¿Hay wifi?' })).toBeInViewport({ ratio: 1 });
      await expect(page.locator('.toast-layer').getByRole('button', { name: 'Play', exact: true })).toBeVisible();
      // Back returns to the list the learner was on.
      await page.goBack();
      await expect(page.getByRole('tab', { name: 'Due' })).toHaveAttribute('aria-selected', 'true');
    });
  }

  test('an edit stays on the list it was made from (Q-07)', async ({ page }) => {
    await addOwnPhrase(page);
    await page.getByRole('button', { name: 'Details for ¿Hay wifi?' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Like', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Liked' }).click();
    await page.getByRole('button', { name: 'Details for ¿Hay wifi?' }).click();
    await page.getByRole('button', { name: 'Edit phrase' }).click();
    await page.getByLabel('In English').fill('Is there Wi-Fi?');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.toast-layer').getByText('Phrase updated')).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/#\/library\?view=liked$/);
    await expect(page.getByRole('tab', { name: 'Liked' })).toHaveAttribute('aria-selected', 'true');
  });
});
