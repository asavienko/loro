// Keyboard focus is never hidden (WCAG 2.4.11): tabbing through a page, each
// focused control is on screen, not under the fixed top bar, tab bar or mini-player.
import { expect, sampleHistory, test } from './fixtures';

test.use({ seed: { log: sampleHistory(Date.now()) } });

for (const [w, h] of [[390, 844], [1440, 900]] as const) {
  for (const hash of ['/', '/#/explore']) {
    test(`focus stays visible at ${w}×${h}: ${hash}`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: w, height: h });
      await page.goto(hash);
      // With the mini-player up, the bottom of the page is at its most crowded.
      await page.getByRole('button', { name: /^Play/ }).first().click();
      await page.getByRole('button', { name: 'Pause', exact: true }).first().click();
      // Home's Play opens the player; the page under the mini-player is what's tested here.
      if (hash === '/') {
        await page.getByRole('button', { name: 'Close player' }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
      }
      const hidden: string[] = [];
      for (let i = 0; i < 50; i++) {
        await page.keyboard.press('Tab');
        const check = () => page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          const r = el.getBoundingClientRect();
          if (r.width === 0) return null;
          const name = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30);
          const [x, y] = [r.left + r.width / 2, r.top + r.height / 2];
          if (y < 0 || y > innerHeight) return `${name}: off screen`;
          const top = document.elementFromPoint(x, y);
          return top && !el.contains(top) && !top.contains(el) ? `${name}: covered` : null;
        });
        // WebKit scrolls to a newly focused control over a few frames (e.g. Tab wrapping from
        // the page's bottom back to the top): a problem counts only once it has settled.
        let problem = await check();
        if (problem) {
          await page.waitForTimeout(300);
          problem = await check();
        }
        if (problem) hidden.push(problem);
      }
      expect([...new Set(hidden)]).toEqual([]);
    });
  }
}

// Safari's Tab reaches buttons only with full keyboard access turned on (macOS / iOS setting).
const TAB_SKIPS_BUTTONS = 'WebKit: Tab skips buttons unless full keyboard access is on';

test('Tab and Shift+Tab stay inside an open sheet, past its tabs', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', TAB_SKIPS_BUTTONS);
  await page.goto('/#/set/set-cafe?from=explore');
  await page.getByRole('button', { name: /^Details for/ }).first().click();
  const inside = () => page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press(key);
      expect(await inside(), `${key} ×${i + 1}`).toBe(true);
    }
  }
});

test('opening a set focuses its heading; Back returns focus to the card', async ({ page }) => {
  await page.goto('/#/explore');
  await page.getByRole('button', { name: 'Café & Mañanas' }).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Café & Mañanas', level: 1 })).toBeFocused();
  await page.getByRole('button', { name: /^Back/ }).first().focus();
  await page.keyboard.press('Enter');
  // Back returns focus to the card that opened the set.
  await expect(page.getByRole('button', { name: 'Café & Mañanas' }).first()).toBeFocused();
  // A tab switch leaves focus on the tab.
  await page.getByRole('button', { name: 'Library' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Library' })).toBeFocused();
});

test("the player's keys stay out of a sheet opened over it", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Play/ }).first().click();
  const player = page.getByRole('dialog', { name: 'Now playing' });
  const position = await player.getByText(/^1 of \d+$/).textContent();
  await page.getByRole('button', { name: 'Session summary' }).click();
  await page.getByRole('region', { name: 'This session' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  await expect(player.getByText(position!)).toBeVisible();
  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
});

test.describe('one sheet handing over to another', () => {
  test('Back closes the new sheet and stays on the page', async ({ page }) => {
    // Into the set from Explore as a learner would (a second hash-only goto isn't always
    // a navigation in WebKit).
    await page.goto('/#/explore');
    await page.getByRole('button', { name: 'Café & Mañanas' }).first().click();
    await page.getByRole('button', { name: /^Details for/ }).first().click();
    await page.getByRole('button', { name: 'Add to set…' }).click();
    await expect(page.getByRole('dialog', { name: 'Add to set' })).toBeVisible();
    await page.waitForTimeout(300);
    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/#\/set\/set-cafe/);
    await page.goBack();
    await expect(page).toHaveURL(/#\/explore/);
  });

  test('focus stays in the new sheet, and returns to the page when it closes', async ({ page }) => {
    await page.goto('/#/set/set-cafe?from=explore');
    await page.getByRole('button', { name: /^Details for/ }).first().focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Add to set…' }).focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    const inDialog = () => page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
    expect(await inDialog()).toBe(true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    await expect(page.getByRole('button', { name: /^Details for/ }).first()).toBeFocused();
  });

  test('creating a set from a sheet opens it with focus on its heading and a clean Back', async ({ page }) => {
    // Into the set from Explore as a learner would (a second hash-only goto isn't always
    // a navigation in WebKit).
    await page.goto('/#/explore');
    await page.getByRole('button', { name: 'Café & Mañanas' }).first().click();
    await page.getByRole('button', { name: /^Details for/ }).first().click();
    await page.getByRole('button', { name: 'Add to set…' }).click();
    await page.getByRole('button', { name: 'New set…' }).click();
    await page.getByLabel('Name').fill('Probe');
    await page.getByLabel('Name').press('Enter');
    await expect(page.getByRole('heading', { name: 'Probe', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Probe', level: 1 })).toBeFocused({ timeout: 3000 });
    await page.goBack();
    await expect(page).toHaveURL(/#\/set\/set-cafe/);
    await page.goBack();
    await expect(page).toHaveURL(/#\/explore/);
  });
});

test('Undo is reachable by keyboard from the queue, and stays while focused', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', TAB_SKIPS_BUTTONS);
  await page.goto('/');
  await page.getByRole('button', { name: /^Play/ }).first().click();
  await page.getByRole('button', { name: 'Pause', exact: true }).first().click();
  await page.getByRole('button', { name: 'Open queue' }).click();
  const queue = page.getByRole('dialog', { name: 'Queue' });
  const count = await queue.getByRole('button', { name: /^Play .* now$/ }).count();
  await queue.getByRole('button', { name: /^Move / }).first().press('Delete');
  await expect(page.locator('div[role="status"]')).toHaveText(/Undo$/);
  const undo = page.getByRole('button', { name: 'Undo' });
  for (let i = 0; i < 40 && !(await undo.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(undo).toBeFocused();
  await page.waitForTimeout(7000); // longer than the message's own time
  await expect(undo).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(queue.getByRole('button', { name: /^Play .* now$/ })).toHaveCount(count);
  // Focus goes back into the queue, not to the page behind it.
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
});

test('a new message in place of the one focused stays, and keeps focus', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', TAB_SKIPS_BUTTONS);
  await page.goto('/');
  await page.getByRole('button', { name: /^Play/ }).first().click();
  await page.getByRole('button', { name: 'Pause', exact: true }).first().click();
  await page.getByRole('button', { name: 'Open queue' }).click();
  await page.getByRole('dialog', { name: 'Queue' }).getByRole('button', { name: /^Move / }).first().press('Delete');
  const undo = page.getByRole('button', { name: 'Undo' });
  for (let i = 0; i < 40 && !(await undo.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(undo).toBeFocused();
  // A message without an action takes its place (here: a save that failed).
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('loro:save-failed', { detail: 'full' })));
  const dismiss = page.getByRole('button', { name: 'Dismiss' });
  await expect(dismiss).toBeFocused();
  await page.waitForTimeout(5000); // longer than the message's own time
  await expect(dismiss).toBeVisible();
});

test('a focused message stays when the pointer passes over it and leaves', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', TAB_SKIPS_BUTTONS);
  await page.goto('/');
  await page.getByRole('button', { name: /^Play/ }).first().click();
  await page.getByRole('button', { name: 'Pause', exact: true }).first().click();
  await page.getByRole('button', { name: 'Open queue' }).click();
  await page.getByRole('dialog', { name: 'Queue' }).getByRole('button', { name: /^Move / }).first().press('Delete');
  const undo = page.getByRole('button', { name: 'Undo' });
  for (let i = 0; i < 40 && !(await undo.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(undo).toBeFocused();
  await undo.hover();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(7000); // longer than the message's own time
  await expect(undo).toBeVisible();
});

test('closing a message focused with nothing before it keeps focus in the top sheet', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', TAB_SKIPS_BUTTONS);
  await page.goto('/');
  await page.getByRole('button', { name: /^Play/ }).first().click();
  await page.getByRole('button', { name: 'Pause', exact: true }).first().click();
  await page.getByRole('button', { name: 'Open queue' }).click();
  await page.getByRole('button', { name: /^Clear/ }).click();
  // Focus came from nowhere (the Clear button is gone), then moved into the message.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.getByRole('button', { name: 'Dismiss message' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Dismiss message' })).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]')?.getAttribute('aria-label'))).toBe('Queue');
});

test('holding an arrow key moves one phrase, not through the queue', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Play/ }).first().click();
  await page.getByRole('button', { name: 'Pause', exact: true }).first().click();
  const player = page.getByRole('dialog', { name: 'Now playing' });
  await expect(player.getByText(/^1 of \d+$/)).toBeVisible();
  await page.keyboard.press('ArrowRight');
  // A held key: the system's auto-repeat sends more keydowns marked `repeat`.
  await page.evaluate(() => {
    for (let i = 0; i < 10; i++) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', repeat: true, bubbles: true }));
  });
  await expect(player.getByText(/^2 of \d+$/)).toBeVisible();
});

test('a held key still works inside a sheet over the player', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Play/ }).first().click();
  await page.getByRole('button', { name: 'Pause', exact: true }).first().click();
  await page.getByRole('button', { name: 'Open queue' }).click();
  const prevented = await page.getByRole('dialog', { name: 'Queue' }).evaluate((dialog) => {
    const target = dialog.querySelector<HTMLElement>('button') ?? dialog;
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', repeat: true, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
});
