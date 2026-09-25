// Home and the app shell: the header's title, one hero, and what Home's buttons do.
import { expect, expectAccessible, expectMobileBasics, masteredCourse, sampleHistory, test } from './fixtures';

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

test.describe("Home's study plays open the player, where the grades are (U-01b)", () => {
  test('Start here plays in the full player', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    await expect(player).toBeVisible();
    await expect(player.getByRole('button', { name: /^Easy/ })).toBeVisible();
  });

  test.describe('with reviews due', () => {
    test.use({ seed: { log: sampleHistory(Date.now()) } });
    test('the review and Continue both open it; a card elsewhere stays in the mini-player', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: /^Play 7 phrases/ }).click();
      const player = page.getByRole('dialog', { name: 'Now playing' });
      await expect(player.getByText(/^1 of 7$/)).toBeVisible();
      await page.getByRole('button', { name: 'Close player' }).click();
      await page.getByRole('region', { name: 'Continue' }).getByRole('button', { name: /^Play \d+ phrases?$/ }).click();
      await expect(player.getByText(/^1 of \d+$/)).toBeVisible();
      await page.getByRole('button', { name: 'Close player' }).click();
      // Quick play on a set card starts it where the learner is.
      await page.getByRole('region', { name: 'Not started yet' }).getByRole('button', { name: /^Play / }).first().click();
      await expect(page.getByRole('button', { name: /^Now playing:/ })).toBeVisible();
      await expect(player).toHaveCount(0);
    });
  });
});

test('the avatar shows the course: its flag, and "Learning Spanish" as its description (U-06)', async ({ page }) => {
  await page.goto('/');
  const avatar = page.getByRole('button', { name: 'Ana: settings' });
  await expect(avatar).toHaveAccessibleDescription('Learning Spanish');
  await expect(avatar).toContainText('🇪🇸');
  await avatar.click();
  await page.getByLabel('I’m learning').selectOption('bg-BG');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(avatar).toHaveAccessibleDescription('Learning Bulgarian');
  await expect(avatar).toContainText('🇧🇬');
});

test.describe('in Bulgarian', () => {
  test.use({ seed: { nativeLang: 'bg-BG', name: 'Мира' } });
  test('the avatar says the course in the UI language (U-06)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Мира: настройки' })).toHaveAccessibleDescription('Учите испански');
  });
});

test.describe("Library's + adds a phrase or a set (U-09)", () => {
  test('it opens a small Add sheet that hands over to each form', async ({ page }) => {
    await page.goto('/#/library');
    await page.getByRole('button', { name: 'Add a phrase or set' }).click();
    const sheet = page.getByRole('dialog', { name: 'Add' });
    await page.waitForTimeout(500); // the sheet slides up
    await expectMobileBasics(page);
    await expectAccessible(page);
    await sheet.getByRole('button', { name: 'Add your phrase' }).click();
    await expect(page.getByRole('dialog', { name: 'Add your phrase' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('button', { name: 'Add a phrase or set' }).click();
    await sheet.getByRole('button', { name: 'New set' }).click();
    await page.getByLabel('Name').fill('Viaje');
    await page.getByLabel('Name').press('Enter');
    await expect(page.getByRole('heading', { name: 'Viaje', level: 1 })).toBeVisible();
    // Back leaves the new set for Library, not for a sheet.
    await page.goBack();
    await expect(page).toHaveURL(/#\/library/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('only Library has it', async ({ page }) => {
    for (const hash of ['/', '/#/explore', '/#/set/set-cafe?from=explore']) {
      await page.goto(hash);
      await expect(page.locator('header')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add a phrase or set' })).toHaveCount(0);
    }
  });

  test('at 200% text the title and the + keep their room; the points give way here', async ({ page }) => {
    await page.goto('/#/library');
    await page.addStyleTag({ content: 'html { font-size: 200% }' });
    await page.waitForTimeout(200);
    expect((await page.locator('header h1').boundingBox())!.width).toBeGreaterThanOrEqual(100);
    await expect(page.getByRole('button', { name: 'Add a phrase or set' })).toBeVisible();
    await expect(page.getByTestId('points')).toBeHidden();
  });
});

test.describe('onboarding', () => {
  test.use({ seed: null });
  test('a drawn progress bar fills step by step; the loop says to speak out loud (V-21, U-04)', async ({ page }) => {
    await page.goto('/');
    const filledSegments = () =>
      page.locator('main [aria-hidden="true"] > span').evaluateAll((els) => els.filter((e) => getComputedStyle(e).backgroundColor === 'rgb(159, 60, 22)').length);
    await expect(page.getByText('Step 1 of 5')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Loro', level: 1 })).toBeVisible();
    expect(await filledSegments()).toBe(1);
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Step 5 of 5')).toBeVisible();
    expect(await filledSegments()).toBe(5);
    await expect(page.getByText('Say it out loud in Spanish while it’s quiet.')).toBeVisible();
  });
});

test.describe('onboarding in Russian', () => {
  test.use({ seed: { onboarded: false, nativeLang: 'ru-RU', name: '' } });
  test('says to speak out loud, in Spanish, as Russian says it (U-04)', async ({ page }) => {
    await page.goto('/');
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Дальше' }).click();
    await expect(page.getByText('Скажите её вслух по-испански, пока тихо.')).toBeVisible();
  });
});
