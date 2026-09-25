// Screenshots of many states for manual review (not assertions):
// GALLERY_DIR=/tmp/x npx playwright test e2e/gallery.spec.ts
import { Page } from '@playwright/test';
import { sampleHistory, test } from './fixtures';

const dir = process.env.GALLERY_DIR;
test.skip(!dir, 'set GALLERY_DIR to write screenshots');
test.use({ seed: { log: sampleHistory(Date.now()) } });

const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: `${dir}/${name}.png`, fullPage });

test('with history', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(600);
  await shot(page, 'home', true);
  await page.goto('/#/library?view=learning');
  await page.waitForTimeout(400);
  await shot(page, 'library', true);
  await page.goto('/#/set/set-cafe?from=home');
  await page.waitForTimeout(400);
  await shot(page, 'set', true);
  await page.getByRole('button', { name: /Details for ¿Tienen/ }).click();
  await page.waitForTimeout(500);
  await shot(page, 'details');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.goto('/');
  await page.getByRole('button', { name: /History/ }).first().click();
  await page.waitForTimeout(500);
  await shot(page, 'history');
});

test('player hold and 200%', async ({ page }) => {
  await page.clock.install();
  await page.goto('/#/set/set-sobremesa?from=home');
  await page.getByRole('button', { name: 'Play Sobremesa' }).click();
  await page.getByRole('button', { name: /^Now playing:/ }).click();
  for (let t = 0; t < 26_000; t += 500) await page.clock.runFor(500);
  await shot(page, 'player-hold');
  await page.addStyleTag({ content: 'html { font-size: 200% }' });
  await page.clock.runFor(500);
  await shot(page, 'player-200', true);
});

test('tablet and landscape', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  await page.waitForTimeout(500);
  await shot(page, 'tablet-home');
  await page.getByRole('button', { name: /Play/ }).first().click();
  await page.getByRole('button', { name: /^Now playing:/ }).click();
  await page.waitForTimeout(700);
  await shot(page, 'tablet-player');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(400);
  await shot(page, 'landscape-player');
});

test.describe('other UI languages', () => {
  test.use({ seed: { nativeLang: 'bg-BG', name: 'Мира', log: sampleHistory(Date.now()).map((e) => ({ ...e, key: String(e.key).replace('en-GB>', 'bg-BG>') })) } });
  test('bulgarian', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    await shot(page, 'bg-home', true);
    await page.goto('/#/library?view=due');
    await page.waitForTimeout(400);
    await shot(page, 'bg-library', true);
    await page.getByRole('button', { name: /Пусни всички/ }).click();
    await page.getByRole('button', { name: /^Сега звучи:/ }).click();
    await page.waitForTimeout(800);
    await shot(page, 'bg-player');
  });
});

test('200% text screens', async ({ page }) => {
  await page.goto('/');
  await page.addStyleTag({ content: 'html { font-size: 200% }' });
  await page.waitForTimeout(400);
  await shot(page, 'home-200');
  await page.getByRole('button', { name: /Play 7 phrases/ }).click();
  await page.waitForTimeout(700);
  await shot(page, 'player-200b');
});
