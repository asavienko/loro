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

/** Every control in the player whose box ends outside the window (nothing may need a scroll to reach). */
const offscreenControls = (player: import('@playwright/test').Locator) =>
  player.evaluate((root) =>
    [...root.querySelectorAll('button, [role="radio"]')]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.top < 0 || r.bottom > window.innerHeight || r.right > window.innerWidth);
      })
      .map((e) => e.getAttribute('aria-label') ?? e.textContent),
  );

test('every player control is on screen without scrolling, rated or not', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
  await page.waitForTimeout(700);
  const player = page.getByRole('dialog', { name: 'Now playing' });
  await player.getByRole('button', { name: 'Pause', exact: true }).click();
  expect(await offscreenControls(player)).toEqual([]);
  // One speed control, as a chip here.
  await expect(player.getByRole('button', { name: 'Speed: 1.25×' })).toBeVisible();
  await expect(player.getByRole('radiogroup', { name: 'Speed' })).toBeHidden();
  await player.getByRole('button', { name: /^Hard/ }).click();
  await expect(player.getByRole('button', { name: /^Undo rating/ })).toBeVisible();
  expect(await offscreenControls(player)).toEqual([]);
});

test.describe('200% text on a 390 px phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('Pause and the grades stay on screen; the phrase scrolls above them', async ({ page }) => {
    await page.goto('/');
    await page.addStyleTag({ content: 'html { font-size: 200% !important }' });
    await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
    await page.waitForTimeout(700);
    const player = page.getByRole('dialog', { name: 'Now playing' });
    for (const control of [player.getByRole('button', { name: 'Pause', exact: true }), ...['Missed', 'Hard', 'Easy'].map((g) => player.getByRole('button', { name: new RegExp(`^${g}`) }))]) {
      const box = (await control.boundingBox())!;
      expect(box.y >= 0 && box.y + box.height <= 844, `${await control.getAttribute('aria-label') ?? await control.textContent()} on screen`).toBe(true);
    }
    // The header's icons keep their size, so the title isn't squeezed into breaking a word.
    const close = (await player.getByRole('button', { name: 'Close player' }).boundingBox())!;
    expect(close.width).toBeLessThan(50);
  });
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

test.describe('Explore on a phone held sideways (844×390)', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test('the topics are chips in the one filter line, so a row of sets is on the first screen (Q-16)', async ({ page }) => {
    await page.goto('/#/explore');
    await page.waitForTimeout(300);
    await expect(page.getByRole('region', { name: 'Topics' })).toHaveCount(0);
    const topics = page.getByRole('group', { name: 'Topics' });
    await expect(topics.getByRole('button', { name: 'Eating out' })).toBeVisible();
    // The first row of covers shows at least 6rem of itself above the tab bar.
    const tabBar = (await page.getByRole('navigation').last().boundingBox())!;
    const card = (await page.getByRole('region', { name: 'All sets' }).getByRole('listitem').first().boundingBox())!;
    expect(card.y + 96).toBeLessThanOrEqual(tabBar.y);
    await topics.getByRole('button', { name: 'Getting around' }).click();
    await expect(page.getByRole('heading', { name: 'Getting around · 2 sets' })).toBeVisible();
    // Held upright again, the topics are tiles.
    await page.goto('/#/explore');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('region', { name: 'Topics' }).getByRole('button', { name: /^Eating out/ })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Topics' })).toBeHidden();
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

test.describe('onboarding at 200% text (Q-05)', () => {
  test.use({ seed: null });

  test('only the step\'s action is pinned: the explanation shows above it, the other choices follow it', async ({ page }) => {
    await page.goto('/');
    await page.addStyleTag({ content: 'html { font-size: 200% }' });
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Continue' }).click();
    const start = page.getByRole('button', { name: 'Start with one phrase' });
    const box = (await start.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    // Two of the four steps are readable over it (the pinned footer used to leave half of one).
    const second = (await page.getByText('Say it out loud in Spanish while it’s quiet.').boundingBox())!;
    expect(second.y + second.height).toBeLessThanOrEqual(box.y);
    // Skipping the demo and Back come after it, in the page; not stacked into the pinned strip.
    const skip = page.getByRole('button', { name: 'Start without the demo' });
    expect((await skip.boundingBox())!.y).toBeGreaterThanOrEqual(box.y + box.height);
    await skip.scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Back' })).toBeInViewport();
    // A wrapped action is a rounded block (the hero's radius), not a three-line oval.
    await expect(start).toHaveCSS('border-top-left-radius', '48px');
  });

  test('no step scrolls sideways at 320 px, even at 200% text', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await page.addStyleTag({ content: 'html { font-size: 200% }' });
    for (let step = 1; step <= 5; step++) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `step ${step}`).toBeLessThanOrEqual(320);
      if (step < 5) await page.getByRole('button', { name: 'Continue' }).click();
    }
    const start = (await page.getByRole('button', { name: 'Start with one phrase' }).boundingBox())!;
    expect(start.y + start.height).toBeLessThanOrEqual(568);
  });

  test('an icon font still loading never widens a step past the screen', async ({ page }) => {
    // Until the icon font arrives an icon's ligature name ("volume_up") lays out as text; WebKit
    // showed it as a 342 px page on the voices step. The font is held back until every step has
    // been checked, so that moment lasts; held, not failed, since Firefox reports a failed font
    // download as a page error.
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/fonts/material-symbols.woff2', async (route) => {
      await held;
      await route.continue();
    });
    const iconFont = () =>
      page.evaluate(() => [...document.fonts].find((f) => f.family.replace(/"/g, '') === 'Material Symbols Outlined')?.status);
    await page.setViewportSize({ width: 320, height: 568 });
    // Chromium and WebKit hold the load event for a preloaded font in flight.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: 'html { font-size: 200% }' });
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    try {
      for (let step = 1; step <= 5; step++) {
        await expect(page.getByText(`Step ${step} of 5`)).toBeVisible();
        expect(await iconFont(), `step ${step}: the icons are still their names`).not.toBe('loaded');
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `step ${step}`).toBeLessThanOrEqual(320);
        // Enter, not a tap: a tap waits for a painted frame, and WebKit paints none while the
        // page is still loading.
        if (step < 5) await page.getByRole('button', { name: 'Continue' }).press('Enter');
      }
    } finally {
      release();
    }
    // Let through, the font arrives without an error.
    await expect.poll(iconFont).toBe('loaded');
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
    await expect(page.getByText('A portion of croquettes, please')).toBeVisible();
  });

  test('each grade in the summary stays with its count', async ({ page }) => {
    // Something rated, so the summary has ratings to show (nothing played is one line).
    await page.getByRole('dialog', { name: 'Now playing' }).getByRole('button', { name: /^Missed/ }).click();
    await page.getByRole('button', { name: /queue/i }).first().click();
    await page.getByRole('button', { name: /^This session · / }).click();
    await page.waitForTimeout(500);
    const ratings = page.getByRole('dialog').last().locator('dd').filter({ hasText: 'Missed' });
    // The grades' line only: the note under it about the changeable rating starts with its count.
    const note = await ratings.locator('span').innerText();
    const text = (await ratings.innerText()).replace(note, '');
    for (const line of text.split('\n').filter((l) => l.trim())) expect(line.trim()).not.toMatch(/^(\d+|·)/);
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

    test('topic tiles keep every word and "2 набора" on one line (Q-14)', async ({ page }) => {
      for (const scale of [100, 200]) {
        await page.goto('/#/explore');
        if (scale !== 100) await page.addStyleTag({ content: `html { font-size: ${scale}% }` });
        await page.waitForTimeout(200);
        const split = await page.getByRole('region', { name: /^(Теми|Темы)$/ }).evaluate((region) => {
          const out: string[] = [];
          for (const tile of region.querySelectorAll('button')) {
            const [title, count] = [...tile.querySelectorAll('span')].filter((e) => e.children.length === 0 && !e.classList.contains('material-symbols-outlined'));
            const lines = (node: Node, from: number, to: number) => {
              const range = document.createRange();
              range.setStart(node, from);
              range.setEnd(node, to);
              return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
            };
            const text = title.firstChild!;
            for (const m of (text.textContent ?? '').matchAll(/\S+/g)) if (lines(text, m.index, m.index + m[0].length) > 1) out.push(m[0]);
            if (lines(count.firstChild!, 0, count.textContent!.length) > 1) out.push(count.textContent!);
          }
          return out;
        });
        expect(split, `${scale}%`).toEqual([]);
      }
    });

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
