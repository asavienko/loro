// A seeded random walk through the app: taps on visible controls, text in
// fields, Back and Escape. Any page error (the fixture checks) or the error
// screen fails the run. Seeds are fixed so a failure replays exactly.
import { Page } from '@playwright/test';
import { expect, sampleHistory, test } from './fixtures';

test.skip(!process.env.MONKEY, 'slow (about 2 minutes): npm run test:monkey');
test.use({ seed: { log: sampleHistory(Date.now()) } });
// MONKEY_VIEWPORT=320x568 (or 568x320) walks a small phone or phone landscape instead.
const [vw, vh] = (process.env.MONKEY_VIEWPORT ?? '').split('x').map(Number);
if (vw && vh) test.use({ viewport: { width: vw, height: vh } });

function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function walk(page: Page, seed: number, steps: number) {
  const random = prng(seed);
  await page.goto('/');
  for (let step = 0; step < steps; step++) {
    const roll = random();
    if (!page.url().startsWith('http://localhost')) await page.goto('/');
    if (roll < 0.06) {
      await page.goBack().catch(() => undefined);
    } else if (roll < 0.1) {
      await page.keyboard.press('Escape');
    } else {
      const controls = page.locator('button:visible:not([disabled]), input:visible, select:visible, [role="tab"]:visible');
      const count = await controls.count();
      if (count === 0) continue;
      const control = controls.nth(Math.floor(random() * count));
      const tag = await control.evaluate((el) => el.tagName, undefined, { timeout: 1500 }).catch(() => '');
      if (process.env.MONKEY_LOG) console.log('act', step, tag, (await control.evaluate((el) => el.getAttribute('aria-label') ?? el.textContent).catch(() => '?'))?.slice(0, 50));
      if (tag === 'INPUT') await control.fill(['Hola', '¿Qué tal?', 'cuenta', ''][Math.floor(random() * 4)], { timeout: 1500 }).catch(() => undefined);
      else if (tag === 'SELECT') await control.selectOption({ index: Math.floor(random() * 2) }, { timeout: 1500 }).catch(() => undefined);
      else await control.click({ timeout: 1500, trial: false }).catch(() => undefined);
    }
    await page.waitForTimeout(40);
    if (process.env.MONKEY_LOG) console.log(step, Math.round(performance.now()), page.url().replace(/.*#/, '#'));
    await expect(page.getByRole('heading', { name: 'Something went wrong' }), `error screen at step ${step} (seed ${seed})`).toHaveCount(0);
  }
}

for (const seed of (process.env.MONKEY_SEEDS ?? "1,2,3,4").split(",").map(Number)) {
  test(`random walk, seed ${seed}`, async ({ page }) => {
    test.setTimeout(300_000);
    await walk(page, seed, 150);
  });
}
