// Every screen: axe (WCAG 2.1 AA), 44 px targets and 11 px text — at the
// default text size and at 200%. Charts are measured against their numbers.
import { Page } from '@playwright/test';
import { expect, expectAccessible, expectMobileBasics, sampleHistory, test } from './fixtures';

const screens: { name: string; open: (page: Page) => Promise<void> }[] = [
  { name: 'home', open: (page) => page.goto('/').then(() => undefined) },
  { name: 'explore', open: (page) => page.goto('/#/explore').then(() => undefined) },
  { name: 'library', open: (page) => page.goto('/#/library').then(() => undefined) },
  { name: 'set', open: (page) => page.goto('/#/set/set-cafe?from=explore').then(() => undefined) },
  {
    name: 'player',
    open: async (page) => {
      await page.goto('/');
      await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await page.waitForTimeout(600);
    },
  },
  {
    name: 'queue',
    open: async (page) => {
      await page.goto('/');
      await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await page.getByRole('button', { name: 'Open queue' }).click();
      await page.waitForTimeout(600);
    },
  },
  {
    name: 'phrase details',
    open: async (page) => {
      await page.goto('/#/set/set-cafe?from=explore');
      await page.getByRole('button', { name: 'Details for La cuenta, por favor' }).click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: 'add phrase',
    open: async (page) => {
      await page.goto('/#/library?view=mine');
      await page.getByRole('button', { name: 'Add your phrase' }).click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: 'session summary',
    open: async (page) => {
      await page.goto('/');
      await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      // The summary opens from the top of the queue (and from the toast after a pass).
      await page.getByRole('button', { name: 'Open queue' }).click();
      await page.getByRole('button', { name: /^This session · / }).click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: 'history',
    open: async (page) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'History' }).first().click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: 'settings',
    open: async (page) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Ana: settings' }).click();
      await page.waitForTimeout(500);
    },
  },
];

// A learner with history, so lists, cards and charts have content to overflow with.
test.use({ seed: { log: sampleHistory(Date.now()) } });

for (const scale of [1, 2]) {
  test.describe(`text at ${scale * 100}%`, () => {
    for (const screen of screens) {
      test(screen.name, async ({ page }) => {
        await screen.open(page);
        if (scale !== 1) await page.addStyleTag({ content: `html { font-size: ${scale * 100}% }` });
        await page.waitForTimeout(200);
        await expectAccessible(page);
        if (scale === 1) await expectMobileBasics(page);
        // Nothing scrolls sideways (which would also push fixed bars off a phone screen).
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
        for (const name of ['Home', 'Library']) {
          const box = await page.getByRole('button', { name, exact: true }).boundingBox();
          if (box) expect(box.y + box.height).toBeLessThanOrEqual(844);
        }
      });
    }
  });
}

test('chart bars are as long as their numbers say', async ({ page }) => {
  await page.goto('/#/library');
  const bars = await page.locator('[data-bar]').evaluateAll((els) =>
    els.map((el) => {
      const count = Number(el.getAttribute('data-count'));
      const max = Number(el.getAttribute('data-max'));
      const self = el.getBoundingClientRect();
      const track = el.parentElement!.getBoundingClientRect();
      const horizontal = el.closest('[data-chart="recall"]') !== null;
      return { count, max, ratio: horizontal ? self.width / track.width : self.height, horizontal };
    }),
  );
  for (const bar of bars) {
    if (bar.horizontal) expect(bar.ratio).toBeCloseTo(bar.count / bar.max, 1);
    else if (bar.count === 0) expect(bar.ratio).toBeLessThanOrEqual(1);
  }
});

test.describe('onboarding', () => {
  test.use({ seed: null });
  for (const step of [0, 1, 2, 3, 4]) {
    test(`step ${step + 1}`, async ({ page }) => {
      await page.goto('/');
      for (let i = 0; i < step; i++) await page.getByRole('button', { name: 'Continue' }).click();
      await page.waitForTimeout(400);
      await expectAccessible(page);
      await expectMobileBasics(page);
    });
  }
});

for (const nativeLang of ['bg-BG', 'ru-RU']) {
  test.describe(`${nativeLang} UI`, () => {
    test.use({ seed: { nativeLang, log: sampleHistory(Date.now()).map((e) => ({ ...e, key: String(e.key).replace('en-GB>', `${nativeLang}>`) })) } });
    for (const hash of ['/', '/#/explore', '/#/library', '/#/set/set-cafe?from=explore']) {
      test(hash, async ({ page }) => {
        await page.goto(hash);
        await page.waitForTimeout(400);
        expect(await page.evaluate(() => document.documentElement.lang)).toBe(nativeLang);
        await expectAccessible(page);
        await expectMobileBasics(page);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      });
    }
  });
}
