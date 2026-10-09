// Progress across devices, and working offline (F-03, F-04, CC-03).
//
// Covers:
// - One account, two phones: progress is sent to the account about 20 s after a change (heard, then
//   the rating once its 5-minute window has closed); a fresh phone signed in as the same account
//   shows it (Home figures, the Learning list, a phrase's "Rated" line) and saves it; what that phone
//   rates reaches the account beside the first phone's; likes and the learner's name merge (the later
//   change wins); prefs stay on the device that set them and never reach the account; the account
//   coming back to the foreground merges what another phone wrote meanwhile.
// - Conflicts (409): a refused write is merged and tried again; a second phone writing between the
//   read and the write loses nothing; three refusals in a row give up, say so on the account page,
//   and the next foreground sends it.
// - Signing in with progress already on the device merges it with the account's; signing out sends
//   a change not yet sent first; signing in as someone else keeps the first learner's progress aside
//   (never merged into the second's) and gives it back when they return; a new account starts empty.
// - Made on the device before signing in (own phrases and sets): the "On this device only" banner and
//   its Sign in button; uploaded on sign-in with their ids (set with Loro's phrases by reference,
//   loose phrase into "My phrases"), the banner gone, the learner told; a failed upload is tried
//   again at the next start.
// - Offline first: the app opens and plays with no network from the course kept on the phone, ratings
//   are saved locally and reach the account once the network is back; a signed-in phone whose server
//   can't be reached stays signed in.
// - The course kept fresh: coming back to the foreground after more than 10 minutes downloads it
//   again, not before; a set deleted from the account leaves the Library, and its phrases leave the
//   queue, on the next download.
// - A set opened from a link is kept on the phone: it opens again with no network (CC-03).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resetContent } from '@shared/content';
import { encodeLog } from '@shared/state/compactLog';
import { initialLearner } from '@shared/state/initial';
import { memoryKey } from '@shared/state/memory';
import { sanitizeLearner } from '@shared/state/persistence';
import type { AppState, LearnerState, LogEntry } from '@shared/state/types';
import { FakeApi, problem } from '../fakes/api';
import { communitySet, lib, seedSet } from '../fakes/library';
import { audio, DAY, HOUR, launch, MINUTE, SECOND, T0, type App } from '../harness';

const EMAIL = 'ana@loro.test';
const BOB = 'bob@loro.test';
const TITLE = 'Café & Mañanas';
const CAFE_1 = 'Me pone un cortado, por favor';

/** A rated entry for each phrase, so a device (or the account) holds progress made elsewhere. */
function rated(phraseIds: string[], tag: string): LogEntry[] {
  return phraseIds.map((phraseId, i) => ({
    id: `${tag}-${phraseId}`,
    device: tag,
    at: T0 - HOUR + i,
    kind: 'rated' as const,
    grade: 'easy' as const,
    key: memoryKey('en-GB', 'es-ES', phraseId),
    phraseId,
    setId: 'set-cafe',
  }));
}

/** Saved state with these rated phrases in its log: the device has practised without the account. */
function withRatings(phraseIds: string[], tag = 'seed') {
  return (state: AppState): AppState => ({ ...state, learner: { ...state.learner, log: [...state.learner.log, ...rated(phraseIds, tag)] } });
}

/** The profile of an onboarded learner, as a phone saves it. */
const PROFILE = { ...initialLearner().profile, name: 'Ana', nativeLang: 'en-GB' as const, targetLang: 'es-ES' as const, onboarded: true, updatedAt: T0 - DAY };

/** What another phone left in an account: these phrases rated (and anything `more` says). */
function accountCopy(phraseIds: string[], tag: string, more: Partial<LearnerState> = {}): Record<string, unknown> {
  const learner: LearnerState = { ...initialLearner(), profile: PROFILE, log: rated(phraseIds, tag), ...more };
  return { ...learner, log: encodeLog(learner.log) };
}

/** The phrases the account holds ratings for. */
function ratedInAccount(api: FakeApi, email: string): string[] {
  const user = api.userByEmail(email);
  const stored = user && api.progress.get(user.id)?.progress;
  if (!stored) return [];
  return sanitizeLearner(stored).log.flatMap((e) => (e.kind === 'rated' ? [e.phraseId] : []));
}

/** The phrases the phone itself has saved ratings for. */
async function ratedOnPhone(app: App): Promise<string[]> {
  return (await app.saved()).learner.log.flatMap((e) => (e.kind === 'rated' ? [e.phraseId] : []));
}

/** Plays the set from its first phrase, rates what plays Easy, and pauses. */
async function playAndRate(app: App): Promise<void> {
  await app.tap(app.c.set.playAll(TITLE));
  await app.advance(8 * SECOND);
  await app.tap(app.c.player.rateAs(app.c.common.grade.easy));
  await app.tap(app.c.common.pause);
}

/** The phone starting again from nothing but what it saved: the app is closed and the process's memory of the content is gone. */
async function coldStart(app: App, options: { url: string }): Promise<App> {
  await app.advance(500); // let the last save finish
  app.unmount();
  resetContent();
  return launch({ ...options, api: app.api, keepDevice: true });
}

/** Signs in on the sign-in page with an emailed code. */
async function signInByEmail(app: App, email: string): Promise<void> {
  await app.type(app.c.account.emailPlaceholder, email);
  await app.tap(app.c.account.sendCode);
  await app.type('000000', app.api.codeFor(email));
  await app.advance(2 * SECOND);
}

/** Signs out from the account page. */
async function signOut(app: App): Promise<void> {
  await app.open('/account');
  await app.tap(app.c.account.signOut);
  await app.advance(SECOND);
}

describe('one account, two phones', () => {
  it('sends progress about 20 seconds after a change, and the rating once its window has closed', async () => {
    const app = await launch({ url: '/set/set-cafe', signedIn: EMAIL });
    const posts = () => app.api.calls('POST /library/progress').length;
    expect(posts()).toBe(1); // signing in sends what the phone has, at once
    await playAndRate(app);
    await app.advance(10 * SECOND);
    expect(posts()).toBe(1);
    await app.advance(15 * SECOND);
    expect(posts()).toBe(2);
    // The phrase was heard; the rating is still in its undo window, so it is not in the account yet.
    expect(ratedInAccount(app.api, EMAIL)).toEqual([]);
    await app.advance(5 * MINUTE);
    await app.advance(25 * SECOND);
    expect(posts()).toBe(3);
    expect(ratedInAccount(app.api, EMAIL)).toEqual(['cafe-01']);
  });

  it('sends a change no later than two minutes after the first one, however long the practice goes on', async () => {
    const app = await launch({ url: '/set/set-cafe', signedIn: EMAIL });
    const posts = () => app.api.calls('POST /library/progress').length;
    await app.tap(app.c.set.playAll(TITLE));
    // Every phrase heard is a change, each pushing the 20 s wait back; the 2 minute cap still sends.
    await app.advance(2 * MINUTE + 5 * SECOND);
    expect(posts()).toBeGreaterThanOrEqual(2);
    expect(app.api.progress.get(app.user!.id)!.revision).toBeGreaterThanOrEqual(2);
  });

  it('sends progress when the app goes to the background', async () => {
    const app = await launch({ url: '/set/set-cafe', signedIn: EMAIL });
    await playAndRate(app);
    expect(app.api.calls('POST /library/progress')).toHaveLength(1);
    await app.background();
    expect(app.api.calls('POST /library/progress')).toHaveLength(2);
    expect(app.api.progress.get(app.user!.id)!.revision).toBe(2);
  });

  it('shows that progress on a fresh phone signed in as the same account', async () => {
    const first = await launch({ url: '/set/set-cafe', signedIn: EMAIL });
    await playAndRate(first);
    await first.advance(5 * MINUTE + 30 * SECOND);
    expect(ratedInAccount(first.api, EMAIL)).toEqual(['cafe-01']);

    const second = await launch({ api: first.api, signedIn: EMAIL });
    await second.advance(2 * SECOND);
    const { c } = second;
    // Home: the figures, as the first phone had them.
    expect(second.sees(c.home.today(1, 1))).toBe(true);
    // Library: the phrase is under Learning.
    await second.open('/library?view=learning');
    expect(second.sees(CAFE_1)).toBe(true);
    // The set's page: the phrase's row says how it was rated.
    await second.open('/set/set-cafe');
    expect(second.sees(/Rated Easy/)).toBe(true);
    // And the phone itself saved it.
    expect(await ratedOnPhone(second)).toEqual(['cafe-01']);
  });

  it('puts what the second phone rates beside the first phone’s in the account', async () => {
    const first = await launch({ url: '/set/set-cafe', signedIn: EMAIL });
    await playAndRate(first);
    await first.advance(5 * MINUTE + 30 * SECOND);

    const second = await launch({ api: first.api, signedIn: EMAIL, url: '/set/set-cafe' });
    await second.advance(2 * SECOND);
    // The first phrase is rated; play from the second.
    await second.tap(second.c.phrase.play('¿Tienen leche de avena?'));
    await second.advance(8 * SECOND);
    await second.tap(second.c.player.rateAs(second.c.common.grade.hard));
    await second.tap(second.c.common.pause);
    await second.advance(5 * MINUTE + 30 * SECOND);
    expect(ratedInAccount(second.api, EMAIL).sort()).toEqual(['cafe-01', 'cafe-02']);
    expect((await ratedOnPhone(second)).sort()).toEqual(['cafe-01', 'cafe-02']);
  });

  it('merges likes: a set liked on one phone is liked on the other', async () => {
    const first = await launch({ url: '/set/set-cafe', signedIn: EMAIL });
    await first.tap(first.c.set.like);
    await first.advance(25 * SECOND);
    const stored = sanitizeLearner(first.api.progress.get(first.user!.id)!.progress!);
    expect(stored.likes['set:set-cafe']?.liked).toBe(true);

    const second = await launch({ api: first.api, signedIn: EMAIL, url: '/library?view=likedSets' });
    await second.advance(2 * SECOND);
    expect(second.sees(TITLE)).toBe(true);
    expect((await second.saved()).learner.likes['set:set-cafe']?.liked).toBe(true);
  });

  it('merges a phrase liked on one phone into the other, and the later change to the same phrase wins', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    // The account says cafe-02 was liked, then unliked later; cafe-03 liked.
    api.progress.set(user.id, {
      progress: accountCopy([], 'x', { likes: { 'phrase:cafe-02': { liked: false, at: T0 - HOUR }, 'phrase:cafe-03': { liked: true, at: T0 - HOUR } } }),
      revision: 1,
    });
    const app = await launch({
      api,
      signedIn: EMAIL,
      url: '/library?view=liked',
      learner: { edit: (s) => ({ ...s, learner: { ...s.learner, likes: { 'phrase:cafe-02': { liked: true, at: T0 - 2 * HOUR } } } }) },
    });
    await app.advance(2 * SECOND);
    expect(app.sees('La cuenta, por favor')).toBe(true); // cafe-03, from the account
    expect(app.sees('¿Tienen leche de avena?')).toBe(false); // cafe-02: the account's later unlike won
    const likes = sanitizeLearner(api.progress.get(user.id)!.progress!).likes;
    expect(likes['phrase:cafe-02']?.liked).toBe(false);
    expect(likes['phrase:cafe-03']?.liked).toBe(true);
  });

  it('takes the later profile: a name changed on another phone shows here', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    const profile = { ...initialLearner().profile, name: 'Anita', nativeLang: 'en-GB' as const, targetLang: 'es-ES' as const, onboarded: true, updatedAt: T0 - HOUR };
    api.progress.set(user.id, { progress: accountCopy([], 'x', { profile }), revision: 1 });
    const app = await launch({ api, signedIn: EMAIL });
    await app.advance(2 * SECOND);
    expect(app.sees(app.c.nav.settings('Anita'))).toBe(true);
    expect((await app.saved()).learner.profile.name).toBe('Anita');
  });

  it('keeps its own name when its profile is the later one, and sends it', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    const old = { ...initialLearner().profile, name: 'Anita', onboarded: true, updatedAt: T0 - 5 * DAY };
    api.progress.set(user.id, { progress: accountCopy([], 'x', { profile: old }), revision: 1 });
    const app = await launch({ api, signedIn: EMAIL });
    await app.advance(2 * SECOND);
    expect(app.sees(app.c.nav.settings('Ana'))).toBe(true);
    expect(sanitizeLearner(api.progress.get(user.id)!.progress!).profile.name).toBe('Ana');
  });

  it('keeps prefs on the phone that set them: they never reach the account or the other phone', async () => {
    const first = await launch({ signedIn: EMAIL, learner: { prefs: { pauseLength: 'longer' } } });
    await first.advance(2 * SECOND);
    const sent = first.api.progress.get(first.user!.id)!.progress!;
    expect(sent).not.toHaveProperty('prefs');
    expect(JSON.stringify(sent)).not.toContain('pauseLength');

    const second = await launch({ api: first.api, signedIn: EMAIL });
    await second.advance(2 * SECOND);
    expect((await second.saved()).prefs.pauseLength).toBe('standard');
  });

  it('merges what another phone wrote meanwhile when the app comes back to the foreground', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    const app = await launch({ api, signedIn: EMAIL, learner: { edit: withRatings(['cafe-01'], 'here') } });
    await app.advance(2 * SECOND);
    expect(ratedInAccount(api, EMAIL)).toEqual(['cafe-01']);
    // Another phone practises: the account gains cafe-02, a revision on.
    const current = api.progress.get(user.id)!;
    const theirs = sanitizeLearner(current.progress!);
    const merged = { ...theirs, log: [...theirs.log, ...rated(['cafe-02'], 'there')] };
    api.progress.set(user.id, { progress: { ...merged, log: encodeLog(merged.log) }, revision: current.revision + 1 });
    await app.background();
    await app.foreground();
    await app.advance(SECOND);
    expect((await ratedOnPhone(app)).sort()).toEqual(['cafe-01', 'cafe-02']);
    await app.open('/library?view=learning');
    expect(app.sees('¿Tienen leche de avena?')).toBe(true);
  });

  it('writes nothing when the account already has everything the phone has', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    api.progress.set(user.id, { progress: accountCopy(['cafe-01'], 'there'), revision: 4 });
    const app = await launch({ api, signedIn: EMAIL, learner: { edit: withRatings(['cafe-01'], 'there') } });
    await app.advance(2 * SECOND);
    await app.background();
    expect(app.api.calls('GET /library/progress').filter((r) => r.userId).length).toBeGreaterThanOrEqual(2);
    expect(app.api.calls('POST /library/progress')).toHaveLength(0);
    expect(api.progress.get(user.id)!.revision).toBe(4);
  });
});

describe('conflicts', () => {
  it('merges again and retries when a write is refused because the account moved on', async () => {
    const api = new FakeApi();
    api.failNext('POST /library/progress', problem(409, 'CURSOR_EXPIRED', 'Progress changed on another device'));
    const app = await launch({ api, signedIn: EMAIL, learner: { edit: withRatings(['cafe-01', 'cafe-02'], 'here') } });
    await app.advance(2 * SECOND);
    expect(api.calls('POST /library/progress')).toHaveLength(2);
    expect(api.calls('GET /library/progress').filter((r) => r.userId)).toHaveLength(2);
    expect(ratedInAccount(api, EMAIL).sort()).toEqual(['cafe-01', 'cafe-02']);
  });

  it('loses nothing when a second phone writes between the read and the write', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    const answer = api.answer.bind(api);
    let raced = false;
    api.answer = async (method, url, headers, body) => {
      if (!raced && method === 'POST' && url.includes('/library/progress')) {
        raced = true;
        // The other phone's write lands first.
        api.progress.set(user.id, { progress: accountCopy(['cafe-03'], 'there'), revision: 1 });
      }
      return answer(method, url, headers, body);
    };
    const app = await launch({ api, signedIn: EMAIL, learner: { edit: withRatings(['cafe-01'], 'here') } });
    await app.advance(2 * SECOND);
    expect(raced).toBe(true);
    expect(api.calls('POST /library/progress')).toHaveLength(2);
    expect(ratedInAccount(api, EMAIL).sort()).toEqual(['cafe-01', 'cafe-03']);
    expect(api.progress.get(user.id)!.revision).toBe(2);
    // The phone took the other phone's progress in too.
    expect((await ratedOnPhone(app)).sort()).toEqual(['cafe-01', 'cafe-03']);
  });

  it('gives up after three refusals, says so on the account page, and sends at the next foreground', async () => {
    const api = new FakeApi();
    for (let i = 0; i < 3; i++) api.failNext('POST /library/progress', problem(409, 'CURSOR_EXPIRED'));
    const app = await launch({ api, signedIn: EMAIL, learner: { edit: withRatings(['cafe-01'], 'here') } });
    await app.advance(2 * SECOND);
    expect(api.calls('POST /library/progress')).toHaveLength(3);
    expect(ratedInAccount(api, EMAIL)).toEqual([]);
    await app.open('/account');
    expect(app.sees(app.c.account.syncFailed)).toBe(true);
    // The phone's own copy is safe.
    expect(await ratedOnPhone(app)).toEqual(['cafe-01']);
    await app.background();
    await app.foreground();
    expect(ratedInAccount(api, EMAIL)).toEqual(['cafe-01']);
    // The page reads how the last sync went when it is shown.
    await app.open('/');
    await app.open('/account');
    expect(app.sees(app.c.account.syncFailed)).toBe(false);
    expect(app.sees(app.c.account.synced)).toBe(true);
  });

  it('stays quiet when the account fails to answer, and sends at the next foreground', async () => {
    const api = new FakeApi();
    api.failNext('GET /library/progress', problem(500, 'INTERNAL'));
    const app = await launch({ api, signedIn: EMAIL, learner: { edit: withRatings(['cafe-01'], 'here') } });
    await app.advance(2 * SECOND);
    expect(api.calls('POST /library/progress')).toHaveLength(0);
    expect(app.sees(app.c.tabs.home)).toBe(true);
    await app.background();
    expect(ratedInAccount(api, EMAIL)).toEqual(['cafe-01']);
  });
});

describe('signing in and out with progress on the phone', () => {
  it('merges the phone’s progress with the account’s on signing in, replacing neither', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    api.progress.set(user.id, { progress: accountCopy(['cafe-03'], 'there'), revision: 1 });
    const app = await launch({ api, url: '/account', learner: { edit: withRatings(['cafe-01', 'cafe-02'], 'here') } });
    expect(api.calls('GET /library/progress')).toHaveLength(0); // signed out: nothing asked of the account
    await signInByEmail(app, EMAIL);
    await app.advance(SECOND);
    expect(ratedInAccount(api, EMAIL).sort()).toEqual(['cafe-01', 'cafe-02', 'cafe-03']);
    expect((await ratedOnPhone(app)).sort()).toEqual(['cafe-01', 'cafe-02', 'cafe-03']);
  });

  it('sends a change not yet sent before signing out, and keeps the progress on the phone', async () => {
    const app = await launch({ url: '/set/set-cafe', signedIn: EMAIL });
    await app.tap(app.c.set.like);
    await app.advance(2 * SECOND); // well inside the 20 s wait
    const before = app.api.calls('POST /library/progress').length;
    await signOut(app);
    const sent = sanitizeLearner(app.api.progress.get(app.user!.id)!.progress!);
    expect(app.api.calls('POST /library/progress').length).toBe(before + 1);
    expect(sent.likes['set:set-cafe']?.liked).toBe(true);
    const routes = app.api.requests.map((r) => `${r.method} ${r.path}`);
    expect(routes.lastIndexOf('POST /library/progress')).toBeLessThan(routes.indexOf('POST /auth/logout'));
    expect((await app.saved()).learner.likes['set:set-cafe']?.liked).toBe(true);
  });

  it('keeps a first learner’s progress aside when someone else signs in, never mixing the two', async () => {
    const api = new FakeApi();
    const bob = api.addUser(BOB);
    api.progress.set(bob.id, { progress: accountCopy(['cafe-03'], 'bob'), revision: 1 });
    const app = await launch({ api, signedIn: EMAIL, learner: { edit: withRatings(['cafe-01', 'cafe-02'], 'ana') } });
    await app.advance(2 * SECOND);
    expect(ratedInAccount(api, EMAIL).sort()).toEqual(['cafe-01', 'cafe-02']);

    await signOut(app);
    expect(await ratedOnPhone(app)).toEqual(['cafe-01', 'cafe-02']); // signed out, still the phone's
    await app.open('/account');
    await signInByEmail(app, BOB);
    await app.advance(SECOND);
    // The phone now holds Bob's progress and none of Ana's...
    expect(await ratedOnPhone(app)).toEqual(['cafe-03']);
    // ...and neither account has the other’s.
    expect(ratedInAccount(api, BOB)).toEqual(['cafe-03']);
    expect(ratedInAccount(api, EMAIL).sort()).toEqual(['cafe-01', 'cafe-02']);

    // Ana comes back: hers returns, still without Bob's.
    await signOut(app);
    await app.open('/account');
    await signInByEmail(app, EMAIL);
    await app.advance(SECOND);
    expect((await ratedOnPhone(app)).sort()).toEqual(['cafe-01', 'cafe-02']);
    expect(ratedInAccount(api, BOB)).toEqual(['cafe-03']);
    expect(ratedInAccount(api, EMAIL).sort()).toEqual(['cafe-01', 'cafe-02']);
  });

  it('starts a new account empty on a phone another learner used, and gives the first learner theirs back', async () => {
    const app = await launch({ signedIn: EMAIL, learner: { edit: withRatings(['cafe-01'], 'ana') } });
    await app.advance(2 * SECOND);
    await signOut(app);
    await app.open('/account');
    await signInByEmail(app, BOB); // a new account: the server has nothing for it
    await app.advance(SECOND);
    expect(await ratedOnPhone(app)).toEqual([]);
    expect(ratedInAccount(app.api, BOB)).toEqual([]);
    await app.open('/library?view=learning');
    expect(app.sees(CAFE_1)).toBe(false);

    await signOut(app);
    await app.open('/account');
    await signInByEmail(app, EMAIL);
    await app.advance(SECOND);
    expect(await ratedOnPhone(app)).toEqual(['cafe-01']);
  });

  it('keeps a signed-out learner’s own progress when a first account signs in with an empty account', async () => {
    const app = await launch({ url: '/account', learner: { edit: withRatings(['cafe-01'], 'here') } });
    await signInByEmail(app, EMAIL);
    await app.advance(SECOND);
    expect(ratedInAccount(app.api, EMAIL)).toEqual(['cafe-01']);
    expect(await ratedOnPhone(app)).toEqual(['cafe-01']);
  });
});

describe('made on this phone before signing in', () => {
  /** A phrase of its own in a set (with a phrase of Loro's), and another in no set. */
  const madeBefore = (state: AppState): AppState => {
    const phrase = (id: string, target: string, native: string) => ({ id, targetLang: 'es-ES' as const, nativeLang: 'en-GB' as const, target, native, createdAt: T0 - DAY, updatedAt: T0 - DAY, deleted: false });
    return {
      ...state,
      learner: {
        ...state.learner,
        ownPhrases: { 'mine-p-buenos': phrase('mine-p-buenos', 'Buenos días', 'Good morning'), 'mine-p-luego': phrase('mine-p-luego', 'Hasta luego', 'See you later') },
        ownSets: { 'mine-s-frases': { id: 'mine-s-frases', title: 'Mis frases', targetLang: 'es-ES', phraseIds: ['mine-p-buenos', 'cafe-01'], createdAt: T0 - DAY, updatedAt: T0 - DAY, deleted: false } },
      },
    };
  };

  it('offers to sign in from the Library, naming how many phrases and sets are waiting', async () => {
    const app = await launch({ url: '/library', learner: { edit: madeBefore } });
    expect(app.sees(app.c.library.onDevice(2, 1))).toBe(true);
    await app.tap(app.c.account.signIn);
    expect(app.pathname()).toBe('/account');
    expect(app.sees(app.c.account.signInTitle)).toBe(true);
  });

  it('shows no banner when nothing was made on the phone before signing in', async () => {
    const plain = await launch({ url: '/library' });
    expect(plain.sees(/On this device only/)).toBe(false);
  });

  it('uploads them on signing in, keeping their ids, and the banner goes away', async () => {
    const app = await launch({ url: '/library', learner: { edit: madeBefore } });
    await app.tap(app.c.account.signIn);
    await signInByEmail(app, EMAIL);
    const sets = app.api.calls('POST /library/sets');
    expect(sets).toHaveLength(1);
    expect(sets[0].body).toMatchObject({
      id: 'mine-s-frases',
      title: 'Mis frases',
      targetLang: 'es-ES',
      nativeLang: 'en-GB',
      visibility: 'private',
      phrases: [{ id: 'mine-p-buenos', target: 'Buenos días', native: 'Good morning' }, { ref: 'cafe-01' }],
    });
   
    const loose = app.api.calls('POST /library/phrases');
    expect(loose).toHaveLength(1);
    expect(JSON.stringify(loose[0].body)).toContain('Hasta luego');
    expect(JSON.stringify(loose[0].body)).toContain('mine-p-luego');
    // The learner is told; the banner is gone; the phone marks them uploaded.
    expect(app.pathname()).toBe('/library');
    expect(app.sees(app.c.library.uploaded)).toBe(true);
    expect(app.sees(/On this device only/)).toBe(false);
    const saved = (await app.saved()).learner;
    expect(saved.ownPhrases['mine-p-buenos'].deleted).toBe(true);
    expect(saved.ownPhrases['mine-p-luego'].deleted).toBe(true);
    expect(saved.ownSets['mine-s-frases'].deleted).toBe(true);
    // They are in the account now: the set lists in Library, the loose phrase is in "My phrases".
    await app.open('/library?view=ownSets');
    expect(app.sees('Mis frases')).toBe(true);
    await app.open('/library?view=mine');
    expect(app.sees('Hasta luego')).toBe(true);
    expect(app.sees('Buenos días')).toBe(true);
    // Nothing is uploaded a second time.
    await app.restart();
    await app.advance(2 * SECOND);
    expect(app.api.calls('POST /library/sets')).toHaveLength(1);
  });

  it('tries again at the next start when the upload failed, and says nothing until it works', async () => {
    const app = await launch({ url: '/library', learner: { edit: madeBefore } });
    app.api.failNext('POST /library/sets', problem(500, 'INTERNAL'));
    await app.tap(app.c.account.signIn);
    await signInByEmail(app, EMAIL);
    await app.advance(2 * SECOND);
    expect(app.sees(app.c.library.uploaded)).toBe(false);
    expect((await app.saved()).learner.ownSets['mine-s-frases'].deleted).toBe(false);
    const again = await app.restart({ url: '/library' });
    await again.advance(2 * SECOND);
    expect(again.sees(again.c.library.uploaded)).toBe(true);
    expect((await again.saved()).learner.ownSets['mine-s-frases'].deleted).toBe(true);
    expect(again.api.calls('POST /library/sets').length).toBe(2);
  });
});

describe('working offline', () => {
  it('opens with the course kept from the last start and lists its sets and phrases', async () => {
    const online = await launch({ url: '/set/set-cafe' });
    expect(online.api.calls('GET /library/pack')).toHaveLength(1);
    online.api.offline = true;
    const app = await coldStart(online, { url: '/set/set-cafe' });
    expect(app.sees(TITLE)).toBe(true);
    expect(app.sees(CAFE_1)).toBe(true);
    expect(app.sees(app.c.connection.offlineTitle)).toBe(false);
    await app.open('/');
    expect(app.sees('Tapas & Tabernas')).toBe(true);
    // Nothing reached the server, and the phone has kept the pack under its own key.
    expect(app.api.calls('GET /library/pack')).toHaveLength(1);
    expect(await AsyncStorage.getItem('loro.content.pack.es-ES')).not.toBeNull();
  });

  it('plays offline as far as the phone can: the phrase shows, the recording says it did not play, and Play carries on once the network is back', async () => {
    const online = await launch({ url: '/set/set-cafe' });
    online.api.offline = true;
    const app = await online.restart({ url: '/set/set-cafe' });
    await app.tap(app.c.set.playAll(TITLE));
    await app.advance(10 * SECOND);
    // Every sound is the server's (overview.md rule 2): with no network, no clip plays.
    expect(app.sees(app.c.player.silent)).toBe(true);
    expect(audio.heard).toHaveLength(0);
    app.api.offline = false;
    await app.tap(app.c.common.play);
    await app.advance(10 * SECOND);
    expect(app.sees(app.c.player.silent)).toBe(false);
    expect(audio.heard.length).toBeGreaterThan(0);
  });

  it('saves a rating given offline on the phone, and it counts once its window has closed', async () => {
    const online = await launch({ url: '/set/set-cafe' });
    online.api.offline = true;
    const app = await online.restart({ url: '/set/set-cafe' });
    await app.tap(app.c.set.playAll(TITLE));
    await app.advance(10 * SECOND);
    await app.tap(app.c.player.rateAs(app.c.common.grade.easy));
    expect((await app.saved()).pending.map((p) => p.phraseId)).toEqual(['cafe-01']);
    await app.advance(5 * MINUTE + 30 * SECOND);
    expect(await ratedOnPhone(app)).toEqual(['cafe-01']);
    await app.open('/library?view=learning');
    expect(app.sees(CAFE_1)).toBe(true);
    // And it is still there after a restart, still offline.
    const again = await app.restart({ url: '/library?view=learning' });
    expect(again.sees(CAFE_1)).toBe(true);
  });

  it('sends progress made offline to the account once the network is back, at the next foreground', async () => {
    const online = await launch({ url: '/set/set-cafe', signedIn: EMAIL });
    await online.advance(SECOND);
    online.api.offline = true;
    const app = await online.restart({ url: '/set/set-cafe' });
    await app.tap(app.c.set.playAll(TITLE));
    await app.advance(10 * SECOND);
    await app.tap(app.c.player.rateAs(app.c.common.grade.easy));
    await app.advance(5 * MINUTE + 30 * SECOND);
    expect(await ratedOnPhone(app)).toEqual(['cafe-01']);
    expect(ratedInAccount(app.api, EMAIL)).toEqual([]);
    // Still signed in, and it says so when the account page is opened.
    await app.open('/account');
    expect(app.sees(app.c.account.signedInAs(EMAIL))).toBe(true);
    expect(app.sees(app.c.account.syncFailed)).toBe(true);
    app.api.offline = false;
    await app.background();
    await app.foreground();
    expect(ratedInAccount(app.api, EMAIL)).toEqual(['cafe-01']);
  });

  it('sends it at the next change too, with no foreground needed', async () => {
    const online = await launch({ url: '/set/set-cafe', signedIn: EMAIL });
    await online.advance(SECOND);
    online.api.offline = true;
    const app = await online.restart({ url: '/set/set-cafe' });
    await app.tap(app.c.set.playAll(TITLE));
    await app.advance(10 * SECOND);
    await app.tap(app.c.player.rateAs(app.c.common.grade.easy));
    await app.advance(5 * MINUTE + 30 * SECOND);
    expect(ratedInAccount(app.api, EMAIL)).toEqual([]);
    // The network is back; the learner plays on, which is a change, and a little later it is all sent.
    app.api.offline = false;
    await app.tap(app.c.common.play);
    await app.advance(8 * SECOND);
    await app.tap(app.c.common.pause);
    await app.advance(25 * SECOND);
    expect(ratedInAccount(app.api, EMAIL)).toEqual(['cafe-01']);
  });
});

describe('open questions about working offline', () => {
  // overview.md says phrase clips come from the API and the app keeps no clip store; prd.md F-03 says
  // "the player ... work[s] with no network". Offline today the phrase shows and rating works, but no
  // recording plays ("Didn’t play — press Play"). Which is meant?
  it.todo('F-03: should the player play phrase recordings with no network (a clip store), or is a silent, rate-only player the intended offline behaviour?');
});

describe('keeping the course fresh', () => {
  const packs = (app: App) => app.api.calls('GET /library/pack').length;

  it('downloads the course again on coming back to the foreground after more than ten minutes, not before', async () => {
    const app = await launch({ url: '/' });
    expect(packs(app)).toBe(1);
    await app.background();
    await app.skip(9 * MINUTE);
    await app.foreground();
    expect(packs(app)).toBe(1);
    await app.background();
    await app.skip(2 * MINUTE); // eleven minutes since the download
    await app.foreground();
    expect(packs(app)).toBe(2);
    // The new copy starts the ten minutes over.
    await app.background();
    await app.foreground();
    expect(packs(app)).toBe(2);
  });

  it('never downloads it again just for going to the background', async () => {
    const app = await launch({ url: '/' });
    await app.skip(HOUR);
    await app.background();
    expect(packs(app)).toBe(1);
  });

  it('shows what the server added meanwhile after that download', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    const app = await launch({ api, signedIn: EMAIL, url: '/library?view=ownSets' });
    expect(app.sees('Mi lista nueva')).toBe(false);
    seedSet(api, user, { title: 'Mi lista nueva', phrases: [{ target: 'Hasta pronto', native: 'See you soon' }] });
    api.store.revision = (api.store.revision ?? 0) + 1;
    await app.background();
    await app.skip(11 * MINUTE);
    await app.foreground();
    expect(app.sees('Mi lista nueva')).toBe(true);
  });

  it('drops a set deleted from the account, and its phrases leave the queue', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    const mine = seedSet(api, user, {
      title: 'Mi lista',
      phrases: [
        { target: 'Buenas tardes', native: 'Good afternoon' },
        { target: 'Hasta mañana', native: 'See you tomorrow' },
      ],
    });
    const app = await launch({ api, signedIn: EMAIL, url: `/set/${mine.id}` });
    await app.tap(app.c.set.playAll('Mi lista'));
    await app.advance(SECOND);
    await app.tap(app.c.common.pause);
    expect(app.sees(new RegExp(`^${app.c.player.dialog}: `))).toBe(true);
    await app.open('/library?view=ownSets');
    expect(app.sees('Mi lista')).toBe(true);
    // The set is deleted elsewhere (another phone); this one finds out at its next download.
    lib(api).sets.delete(mine.id);
    api.store.revision = (api.store.revision ?? 0) + 1;
    await app.background();
    await app.skip(11 * MINUTE);
    await app.foreground();
    expect(app.sees('Mi lista')).toBe(false);
    // Nothing from it is left to play.
    expect(app.sees(new RegExp(`^${app.c.player.dialog}: `))).toBe(false);
    expect((await app.saved()).player.order).toEqual([]);
  });
});

describe('a set opened from a link or Community is kept (CC-03)', () => {
  const phrases = [
    { target: 'Dos cafés, por favor', native: 'Two coffees, please' },
    { target: '¿Dónde está el baño?', native: 'Where is the toilet?' },
  ];

  it('opens again with no network after it was opened from a share link', async () => {
    const api = new FakeApi();
    const set = communitySet(api, { title: 'Tapas de Marta', displayName: 'Marta', phrases });
    const app = await launch({ api, url: `/shared/${set.shareCode}` });
    await app.waitFor('Tapas de Marta');
    expect(app.pathname()).toBe(`/set/${set.id}`);
    expect(await AsyncStorage.getItem('loro.content.extras')).toContain('Tapas de Marta');

    api.offline = true;
    const off = await coldStart(app, { url: `/set/${set.id}` });
    expect(off.sees('Tapas de Marta')).toBe(true);
    expect(off.sees('Dos cafés, por favor')).toBe(true);
    expect(off.sees(off.c.set.notFound)).toBe(false);
    // And it can be played into the queue (its recordings need the network, but the phrases are here).
    await off.tap(off.c.set.playAll('Tapas de Marta'));
    await off.advance(SECOND);
    expect(off.sees(new RegExp(`^${off.c.player.dialog}: `))).toBe(true);
  });

  it('is kept by opening the set page itself, as from Community', async () => {
    const api = new FakeApi();
    const set = communitySet(api, { title: 'Tapas de Marta', displayName: 'Marta', phrases });
    const app = await launch({ api, url: `/set/${set.id}` });
    await app.waitFor('Tapas de Marta');
    expect(api.calls('GET /library/sets/' + set.id)).toHaveLength(1);
    api.offline = true;
    const off = await app.restart({ url: `/set/${set.id}` });
    expect(off.sees('Tapas de Marta')).toBe(true);
    expect(off.sees('Dos cafés, por favor')).toBe(true);
  });

  it('is not there offline when it was never opened', async () => {
    const api = new FakeApi();
    const set = communitySet(api, { title: 'Tapas de Marta', displayName: 'Marta', phrases });
    const app = await launch({ api, url: '/' });
    api.offline = true;
    const off = await app.restart({ url: `/set/${set.id}` });
    await off.waitFor(off.c.set.notFound);
  });

  it('is forgotten on signing out, since it may have held the learner’s own and saved sets', async () => {
    const api = new FakeApi();
    const set = communitySet(api, { title: 'Tapas de Marta', displayName: 'Marta', phrases });
    const app = await launch({ api, signedIn: EMAIL, url: `/shared/${set.shareCode}` });
    await app.waitFor('Tapas de Marta');
    expect(await AsyncStorage.getItem('loro.content.extras')).not.toBeNull();
    await signOut(app);
    expect(await AsyncStorage.getItem('loro.content.extras')).toBeNull();
  });
});
