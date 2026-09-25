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
    const player = page.getByRole('dialog', { name: 'Now playing' });
    // Paused, so the phrase can't reach its rating hold (where a rating moves on) on a slow run.
    await player.getByRole('button', { name: 'Pause', exact: true }).click();
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
    await page.addInitScript(() => (window.__noVoices = ['es-ES', 'es-MX']));
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    await page.getByRole('button', { name: 'Close player' }).click(); // Home's Play opens the player
    await expect(page.getByRole('button', { name: /^Now playing:/ })).toContainText('No voice for this language');
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    await expect(player.getByRole('alert')).toContainText('This device has no Spanish voice');
    await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Close player' }).click();
    await expect(page.getByTestId('points')).toContainText('0 points');
  });

  test('a stuck speech engine is silenced before the learner’s turn', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.evaluate(() => (window.__speechStuck = true));
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    // Each utterance times out (it never ends); whenever the learner's turn comes, the
    // engine that was still "talking" must have been silenced.
    let turns = 0;
    for (let t = 0; t < 20_000; t += 250) {
      await page.clock.runFor(250);
      if (await player.getByText('Your turn — say it in Spanish', { exact: true }).count()) {
        turns++;
        expect(await page.evaluate(() => window.__talking)).toBe(false);
      }
    }
    expect(turns).toBeGreaterThan(0);
  });

  test('a silent speech engine stops playback honestly and pays nothing', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => (window.__speechSilent = true));
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
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
    await page.getByRole('button', { name: 'Notes' }).click();
    await expect(page.getByRole('dialog', { name: 'Notes' }).getByRole('heading', { name: '«Me pone…»' })).toBeVisible();
  });
});

test.describe('queue', () => {
  test('keeps the target hidden during recall; remove can be undone', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
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

// No content ships clips yet, so the clip path is exercised through the module
// itself (dev server only: the production build has no /src).
test.describe('recorded clips', () => {
  test.skip(Boolean(process.env.PREVIEW), 'imports /src from the dev server');

  test('a clip that fails falls back to the device voice', async ({ page }) => {
    await page.goto('/');
    // Wait for the app to mount: its start-up cleanup (stopSpeech) would cancel this speech.
    await expect(page.getByRole('heading', { name: '¡Hola, Ana!' })).toBeVisible();
    const result = await page.evaluate(async () => {
      class BrokenAudio {
        error = { code: 4 };
        duration = NaN;
        currentTime = 0;
        playbackRate = 1;
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;
        play() { return Promise.reject(new Error('not supported')); }
        pause() {}
      }
      (window as unknown as { Audio: unknown }).Audio = BrokenAudio;
      // Served by the dev server; typed from the source.
      const path = '/src/audio/speech.ts';
      const speech = (await import(/* @vite-ignore */ path)) as typeof import('../src/audio/speech');
      const r = await speech.speak('Me pone un cortado', 'es-ES', 1, 'https://example.invalid/clip.mp3').done;
      return { r, spoken: window.__spoken.map((u) => u.text) };
    });
    expect(result.spoken).toContain('Me pone un cortado');
    expect(result.r.status).toBe('ended');
  });

  test('a clip that stalls gives way instead of hanging the loop', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    const pending = page.evaluate(async () => {
      class StalledAudio {
        error = null;
        duration = NaN;
        currentTime = 0;
        playbackRate = 1;
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;
        play() { return new Promise<void>(() => {}); }
        pause() {}
      }
      (window as unknown as { Audio: unknown }).Audio = StalledAudio;
      // Served by the dev server; typed from the source.
      const path = '/src/audio/speech.ts';
      const speech = (await import(/* @vite-ignore */ path)) as typeof import('../src/audio/speech');
      return (await speech.speak('Hola', 'es-ES', 1, 'https://example.invalid/stall.mp3').done).status;
    });
    for (let t = 0; t < 20_000; t += 1000) await page.clock.runFor(1000);
    expect(await pending).toBe('timeout');
  });
});

test('Play from the lock screen while hidden starts when the page is visible again', async ({ page }) => {
  // Capture the Media Session handlers, and let the test hide and show the page.
  await page.addInitScript(() => {
    const handlers: Record<string, (() => void) | null> = {};
    Object.defineProperty(navigator, 'mediaSession', {
      value: { setActionHandler: (a: string, h: (() => void) | null) => (handlers[a] = h), metadata: null, playbackState: 'none' },
    });
    let state: DocumentVisibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', { get: () => state });
    Object.assign(window, {
      __media: handlers,
      __setVisible: (visible: boolean) => {
        state = visible ? 'visible' : 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Play 5 phrases' }).click();
  await page.getByRole('button', { name: 'Close player' }).click(); // Home's Play opens the player
  const mini = page.getByRole('button', { name: /^Now playing:/ });
  type Hooks = { __setVisible: (visible: boolean) => void; __media: Record<string, () => void> };
  const setVisible = (visible: boolean) => page.evaluate((v) => (window as unknown as Hooks).__setVisible(v), visible);
  await setVisible(false);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toHaveCount(1);
  await page.evaluate(() => (window as unknown as Hooks).__media.play());
  await page.waitForTimeout(300);
  // Still paused while hidden: nothing plays into silence.
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0);
  await setVisible(true);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(mini).not.toContainText('Speech stopped');
});

test('a new version is offered only while nothing plays', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play 5 phrases' }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('loro:update-ready')));
  await page.waitForTimeout(300);
  await expect(page.getByText('A new version of Loro is ready')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pause', exact: true }).first().click();
  await expect(page.locator('.toast-layer').getByText('A new version of Loro is ready')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
});

test.describe('what a screen reader hears', () => {
  test('by default: a short "Your turn", and the phrase in Spanish only after it is heard', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    const region = page.getByRole('dialog', { name: 'Now playing' }).locator('p.sr-only[aria-live]');
    const heard: { text: string; lang: string | null; phase: string }[] = [];
    for (let t = 0; t < 45_000; t += 250) {
      await page.clock.runFor(250);
      const text = (await region.textContent())?.trim() ?? '';
      if (text && heard.at(-1)?.text !== text) heard.push({ text, lang: await region.getAttribute('lang'), phase: await page.evaluate(() => document.querySelector('[aria-current="step"]')?.textContent ?? '') });
    }
    expect(heard.map((h) => h.text)).toContain('Your turn');
    const reveal = heard.find((h) => h.text === 'Me pone un cortado, por favor');
    expect(reveal?.lang).toBe('es-ES');
    // Never announced while the Spanish audio plays.
    expect(heard.some((h) => h.text === 'Me pone un cortado, por favor' && /Spanish/.test(h.phase))).toBe(false);
  });

  test('a rating is announced once, not every minute of its window', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).first().click();
    await page.getByRole('button', { name: /^Missed/ }).click();
    const status = page.locator('div[role="status"]');
    await expect(status).toHaveText(/^Rated Missed/);
    await page.evaluate(() => document.querySelector('div[role="status"]')!.replaceChildren());
    await page.clock.runFor(3 * 60_000);
    await expect(status).toHaveText('');
  });

  test('a changed rating says the same "back …" as the screen', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).first().click();
    await page.getByRole('button', { name: /^Missed/ }).click();
    await page.clock.runFor(4 * 60_000);
    await page.getByRole('button', { name: /^Hard/ }).click();
    const status = page.locator('div[role="status"]');
    await expect(status).toHaveText(/^Rated Hard/);
    const player = page.getByRole('dialog', { name: 'Now playing' });
    await expect(player.getByText(/^Rated Hard/)).toHaveText((await status.textContent())!);
  });

  test('a rating given while the grades wait is announced then, not when the phrase returns', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    const waiting = player.getByText('Rate it, or wait to go on').first();
    for (let t = 0; t < 120_000 && !(await waiting.isVisible()); t += 250) await page.clock.runFor(250);
    await expect(waiting).toBeVisible();
    await page.keyboard.press('1');
    const status = page.locator('div[role="status"]');
    await expect(status).toHaveText(/^Rated Missed/);
    await page.evaluate(() => document.querySelector('div[role="status"]')!.replaceChildren());
    // The missed phrase comes back a few phrases later, well inside its five-minute window.
    for (let t = 0; t < 4 * 60_000; t += 1000) {
      await page.clock.runFor(1000);
      expect(await status.textContent()).not.toMatch(/^Rated/);
    }
  });
});
