import { expect, expectAccessible, test } from './fixtures';

test.describe('onboarding', () => {
  test.use({ seed: null });

  test('languages, name, voices and the loop, then a demo phrase', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Step 1 of 5')).toBeVisible();
    await page.getByRole('radio', { name: 'English' }).check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByPlaceholder('Your name').fill('Clara');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('radio', { name: 'Spanish' }).check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Spanish: Test Español')).toBeVisible();
    await expect(page.getByText('English: Test English')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Say it yourself in Spanish while it’s quiet.')).toBeVisible();
    await page.getByRole('button', { name: 'Start with one phrase' }).click();
    await expect(page.getByRole('dialog', { name: 'Now playing' })).toBeVisible();
    await page.getByRole('button', { name: 'Close player' }).click();
    await expect(page.getByRole('heading', { name: '¡Hola, Clara!' })).toBeVisible();
  });

  test('a Bulgarian speaker gets the UI in Bulgarian and only the Spanish course', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Български' }).check();
    await expect(page.getByRole('button', { name: 'Напред' })).toBeVisible();
    await page.getByRole('button', { name: 'Напред' }).click();
    await page.getByRole('button', { name: 'Напред' }).click();
    await expect(page.getByRole('radio')).toHaveCount(1);
  });
});

test.describe('the loop', () => {
  test('hides the Spanish until it is heard, then reveals it with glosses', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    await expect(player.getByText('Spanish hidden until you hear it')).toBeAttached();
    await expect(player.getByRole('heading', { name: 'Me pone un cortado, por favor' })).toHaveCount(0);
    // Prompt, then the learner's turn, then the target.
    await expect(player.getByText('Your turn — say it in Spanish', { exact: true }).first()).toBeVisible();
    await expect(player.getByText('Hear it in Spanish', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await player.getByRole('button', { name: 'Pause', exact: true }).click();
    // The glossed heading reads exactly as the phrase: no punctuation lost or doubled.
    await expect(player.getByRole('heading', { name: 'Me pone un cortado, por favor', exact: true })).toHaveText('Me pone un cortado, por favor');
    await player.getByRole('button', { name: 'cortado' }).click();
    await expect(player.getByText('cortado: espresso with a dash of milk')).toBeVisible();
  });

  test('transport is visible without scrolling; Back closes the queue, then the player', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    await page.waitForTimeout(700); // the player slides up
    const pause = page.getByRole('dialog', { name: 'Now playing' }).getByRole('button', { name: 'Pause', exact: true });
    const box = await pause.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    await page.getByRole('button', { name: 'Open queue' }).click();
    await expect(page.getByRole('dialog', { name: 'Queue' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Queue' })).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Now playing' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Now playing' })).toHaveCount(0);
  });

  test('a rating can be changed and undone, and counts after five minutes', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    await player.getByRole('button', { name: /^Hard/ }).click();
    await expect(player.getByRole('button', { name: /^Hard/ })).toHaveAttribute('aria-pressed', 'true');
    await player.getByRole('button', { name: /^Easy/ }).click();
    await expect(player.getByRole('button', { name: /^Easy/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(player.getByText(/Change or undo for 4:5\d/)).toBeVisible();
    await player.getByRole('button', { name: 'Undo' }).click();
    await expect(player.getByRole('button', { name: /^Easy/ })).toHaveAttribute('aria-pressed', 'false');
    await player.getByRole('button', { name: /^Easy/ }).click();
    await page.clock.runFor(5 * 60_000 + 20_000);
    await page.getByRole('button', { name: 'Close player' }).click();
    await expect(page.getByTestId('points')).toContainText(/[1-9]\d* points/);
  });

  test('keyboard: space plays and pauses, arrows change phrase, 1–3 rate', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    await player.focus();
    await page.keyboard.press('Space');
    await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(player.getByText('2 of 5')).toBeVisible();
    await page.keyboard.press('3');
    await expect(player.getByRole('button', { name: /^Easy/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('a device with no Spanish voice says so and pays nothing', async ({ page }) => {
    await page.addInitScript(() => (window.__noVoices = ['es-ES']));
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    await expect(page.getByRole('button', { name: /^Now playing:/ })).toContainText('No voice for this language');
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    await expect(player.getByRole('alert')).toContainText('This device has no Spanish voice');
    await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Close player' }).click();
    await expect(page.getByTestId('points')).toContainText('0 points');
  });

  test('a silent speech engine stops playback honestly and pays nothing', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => (window.__speechSilent = true));
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    await expect(player.getByRole('alert')).toContainText('Speech stopped before the phrase played. Press Play to try again.');
    await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close player' }).click();
    await expect(player).toHaveCount(0);
    await expect(page.getByTestId('points')).toContainText('0 points');
    // Once speech works again, Play carries on.
    await page.evaluate(() => (window.__speechSilent = false));
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Now playing:/ })).toContainText('Your turn', { timeout: 5000 });
  });

  test('notes open in a sheet', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    await page.getByRole('button', { name: 'Notes' }).click();
    await expect(page.getByRole('dialog', { name: 'Notes' }).getByRole('heading', { name: '«Me pone…»' })).toBeVisible();
  });
});

test.describe('queue', () => {
  test('keeps the target hidden during recall; remove can be undone', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    await page.getByRole('button', { name: 'Open queue' }).click();
    const queue = page.getByRole('dialog', { name: 'Queue' });
    await expect(queue.getByText('Spanish hidden until you hear it · Repetition 1 of 3')).toBeVisible();
    await expect(queue.getByText('4 left')).toBeVisible();
    await queue.getByRole('button', { name: 'Move La cuenta, por favor' }).press('Delete');
    await expect(queue.getByText('3 left')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(queue.getByText('4 left')).toBeVisible();
    await queue.getByRole('button', { name: 'Move La cuenta, por favor' }).press('ArrowUp');
    await expect(page.getByRole('status')).toHaveText('Moved to position 1 of 4');
  });
});
