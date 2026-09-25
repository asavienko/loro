// Phrase rows: your own phrase is named in words, and at large text on a small phone the phrase
// keeps its room beside the ⋮ button.
import { expect, sampleHistory, test } from './fixtures';

test('your own phrase says "Yours" in its row, with no icon that looks like a button (U-16)', async ({ page }) => {
  await page.goto('/#/library?view=mine');
  await page.getByRole('button', { name: 'Add your phrase' }).click();
  await page.getByLabel('In Spanish').fill('¿Hay wifi?');
  await page.getByLabel('In English').fill('Is there wifi?');
  await page.getByRole('button', { name: 'Add phrase' }).click();
  const row = page.getByRole('button', { name: 'Play ¿Hay wifi?' });
  await expect(row).toContainText('Is there wifi? · New · Yours');
  await expect(row.locator('.material-symbols-outlined')).toHaveCount(0);
  // Search results say it too.
  await page.goto('/#/explore?q=wifi');
  await expect(page.getByRole('button', { name: /^Play ¿Hay wifi\?/ })).toContainText('New · Yours');
});

test.describe('at 200% text on a 320 px phone', () => {
  test.use({ viewport: { width: 320, height: 568 }, seed: { log: sampleHistory(Date.now()) } });

  test('a set page row gives the phrase its room: the position number steps aside', async ({ page }) => {
    await page.goto('/#/set/set-cafe?from=explore');
    await page.addStyleTag({ content: 'html { font-size: 200% }' });
    await page.waitForTimeout(300);
    const rows = await page.locator('main li').evaluateAll((items) =>
      items.map((li) => {
        const title = li.querySelector('[lang]')!.getBoundingClientRect();
        const more = li.querySelectorAll('button')[1].getBoundingClientRect();
        return { width: title.width, clear: title.right <= more.left };
      }),
    );
    expect(rows.length).toBe(5);
    for (const row of rows) {
      expect(row.clear).toBe(true);
      expect(row.width).toBeGreaterThanOrEqual(150);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });
});
