// Home and the app shell: the header's title, one hero, and what Home's buttons do.
import { expect, masteredCourse, sampleHistory, test } from './fixtures';

test("the greeting is the header's title, in the language being learned (V-10)", async ({ page }) => {
  await page.goto('/');
  const title = page.locator('header h1');
  await expect(title).toHaveText('¡Hola, Ana!');
  await expect(title).toHaveAttribute('lang', 'es-ES');
  await expect(page.locator('main h1')).toHaveCount(0);
  // Coming back to Home, focus lands on it as on any page's heading.
  await page.goto('/#/set/set-cafe?from=home');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(title).toBeFocused();
  // At large text it takes two lines rather than being cut to "¡Hol…".
  await page.addStyleTag({ content: 'html { font-size: 200% }' });
  expect(await title.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
});

const TERRACOTTA = 'rgb(159, 60, 22)'; // primary-container
const DAY = 86_400_000;

/** The buttons on the page filled terracotta: the one primary action. */
const filled = (page: import('@playwright/test').Page) =>
  page.locator('main button').evaluateAll(
    (els, colour) =>
      els
        .filter((e) => getComputedStyle(e).backgroundColor === colour)
        .map((e) => {
          // Its name as read: without the icon's ligature text.
          const copy = e.cloneNode(true) as HTMLElement;
          copy.querySelectorAll('.material-symbols-outlined').forEach((icon) => icon.remove());
          return e.getAttribute('aria-label') ?? copy.textContent?.trim();
        }),
    TERRACOTTA,
  );

/** Café heard twice and rated Easy an hour ago: nothing due, and Café still to learn. */
function caughtUp(now: number) {
  let n = 0;
  return ['cafe-01', 'cafe-02', 'cafe-03', 'cafe-04', 'cafe-05'].flatMap((phraseId) =>
    [9, 0.04].flatMap((days) => {
      const at = now - days * DAY;
      const base = { device: 'c', key: `en-GB>es-ES:${phraseId}`, phraseId, setId: 'set-cafe' };
      return [
        { ...base, id: `c.x-${(n++).toString(36)}`, at, kind: 'heard', targetMs: 1500, nativeMs: 1100 },
        { ...base, id: `c.x-${(n++).toString(36)}`, at: at + 30_000, kind: 'rated', grade: 'easy' },
      ];
    }),
  );
}

test.describe('Home has one hero, and one terracotta Play (V-05)', () => {
  test('a first run: the demo, then Start here as a row; no zeros (V-17)', async ({ page }) => {
    await page.goto('/');
    expect(await filled(page)).toEqual(['Play one phrase']);
    await expect(page.getByRole('heading', { name: 'Start here' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play 5 phrases' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Learned/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Started/ })).toHaveCount(0);
    // The points chip stays: it is real, and says nothing about a missed day.
    await expect(page.getByTestId('points')).toContainText('0 points');
  });

  test.describe('reviews due', () => {
    test.use({ seed: { log: sampleHistory(Date.now()) } });
    test('the review is the hero; Continue is a row; the stats are quiet chips', async ({ page }) => {
      await page.goto('/');
      expect(await filled(page)).toEqual([expect.stringMatching(/^Play 7 phrases\s· /)]);
      await expect(page.getByRole('heading', { name: 'Continue' })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Learned 3/ })).toBeVisible();
      // What comes after the review is said inside it.
      await expect(page.getByRole('region', { name: 'Review' }).getByText(/After these: /)).toBeVisible();
    });
  });

  test.describe('nothing due', () => {
    test.use({ seed: { log: caughtUp(Date.now()) } });
    test('what to continue is the hero', async ({ page }) => {
      await page.goto('/');
      expect(await filled(page)).toEqual(['Play 5 phrases']);
      await expect(page.getByRole('region', { name: 'Continue' })).toContainText('Café & Mañanas');
      await expect(page.getByText(/Next: 5 phrases /)).toBeVisible();
    });
  });

  test.describe('the course learned', () => {
    test.use({ seed: { log: masteredCourse(Date.now()) } });
    test('the course-done card is the hero, its icon above the heading (V-22)', async ({ page }) => {
      await page.goto('/');
      expect(await filled(page)).toEqual(['Add your phrase']);
      const heading = page.getByRole('heading', { name: 'Every phrase in this course is learned' });
      const icon = (await page.getByRole('region', { name: 'Every phrase in this course is learned' }).locator('.material-symbols-outlined').first().boundingBox())!;
      expect(icon.y + icon.height).toBeLessThanOrEqual((await heading.boundingBox())!.y + 1);
    });
  });
});

test.describe('a learner switching to a course they have not started (U-15)', () => {
  test.use({ seed: { targetLang: 'bg-BG', log: sampleHistory(Date.now()) } });
  test('is not offered the demo or the first-run line again', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Start here' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Play one phrase/ })).toHaveCount(0);
    await expect(page.getByText('Listen to a phrase, then say it before you hear it again.')).toHaveCount(0);
    // Its first set is the hero instead.
    expect(await filled(page)).toEqual(['Play 4 phrases']);
  });
});
