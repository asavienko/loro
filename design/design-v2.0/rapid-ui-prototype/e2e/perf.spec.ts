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
  // A year's points read as a grouped number.
  await expect(page.getByTestId('points')).toContainText(/\d,\d{3}/);
  await page.evaluate(() => {
    (window as unknown as { __long: number[] }).__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) (window as unknown as { __long: number[] }).__long.push(Math.round(e.duration));
    }).observe({ type: 'longtask', buffered: false });
  });
  await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
  await page.getByRole('button', { name: 'Close player' }).click(); // Home's Play opens the player
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
test('interactions respond quickly on a slow phone', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CPU throttling and event timing come from the Chrome DevTools Protocol');
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

// Half an hour of hands-free playback (repeat mode, so toasts keep coming): the
// page doesn't grow. Before the toast was one element, replaced toasts piled up.
test.describe('a long session', () => {
  test.use({ seed: {} });
  test('keeps the page the same size', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'heap and listener counts come from the Chrome DevTools Protocol');
    test.setTimeout(120_000);
    await page.clock.install();
    await page.goto('/');
    await page.getByRole('button', { name: /^Play \d+ phrases/ }).first().click();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const size = async () => {
      // Listeners on detached nodes count until collected.
      await cdp.send('HeapProfiler.collectGarbage');
      const elements = await page.evaluate(() => document.querySelectorAll('*').length);
      const { metrics } = await cdp.send('Performance.getMetrics');
      return { elements, listeners: metrics.find((m) => m.name === 'JSEventListeners')!.value };
    };
    for (let t = 0; t < 60_000; t += 1000) await page.clock.runFor(1000);
    const early = await size();
    for (let t = 0; t < 29 * 60_000; t += 1000) await page.clock.runFor(1000);
    const late = await size();
    // Not growth: a different phrase in the player (±15) and, late, the pass toast with its two
    // choices (8). The pile-up this guards against added ~130.
    expect(late.elements - early.elements, 'elements added in 29 minutes').toBeLessThan(30);
    expect(late.listeners - early.listeners, 'listeners added in 29 minutes').toBeLessThan(10);
  });
});
