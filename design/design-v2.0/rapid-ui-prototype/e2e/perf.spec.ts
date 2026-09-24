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

// Taps and typing on a slow phone (CPU 4× throttled), from the browser's own
// event timing: every interaction paints within 200 ms (the "good" INP line).
test('interactions respond quickly on a slow phone', async ({ page }) => {
  test.setTimeout(120_000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '¡Hola, Ana!' })).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as { __slow: string[] };
    w.__slow = [];
    new PerformanceObserver((list) => {
      // `interactionId` is newer than the DOM typings.
      for (const e of list.getEntries() as (PerformanceEventTiming & { interactionId?: number })[]) {
        if (e.interactionId && e.duration >= 200) w.__slow.push(`${e.name} ${Math.round(e.duration)} ms`);
      }
    }).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
  });
  const tap = async (fn: () => Promise<unknown>) => {
    await fn();
    await page.waitForTimeout(600);
  };
  await tap(() => page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click());
  await tap(() => page.getByRole('button', { name: /^Now playing:/ }).click());
  await tap(() => page.getByRole('button', { name: /^Easy/ }).click());
  await tap(() => page.getByRole('button', { name: 'Next phrase', exact: true }).click());
  await tap(() => page.getByRole('button', { name: /queue/i }).first().click());
  await tap(() => page.goBack());
  await tap(() => page.goBack());
  await tap(() => page.getByRole('button', { name: 'Explore' }).click());
  await tap(() => page.getByRole('searchbox').pressSequentially('cafe', { delay: 60 }));
  await tap(() => page.getByRole('button', { name: 'Library' }).click());
  await tap(() => page.getByRole('button', { name: /^Learned/ }).first().click());
  const slow = await page.evaluate(() => (window as unknown as { __slow: string[] }).__slow);
  expect(slow, 'interactions over 200 ms').toEqual([]);
});
