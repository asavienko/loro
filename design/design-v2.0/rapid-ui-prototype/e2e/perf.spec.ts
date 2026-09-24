// Smoothness with a year of history: long tasks on the main thread while
// the loop plays and the learner moves between screens.
import { expect, test, yearOfHistory } from './fixtures';

test.use({ seed: { log: yearOfHistory(Date.now()) } });

test('a year of history stays smooth while playing', async ({ page }) => {
  test.setTimeout(90_000);
  const t0 = Date.now();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '¡Hola, Ana!' })).toBeVisible();
  const loadMs = Date.now() - t0;
  await page.evaluate(() => {
    (window as unknown as { __long: number[] }).__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) (window as unknown as { __long: number[] }).__long.push(Math.round(e.duration));
    }).observe({ type: 'longtask', buffered: false });
  });
  await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
  for (const hash of ['/#/library', '/#/explore', '/#/set/set-cafe?from=home', '/#/']) {
    await page.evaluate((h) => (location.hash = h.slice(2)), hash);
    await page.waitForTimeout(2500);
  }
  const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
  console.log(`load ${loadMs} ms; long tasks while playing: ${long.length} [${long.join(', ')}]`);
  expect(Math.max(0, ...long), 'no main-thread task over 200 ms').toBeLessThan(200);
});
