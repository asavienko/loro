// Pasted links, list counts and search: what a learner reaches is what the page says.
import { expect, test } from './fixtures';

test('a link with a stray "%" opens a page instead of an error', async ({ page }) => {
  await page.goto('/#/%');
  await expect(page.getByRole('heading', { name: '¡Hola, Ana!' })).toBeVisible();
  await page.goto('/#/set/abc%zz?from=explore');
  await expect(page.getByText('This set isn’t available.')).toBeVisible();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
});

test('after deleting your set, Back does not return to it', async ({ page }) => {
  await page.goto('/#/explore');
  await page.goto('/#/library?view=ownSets');
  await page.getByRole('button', { name: 'New set' }).first().click();
  await page.getByLabel('Name').fill('Probe');
  await page.getByLabel('Name').press('Enter');
  await expect(page.getByRole('heading', { name: 'Probe', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: /^More/ }).click();
  await page.getByRole('button', { name: 'Delete set' }).click();
  await expect(page).toHaveURL(/#\/library/);
  await page.goBack();
  await expect(page.getByText('This set isn’t available.')).toHaveCount(0);
});

test('filters with no phrases say so, without an empty search', async ({ page }) => {
  await page.goto('/#/explore?topic=eating-out&tag=directions');
  await expect(page.getByText('No phrases match these filters.')).toBeVisible();
});

test.describe('search', () => {
  test('matches words from their start, not inside other words', async ({ page }) => {
    // "uenta" is inside "cuenta", and starts no word.
    await page.goto('/#/explore?q=uenta');
    await expect(page.getByRole('button', { name: 'Play La cuenta, por favor' })).toHaveCount(0);
  });
});

test.describe('a set with phrases being learned', () => {
  const now = Date.now();
  const log = ['tapas-01', 'tapas-02', 'tapas-03', 'tapas-04'].flatMap((phraseId, i) => {
    const key = `en-GB>es-ES:${phraseId}`;
    const at = now - 60_000 * (10 + i);
    return [
      { id: `t.x-${i}a`, at, device: 't', kind: 'heard', key, phraseId, setId: 'set-tapas', targetMs: 1500, nativeMs: 1100 },
      { id: `t.x-${i}b`, at: at + 30_000, device: 't', kind: 'rated', key, phraseId, setId: 'set-tapas', grade: 'easy' },
    ];
  });
  test.use({ seed: { log } });

  test('"Play due and new" counts only due and new phrases', async ({ page }) => {
    await page.goto('/#/set/set-tapas?from=explore');
    await expect(page.getByRole('button', { name: 'Play due and new (1)' })).toBeVisible();
  });
});

test.describe('forms', () => {
  test('a name typed in Settings is kept when the sheet closes with Escape', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Ana: settings' }).click();
    await page.getByLabel('Name').fill('Bea');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Bea: settings' })).toBeVisible();
  });

  test('a long search offered as your own phrase starts within the limit', async ({ page }) => {
    await page.goto(`/#/explore?q=${'palabra '.repeat(20)}`);
    await page.getByRole('button', { name: /^Add/ }).last().click();
    const field = page.getByLabel('In Spanish');
    expect(((await field.inputValue()) ?? '').length).toBeLessThanOrEqual(120);
    await expect(page.getByText(/-\d+ characters? left/)).toHaveCount(0);
  });

  test('saving an edit that changes nothing is not offered', async ({ page }) => {
    await page.goto('/#/library?view=mine');
    await page.getByRole('button', { name: 'Add your phrase' }).click();
    await page.getByLabel('In Spanish').fill('Hola');
    await page.getByLabel('In English').fill('Hi');
    await page.getByRole('button', { name: 'Add phrase' }).click();
    await page.getByRole('button', { name: 'Details for Hola' }).click();
    await page.getByRole('button', { name: 'Edit phrase' }).click();
    const save = page.getByRole('button', { name: 'Save' });
    await expect(save).toBeDisabled();
    await page.getByLabel('In English').fill('Hi ');
    await expect(save).toBeDisabled();
    await page.getByLabel('In English').fill('Hello');
    await expect(save).toBeEnabled();
  });
});

test("the set page's Back works after a reload with a sheet open", async ({ page }) => {
  await page.goto('/#/explore');
  await page.getByRole('button', { name: 'Café & Mañanas' }).first().click();
  await page.getByRole('button', { name: /^More/ }).click();
  await page.reload();
  await page.getByRole('button', { name: /^Back/ }).first().click();
  await expect(page).toHaveURL(/#\/explore/);
});

test('the notes sheet shows the next phrase its own first tab', async ({ page }) => {
  await page.clock.install();
  await page.goto('/#/set/set-tapas?from=explore');
  await page.getByRole('button', { name: 'Play Tapas & Tabernas' }).click();
  await page.getByRole('button', { name: /^Now playing:/ }).click();
  const player = page.getByRole('dialog', { name: 'Now playing' });
  await player.getByRole('button', { name: 'Notes' }).click();
  // The first phrase has more kinds of note than the second: pick its last.
  const first = await page.getByRole('tab').count();
  await page.getByRole('tab').last().click();
  // The player moves on while the notes stay open.
  for (let t = 0; t < 90_000 && (await player.getByText(/^1 of \d+$/).count()) > 0; t += 500) await page.clock.runFor(500);
  await expect(player.getByText(/^2 of \d+$/)).toBeVisible();
  expect(await page.getByRole('tab').count()).toBeLessThan(first);
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
  await expect(page.getByRole('tabpanel')).not.toBeEmpty();
});

test.describe('onboarding', () => {
  test.use({ seed: null });
  test('a typed name survives a reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByPlaceholder(/name/i).fill('Ivan');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(600);
    await page.reload();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByPlaceholder(/name/i)).toHaveValue('Ivan');
  });
});

