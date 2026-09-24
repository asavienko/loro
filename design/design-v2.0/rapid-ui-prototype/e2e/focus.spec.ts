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
      const hidden: string[] = [];
      for (let i = 0; i < 50; i++) {
        await page.keyboard.press('Tab');
        const problem = await page.evaluate(() => {
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
        if (problem) hidden.push(problem);
      }
      expect([...new Set(hidden)]).toEqual([]);
    });
  }
}

test('Tab and Shift+Tab stay inside an open sheet, past its tabs', async ({ page }) => {
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
