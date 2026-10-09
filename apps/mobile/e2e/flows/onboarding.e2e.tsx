// First run: onboarding and the connection gate (F-08, CC-02, F-03, F-01).
//
// Covers:
// - Onboarding steps: the step counter and progress, choosing the interface language (each language
//   in its own name; the copy switching to Bulgarian, Russian, Polish, Czech), name entry (typed,
//   submitted from the keyboard, trimmed), the course choice (never the learner's own language; the
//   courses follow the native language; changing native moves a clashing course), the account step
//   ("Not now", email-code sign-in with its refusals, "Send a new code", "Use another email", the
//   signed-in view), the loop explained, Back between steps, finishing with the demo (the player) or
//   without it (Home).
// - What onboarding saves (profile, prefs.skippedDemo) and the pack requested for the chosen course.
// - The loop step waiting for the course: the offline notice and "Try again".
// - The gate: no languages and the server unreachable (offline screen, "Try again"); an onboarded
//   learner whose course is not installed and the server unreachable (offline screen, "Try again");
//   "Keep learning X" falling back to a course kept on the device.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { languageLabel, languageName } from '@shared/copy';
import { coursesFor, installLanguages, type LanguageCode } from '@shared/content';
import { serializeState } from '@shared/state/persistence';
import { STORAGE_KEY } from '@shared/state/storage';
import type { AppState } from '@shared/state/types';
import { FakeApi } from '../fakes/api';
import { copy, device, launch, screen, type App } from '../harness';

/** Taps Continue `times` times. */
async function next(app: App, times = 1): Promise<void> {
  for (let i = 0; i < times; i++) await app.tap(app.c.onboarding.next);
}

/** Whether the language option labelled `label` (the `index`th of that name) is the chosen one. */
function chosen(label: string, index = 0): boolean {
  const option = screen.getAllByLabelText(label)[index];
  return option.props.accessibilityState?.checked === true;
}

/** Goes through onboarding to the loop step, choosing `course` on the way. */
async function toLoop(app: App, course?: LanguageCode): Promise<void> {
  await next(app, 2);
  if (course) await app.tap(languageLabel(course, app.c.locale));
  await next(app);
  await app.tap(app.c.account.notNow);
}

const email = 'marta@example.com';

describe('the steps', () => {
  it('starts on the language choice, step 1 of 5, with the welcome line and no Back', async () => {
    const app = await launch({ learner: 'new' });
    expect(app.sees(app.c.onboarding.step(1, 5))).toBe(true);
    expect(app.sees(app.c.onboarding.welcome)).toBe(true);
    expect(app.sees(app.c.onboarding.native)).toBe(true);
    expect(app.sees(app.c.common.back)).toBe(false);
    // Each language is named in its own words, and British English is the chosen one.
    for (const code of ['bg-BG', 'ru-RU', 'pl-PL', 'cs-CZ'] as const) expect(app.sees(languageLabel(code, code))).toBe(true);
    expect(screen.getAllByLabelText('English')).toHaveLength(2);
    expect(chosen('English', 0)).toBe(true);
    expect(chosen('English', 1)).toBe(false);
  });

  it('counts the five steps in order', async () => {
    const app = await launch({ learner: 'new' });
    await next(app);
    expect(app.sees(app.c.onboarding.step(2, 5))).toBe(true);
    expect(app.sees(app.c.onboarding.name)).toBe(true);
    expect(app.sees(app.c.onboarding.welcome)).toBe(false);
    await next(app);
    expect(app.sees(app.c.onboarding.step(3, 5))).toBe(true);
    expect(app.sees(app.c.onboarding.course)).toBe(true);
    await next(app);
    expect(app.sees(app.c.onboarding.step(4, 5))).toBe(true);
    expect(app.sees(app.c.account.signInTitle)).toBe(true);
    await app.tap(app.c.account.notNow);
    expect(app.sees(app.c.onboarding.step(5, 5))).toBe(true);
    expect(app.sees(app.c.onboarding.loop)).toBe(true);
  });

  it('goes back one step at a time and keeps what was typed and chosen', async () => {
    const app = await launch({ learner: 'new' });
    await next(app);
    await app.type(app.c.onboarding.namePlaceholder, 'Marta');
    await next(app);
    await app.tap(languageLabel('ru-RU', app.c.locale));
    await app.tap(app.c.common.back);
    expect(app.sees(app.c.onboarding.step(2, 5))).toBe(true);
    expect(screen.getByDisplayValue('Marta')).toBeTruthy();
    await app.tap(app.c.common.back);
    expect(app.sees(app.c.onboarding.step(1, 5))).toBe(true);
    expect(app.sees(app.c.onboarding.welcome)).toBe(true);
    await next(app, 2);
    expect(chosen(languageLabel('ru-RU', app.c.locale))).toBe(true);
  });
});

describe('the interface language', () => {
  it.each([
    ['bg-BG', 'Български'],
    ['ru-RU', 'Русский'],
    ['pl-PL', 'Polski'],
    ['cs-CZ', 'Čeština'],
  ] as const)('choosing %s switches the copy to it', async (code, label) => {
    const app = await launch({ learner: 'new' });
    const there = copy(code);
    expect(there.onboarding.native).not.toBe(app.c.onboarding.native);
    await app.tap(label);
    expect(app.sees(there.onboarding.native)).toBe(true);
    expect(app.sees(there.onboarding.welcome)).toBe(true);
    expect(app.sees(there.onboarding.step(1, 5))).toBe(true);
    expect(app.sees(app.c.onboarding.welcome)).toBe(false);
    expect(chosen(label)).toBe(true);
    await app.tap(there.onboarding.next);
    expect(app.sees(there.onboarding.name)).toBe(true);
    expect((await app.saved()).learner.profile.nativeLang).toBe(code);
  });

  it('keeps the chosen language for the whole of onboarding, and offers its courses', async () => {
    const app = await launch({ learner: 'new' });
    const bg = copy('bg-BG');
    await app.tap('Български');
    await app.tap(bg.onboarding.next);
    await app.tap(bg.onboarding.next);
    expect(app.sees(bg.onboarding.course)).toBe(true);
    // The learner's own language is never offered; the rest are named in the interface language.
    expect(coursesFor('bg-BG')).not.toContain('bg-BG');
    for (const code of coursesFor('bg-BG')) expect(app.sees(languageLabel(code, bg.locale))).toBe(true);
    expect(app.sees(languageLabel('bg-BG', bg.locale))).toBe(false);
    await app.tap(bg.onboarding.next);
    await app.tap(bg.account.notNow);
    expect(app.sees(bg.onboarding.loop)).toBe(true);
    expect(app.sees(bg.onboarding.step(5, 5))).toBe(true);
  });

  it('American English is a language of its own to speak, and English is never offered as a course then', async () => {
    const app = await launch({ learner: 'new' });
    await app.tap('English', { index: 1 });
    expect(chosen('English', 1)).toBe(true);
    expect(chosen('English', 0)).toBe(false);
    expect((await app.saved()).learner.profile.nativeLang).toBe('en-US');
    await next(app, 2);
    expect(app.sees('English')).toBe(false);
    for (const code of coursesFor('en-US')) expect(app.sees(languageLabel(code, app.c.locale))).toBe(true);
  });
});

describe('the name', () => {
  it('is typed and saved trimmed once the learner continues', async () => {
    const app = await launch({ learner: 'new' });
    await next(app);
    await app.type(app.c.onboarding.namePlaceholder, '  Marta  ');
    await next(app);
    expect((await app.saved()).learner.profile.name).toBe('Marta');
  });

  it('is submitted from the keyboard, which moves on', async () => {
    const app = await launch({ learner: 'new' });
    await next(app);
    await app.type(app.c.onboarding.namePlaceholder, 'Marta');
    await app.submit(app.c.onboarding.namePlaceholder);
    expect(app.sees(app.c.onboarding.step(3, 5))).toBe(true);
    expect((await app.saved()).learner.profile.name).toBe('Marta');
  });
});

describe('the course', () => {
  it('offers every course but the learner’s own language, and none is lost to the name step', async () => {
    const app = await launch({ learner: 'new' });
    await next(app, 2);
    expect(coursesFor('en-GB')).toEqual(expect.arrayContaining(['es-ES', 'bg-BG', 'ru-RU', 'pl-PL', 'cs-CZ']));
    for (const code of coursesFor('en-GB')) expect(app.sees(languageLabel(code, app.c.locale))).toBe(true);
    expect(app.sees('English')).toBe(false);
  });

  it('chooses one, saves it and downloads its pack', async () => {
    const app = await launch({ learner: 'new' });
    await next(app, 2);
    await app.tap(languageLabel('ru-RU', app.c.locale));
    expect(chosen(languageLabel('ru-RU', app.c.locale))).toBe(true);
    expect(chosen(languageLabel('es-ES', app.c.locale))).toBe(false);
    await app.advance(1_000);
    expect((await app.saved()).learner.profile.targetLang).toBe('ru-RU');
    const packs = app.api.calls('GET /library/pack').map((r) => r.path);
    expect(packs[packs.length - 1]).toBe('/library/pack?target=ru-RU');
  });

  it('moves the course when a new interface language is the course already chosen', async () => {
    const app = await launch({ learner: 'new' });
    await next(app, 2);
    await app.tap(languageLabel('ru-RU', app.c.locale));
    await app.tap(app.c.common.back);
    await app.tap(app.c.common.back);
    await app.tap(languageLabel('ru-RU', 'ru-RU'));
    const profile = (await app.saved()).learner.profile;
    expect(profile.nativeLang).toBe('ru-RU');
    expect(profile.targetLang).toBe(coursesFor('ru-RU')[0]);
    expect(profile.targetLang).not.toBe('ru-RU');
  });

  it('keeps the course when the new interface language still allows it', async () => {
    const app = await launch({ learner: 'new' });
    await app.tap('Polski');
    expect((await app.saved()).learner.profile.targetLang).toBe('es-ES');
  });
});

describe('the account step', () => {
  it('is skipped with "Not now", leaving the learner signed out', async () => {
    const app = await launch({ learner: 'new' });
    await next(app, 3);
    expect(app.sees(app.c.onboarding.next)).toBe(false);
    await app.tap(app.c.account.notNow);
    expect(app.sees(app.c.onboarding.loop)).toBe(true);
    expect(app.api.calls('POST /auth/email/request')).toHaveLength(0);
  });

  it('signs in with an emailed code and moves on to the loop', async () => {
    const app = await launch({ learner: 'new' });
    await next(app, 3);
    await app.type(app.c.account.emailPlaceholder, email);
    await app.tap(app.c.account.sendCode);
    expect(app.sees(app.c.account.codeTitle)).toBe(true);
    expect(app.sees(app.c.account.codeBody(email))).toBe(true);
    await app.type('000000', app.api.codeFor(email));
    await app.advance(1_000);
    expect(app.sees(app.c.onboarding.loop)).toBe(true);
    expect(app.sees(app.c.account.welcome)).toBe(true);
    expect(app.api.userByEmail(email)).toBeDefined();
  });

  it('shows the signed-in account, with Continue, when already signed in', async () => {
    const app = await launch({ learner: 'new', signedIn: email });
    await next(app, 3);
    await app.waitFor(app.c.account.signedInAs(email));
    expect(app.sees(app.c.account.notNow)).toBe(false);
    await next(app);
    expect(app.sees(app.c.onboarding.loop)).toBe(true);
  });

  it('signs in with a provider from here, as the sign-in page returns', async () => {
    const app = await launch({ learner: 'new' });
    await next(app, 3);
    device.authSession.email = email;
    await app.tap(app.c.account.google);
    await app.advance(1_000);
    expect(app.sees(app.c.onboarding.loop)).toBe(true);
    expect(device.authPages).toHaveLength(1);
    expect(app.api.userByEmail(email)).toBeDefined();
  });

  it('stays on the account step when the provider’s page is closed', async () => {
    const app = await launch({ learner: 'new' });
    await next(app, 3);
    device.authSession.email = null;
    await app.tap(app.c.account.apple);
    await app.advance(1_000);
    expect(app.sees(app.c.account.signInTitle)).toBe(true);
    expect(app.sees(app.c.onboarding.loop)).toBe(false);
  });

  it('refuses a malformed email without asking the server', async () => {
    const app = await launch({ learner: 'new' });
    await next(app, 3);
    await app.type(app.c.account.emailPlaceholder, 'not an email');
    await app.tap(app.c.account.sendCode);
    expect(app.sees(app.c.account.errors.badEmail)).toBe(true);
    expect(app.api.mail).toHaveLength(0);
  });

  it('refuses a wrong code and lets the learner try again', async () => {
    const app = await launch({ learner: 'new' });
    await next(app, 3);
    await app.type(app.c.account.emailPlaceholder, email);
    await app.tap(app.c.account.sendCode);
    const right = app.api.codeFor(email);
    await app.type('000000', right === '111111' ? '222222' : '111111');
    await app.advance(500);
    expect(app.sees(app.c.account.errors.badCode)).toBe(true);
    expect(app.sees(app.c.onboarding.loop)).toBe(false);
    await app.type('000000', right);
    await app.advance(1_000);
    expect(app.sees(app.c.onboarding.loop)).toBe(true);
  });

  it('sends a new code on request', async () => {
    const app = await launch({ learner: 'new' });
    await next(app, 3);
    await app.type(app.c.account.emailPlaceholder, email);
    await app.tap(app.c.account.sendCode);
    expect(app.api.mail).toHaveLength(1);
    await app.tap(app.c.account.resend);
    expect(app.api.mail).toHaveLength(2);
    expect(app.sees(app.c.account.codeTitle)).toBe(true);
  });

  it('goes back to the email field with "Use another email"', async () => {
    const app = await launch({ learner: 'new' });
    await next(app, 3);
    await app.type(app.c.account.emailPlaceholder, email);
    await app.tap(app.c.account.sendCode);
    await app.tap(app.c.account.changeEmail);
    expect(app.sees(app.c.account.signInTitle)).toBe(true);
    expect(app.sees(app.c.account.sendCode)).toBe(true);
  });

  it('can be left with Back', async () => {
    const app = await launch({ learner: 'new' });
    await next(app, 3);
    await app.tap(app.c.common.back);
    expect(app.sees(app.c.onboarding.step(3, 5))).toBe(true);
  });
});

describe('the loop and finishing', () => {
  it('explains the loop in the learner’s languages, with Back to the account step', async () => {
    const app = await launch({ learner: 'new' });
    await toLoop(app);
    for (const line of app.c.onboarding.loopSteps('English', 'Spanish')) expect(app.sees(line)).toBe(true);
    await app.tap(app.c.common.back);
    expect(app.sees(app.c.onboarding.step(4, 5))).toBe(true);
  });

  it('names the chosen course in the loop', async () => {
    const app = await launch({ learner: 'new' });
    await toLoop(app, 'pl-PL');
    for (const line of app.c.onboarding.loopSteps('English', 'Polish')) expect(app.sees(line)).toBe(true);
  });

  it('starts with the demo: the player opens on the first phrase and onboarding is saved', async () => {
    const app = await launch({ learner: 'new' });
    await next(app);
    await app.type(app.c.onboarding.namePlaceholder, 'Marta');
    await next(app);
    await app.tap(languageLabel('ru-RU', app.c.locale));
    await next(app);
    await app.tap(app.c.account.notNow);
    await app.waitFor(app.c.onboarding.start);
    await app.tap(app.c.onboarding.start);
    await app.advance(1_000);
    expect(app.pathname()).toBe('/player');
    const saved = await app.saved();
    expect(saved.learner.profile).toMatchObject({ name: 'Marta', nativeLang: 'en-GB', targetLang: 'ru-RU', onboarded: true });
    expect(saved.prefs.skippedDemo).toBeFalsy();
    expect(app.api.calls('GET /library/pack').map((r) => r.path)).toContain('/library/pack?target=ru-RU');
  });

  it('starts without the demo: Home opens and the demo is marked skipped', async () => {
    const app = await launch({ learner: 'new' });
    await next(app);
    await app.type(app.c.onboarding.namePlaceholder, 'Marta');
    await next(app, 2);
    await app.tap(app.c.account.notNow);
    await app.waitFor(app.c.onboarding.skip);
    await app.tap(app.c.onboarding.skip);
    await app.waitFor(app.c.tabs.home);
    expect(app.pathname()).toBe('/');
    expect(app.sees(app.c.onboarding.welcome)).toBe(false);
    const saved = await app.saved();
    expect(saved.learner.profile).toMatchObject({ name: 'Marta', nativeLang: 'en-GB', targetLang: 'es-ES', onboarded: true });
    expect(saved.prefs.skippedDemo).toBe(true);
  });

  it('stays finished: the next launch opens Home, not onboarding', async () => {
    const app = await launch({ learner: 'new' });
    await toLoop(app);
    await app.waitFor(app.c.onboarding.skip);
    await app.tap(app.c.onboarding.skip);
    const again = await app.restart();
    await again.waitFor(again.c.tabs.home);
    expect(again.sees(again.c.onboarding.welcome)).toBe(false);
  });

  it('waits for the course at the last step: the offline notice, then "Try again" brings the buttons', async () => {
    const app = await launch({ learner: 'new' });
    await next(app, 2);
    app.api.offline = true;
    await app.tap(languageLabel('ru-RU', app.c.locale));
    await next(app);
    await app.tap(app.c.account.notNow);
    await app.waitFor(app.c.connection.offlineTitle);
    expect(app.sees(app.c.connection.offlineBody)).toBe(true);
    expect(app.sees(app.c.onboarding.start)).toBe(false);
    expect(app.sees(app.c.onboarding.skip)).toBe(false);
    app.api.offline = false;
    await app.tap(app.c.connection.retry);
    await app.waitFor(app.c.onboarding.start);
    expect(app.sees(app.c.onboarding.skip)).toBe(true);
    expect(app.sees(app.c.connection.offlineTitle)).toBe(false);
  });
});

/** A phone that has never downloaded the server's languages (the module keeps them between launches). */
function forgetLanguages(): void {
  installLanguages({ version: 'none', languages: [] });
}

describe('the connection gate', () => {
  beforeEach(forgetLanguages);

  it('shows the offline screen to a new learner when the server can’t be reached, and Try again recovers', async () => {
    const api = new FakeApi();
    api.offline = true;
    const app = await launch({ api, learner: 'new', waitForReady: false });
    await app.waitFor(app.c.connection.offlineTitle);
    expect(app.sees(app.c.connection.offlineBody)).toBe(true);
    expect(app.sees(app.c.onboarding.welcome)).toBe(false);
    // Nothing else to press than Try again: no course is kept.
    api.offline = false;
    await app.tap(app.c.connection.retry);
    await app.waitFor(app.c.onboarding.welcome);
    expect(app.sees(app.c.connection.offlineTitle)).toBe(false);
  });

  it('keeps showing the offline screen while the server is still unreachable', async () => {
    const api = new FakeApi();
    api.offline = true;
    const app = await launch({ api, learner: 'new', waitForReady: false });
    await app.waitFor(app.c.connection.offlineTitle);
    await app.tap(app.c.connection.retry);
    await app.waitFor(app.c.connection.offlineTitle);
    expect(app.sees(app.c.onboarding.welcome)).toBe(false);
  });

  it('shows the offline screen to an onboarded learner whose course isn’t installed, and Try again recovers', async () => {
    const api = new FakeApi();
    api.offline = true;
    const app = await launch({ api, waitForReady: false });
    await app.waitFor(app.c.connection.offlineTitle);
    expect(app.sees(app.c.tabs.home)).toBe(false);
    // No other course is kept, so no way to keep learning another.
    expect(app.sees(/^Keep learning/)).toBe(false);
    api.offline = false;
    await app.tap(app.c.connection.retry);
    await app.waitFor(app.c.tabs.home);
    expect(app.api.calls('GET /library/pack').length).toBeGreaterThan(0);
  });

  it('offers to keep learning a course kept on the device when the chosen one is missing', async () => {
    const app = await launch();
    await app.waitFor(app.c.tabs.home);
    // Another device changed the course to one this phone doesn't have.
    const state: AppState = await app.saved();
    const edited = { ...state, learner: { ...state.learner, profile: { ...state.learner.profile, targetLang: 'ru-RU' as const } } };
    await AsyncStorage.setItem(STORAGE_KEY, serializeState(edited));
    app.api.offline = true;
    const again = await app.restart({ waitForReady: false });
    await again.waitFor(again.c.connection.offlineTitle);
    const keep = again.c.connection.useCourse(languageName('es-ES', again.c.locale));
    expect(again.sees(keep)).toBe(true);
    await again.tap(keep);
    await again.waitFor(again.c.tabs.home);
    expect((await again.saved()).learner.profile.targetLang).toBe('es-ES');
  });

  it('opens the missing course once the server is back, with the fallback offered meanwhile', async () => {
    const app = await launch();
    await app.waitFor(app.c.tabs.home);
    const state = await app.saved();
    const edited = { ...state, learner: { ...state.learner, profile: { ...state.learner.profile, targetLang: 'ru-RU' as const } } };
    await AsyncStorage.setItem(STORAGE_KEY, serializeState(edited));
    app.api.offline = true;
    const again = await app.restart({ waitForReady: false });
    await again.waitFor(again.c.connection.offlineTitle);
    again.api.offline = false;
    await again.tap(again.c.connection.retry);
    await again.waitFor(again.c.tabs.home);
    expect((await again.saved()).learner.profile.targetLang).toBe('ru-RU');
    expect(again.api.calls('GET /library/pack').map((r) => r.path)).toContain('/library/pack?target=ru-RU');
  });
});
