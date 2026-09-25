// Home and the app shell: the header's title, one hero, and what Home's buttons do.
import { expect, test } from './fixtures';

test("the greeting is the header's title, in the language being learned (V-10)", async ({ page }) => {
  await page.goto('/');
  const title = page.locator('header h1');
  await expect(title).toHaveText('¡Hola, Ana!');
  await expect(title).toHaveAttribute('lang', 'es-ES');
  await expect(page.locator('main h1')).toHaveCount(0);
  // Coming back to Home, focus lands on it as on any page's heading.
  await page.goto('/#/set/set-cafe?from=home');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(title).toBeFocused();
  // At large text it takes two lines rather than being cut to "¡Hol…".
  await page.addStyleTag({ content: 'html { font-size: 200% }' });
  expect(await title.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
});
