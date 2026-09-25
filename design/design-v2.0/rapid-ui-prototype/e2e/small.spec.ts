// A small phone (320×568): nothing scrolls sideways and the player's controls can be reached.
import { expect, expectAccessible, sampleHistory, test } from './fixtures';

test.use({ viewport: { width: 320, height: 568 }, seed: { log: sampleHistory(Date.now()) } });

for (const hash of ['/', '/#/explore', '/#/library', '/#/library?view=ownSets', '/#/set/set-cafe?from=explore']) {
  test(`no sideways scroll: ${hash}`, async ({ page }) => {
    await page.goto(hash);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .filter((e) => e.getBoundingClientRect().right > 321 && !e.closest('.truncate, .scroll-row'))
        .map((e) => `${e.tagName}.${String(e.className).slice(0, 50)}`)
        .slice(0, 5),
    );
    expect(overflow).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });
}

test('the player fits, and Pause is reachable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
  await page.waitForTimeout(700);
  const player = page.getByRole('dialog', { name: 'Now playing' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const pause = player.getByRole('button', { name: 'Pause', exact: true });
  const box = (await pause.boundingBox())!;
  expect(box.y + box.height, 'Pause is visible without scrolling').toBeLessThanOrEqual(568);
  await pause.click();
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});

test.describe('phone landscape (568×320)', () => {
  test.use({ viewport: { width: 568, height: 320 } });

  test('Pause and the ratings are reachable without scrolling', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
    await page.waitForTimeout(700);
    const player = page.getByRole('dialog', { name: 'Now playing' });
    for (const name of ['Pause', 'Next phrase']) {
      const box = (await player.getByRole('button', { name, exact: true }).boundingBox())!;
      expect(box.y + box.height, `${name} is visible`).toBeLessThanOrEqual(320);
    }
    const easy = (await player.getByRole('button', { name: /^Easy/ }).boundingBox())!;
    expect(easy.y + easy.height, 'Easy is visible').toBeLessThanOrEqual(320);
  });
});

test.describe('large text (150%) on a 360 px phone', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test('the step pills and rating buttons hold their labels', async ({ page }) => {
    await page.goto('/');
    await page.addStyleTag({ content: 'html { font-size: 150% !important }' });
    await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
    await page.waitForTimeout(700);
    const player = page.getByRole('dialog', { name: 'Now playing' });
    const spilled = await player.evaluate((root) =>
      [...root.querySelectorAll('ol[aria-label] > li, [aria-keyshortcuts="1"], [aria-keyshortcuts="2"], [aria-keyshortcuts="3"]')]
        .filter((e) => e.scrollWidth > e.clientWidth + 1)
        .map((e) => e.textContent),
    );
    expect(spilled).toEqual([]);
  });

  for (const hash of ['/#/explore']) {
    test(`set titles are shown whole: ${hash}`, async ({ page }) => {
      await page.goto(hash);
      await page.addStyleTag({ content: 'html { font-size: 150% !important }' });
      await page.waitForTimeout(300);
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll('main .line-clamp-2')]
          .filter((e) => e.clientHeight > 0 && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)) // inline text has no box
          .map((e) => e.textContent),
      );
      expect(clipped).toEqual([]);
      expect(await page.locator('main .line-clamp-2').count()).toBeGreaterThan(3);
    });
  }
});

test.describe('onboarding on a small phone at 125% text', () => {
  test.use({ seed: null });

  test("every step's action is on screen", async ({ page }) => {
    await page.goto('/');
    await page.addStyleTag({ content: 'html { font-size: 125% !important }' });
    for (let step = 0; step < 4; step++) {
      const box = (await page.getByRole('button', { name: 'Continue' }).boundingBox())!;
      expect(box.y + box.height, `step ${step + 1}`).toBeLessThanOrEqual(568);
      await page.getByRole('button', { name: 'Continue' }).click();
    }
    const start = (await page.getByRole('button', { name: 'Start with one phrase' }).boundingBox())!;
    expect(start.y + start.height).toBeLessThanOrEqual(568);
  });
});

test.describe('large text (150%) on a 320 px phone: player, queue and summary', () => {
  const clippedText = (root: import('@playwright/test').Locator, selector: string) =>
    root.evaluate(
      (el, sel) =>
        [...el.querySelectorAll(sel)]
          .filter((e) => e.clientHeight > 0 && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)) // inline text has no box
          .map((e) => e.textContent),
      selector,
    );

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.addStyleTag({ content: 'html { font-size: 150% !important }' });
    await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
  });

  test('the player title is whole', async ({ page }) => {
    const player = page.getByRole('dialog', { name: 'Now playing' });
    expect(await clippedText(player, 'header h1')).toEqual([]);
  });

  test('up-next phrases are whole', async ({ page }) => {
    await page.getByRole('button', { name: /queue/i }).first().click();
    await page.waitForTimeout(500);
    expect(await clippedText(page.locator('body'), 'li [lang]:not(.truncate)')).toEqual([]);
    await expect(page.getByText('Una ración de croquetas, por favor')).toBeVisible();
  });

  test('each grade in the summary stays with its count', async ({ page }) => {
    await page.getByRole('button', { name: 'Session summary' }).click();
    await page.waitForTimeout(500);
    const text = await page.getByRole('dialog').last().locator('dd').filter({ hasText: 'Missed' }).innerText();
    for (const line of text.split('\n')) expect(line.trim()).not.toMatch(/^(\d+|·)/);
  });
});

test.describe('with the on-screen keyboard up (iOS overlays it)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("a sheet's fields and button stay above the keyboard", async ({ page }) => {
    // A stand-in visual viewport the test can shrink, as iOS does when the keyboard opens.
    await page.addInitScript(() => {
      const vv = new EventTarget() as EventTarget & { height: number; offsetTop: number; width: number };
      vv.height = window.innerHeight;
      vv.offsetTop = 0;
      vv.width = window.innerWidth;
      Object.defineProperty(window, 'visualViewport', { value: vv });
      (window as unknown as { __keyboard: (px: number) => void }).__keyboard = (px) => {
        vv.height = window.innerHeight - px;
        vv.dispatchEvent(new Event('resize'));
      };
    });
    await page.goto('/#/library?view=mine');
    await page.getByRole('button', { name: 'Add your phrase' }).click();
    await page.getByLabel('In Spanish').focus();
    await page.evaluate(() => (window as unknown as { __keyboard: (px: number) => void }).__keyboard(300));
    await page.waitForTimeout(300);
    const add = (await page.getByRole('button', { name: 'Add phrase' }).boundingBox())!;
    expect(add.y + add.height, 'Add is above the keyboard').toBeLessThanOrEqual(844 - 300);
    const english = (await page.getByLabel('In English').boundingBox())!;
    expect(english.y + english.height).toBeLessThanOrEqual(844 - 300);
  });
});

test('a long press selects no button label, while phrases stay selectable', async ({ page }) => {
  await page.goto('/#/set/set-cafe?from=explore');
  const button = page.getByRole('button', { name: /^Play due and new/ });
  expect(await button.evaluate((e) => getComputedStyle(e).userSelect)).toBe('none');
  await page.getByRole('button', { name: /^Details for/ }).first().click();
  const phrase = page.getByRole('dialog').getByText('Me pone un cortado, por favor', { exact: true });
  expect(await phrase.evaluate((e) => getComputedStyle(e).userSelect)).not.toBe('none');
});

// Bulgarian and Russian labels run longer than English: the same 320 px phone, the same checks.
for (const nativeLang of ['bg-BG', 'ru-RU'] as const) {
  test.describe(`${nativeLang} UI on a 320 px phone`, () => {
    test.use({ seed: { nativeLang, targetLang: 'es-ES' } });
    const spills = (page: import('@playwright/test').Page) =>
      page.evaluate(() =>
        [...document.querySelectorAll('button, [role="button"], a, h1, h2, p, li')]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            if (r.width === 0 || e.closest('.truncate, .scroll-row, .sr-only')) return false;
            return r.right > 321 || (e.clientHeight > 0 && e.scrollWidth > e.clientWidth + 1);
          })
          .map((e) => (e.textContent ?? '').trim().slice(0, 40))
          .slice(0, 5),
      );

    for (const hash of ['/', '/#/explore', '/#/library', '/#/set/set-cafe?from=explore']) {
      test(`nothing spills: ${hash}`, async ({ page }) => {
        await page.goto(hash);
        await page.waitForTimeout(300);
        expect(await spills(page)).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
        await expectAccessible(page);
        // Screen readers pick their voice from it.
        expect(await page.evaluate(() => document.documentElement.lang)).toBe(nativeLang);
      });
    }

    test('the player and its rating window line fit', async ({ page }) => {
      await page.goto('/#/set/set-cafe?from=explore');
      await page.getByRole('button', { name: /^(Пусни „|Слушать «)Café & Mañanas/ }).click();
      await page.getByRole('button', { name: /^(Сега звучи|Сейчас звучит)/ }).click();
      await page.waitForTimeout(700);
      await page.locator('[aria-keyshortcuts="1"]').click();
      await page.waitForTimeout(300);
      expect(await spills(page)).toEqual([]);
      await expectAccessible(page);
    });
  });
}
