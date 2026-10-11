// The account: signing in and out, the profile, today's allowances and deleting (F-01, F-07, LIB-02).
//
// Covers:
// - Reaching /account: Settings' account row (signed out: "Sign in"; signed in: who is signed in).
// - Signing in by email: the sign-in page (Email me a code disabled while the field is empty), a
//   malformed email refused without asking the server, the code step (six digits sign in at once;
//   fewer leave Sign in disabled), a wrong code refused with its message and the Sign in button
//   trying again, "Send a new code", "Use another email", the server refusing (too many tries,
//   unreachable); success (toast, closes, the refresh token kept in the secret store, the account
//   saved); "Not now" and the close button; the emailed code is masked from replay (not asserted).
// - Google and Apple: success as the provider's page returns, the page closed (nothing changes), the
//   server refusing the address (422), the buttons hidden when the server doesn't offer them, and
//   "Signing in by email isn't set up" when email is off.
// - Signed in: the account label (email, or the provider), the sync note, the display name (starts
//   from the saved one, Save disabled while empty or unchanged, saved from the button or the keyboard
//   and trimmed, refused when too long), today's allowances (shown before asking, remaining counts,
//   reset time, what is kept, who writes, a kind an older server doesn't count left out).
// - Signing out: the toast, the sign-in page back, progress saved to the account first (before the
//   logout), progress on the device kept, the account's own sets leaving the course, the push token
//   forgotten, the session secrets removed.
// - Deleting: "Delete my Loro data" and "Delete my account" with their confirm dialogs (Cancel does
//   nothing), the calls, signed out after, the device's progress kept, a failed delete shown.
// - Sessions the server ends (refresh token unknown: signed out, local progress kept), an access token
//   the server no longer knows or that has expired (renewed silently, the action succeeds), a refresh
//   refused as the network is down (stays signed in).
// - Signing in from here keeps the device's progress and syncs it into the account.
//
// - Pulling the page down by its top: far closes it, a short pull springs back.
//
// Not covered: the web-only return from a provider's page with a ticket in the address (Platform.OS
// is ios here).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIXTURE } from '@shared/content/fixture';
import { sanitizeLearner } from '@shared/state/persistence';
import { memoryKey } from '@shared/state/memory';
import type { AppState, LogEntry } from '@shared/state/types';
import { FakeApi, json, problem } from '../fakes/api';
import { lib, seedSet } from '../fakes/library';
import { act, device, fireEvent, HOUR, launch, MINUTE, screen, T0, visibleText, type App } from '../harness';

const EMAIL = 'ana@loro.test';
const CAFE = FIXTURE.sets.find((s) => s.id === 'set-cafe')!.phraseIds;
const OWN_SET = 'Mi lista de prueba';

/** Whether the button called `label` is shown disabled. */
function disabled(label: string): boolean {
  return screen.queryByRole('button', { name: label, disabled: true }) !== null;
}

/** Presses the button called `label` (not a heading with the same words). */
async function press(app: App, label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: label }));
  });
  await app.settle();
}

/** The routes the app called, as "METHOD /path", in order. */
function routes(api: FakeApi): string[] {
  return api.requests.map((r) => `${r.method} ${r.path.split('?')[0]}`);
}

/** Saved state with a heard-and-rated log, so the device holds progress the account hasn't seen. */
function withRatings(phraseIds: string[]) {
  return (state: AppState): AppState => {
    const entries: LogEntry[] = phraseIds.flatMap((phraseId, i) => {
      const base = { device: 'e2edevice', key: memoryKey('en-GB', 'es-ES', phraseId), phraseId, setId: 'set-cafe' };
      return [{ ...base, id: `seed-acc-${phraseId}`, at: T0 - HOUR + i, kind: 'rated' as const, grade: 'easy' as const }];
    });
    return { ...state, learner: { ...state.learner, log: [...state.learner.log, ...entries] } };
  };
}

/** The rated phrases the account holds for `userId`. */
function ratedInAccount(api: FakeApi, userId: string): string[] {
  const stored = api.progress.get(userId)?.progress;
  if (!stored) return [];
  return sanitizeLearner(stored).log.flatMap((e) => (e.kind === 'rated' ? [e.phraseId] : []));
}

/** Types an email on the sign-in page and asks for the code. */
async function askForCode(app: App, email = EMAIL): Promise<void> {
  await app.type(app.c.account.emailPlaceholder, email);
  await app.tap(app.c.account.sendCode);
}

/** Moves the clock on in one jump, then lets what it started finish (the rating window). */
async function jump(app: App, ms: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await app.settle();
}

describe('reaching the account', () => {
  it('opens from Settings: signed out it says Sign in, and leads to the sign-in page', async () => {
    const app = await launch();
    await app.tap(app.c.nav.settings('Ana'));
    await app.tap(app.c.account.signIn);
    expect(app.pathname()).toBe('/account');
    expect(app.sees(app.c.account.signInTitle)).toBe(true);
  });

  it('opens from Settings: signed in it names who is signed in, and leads to the account', async () => {
    const app = await launch({ signedIn: EMAIL });
    await app.tap(app.c.nav.settings('Ana'));
    await app.tap(app.c.account.signedInAs(EMAIL));
    expect(app.pathname()).toBe('/account');
    expect(app.sees(app.c.account.title)).toBe(true);
    expect(app.sees(app.c.account.signOut)).toBe(true);
  });
});

describe('signing in by email', () => {
  it('shows the sign-in page, with Email me a code disabled until an email is typed', async () => {
    const app = await launch({ url: '/account' });
    expect(app.sees(app.c.account.signInTitle)).toBe(true);
    expect(app.sees(app.c.account.signInBody)).toBe(true);
    expect(app.sees(app.c.account.signedInAs(EMAIL))).toBe(false);
    expect(disabled(app.c.account.sendCode)).toBe(true);
    await app.type(app.c.account.emailPlaceholder, EMAIL);
    expect(disabled(app.c.account.sendCode)).toBe(false);
  });

  it('refuses a malformed email without asking the server', async () => {
    const app = await launch({ url: '/account' });
    await askForCode(app, 'not an email');
    expect(app.sees(app.c.account.errors.badEmail)).toBe(true);
    expect(app.api.calls('POST /auth/magic-link')).toEqual([]);
    expect(app.sees(app.c.account.codeTitle)).toBe(false);
  });

  it('sends the code, trimming and lower-casing the email, and shows where it went', async () => {
    const app = await launch({ url: '/account' });
    await askForCode(app, '  Ana@Loro.Test ');
    expect(app.sees(app.c.account.codeTitle)).toBe(true);
    expect(app.sees(app.c.account.codeBody('Ana@Loro.Test'))).toBe(true);
    expect(app.api.calls('POST /auth/magic-link')[0].body).toEqual({ email: 'ana@loro.test' });
    expect(app.api.mail).toHaveLength(1);
  });

  it('keeps Sign in disabled until six digits are typed, ignoring anything but digits', async () => {
    const app = await launch({ url: '/account' });
    await askForCode(app);
    expect(disabled(app.c.account.verify)).toBe(true);
    await app.type('000000', '12a3-45');
    expect(screen.getByDisplayValue('12345')).toBeTruthy();
    expect(disabled(app.c.account.verify)).toBe(true);
    expect(app.api.calls('POST /auth/magic-link/verify')).toEqual([]);
  });

  it('signs in as soon as the sixth digit is typed: welcome, closed, session kept', async () => {
    const app = await launch({ url: '/' });
    await app.open('/account');
    await askForCode(app);
    const code = app.api.codeFor(EMAIL);
    await app.type('000000', code);
    await app.advance(1_000);
    expect(app.sees(app.c.account.welcome)).toBe(true);
    expect(app.pathname()).toBe('/');
    const verify = app.api.calls('POST /auth/magic-link/verify');
    expect(verify).toHaveLength(1);
    expect(verify[0].body).toMatchObject({ email: EMAIL, code });
    // The refresh token is in the secret store and the account on the phone.
    expect(device.secure.get('loro.refresh')).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem('loro.account'))!)).toMatchObject({ email: EMAIL, provider: 'email' });
    await app.tap(app.c.nav.settings('Ana'));
    expect(app.sees(app.c.account.signedInAs(EMAIL))).toBe(true);
  });

  it('goes Home after signing in when the sign-in page was the first screen', async () => {
    const app = await launch({ url: '/account' });
    await askForCode(app);
    await app.type('000000', app.api.codeFor(EMAIL));
    await app.advance(1_000);
    // No screen to go back to.
    expect(app.pathname()).toBe('/');
  });

  it('refuses a wrong code with its message, then Sign in tries the same six digits again', async () => {
    const app = await launch({ url: '/account' });
    await askForCode(app);
    const right = app.api.codeFor(EMAIL);
    const wrong = right === '111111' ? '222222' : '111111';
    await app.type('000000', wrong);
    await app.advance(500);
    expect(app.sees(app.c.account.errors.badCode)).toBe(true);
    expect(app.pathname()).toBe('/account');
    expect(device.secure.get('loro.refresh')).toBeUndefined();
    // The button is enabled again with six digits in the field, and asks again.
    expect(disabled(app.c.account.verify)).toBe(false);
    await press(app, app.c.account.verify);
    expect(app.api.calls('POST /auth/magic-link/verify')).toHaveLength(2);
    expect(app.sees(app.c.account.errors.badCode)).toBe(true);
    // The right code then signs in.
    await app.type('000000', right);
    await app.advance(1_000);
    expect(app.sees(app.c.account.welcome)).toBe(true);
    expect(device.secure.get('loro.refresh')).toBeTruthy();
  });

  it('sends a new code on request, and the newest is the one that works', async () => {
    const app = await launch({ url: '/account' });
    await askForCode(app);
    await app.tap(app.c.account.resend);
    expect(app.api.mail).toHaveLength(2);
    expect(app.sees(app.c.account.codeTitle)).toBe(true);
    await app.type('000000', app.api.codeFor(EMAIL));
    await app.advance(1_000);
    expect(app.sees(app.c.account.welcome)).toBe(true);
  });

  it('goes back to the email field with "Use another email" and sends to the new one', async () => {
    const app = await launch({ url: '/account' });
    await askForCode(app);
    await app.tap(app.c.account.changeEmail);
    expect(app.sees(app.c.account.signInTitle)).toBe(true);
    expect(app.sees(app.c.account.codeTitle)).toBe(false);
    await askForCode(app, 'ben@loro.test');
    expect(app.sees(app.c.account.codeBody('ben@loro.test'))).toBe(true);
    expect(app.api.mail.map((m) => m.email)).toEqual([EMAIL, 'ben@loro.test']);
  });

  it('sends the code from the keyboard too', async () => {
    const app = await launch({ url: '/account' });
    await app.type(app.c.account.emailPlaceholder, EMAIL);
    await app.submit(app.c.account.emailPlaceholder);
    expect(app.sees(app.c.account.codeTitle)).toBe(true);
  });

  it('says so when the server refuses too many tries', async () => {
    const app = await launch({ url: '/account' });
    app.api.failNext('POST /auth/magic-link', problem(429, 'RATE_LIMITED'));
    await askForCode(app);
    expect(app.sees(app.c.account.errors.tooMany)).toBe(true);
    expect(app.sees(app.c.account.codeTitle)).toBe(false);
  });

  it('says so when the server can’t be reached', async () => {
    const app = await launch({ url: '/account' });
    await app.type(app.c.account.emailPlaceholder, EMAIL);
    app.api.offline = true;
    await app.tap(app.c.account.sendCode);
    await app.advance(10_000);
    expect(app.sees(app.c.account.errors.offline)).toBe(true);
    expect(app.sees(app.c.account.codeTitle)).toBe(false);
  });

  it('says the server is refusing when email sign-in isn’t set up, and Email me a code stays disabled', async () => {
    const api = new FakeApi();
    api.capabilities.email = false;
    const app = await launch({ api, url: '/account' });
    expect(app.sees(app.c.account.errors.unavailable)).toBe(true);
    await app.type(app.c.account.emailPlaceholder, EMAIL);
    expect(disabled(app.c.account.sendCode)).toBe(true);
    await app.tap(app.c.account.sendCode);
    expect(app.api.calls('POST /auth/magic-link')).toEqual([]);
  });

  it('closes with Not now, back to Home when nothing is behind it', async () => {
    const app = await launch({ url: '/account' });
    await app.tap(app.c.account.notNow);
    expect(app.pathname()).toBe('/');
    expect(app.sees(app.c.account.signInTitle)).toBe(false);
  });

  it('closes with the close button, back to where it was opened from', async () => {
    const app = await launch({ url: '/library' });
    await app.open('/account');
    expect(app.pathname()).toBe('/account');
    await app.tap(app.c.common.close);
    expect(app.pathname()).toBe('/library');
  });
});

describe('pulling the page down', () => {
  it('closes the sign-in page when pulled far down by its top, back to where it was opened from', async () => {
    const app = await launch({ url: '/library' });
    await app.open('/account');
    await app.swipe(app.c.common.close, { dy: 400 });
    await app.advance(1_000);
    expect(app.pathname()).toBe('/library');
  });

  it('closes the signed-in account the same way, by its title', async () => {
    const app = await launch({ url: '/library', signedIn: EMAIL });
    await app.open('/account');
    await app.swipe(app.c.account.title, { dy: 400 });
    await app.advance(1_000);
    expect(app.pathname()).toBe('/library');
  });

  it('springs back from a short pull and stays open', async () => {
    const app = await launch({ url: '/library' });
    await app.open('/account');
    // The test layout gives the window a 64-point height, so it closes past 16 points.
    await app.swipe(app.c.common.close, { dy: 8 });
    await app.advance(1_000);
    expect(app.pathname()).toBe('/account');
    expect(app.sees(app.c.account.signInTitle)).toBe(true);
  });
});

describe('signing in with Google or Apple', () => {
  it('offers both, and signs in with Google as the provider’s page returns', async () => {
    const app = await launch({ url: '/account' });
    expect(app.sees(app.c.account.google)).toBe(true);
    expect(app.sees(app.c.account.apple)).toBe(true);
    device.authSession.email = 'gina@gmail.test';
    await app.tap(app.c.account.google);
    await app.advance(1_000);
    expect(device.authPages).toHaveLength(1);
    expect(device.authPages[0]).toContain('accounts.google.test');
    expect(app.sees(app.c.account.welcome)).toBe(true);
    expect(app.pathname()).toBe('/');
    expect(app.api.userByEmail('gina@gmail.test')).toMatchObject({ provider: 'google' });
    expect(JSON.parse((await AsyncStorage.getItem('loro.account'))!)).toMatchObject({ email: null, provider: 'google' });
  });

  it('signs in with Apple, and the account then says it is signed in with Apple', async () => {
    const app = await launch({ url: '/account' });
    device.authSession.email = 'abel@icloud.test';
    await app.tap(app.c.account.apple);
    await app.advance(1_000);
    expect(device.authPages[0]).toContain('accounts.apple.test');
    await app.open('/account');
    expect(app.sees(app.c.account.signedInWith('Apple'))).toBe(true);
  });

  it('puts Apple first on an iPhone', async () => {
    const app = await launch({ url: '/account' });
    const shown = visibleText();
    expect(shown.indexOf(app.c.account.apple)).toBeGreaterThanOrEqual(0);
    expect(shown.indexOf(app.c.account.apple)).toBeLessThan(shown.indexOf(app.c.account.google));
  });

  it('does nothing when the provider’s page is closed', async () => {
    const app = await launch({ url: '/account' });
    device.authSession.email = null;
    await app.tap(app.c.account.google);
    await app.advance(1_000);
    expect(app.pathname()).toBe('/account');
    expect(app.sees(app.c.account.signInTitle)).toBe(true);
    expect(app.sees(app.c.account.welcome)).toBe(false);
    expect(app.api.calls('POST /auth/exchange')).toEqual([]);
    expect(device.secure.get('loro.refresh')).toBeUndefined();
    // And the buttons work again afterwards.
    device.authSession.email = 'gina@gmail.test';
    await app.tap(app.c.account.google);
    await app.advance(1_000);
    expect(app.sees(app.c.account.welcome)).toBe(true);
  });

  it('says the provider isn’t set up for this address when the server refuses it', async () => {
    const app = await launch({ url: '/account' });
    app.api.failNext('POST /auth/apple/start', problem(422, 'VALIDATION'));
    await app.tap(app.c.account.apple);
    await app.advance(500);
    expect(app.sees(app.c.account.errors.providerUnavailable('Apple'))).toBe(true);
    expect(device.authPages).toEqual([]);
  });

  it.each([
    ['google', 'apple'],
    ['apple', 'google'],
  ] as const)('hides %s when the server doesn’t offer it', async (hidden, shown) => {
    const api = new FakeApi();
    api.capabilities[hidden] = false;
    const app = await launch({ api, url: '/account' });
    expect(app.sees(app.c.account[hidden])).toBe(false);
    expect(app.sees(app.c.account[shown])).toBe(true);
  });

  it('shows no provider buttons when the server offers neither, and email still works', async () => {
    const api = new FakeApi();
    api.capabilities.google = false;
    api.capabilities.apple = false;
    const app = await launch({ api, url: '/account' });
    expect(app.sees(app.c.account.google)).toBe(false);
    expect(app.sees(app.c.account.apple)).toBe(false);
    await askForCode(app);
    expect(app.sees(app.c.account.codeTitle)).toBe(true);
  });

  it('shows no provider buttons on the code step', async () => {
    const app = await launch({ url: '/account' });
    await askForCode(app);
    expect(app.sees(app.c.account.google)).toBe(false);
    expect(app.sees(app.c.account.notNow)).toBe(false);
  });
});

describe('the signed-in account', () => {
  it('shows the title, who is signed in and the sign-out and delete actions', async () => {
    const app = await launch({ url: '/account', signedIn: EMAIL });
    expect(app.sees(app.c.account.title)).toBe(true);
    expect(app.sees(app.c.account.signedInAs(EMAIL))).toBe(true);
    for (const label of [app.c.account.signOut, app.c.account.deleteData, app.c.account.deleteAccount]) expect(app.sees(label)).toBe(true);
    expect(app.sees(app.c.account.signInTitle)).toBe(false);
  });

  it('says the progress is kept in the account once it has been saved there', async () => {
    const app = await launch({ url: '/account', signedIn: EMAIL });
    await app.waitFor(app.c.account.synced);
    expect(app.api.calls('POST /library/progress')).toHaveLength(1);
  });

  it('says the progress is safe on the device when saving it to the account failed', async () => {
    const api = new FakeApi();
    api.failNext('POST /library/progress', problem(500, 'INTERNAL'));
    const app = await launch({ api, url: '/account', signedIn: EMAIL });
    await app.waitFor(app.c.account.syncFailed);
    expect(app.sees(app.c.account.synced)).toBe(false);
  });

  it('closes with the close button', async () => {
    const app = await launch({ url: '/library', signedIn: EMAIL });
    await app.open('/account');
    await app.tap(app.c.common.close);
    expect(app.pathname()).toBe('/library');
  });
});

describe('the display name', () => {
  it('starts from the name the account has', async () => {
    const api = new FakeApi();
    api.addUser(EMAIL, 'Ana M');
    const app = await launch({ api, url: '/account', signedIn: EMAIL });
    expect(screen.getByDisplayValue('Ana M')).toBeTruthy();
    expect(app.sees(app.c.account.displayNameHint)).toBe(true);
  });

  it('keeps Save disabled while the name is empty or unchanged', async () => {
    const api = new FakeApi();
    api.addUser(EMAIL, 'Ana M');
    const app = await launch({ api, url: '/account', signedIn: EMAIL });
    expect(disabled(app.c.common.save)).toBe(true);
    await app.type(app.c.account.displayName, '   ');
    expect(disabled(app.c.common.save)).toBe(true);
    await app.type(app.c.account.displayName, 'Ana Marta');
    expect(disabled(app.c.common.save)).toBe(false);
    await app.type(app.c.account.displayName, 'Ana M');
    expect(disabled(app.c.common.save)).toBe(true);
    expect(app.api.calls('POST /library/profile')).toEqual([]);
  });

  it('saves a new name, trimmed, with a toast, and Save is disabled again', async () => {
    const app = await launch({ url: '/account', signedIn: EMAIL });
    await app.type(app.c.account.displayName, '  Ana Marta ');
    await app.tap(app.c.common.save);
    expect(app.sees(app.c.account.displayNameSaved)).toBe(true);
    expect(app.api.calls('POST /library/profile').map((r) => r.body)).toEqual([{ displayName: 'Ana Marta' }]);
    expect(app.api.userByEmail(EMAIL)?.displayName).toBe('Ana Marta');
    expect(disabled(app.c.common.save)).toBe(true);
    expect(JSON.parse((await AsyncStorage.getItem('loro.account'))!).displayName).toBe('Ana Marta');
  });

  it('saves from the keyboard’s Done too', async () => {
    const app = await launch({ url: '/account', signedIn: EMAIL });
    await app.type(app.c.account.displayName, 'Marta');
    await app.submit(app.c.account.displayName);
    expect(app.sees(app.c.account.displayNameSaved)).toBe(true);
    expect(app.api.calls('POST /library/profile')).toHaveLength(1);
  });

  it('keeps the saved name when the app starts again', async () => {
    const app = await launch({ url: '/account', signedIn: EMAIL });
    await app.type(app.c.account.displayName, 'Marta');
    await app.tap(app.c.common.save);
    const again = await app.restart({ url: '/account' });
    await again.waitFor(again.c.account.signedInAs(EMAIL));
    expect(screen.getByDisplayValue('Marta')).toBeTruthy();
  });

  it('refuses a name that is too long, shows why, and keeps the old one', async () => {
    const api = new FakeApi();
    api.addUser(EMAIL, 'Ana M');
    const app = await launch({ api, url: '/account', signedIn: EMAIL });
    await app.type(app.c.account.displayName, 'x'.repeat(41));
    await app.tap(app.c.common.save);
    expect(app.sees(app.c.account.errors.invalid)).toBe(true);
    expect(app.sees(app.c.account.displayNameSaved)).toBe(false);
    expect(app.api.userByEmail(EMAIL)?.displayName).toBe('Ana M');
    expect(JSON.parse((await AsyncStorage.getItem('loro.account'))!).displayName).toBe('Ana M');
  });

  it('says it couldn’t save when the server can’t be reached', async () => {
    const app = await launch({ url: '/account', signedIn: EMAIL });
    await app.type(app.c.account.displayName, 'Marta');
    app.api.offline = true;
    await app.tap(app.c.common.save);
    expect(app.sees(app.c.account.errors.offline)).toBe(true);
    expect(app.sees(app.c.account.displayNameSaved)).toBe(false);
    // Save is available again to try once more.
    expect(disabled(app.c.common.save)).toBe(false);
  });
});

describe('today’s allowances (LIB-02)', () => {
  it('shows each allowance with its limit, before the learner asks for anything', async () => {
    const app = await launch({ url: '/account', signedIn: EMAIL });
    await app.waitFor(app.c.account.today);
    const { limits } = app.api;
    expect(app.sees(app.c.account.usage.phrases(limits.phrases, limits.phrases))).toBe(true);
    expect(app.sees(app.c.account.usage.cover(limits.cover, limits.cover))).toBe(true);
    expect(app.sees(app.c.account.usage.song(limits.song, limits.song))).toBe(true);
    expect(app.sees(app.c.account.usage.lyrics(limits.lyrics, limits.lyrics))).toBe(true);
    expect(app.api.calls('GET /library/usage').length).toBeGreaterThan(0);
  });

  it('counts what was spent today', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    api.spend(user.id, 'song', 2);
    api.spend(user.id, 'phrases', 1);
    api.spend(user.id, 'cover', 4);
    const app = await launch({ api, url: '/account', signedIn: EMAIL });
    await app.waitFor(app.c.account.today);
    expect(app.sees(app.c.account.usage.song(3, 5))).toBe(true);
    expect(app.sees(app.c.account.usage.phrases(29, 30))).toBe(true);
    expect(app.sees(app.c.account.usage.cover(6, 10))).toBe(true);
    expect(app.sees(app.c.account.usage.lyrics(20, 20))).toBe(true);
  });

  it('shows zero left, not a negative, when an allowance is used up', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    api.limits.song = 2;
    api.spend(user.id, 'song', 2);
    const app = await launch({ api, url: '/account', signedIn: EMAIL });
    await app.waitFor(app.c.account.usage.song(0, 2));
  });

  it('shows the limits the server has, not fixed ones', async () => {
    const api = new FakeApi();
    api.limits.song = 9;
    const app = await launch({ api, url: '/account', signedIn: EMAIL });
    await app.waitFor(app.c.account.usage.song(9, 9));
  });

  it('says when the allowances reset, and what the account keeps', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    seedSet(api, user, { title: OWN_SET, phrases: [{ target: 'Hola', native: 'Hello' }] });
    seedSet(api, user, { title: 'Otra', phrases: [{ target: 'Adiós', native: 'Goodbye' }] });
    const app = await launch({ api, url: '/account', signedIn: EMAIL });
    await app.waitFor(app.c.account.today);
    expect(app.sees(app.c.account.kept(2, 0))).toBe(true);
    expect(screen.queryAllByText(/^Resets at /)).toHaveLength(1);
  });

  it('says who writes each kind on this server', async () => {
    const app = await launch({ url: '/account', signedIn: EMAIL });
    await app.waitFor(app.c.account.writers);
    for (const kind of ['phrases', 'cover', 'lyrics', 'music'] as const) expect(app.sees(app.c.account.writerKind[kind])).toBe(true);
    expect(screen.getAllByText(app.c.account.writer.ai)).toHaveLength(3);
    expect(app.sees(app.c.account.writer.demo)).toBe(true);
  });

  it('says so when the server has no AI writer', async () => {
    const api = new FakeApi();
    lib(api).config.ai = false;
    const app = await launch({ api, url: '/account', signedIn: EMAIL });
    await app.waitFor(app.c.account.writers);
    expect(app.sees(app.c.account.writer.bank)).toBe(true);
    expect(app.sees(app.c.account.writer.pattern)).toBe(true);
    expect(app.sees(app.c.account.writer.phrases)).toBe(true);
    expect(app.sees(app.c.account.writer.ai)).toBe(false);
  });

  it('leaves out a kind an older server doesn’t count', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    // The usage as an older server answers it: no lyrics.
    // (Asked for more than once as the screen opens, so the reply is queued for each.)
    const olderServer = json({
        day: '2026-09-01',
        resetsAt: T0 + 15 * HOUR,
        daily: { phrases: { used: 0, limit: 30 }, cover: { used: 0, limit: 10 }, song: { used: 0, limit: 5 } },
        kept: { sets: { used: 0, limit: 100 }, albums: { used: 0, limit: 30 }, songs: { used: 0, limit: 120 } },
        writers: { phrases: 'ai', cover: 'ai', lyrics: 'ai', music: 'demo' },
    });
    for (let i = 0; i < 5; i++) api.failNext('GET /library/usage', olderServer);
    const app = await launch({ api, url: '/account', signedIn: EMAIL });
    await app.waitFor(app.c.account.today);
    expect(app.sees(app.c.account.usage.song(5, 5))).toBe(true);
    expect(screen.queryAllByText(/^Lyrics: /)).toHaveLength(0);
    expect(user.email).toBe(EMAIL);
  });

  it('shows no allowances while the server can’t be asked', async () => {
    const api = new FakeApi();
    for (let i = 0; i < 5; i++) api.failNext('GET /library/usage', problem(500, 'INTERNAL'));
    const app = await launch({ api, url: '/account', signedIn: EMAIL });
    expect(app.sees(app.c.account.signedInAs(EMAIL))).toBe(true);
    expect(app.sees(app.c.account.today)).toBe(false);
  });
});

describe('signing out', () => {
  it('shows the toast and the sign-in page, and forgets the session on the device', async () => {
    const app = await launch({ url: '/account', signedIn: EMAIL });
    expect(device.secure.get('loro.refresh')).toBeTruthy();
    await app.tap(app.c.account.signOut);
    expect(app.sees(app.c.account.signedOut)).toBe(true);
    expect(app.sees(app.c.account.signInTitle)).toBe(true);
    expect(app.sees(app.c.account.signedInAs(EMAIL))).toBe(false);
    expect(app.sees(app.c.account.today)).toBe(false);
    expect(device.secure.get('loro.refresh')).toBeUndefined();
    expect(await AsyncStorage.getItem('loro.account')).toBeNull();
    // The server ended the session too.
    expect(app.api.calls('POST /auth/logout')).toHaveLength(1);
    expect(app.api.refresh.size).toBe(0);
  });

  it('saves the progress to the account before ending the session, and keeps it on the device', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    // The first save at launch fails, so the learner’s ratings are still only on the phone.
    api.failNext('POST /library/progress', problem(500, 'INTERNAL'));
    const app = await launch({ api, url: '/account', signedIn: EMAIL, learner: { edit: withRatings(CAFE.slice(0, 2)) } });
    await app.waitFor(app.c.account.syncFailed);
    expect(ratedInAccount(api, user.id)).toEqual([]);
    await app.tap(app.c.account.signOut);
    expect(ratedInAccount(api, user.id)).toEqual(CAFE.slice(0, 2));
    const order = routes(api);
    expect(order.lastIndexOf('POST /library/progress')).toBeLessThan(order.indexOf('POST /auth/logout'));
    // Nothing the learner did is lost on this device.
    const saved = await app.saved();
    expect(saved.learner.log.filter((e) => e.kind === 'rated').map((e) => (e as { phraseId: string }).phraseId)).toEqual(CAFE.slice(0, 2));
  });

  it('still signs out when the server can’t be reached', async () => {
    const app = await launch({ url: '/account', signedIn: EMAIL });
    app.api.offline = true;
    await app.tap(app.c.account.signOut);
    expect(app.sees(app.c.account.signInTitle)).toBe(true);
    expect(device.secure.get('loro.refresh')).toBeUndefined();
    expect(app.sees(app.c.account.signedOut)).toBe(true);
  });

  it('takes the sets the account made out of the course', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    seedSet(api, user, { title: OWN_SET, phrases: [{ target: 'Hola', native: 'Hello' }] });
    const app = await launch({ api, url: '/library?view=ownSets', signedIn: EMAIL });
    await app.waitFor(OWN_SET);
    expect(app.sees(app.c.common.sets(2))).toBe(true);
    await app.open('/account');
    await app.tap(app.c.account.signOut);
    await app.open('/library?view=ownSets');
    await app.advance(1_000);
    expect(app.sees(OWN_SET)).toBe(false);
    // Only the always-there "Liked phrases" row is left in My sets.
    expect(app.sees(app.c.common.sets(1))).toBe(true);
  });

  it('takes this device’s push token back from the server', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    const token = 'ExponentPushToken[abcdefgh1234]';
    lib(api).pushTokens.set(token, { userId: user.id, lang: 'en', platform: 'ios' });
    const app = await launch({ api, url: '/account', signedIn: EMAIL });
    // What registering after a song request leaves on the phone.
    await AsyncStorage.setItem('loro.push.token', token);
    await app.tap(app.c.account.signOut);
    expect(api.calls(`DELETE /library/push-tokens/${encodeURIComponent(token)}`)).toHaveLength(1);
    expect(lib(api).pushTokens.has(token)).toBe(false);
    expect(await AsyncStorage.getItem('loro.push.token')).toBeNull();
    const order = routes(api);
    expect(order.findIndex((r) => r.startsWith('DELETE /library/push-tokens'))).toBeLessThan(order.indexOf('POST /auth/logout'));
  });

  it('asks for no push token when none was registered', async () => {
    const app = await launch({ url: '/account', signedIn: EMAIL });
    await app.tap(app.c.account.signOut);
    expect(routes(app.api).some((r) => r.startsWith('DELETE /library/push-tokens'))).toBe(false);
  });

  it('can sign in again afterwards, as the same account', async () => {
    const app = await launch({ url: '/account', signedIn: EMAIL });
    await app.tap(app.c.account.signOut);
    await askForCode(app);
    await app.type('000000', app.api.codeFor(EMAIL));
    await app.advance(1_000);
    expect(app.sees(app.c.account.welcome)).toBe(true);
    await app.open('/account');
    expect(app.sees(app.c.account.signedInAs(EMAIL))).toBe(true);
  });
});

describe('deleting', () => {
  it('asks before deleting the Loro data, and Cancel does nothing', async () => {
    const app = await launch({ url: '/account', signedIn: EMAIL });
    await app.tap(app.c.account.deleteData);
    expect(device.dialogs).toHaveLength(1);
    expect(device.dialogs[0].message).toBe(app.c.account.deleteDataConfirm);
    expect(device.dialogs[0].buttons.map((b) => b.text)).toEqual([app.c.common.cancel, app.c.share.delete]);
    device.answer(app.c.common.cancel);
    await app.settle();
    expect(app.api.calls('POST /library/me/delete')).toEqual([]);
    expect(app.sees(app.c.account.signedInAs(EMAIL))).toBe(true);
    expect(app.sees(app.c.account.deletedData)).toBe(false);
  });

  it('deletes the Loro data: the sets go, the device’s progress stays, and the learner is signed out', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    seedSet(api, user, { title: OWN_SET, phrases: [{ target: 'Hola', native: 'Hello' }] });
    const app = await launch({ api, url: '/account', signedIn: EMAIL, learner: { edit: withRatings(CAFE.slice(0, 1)) } });
    await app.waitFor(app.c.account.kept(1, 0));
    await app.tap(app.c.account.deleteData);
    device.answer(app.c.share.delete);
    await app.settle();
    expect(app.api.calls('POST /library/me/delete')).toHaveLength(1);
    expect(lib(api).sets.size).toBe(0);
    expect(app.sees(app.c.account.deletedData)).toBe(true);
    // The account itself stays on the server, but this device is signed out without saving again.
    expect(api.users.has(user.id)).toBe(true);
    expect(app.sees(app.c.account.signInTitle)).toBe(true);
    expect(device.secure.get('loro.refresh')).toBeUndefined();
    const order = routes(api);
    expect(order.indexOf('POST /library/me/delete')).toBeLessThan(order.indexOf('POST /auth/logout'));
    expect(order.slice(order.indexOf('POST /library/me/delete')).includes('POST /library/progress')).toBe(false);
    const saved = await app.saved();
    expect(saved.learner.log.some((e) => e.kind === 'rated')).toBe(true);
  });

  it('shows the failure and stays signed in when deleting the data fails', async () => {
    const app = await launch({ url: '/account', signedIn: EMAIL });
    app.api.failNext('POST /library/me/delete', problem(500, 'INTERNAL'));
    await app.tap(app.c.account.deleteData);
    device.answer(app.c.share.delete);
    await app.settle();
    expect(app.sees(app.c.account.errors.generic)).toBe(true);
    expect(app.sees(app.c.account.deletedData)).toBe(false);
    expect(app.sees(app.c.account.signedInAs(EMAIL))).toBe(true);
    expect(device.secure.get('loro.refresh')).toBeTruthy();
  });

  it('asks before deleting the account, and Cancel does nothing', async () => {
    const app = await launch({ url: '/account', signedIn: EMAIL });
    await app.tap(app.c.account.deleteAccount);
    expect(device.dialogs).toHaveLength(1);
    expect(device.dialogs[0].message).toBe(app.c.account.deleteAccountConfirm);
    expect(device.dialogs[0].buttons.map((b) => b.text)).toEqual([app.c.common.cancel, app.c.account.deleteAccountYes]);
    device.answer(app.c.common.cancel);
    await app.settle();
    expect(app.api.calls('POST /library/me/delete-account')).toEqual([]);
    expect(app.sees(app.c.account.signedInAs(EMAIL))).toBe(true);
    expect(app.api.userByEmail(EMAIL)).toBeDefined();
  });

  it('deletes the account: gone from the server, signed out here, the device’s progress stays', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    seedSet(api, user, { title: OWN_SET, phrases: [{ target: 'Hola', native: 'Hello' }] });
    const app = await launch({ api, url: '/account', signedIn: EMAIL, learner: { edit: withRatings(CAFE.slice(0, 2)) } });
    await app.waitFor(app.c.account.synced);
    await app.tap(app.c.account.deleteAccount);
    device.answer(app.c.account.deleteAccountYes);
    await app.settle();
    expect(app.api.calls('POST /library/me/delete-account')).toHaveLength(1);
    expect(api.users.has(user.id)).toBe(false);
    expect(lib(api).sets.size).toBe(0);
    expect(app.sees(app.c.account.deletedAccount)).toBe(true);
    expect(app.sees(app.c.account.signInTitle)).toBe(true);
    expect(device.secure.get('loro.refresh')).toBeUndefined();
    expect(await AsyncStorage.getItem('loro.account')).toBeNull();
    // Nothing is saved to the account on the way out, and nothing is left on the phone under it.
    const order = routes(api);
    expect(order.slice(order.indexOf('POST /library/me/delete-account')).includes('POST /library/progress')).toBe(false);
    expect(await AsyncStorage.getItem(`loro.progress.stash.${user.id}`)).toBeNull();
    expect(await AsyncStorage.getItem('loro.progress.owner')).toBeNull();
    const saved = await app.saved();
    expect(saved.learner.log.filter((e) => e.kind === 'rated')).toHaveLength(2);
    expect(saved.learner.profile.name).toBe('Ana');
  });

  it('shows the failure and stays signed in when deleting the account fails', async () => {
    const app = await launch({ url: '/account', signedIn: EMAIL });
    app.api.failNext('POST /library/me/delete-account', problem(500, 'INTERNAL'));
    await app.tap(app.c.account.deleteAccount);
    device.answer(app.c.account.deleteAccountYes);
    await app.settle();
    expect(app.sees(app.c.account.errors.generic)).toBe(true);
    expect(app.sees(app.c.account.deletedAccount)).toBe(false);
    expect(app.sees(app.c.account.signedInAs(EMAIL))).toBe(true);
    expect(app.api.userByEmail(EMAIL)).toBeDefined();
  });

  it('lets someone else sign in on this device afterwards, keeping the progress here', async () => {
    const app = await launch({ url: '/account', signedIn: EMAIL, learner: { edit: withRatings(CAFE.slice(0, 1)) } });
    await app.waitFor(app.c.account.synced);
    await app.tap(app.c.account.deleteAccount);
    device.answer(app.c.account.deleteAccountYes);
    await app.settle();
    await askForCode(app, 'ben@loro.test');
    await app.type('000000', app.api.codeFor('ben@loro.test'));
    await app.advance(1_000);
    const ben = app.api.userByEmail('ben@loro.test')!;
    // Whoever signs in next keeps what is on the device: it is no longer the deleted account’s.
    expect(ratedInAccount(app.api, ben.id)).toEqual(CAFE.slice(0, 1));
  });
});

describe('a session the server ends', () => {
  it('shows signed out, and keeps the progress on the device, when the refresh token is unknown', async () => {
    const app = await launch({ url: '/library', signedIn: EMAIL, learner: { edit: withRatings(CAFE.slice(0, 2)) } });
    await app.advance(1_000);
    app.api.access.clear();
    app.api.refresh.clear();
    await app.open('/account');
    await app.advance(1_000);
    expect(app.sees(app.c.account.signInTitle)).toBe(true);
    expect(app.sees(app.c.account.signedInAs(EMAIL))).toBe(false);
    expect(device.secure.get('loro.refresh')).toBeUndefined();
    expect(await AsyncStorage.getItem('loro.account')).toBeNull();
    const saved = await app.saved();
    expect(saved.learner.log.filter((e) => e.kind === 'rated')).toHaveLength(2);
    expect(saved.learner.profile.onboarded).toBe(true);
  });

  it('asks Settings to say Sign in after the session ended', async () => {
    const app = await launch({ signedIn: EMAIL });
    await app.advance(1_000);
    app.api.access.clear();
    app.api.refresh.clear();
    await app.open('/account');
    await app.advance(1_000);
    await app.tap(app.c.common.close);
    await app.tap(app.c.nav.settings('Ana'));
    expect(app.sees(app.c.account.signIn)).toBe(true);
    expect(app.sees(app.c.account.signedInAs(EMAIL))).toBe(false);
  });

  it('renews an access token the server no longer knows, silently, and the action succeeds', async () => {
    const app = await launch({ url: '/library', signedIn: EMAIL });
    await app.advance(1_000);
    const refreshes = app.api.calls('POST /auth/refresh').length;
    app.api.access.clear();
    await app.open('/account');
    await app.waitFor(app.c.account.today);
    expect(app.api.calls('POST /auth/refresh').length).toBe(refreshes + 1);
    expect(app.sees(app.c.account.signedInAs(EMAIL))).toBe(true);
    expect(app.sees(app.c.account.errors.generic)).toBe(false);
    // A name can be saved with the renewed token.
    await app.type(app.c.account.displayName, 'Marta');
    await app.tap(app.c.common.save);
    expect(app.sees(app.c.account.displayNameSaved)).toBe(true);
  });

  it('renews an access token that has expired by the clock before using it', async () => {
    const app = await launch({ url: '/library', signedIn: EMAIL });
    await app.advance(1_000);
    const refreshes = app.api.calls('POST /auth/refresh').length;
    await app.skip(30 * MINUTE);
    await app.open('/account');
    await app.waitFor(app.c.account.today);
    expect(app.api.calls('POST /auth/refresh').length).toBeGreaterThan(refreshes);
    expect(app.sees(app.c.account.signedInAs(EMAIL))).toBe(true);
    expect(device.secure.get('loro.refresh')).toBeTruthy();
  });

  it('stays signed in when the token can’t be renewed because the network is down', async () => {
    const app = await launch({ url: '/library', signedIn: EMAIL });
    await app.advance(1_000);
    await app.skip(30 * MINUTE);
    app.api.offline = true;
    await app.open('/account');
    await app.advance(10_000);
    expect(app.sees(app.c.account.signedInAs(EMAIL))).toBe(true);
    expect(device.secure.get('loro.refresh')).toBeTruthy();
  });
});

describe('signing in keeps the device’s progress', () => {
  it('keeps a rating made signed out, and saves it to the account', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.set.playAll('Café & Mañanas'));
    await app.advance(8_000);
    await app.tap(app.c.player.rateAs(app.c.common.grade.easy));
    // The rating commits to the log when its undo window has passed.
    await jump(app, 6 * MINUTE);
    const before = (await app.saved()).learner.log.filter((e) => e.kind === 'rated');
    expect(before).toHaveLength(1);
    const phraseId = (before[0] as { phraseId: string }).phraseId;

    await app.open('/account');
    await askForCode(app);
    await app.type('000000', app.api.codeFor(EMAIL));
    await app.advance(1_000);
    const user = app.api.userByEmail(EMAIL)!;
    await app.advance(1_000);

    // Still on the device, as the same rating, and now in the account too.
    const after = (await app.saved()).learner.log.filter((e) => e.kind === 'rated');
    expect(after.map((e) => (e as { phraseId: string }).phraseId)).toEqual([phraseId]);
    expect(app.api.calls('POST /library/progress').length).toBeGreaterThan(0);
    expect(ratedInAccount(app.api, user.id)).toEqual([phraseId]);
    expect((await app.saved()).learner.profile.name).toBe('Ana');
  });

  it('keeps the device’s progress when signing in with Google, and merges the account’s from another device', async () => {
    const api = new FakeApi();
    const user = api.addUser('gina@gmail.test');
    // Another device had rated a phrase and saved it to the account.
    const other = await launch({ api, signedIn: user.email!, learner: { edit: withRatings(CAFE.slice(2, 3)) } });
    await other.advance(1_000);
    expect(ratedInAccount(api, user.id)).toEqual(CAFE.slice(2, 3));
    other.unmount();

    const app = await launch({ api, url: '/account', learner: { edit: withRatings(CAFE.slice(0, 1)) } });
    device.authSession.email = user.email;
    await app.tap(app.c.account.google);
    await app.advance(2_000);
    const ids = (await app.saved()).learner.log.flatMap((e) => (e.kind === 'rated' ? [e.phraseId] : []));
    expect(ids.sort()).toEqual([CAFE[0], CAFE[2]].sort());
    expect(ratedInAccount(api, user.id).sort()).toEqual([CAFE[0], CAFE[2]].sort());
  });
});
