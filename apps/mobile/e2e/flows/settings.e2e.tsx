// Settings, signed out (P2-24, F-07): the sheet the avatar opens. Covers the account row (to the sign-in
// page), the course (download, switch, a failed download, switching back), the UI language, the name, the
// pause length, announce every step and the usage-sharing switch; every change is saved and survives a
// restart. Reset progress and the progress JSON export are not in this sheet (see the it.todo below).
import { languageName } from '@shared/copy';
import { problem } from '../fakes/api';
import { act, copy, fireEvent, launch, screen, SECOND } from '../harness';

// PostHog is off in tests (no key), so the usage switch is absent. This file makes it appear, with a
// stand-in that keeps the choice in memory where the sheet and a restart can both read it.
jest.mock('../../src/analytics/posthog', () => {
  const actual = jest.requireActual('../../src/analytics/posthog');
  const sharing = () => ((globalThis as any).__e2eSharing ??= { on: true, calls: [] as boolean[] });
  return {
    ...actual,
    analyticsAvailable: () => true,
    sharingUsage: () => sharing().on,
    setSharingUsage: async (on: boolean) => {
      sharing().on = on;
      sharing().calls.push(on);
    },
  };
});

/** The usage-sharing choice the stand-in was given, and what it was asked. */
const sharing = () => ((globalThis as any).__e2eSharing ??= { on: true, calls: [] as boolean[] }) as { on: boolean; calls: boolean[] };

/** Opens the settings sheet from the avatar on Home (the avatar says "<name>: settings"). */
async function openSettings(app: Awaited<ReturnType<typeof launch>>) {
  await app.tap(app.c.nav.settings('Ana'));
  await app.waitFor(app.c.settings.title);
}

/** Whether the radio (a sheet's option) with this name is the one checked. */
const checked = (name: string) => screen.queryByRole('radio', { name, checked: true }) !== null;

/** Sets a switch by its accessibility label, as the learner flips it. */
async function flip(app: Awaited<ReturnType<typeof launch>>, label: string, value: boolean) {
  await act(async () => {
    fireEvent(screen.getByLabelText(label), 'valueChange', value);
  });
  await app.settle();
}

describe('Settings: the sheet', () => {
  it('opens from the avatar on Home and lists the account, profile, listening and screen reader sections', async () => {
    const app = await launch();
    await openSettings(app);
    for (const label of [app.c.account.title, app.c.settings.profile, app.c.settings.listening, app.c.settings.accessibility]) {
      expect(app.sees(label)).toBe(true);
    }
  });

  it('closes with its Close button and stays on the same page', async () => {
    const app = await launch({ url: '/library' });
    await openSettings(app);
    await app.tap(app.c.common.close);
    expect(app.sees(app.c.settings.title)).toBe(false);
    expect(app.pathname()).toBe('/library');
  });

  it('closes when pulled down by its grip, as well as by Close', async () => {
    const app = await launch({ url: '/library' });
    await openSettings(app);
    await app.swipe(app.c.settings.title, { dy: 400 });
    expect(app.sees(app.c.settings.title)).toBe(false);
    expect(app.pathname()).toBe('/library');
  });

  it('stays open when pulled down only a little', async () => {
    const app = await launch({ url: '/library' });
    await openSettings(app);
    await app.swipe(app.c.settings.title, { dy: 10 });
    expect(app.sees(app.c.settings.title)).toBe(true);
  });

  it('opens the sign-in page from the account row when signed out', async () => {
    const app = await launch();
    await openSettings(app);
    await app.tap(app.c.account.signIn);
    expect(app.pathname()).toBe('/account');
    expect(app.sees(app.c.account.signInTitle)).toBe(true);
  });

  it('shows the course options, and the UI languages, in the learner\'s pair', async () => {
    const app = await launch();
    await openSettings(app);
    const courses = screen.getByLabelText(app.c.settings.course);
    expect(courses).toBeTruthy();
    // Every course but the one in the learner's own language.
    expect(app.sees(/Spanish/)).toBe(true);
    expect(app.sees(/Bulgarian/)).toBe(true);
    expect(app.sees(/English/)).toBe(true);
  });
});

describe('Settings: the course', () => {
  it('switching to a course downloads its pack, says so, and saves it', async () => {
    const app = await launch();
    await openSettings(app);
    await app.tap(/Bulgarian/, { within: screen.getByLabelText(app.c.settings.course) });
    await app.waitFor(app.c.settings.switched('Bulgarian', false));
    expect(app.api.calls('GET /library/pack').map((r) => r.path)).toContain('/library/pack?target=bg-BG');
    expect((await app.saved()).learner.profile.targetLang).toBe('bg-BG');
  });

  it('keeps the chosen course after a restart', async () => {
    const app = await launch();
    await openSettings(app);
    await app.tap(/Bulgarian/, { within: screen.getByLabelText(app.c.settings.course) });
    await app.settle();
    const again = await app.restart();
    await again.waitFor(again.c.tabs.home);
    await openSettings(again);
    expect(checked(`🇧🇬  ${languageName('bg-BG', 'en-GB')}`)).toBe(true);
  });

  it('switching to the course already chosen does nothing', async () => {
    const app = await launch();
    await openSettings(app);
    const before = app.api.requests.length;
    await app.tap(/Spanish/, { within: screen.getByLabelText(app.c.settings.course) });
    expect(app.api.requests.length).toBe(before);
    expect(app.sees(app.c.settings.switched('Spanish', false))).toBe(false);
  });

  it('a course that cannot be downloaded is not chosen, and says why', async () => {
    const app = await launch();
    await openSettings(app);
    app.api.failNext('GET /library/pack', problem(503, 'UNAVAILABLE'));
    await app.tap(/Bulgarian/, { within: screen.getByLabelText(app.c.settings.course) });
    expect(app.sees(app.c.settings.courseUnavailable('Bulgarian'))).toBe(true);
    expect((await app.saved()).learner.profile.targetLang).toBe('es-ES');
  });

  it('switching back to a course already on the phone takes effect at once, with no download to wait for', async () => {
    const app = await launch();
    await openSettings(app);
    await app.tap(/Bulgarian/, { within: screen.getByLabelText(app.c.settings.course) });
    await app.settle();
    await app.tap(/Spanish/, { within: screen.getByLabelText(app.c.settings.course) });
    expect(app.sees(app.c.settings.switched('Spanish', false))).toBe(true);
    expect(app.sees(app.c.settings.courseUnavailable('Spanish'))).toBe(false);
    expect((await app.saved()).learner.profile.targetLang).toBe('es-ES');
  });

  it('says the queue was cleared when a course is switched with phrases queued', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.set.playAll('Café & Mañanas'));
    await app.advance(SECOND);
    await app.open('/');
    await openSettings(app);
    await app.tap(/Bulgarian/, { within: screen.getByLabelText(app.c.settings.course) });
    expect(app.sees(app.c.settings.switched('Bulgarian', true))).toBe(true);
    expect((await app.saved()).player.order).toEqual([]);
  });
});

describe('Settings: the UI language', () => {
  it('changes every line of the app to the chosen UI language, and saves it', async () => {
    const app = await launch();
    await openSettings(app);
    await app.tap(/Български/, { within: screen.getByLabelText(app.c.settings.native) });
    const bg = copy('bg-BG');
    expect(app.sees(bg.settings.title)).toBe(true);
    expect(app.sees(bg.settings.profile)).toBe(true);
    expect((await app.saved()).learner.profile.nativeLang).toBe('bg-BG');
  });

  it('keeps the UI language after a restart', async () => {
    const app = await launch();
    await openSettings(app);
    await app.tap(/Български/, { within: screen.getByLabelText(app.c.settings.native) });
    await app.settle();
    const again = await app.restart();
    await again.waitFor(copy('bg-BG').tabs.home);
    expect(again.sees(copy('bg-BG').tabs.library)).toBe(true);
  });
});

describe('Settings: the name', () => {
  it('saves the name when the field loses focus, and the avatar shows it', async () => {
    const app = await launch();
    await openSettings(app);
    await app.type(app.c.settings.name, 'Ben');
    await act(async () => {
      fireEvent(screen.getByLabelText(app.c.settings.name), 'blur');
    });
    await app.settle();
    expect((await app.saved()).learner.profile.name).toBe('Ben');
    await app.tap(app.c.common.close);
    expect(app.sees(app.c.nav.settings('Ben'))).toBe(true);
  });

  it('saves a name typed with spaces around it, without them', async () => {
    const app = await launch();
    await openSettings(app);
    await app.type(app.c.settings.name, '  Ben  ');
    await act(async () => {
      fireEvent(screen.getByLabelText(app.c.settings.name), 'blur');
    });
    await app.settle();
    expect((await app.saved()).learner.profile.name).toBe('Ben');
  });

  it('keeps the name after a restart', async () => {
    const app = await launch();
    await openSettings(app);
    await app.type(app.c.settings.name, 'Ben');
    await act(async () => {
      fireEvent(screen.getByLabelText(app.c.settings.name), 'blur');
    });
    await app.settle();
    const again = await app.restart();
    await again.waitFor(again.c.tabs.home);
    expect(again.sees(again.c.nav.settings('Ben'))).toBe(true);
  });
});

describe('Settings: listening', () => {
  it('chooses a longer pause to say the phrase in, and saves it', async () => {
    const app = await launch();
    await openSettings(app);
    expect(checked(app.c.settings.pause.standard)).toBe(true);
    await app.tap(app.c.settings.pause.longer);
    expect(checked(app.c.settings.pause.longer)).toBe(true);
    expect((await app.saved()).prefs.pauseLength).toBe('longer');
  });

  it('the longer pause is kept after a restart', async () => {
    const app = await launch();
    await openSettings(app);
    await app.tap(app.c.settings.pause.longer);
    await app.settle();
    const again = await app.restart();
    await again.waitFor(again.c.tabs.home);
    await openSettings(again);
    expect(checked(again.c.settings.pause.longer)).toBe(true);
  });

  it('goes back to the standard pause', async () => {
    const app = await launch({ learner: { prefs: { pauseLength: 'longer' } } });
    await openSettings(app);
    await app.tap(app.c.settings.pause.standard);
    expect(checked(app.c.settings.pause.standard)).toBe(true);
    expect((await app.saved()).prefs.pauseLength).toBe('standard');
  });
});

describe('Settings: screen reader', () => {
  it('turns on announcing every step, and saves it', async () => {
    const app = await launch();
    await openSettings(app);
    await flip(app, app.c.settings.announceEveryStep, true);
    expect((await app.saved()).prefs.announceEveryStep).toBe(true);
  });

  it('keeps announcing every step after a restart, and turns it off again', async () => {
    const app = await launch();
    await openSettings(app);
    await flip(app, app.c.settings.announceEveryStep, true);
    await app.settle();
    const again = await app.restart();
    await again.waitFor(again.c.tabs.home);
    await openSettings(again);
    expect(screen.getByLabelText(again.c.settings.announceEveryStep).props.value).toBe(true);
    await flip(again, again.c.settings.announceEveryStep, false);
    expect((await again.saved()).prefs.announceEveryStep).toBe(false);
  });
});

describe('Settings: privacy', () => {
  beforeEach(() => {
    delete (globalThis as any).__e2eSharing;
  });

  it('shows usage sharing on, as the learner has not turned it off', async () => {
    const app = await launch();
    await openSettings(app);
    expect(screen.getByLabelText(app.c.settings.shareUsage).props.value).toBe(true);
  });

  it('turns usage sharing off and on, and the choice is kept after a restart', async () => {
    const app = await launch();
    await openSettings(app);
    expect(screen.getByLabelText(app.c.settings.shareUsage).props.value).toBe(true);
    await flip(app, app.c.settings.shareUsage, false);
    expect(sharing().calls).toEqual([false]);
    const again = await app.restart();
    await again.waitFor(again.c.tabs.home);
    await openSettings(again);
    expect(screen.getByLabelText(again.c.settings.shareUsage).props.value).toBe(false);
    await flip(again, again.c.settings.shareUsage, true);
    expect(sharing().calls).toEqual([false, true]);
  });
});

describe('Settings: what is not in this sheet', () => {
  it.todo('resets progress behind a confirmation: no control in Settings offers it (the copy c.error.reset is unused)');
  it.todo('exports the phrases and progress as JSON through the share sheet: no control offers it (the copy c.error.copy is unused)');
});
