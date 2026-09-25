// Longer learner journeys on a controlled clock: whole queues, both end
// modes, the learner's own phrases, other courses and UI languages.
import { Page } from '@playwright/test';
import { expect, expectAccessible, masteredCourse, test } from './fixtures';

async function start(page: Page, hash = '/') {
  await page.clock.install();
  await page.goto(hash);
}

/** Advance time in small steps so every timer chain (speech → gap → pause) runs. */
async function run(page: Page, ms: number) {
  for (let t = 0; t < ms; t += 500) await page.clock.runFor(500);
}

const spoken = (page: Page) => page.evaluate(() => window.__spoken.map((s) => s.text).filter((t) => t.trim()));

test('a whole set plays through, holds for ratings, then starts again', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Play 5 phrases' }).click();
  await run(page, 2_000);
  expect((await spoken(page))[0]).toBe('A cortado, please');
  // Three repetitions and a rating hold per new phrase; five phrases.
  await run(page, 5 * 20_000);
  const texts = await spoken(page);
  expect(texts.filter((t) => t === 'Me pone un cortado, por favor').length).toBeGreaterThanOrEqual(3);
  expect(texts).toContain('Sin gluten, por favor');
  await expect(page.getByText('Queue played through', { exact: true }).first()).toBeVisible();
  // Listening paid a point per phrase.
  await expect(page.getByTestId('points')).toContainText(/[5-9] points|1\d points/);
});

test('continue mode moves on to the next set', async ({ page }) => {
  await start(page, '/#/set/set-cafe?from=explore');
  await page.getByRole('button', { name: 'Play Café & Mañanas' }).click();
  await page.getByRole('button', { name: /^Now playing:/ }).click();
  await page.getByRole('button', { name: /At the end: play the queue again/ }).click();
  await expect(page.getByRole('button', { name: /At the end: continue/ })).toBeVisible();
  // Skip to the last phrase, then past it.
  const player = page.getByRole('dialog', { name: 'Now playing' });
  for (let i = 0; i < 4; i++) await player.getByRole('button', { name: 'Next phrase', exact: true }).click();
  await expect(player.getByText('5 of 5')).toBeVisible();
  await player.getByRole('button', { name: 'Next phrase', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tapas & Tabernas' })).toBeVisible();
});

test('the mini-player skips and pauses', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Play 5 phrases' }).click();
  await page.getByRole('button', { name: 'Close player' }).click(); // Home's Play opens the player
  await run(page, 1_000);
  const mini = page.getByRole('button', { name: /^Now playing:/ });
  await expect(mini).toContainText('A cortado, please');
  await page.getByRole('button', { name: 'Next phrase', exact: true }).click();
  await expect(mini).toContainText('Do you have oat milk?');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});

test('your own phrase plays like any other', async ({ page }) => {
  await start(page, '/#/library?view=mine');
  await page.getByRole('button', { name: 'Add your phrase' }).click();
  await page.getByLabel('In Spanish').fill('¿Dónde está el baño?');
  await page.getByLabel('In English').fill('Where is the toilet?');
  await page.getByRole('button', { name: 'Add phrase' }).click();
  await page.getByRole('button', { name: /Play all/ }).click();
  await run(page, 6_000);
  expect(await spoken(page)).toEqual(expect.arrayContaining(['Where is the toilet?', '¿Dónde está el baño?']));
});

test('switching course to Bulgarian keeps the English UI and shows Bulgarian sets', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Ana: settings' }).click();
  await page.getByLabel('I’m learning').selectOption('bg-BG');
  await expect(page.getByRole('status').filter({ hasText: 'Now learning Bulgarian' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('heading', { name: 'Здравей, Ana!' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Кафене 4 phrases · 0 learned/ })).toBeVisible();
  await page.getByRole('button', { name: 'Play 4 phrases' }).click();
  await run(page, 2_000);
  expect((await spoken(page))[0]).toBe('A coffee, please');
});

test.describe('a Russian speaker', () => {
  test.use({ seed: { nativeLang: 'ru-RU' } });
  test('gets Russian UI and Russian prompts', async ({ page }) => {
    await start(page);
    await expect(page.getByRole('button', { name: /^Слушать: 5 фраз/ })).toBeVisible();
    await page.getByRole('button', { name: /^Слушать: 5 фраз/ }).click();
    await run(page, 2_000);
    expect((await spoken(page))[0]).toBe('Мне кортадо, пожалуйста');
    await page.goto('/#/set/set-cafe?from=home');
    await page.getByRole('button', { name: 'Подробнее: Me pone un cortado, por favor' }).click();
    await page.clock.runFor(1000);
    await expect(page.getByText('«Me pone…» (буквально «поставьте мне…»)', { exact: false })).toBeVisible();
    await expect(page.getByText('Заметки пока на английском.')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: 'Обзор' }).or(page.getByRole('button', { name: 'Обзор' })).click();
    await expect(page.getByRole('heading', { name: 'Темы' })).toBeVisible();
  });
});

test('a shared set link opens that set', async ({ page }) => {
  await start(page, '/#/set/set-taxi?from=explore');
  await expect(page.getByRole('heading', { name: 'Taxi de Noche' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Explore' })).toHaveAttribute('aria-current', 'page');
});

test('play next from details goes straight after the current phrase', async ({ page }) => {
  await start(page, '/#/set/set-cafe?from=explore');
  await page.getByRole('button', { name: 'Play Café & Mañanas' }).click();
  await page.getByRole('button', { name: 'Details for Sin gluten, por favor' }).click();
  await page.getByRole('button', { name: 'Play next' }).click();
  await page.getByRole('button', { name: /^Now playing:/ }).click();
  await page.getByRole('button', { name: 'Open queue' }).click();
  const first = page.getByRole('dialog', { name: 'Queue' }).getByRole('button', { name: /^Play .* now$/ }).first();
  await expect(first).toHaveAccessibleName('Play Sin gluten, por favor now');
});

test('two tabs never overwrite each other', async ({ page, context }) => {
  await page.goto('/#/set/set-taxi?from=explore');
  const other = await context.newPage();
  await other.goto('/#/set/set-market?from=explore');
  // Tab 1 likes a set; tab 2 then saves something else.
  await page.getByRole('button', { name: 'Like set' }).click();
  await page.waitForTimeout(600);
  await other.getByRole('button', { name: 'Like set' }).click();
  await other.waitForTimeout(600);
  await page.goto('/#/library?view=likedSets');
  await expect(page.getByRole('button', { name: /Taxi de Noche/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Mercado/ })).toBeVisible();
});

test.describe('a learner who has learned the whole course', () => {
  test.use({ seed: { log: masteredCourse(Date.now()) } });
  test('is told so and offered what to do next', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Every phrase in this course is learned' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add your phrase' })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Try another course' }).click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  });
});

test('switching course mid-session says the queue was cleared', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
  await page.getByRole('button', { name: 'Close player' }).click(); // Home's Play opens the player
  await page.getByRole('button', { name: 'Ana: settings' }).click();
  await page.getByLabel('I’m learning').selectOption('bg-BG');
  await expect(page.getByRole('status').filter({ hasText: 'Now learning Bulgarian. The queue was cleared' })).toBeVisible();
});

test.describe('skipping the demo', () => {
  test.use({ seed: null });
  test('Home stops offering it and leads with the first set', async ({ page }) => {
    await page.goto('/');
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Start without the demo' }).click();
    await expect(page.getByRole('heading', { name: 'Start here' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Play one phrase/ })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Start here' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Play one phrase/ })).toHaveCount(0);
  });
});

test.describe('onboarding on a device with no Spanish voice', () => {
  test.use({ seed: null });
  test('the voice check names the missing voice and how to add it', async ({ page }) => {
    await page.addInitScript(() => (window.__noVoices = ['es-ES', 'es-MX']));
    await page.goto('/');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Add the missing voice in your system’s speech settings.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Test English/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Test Spanish/ })).toHaveCount(0);
    await expect(page.getByText('Spanish: no voice on this device')).toBeVisible();
    await expectAccessible(page);
  });

  test('a voice that loads late shows up without going back', async ({ page }) => {
    await page.addInitScript(() => (window.__noVoices = ['es-ES', 'es-MX']));
    await page.goto('/');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Spanish: no voice on this device')).toBeVisible();
    await page.evaluate(() => {
      window.__noVoices = [];
      window.__voicesChanged?.();
    });
    await expect(page.getByText('Spanish: Test Español')).toBeVisible();
    await expect(page.getByText('Spanish: no voice on this device')).toHaveCount(0);
  });
});

test.describe('onboarding by keyboard', () => {
  test.use({ seed: null });
  test('Enter in the name field goes on to the next step', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByPlaceholder(/name/i).fill('Ana');
    await page.getByPlaceholder(/name/i).press('Enter');
    await expect(page.getByText('Step 3 of 5')).toBeVisible();
  });
});

// A phrase's length is kept at 1× and must be measured: speech at another speed
// doesn't scale linearly, so it isn't recorded (clips are).
for (const [speed, measured] of [[1.25, false], [1, true]] as const) {
  test.describe(`speech heard at ${speed}×`, () => {
    test.use({ seed: { speed } });
    test(measured ? 'is measured' : 'is not taken as a 1× length', async ({ page }) => {
      await start(page);
      await page.getByRole('button', { name: 'Play 5 phrases' }).click();
      const player = page.getByRole('dialog', { name: 'Now playing' });
      await run(page, 30_000);
      await player.getByRole('button', { name: 'Previous phrase' }).click();
      await player.getByRole('button', { name: 'Pause', exact: true }).click();
      if (measured) await expect(player.getByText(/ at 1×$/)).toBeVisible();
      else await expect(player.getByText(/ at 1×$/)).toHaveCount(0);
    });
  });
}
