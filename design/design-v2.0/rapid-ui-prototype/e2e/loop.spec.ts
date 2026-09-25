import { expect, expectAccessible, sampleHistory, test } from './fixtures';

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
    await expect(page.getByText('Say it out loud in Spanish while it’s quiet.')).toBeVisible();
    await page.getByRole('button', { name: 'Start with one phrase' }).click();
    await expect(page.getByRole('dialog', { name: 'Now playing' })).toBeVisible();
    await page.getByRole('button', { name: 'Close player' }).click();
    await expect(page.getByRole('heading', { name: '¡Hola, Clara!' })).toBeVisible();
  });

  test('the demo is one pass, then hands over to a whole set', async ({ page }) => {
    await page.goto('/');
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Start with one phrase' }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    await expect(player.getByRole('heading', { level: 1 })).toHaveText('Try the loop');
    await player.getByRole('button', { name: 'Next phrase' }).click();
    await expect(player.getByRole('heading', { name: 'That’s the loop' })).toBeVisible();
    await expect(player.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0);
    await player.getByRole('button', { name: 'Start Café & Mañanas' }).click();
    await expect(player.getByRole('heading', { level: 1 })).toHaveText('Café & Mañanas');
    await expect(player.getByText('1 of 5')).toBeVisible();
    await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
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
    await expect(player.getByText('Your turn — say it out loud in Spanish', { exact: true }).first()).toBeVisible();
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
    // Every control, the speed row too: nothing needs a scroll.
    const offscreen = await page.getByRole('dialog', { name: 'Now playing' }).evaluate((root) =>
      [...root.querySelectorAll('button, [role="radio"]')]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.top < 0 || r.bottom > window.innerHeight);
        })
        .map((e) => e.getAttribute('aria-label') ?? e.textContent),
    );
    expect(offscreen).toEqual([]);
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
    // Paused, so the phrase can't reach its rating hold (where a rating moves on) on a slow run.
    await player.getByRole('button', { name: 'Pause', exact: true }).click();
    await player.getByRole('button', { name: /^Hard/ }).click();
    await expect(player.getByRole('button', { name: /^Hard/ })).toHaveAttribute('aria-pressed', 'true');
    await player.getByRole('button', { name: /^Easy/ }).click();
    await expect(player.getByRole('button', { name: /^Easy/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(player.getByRole('button', { name: /^Undo rating \(4:5\d left\)$/ })).toHaveText(/^Undo · 4:5\d$/);
    await player.getByRole('button', { name: 'Undo' }).click();
    await expect(player.getByRole('button', { name: /^Easy/ })).toHaveAttribute('aria-pressed', 'false');
    await player.getByRole('button', { name: /^Easy/ }).click();
    await page.clock.runFor(5 * 60_000 + 20_000);
    await page.getByRole('button', { name: 'Close player' }).click();
    await expect(page.getByTestId('points')).toContainText(/[1-9]\d* points/);
  });

  test('a rating given in the hold is shown with Undo, which still works once the next phrase plays', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    const waiting = player.getByText('Rate it, or wait to go on').first();
    for (let t = 0; t < 120_000 && !(await waiting.isVisible()); t += 250) await page.clock.runFor(250);
    await player.getByRole('button', { name: /^Easy/ }).click();
    await expect(player.getByText('2 of 5')).toBeVisible();
    const toast = page.locator('.toast-layer');
    await expect(toast).toContainText(/^Rated Easy — back (tomorrow|in \d+ days)/);
    await toast.getByRole('button', { name: 'Undo' }).click();
    // Back on the first phrase, nothing is rated.
    await player.getByRole('button', { name: 'Previous phrase' }).click();
    await expect(player.getByText('1 of 5')).toBeVisible();
    await expect(player.getByRole('button', { name: /^Easy/ })).toHaveAttribute('aria-pressed', 'false');
  });

  test('the repetitions and play-mode buttons show their setting and say what a tap changed', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    const reps = player.getByRole('button', { name: /^Repetitions:/ });
    await expect(reps).toHaveText('Autoreps');
    await reps.click();
    await expect(page.locator('.toast-layer')).toContainText('Each phrase plays once');
    await expect(reps).toHaveText('1reps');
    const mode = player.getByRole('button', { name: /^At the end:/ });
    await expect(mode).toContainText('Again');
    await mode.click();
    await expect(page.locator('.toast-layer')).toContainText('At the end, new phrases follow');
    await expect(mode).toContainText('Continue');
  });

  test('in the hold the mini-player asks for a tap: the grades are in the player', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    const mini = page.getByRole('button', { name: /^Now playing:/ });
    for (let t = 0; t < 60_000 && !/Tap to rate/.test((await mini.textContent()) ?? ''); t += 250) await page.clock.runFor(250);
    await expect(mini).toContainText('Tap to rate');
    await expect(mini).toContainText('Me pone un cortado, por favor');
    await mini.click();
    await expect(page.getByRole('dialog', { name: 'Now playing' }).getByText('Rate it, or wait to go on')).toBeVisible();
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
    await page.addInitScript(() => (window.__noVoices = ['es-ES', 'es-MX']));
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    await expect(page.getByRole('button', { name: /^Now playing:/ })).toContainText('No voice for this language');
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    await expect(player.getByRole('alert')).toContainText('This device has no Spanish voice');
    await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    // Stopped before the prompt, and the Spanish, never heard, stays hidden (the recall rule)…
    // (Only the silent utterance that unlocks audio on the first tap.)
    expect(await page.evaluate(() => window.__spoken.filter((u) => u.text.trim()).length)).toBe(0);
    await expect(player.getByRole('heading', { name: 'Me pone un cortado, por favor' })).toHaveCount(0);
    await expect(player.getByText('Spanish hidden until you hear it')).toBeAttached();
    await expectAccessible(page);
    // …unless the learner chooses to read it.
    await player.getByRole('button', { name: 'Show the Spanish text' }).click();
    await expect(player.getByRole('heading', { name: 'Me pone un cortado, por favor' })).toBeVisible();
    await page.getByRole('button', { name: 'Close player' }).click();
    await expect(page.getByTestId('points')).toContainText('0 points');
  });

  test('a stuck speech engine is silenced before the learner’s turn', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.evaluate(() => (window.__speechStuck = true));
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    // Each utterance times out (it never ends); whenever the learner's turn comes, the
    // engine that was still "talking" must have been silenced.
    let turns = 0;
    for (let t = 0; t < 20_000; t += 250) {
      await page.clock.runFor(250);
      if (await player.getByText('Your turn — say it out loud in Spanish', { exact: true }).count()) {
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

  test('the voice line opens Settings at the voices', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    await page.getByRole('button', { name: 'Voice: Test Español. Change voice' }).click();
    await expect(page.getByRole('dialog', { name: 'Settings' }).getByRole('combobox', { name: 'Spanish' })).toBeFocused();
  });

  test('notes open in a sheet', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    await page.getByRole('button', { name: 'Notes' }).click();
    await expect(page.getByRole('dialog', { name: 'Notes' }).getByRole('heading', { name: '«Me pone…»' })).toBeVisible();
  });
});

test.describe('queues with a natural end', () => {
  test.use({ seed: { log: sampleHistory(Date.now()) } });

  test('a review is named, plays once in repeat mode and stops on "Review done"', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.getByRole('button', { name: /^Play 7 phrases/ }).click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    await expect(player.getByRole('heading', { level: 1 })).toHaveText('Review');
    for (let i = 0; i < 6; i++) await player.getByRole('button', { name: 'Next phrase' }).click();
    await expect(player.getByText('7 of 7')).toBeVisible();
    // Let the last phrase play out, hold included: it doesn't start the review again.
    for (let t = 0; t < 40_000; t += 500) await page.clock.runFor(500);
    await expect(player.getByRole('heading', { name: 'Review done' })).toBeVisible();
    await expect(player.getByText(/^\d+ rated · /)).toBeVisible();
    await expect(player.getByText('7 of 7')).toBeVisible();
    await expect(page.getByText('Queue played through')).toHaveCount(0);
    await expect(player.getByRole('button', { name: /^Continue / })).toBeVisible();
    await player.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(player).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Now playing:/ })).toContainText('Review done');
  });

  test('a longer "time to say it" lengthens every play time it shows', async ({ page }) => {
    await page.goto('/');
    const review = page.getByRole('button', { name: /^Play 7 phrases · / });
    const before = await review.getAttribute('aria-label') ?? (await review.textContent())!;
    await page.getByRole('button', { name: 'Ana: settings' }).click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    // The course comes first in the profile.
    await expect(settings.getByRole('combobox').first()).toHaveAccessibleName('I’m learning');
    await settings.getByRole('radio', { name: 'Longer' }).check();
    await expect(settings.getByText('Longer gives you about twice the phrase’s length.')).toBeVisible();
    await settings.getByRole('button', { name: 'Close' }).click();
    const after = await review.getAttribute('aria-label') ?? (await review.textContent())!;
    const seconds = (label: string) => {
      const [m, s] = label.match(/(\d+):(\d{2}) at 1×/)!.slice(1).map(Number);
      return m * 60 + s;
    };
    expect(seconds(after)).toBeGreaterThan(seconds(before));
  });

  test('a Library list is named by its view', async ({ page }) => {
    await page.goto('/#/library?view=due');
    await page.getByRole('button', { name: /^Play all/ }).click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    await expect(page.getByRole('dialog', { name: 'Now playing' }).getByRole('heading', { level: 1 })).toHaveText('Due');
  });
});

test.describe('queue', () => {
  test('up next goes by the prompt, keeps the Spanish hidden, and marks a phrase coming back', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    const player = page.getByRole('dialog', { name: 'Now playing' });
    await player.getByRole('button', { name: /^Missed/ }).click();
    await expect(player.getByText('1 of 6')).toBeVisible();
    // The count grew by one: the status line says why.
    await expect(player.getByText(/^Rated Missed — back in \d+ minutes · again in this queue$/)).toBeVisible();
    await page.getByRole('button', { name: 'Open queue' }).click();
    const queue = page.getByRole('dialog', { name: 'Queue' });
    const next = queue.getByRole('button', { name: /^Play .* now$/ });
    await expect(next.first()).toHaveAccessibleName('Play Do you have oat milk? now');
    await expect(next.first()).toContainText('2');
    // Not one Spanish phrase of up next is on screen before it is heard.
    for (const target of ['¿Tienen leche de avena?', 'La cuenta, por favor', 'Sin gluten, por favor']) await expect(queue.getByText(target)).toHaveCount(0);
    await expect(next.first()).toContainText('Spanish hidden until you hear it');
    // The missed phrase comes back later in this queue, and says so.
    await expect(next.last()).toHaveAccessibleName('Play A cortado, please now');
    await expect(next.last()).toContainText('Again');
    await expect(next.first()).not.toContainText('Again');
  });


  test('keeps the target hidden during recall; remove can be undone', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Play 5 phrases' }).click();
    await page.getByRole('button', { name: /^Now playing:/ }).click();
    await page.getByRole('button', { name: 'Open queue' }).click();
    const queue = page.getByRole('dialog', { name: 'Queue' });
    await expect(queue.getByText('Spanish hidden until you hear it · Repetition 1 of 3')).toBeVisible();
    await expect(queue.getByText('4 left')).toBeVisible();
    await queue.getByRole('button', { name: 'Move The bill, please' }).press('Delete');
    await expect(queue.getByText('3 left')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(queue.getByText('4 left')).toBeVisible();
    await queue.getByRole('button', { name: 'Move The bill, please' }).press('ArrowUp');
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
    await page.getByRole('button', { name: /^Now playing:/ }).click();
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
    await page.getByRole('button', { name: /^Now playing:/ }).click();
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
    await page.getByRole('button', { name: /^Now playing:/ }).click();
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
    await page.getByRole('button', { name: /^Now playing:/ }).click();
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
