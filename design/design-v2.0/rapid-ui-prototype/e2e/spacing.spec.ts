// WCAG 1.4.12 text spacing: with the user overrides the success criterion names, no text is clipped.
import { expect, sampleHistory, test } from './fixtures';
test.use({ viewport: { width: 390, height: 844 }, seed: { log: sampleHistory(Date.now()) } });
const css = '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }';
const clipped = (page: import('@playwright/test').Page) => page.evaluate(() =>
  [...document.querySelectorAll('button, a, h1, h2, h3, p, li, label, span')]
    .filter((e) => { const r = e.getBoundingClientRect(); if (!r.width) return false; if (e.closest('.truncate, [class*="line-clamp"], .sr-only, [aria-hidden="true"], .scroll-row')) return false; const s = getComputedStyle(e); if (s.overflow === 'visible' && s.overflowX === 'visible' && s.overflowY === 'visible') return false; return e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1; })
    .map((e) => `${e.tagName} "${(e.textContent ?? '').trim().slice(0, 35)}" ${e.scrollWidth}x${e.scrollHeight}/${e.clientWidth}x${e.clientHeight}`).slice(0, 8));
for (const hash of ['/', '/#/explore', '/#/library', '/#/set/set-cafe?from=explore']) test(`spacing ${hash}`, async ({ page }) => {
  await page.goto(hash);
  await page.addStyleTag({ content: css });
  await page.waitForTimeout(300);
  expect(await clipped(page)).toEqual([]);
});
test('spacing player', async ({ page }) => {
  await page.goto('/');
  await page.addStyleTag({ content: css });
  await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
  await page.waitForTimeout(700);
  expect(await clipped(page)).toEqual([]);
});
