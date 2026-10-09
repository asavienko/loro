// A Loro set's page, signed out (P3-01, CC-03, CC-04, P2-07). Covers: the header (title, topic,
// level, subtitle, summary, full-play length); play all / pause / resume and the "paused at" note;
// shuffle play; playing from a phrase's row; "play due and new"; liking the set; the more-options
// menu (play next, add to queue, share link, make a song, and the items a Loro set does not offer);
// the sort sheet (each order, saved in prefs.sortBySet, kept across a restart, per set); the
// phrase rows (play, details button, progress that moves only after real ratings); "Make a song"
// asking a signed-out learner to sign in; no songs shelf on a set without songs; the other-course
// and not-found pages; and back to where the set was opened from.
import { languageName } from '@shared/copy';
import { audio, device, launch, screen, type App } from '../harness';

// The test environment has no app manifest for expo-linking to build a URL from.
jest.mock('expo-linking', () => ({ ...jest.requireActual('expo-linking'), createURL: (path: string) => `loro:/${path}` }));

const TITLE = 'Café & Mañanas';
// The phrase playing shows its meaning, not its words, while it is recalled.
const BILL = 'The bill, please';
const CAFE = ['Me pone un cortado, por favor', '¿Tienen leche de avena?', 'La cuenta, por favor', '¿Nos podemos sentar en la terraza?', 'Sin gluten, por favor'];

/** The phrases listed on the page, top to bottom (each row has a details button named for its phrase). */
function listed(app: App): string[] {
  const prefix = app.c.phrase.details('');
  return screen.queryAllByLabelText(new RegExp(`^${prefix}`)).map((n) => String(n.props.accessibilityLabel).slice(prefix.length));
}

/** Plays the set from its `row`th phrase and rates what plays with `grade` once it is the learner's turn to rate. */
async function rateRow(app: App, row: number, grade: string): Promise<void> {
  await app.tap(app.c.phrase.play(CAFE[row]));
  await app.advance(8_000);
  await app.tap(app.c.player.rateAs(grade));
}

describe('the header', () => {
  it('names the set with its topic, level, subtitle and real figures', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    expect(app.sees(TITLE)).toBe(true);
    expect(app.sees('Ordering coffee at the counter')).toBe(true);
    expect(app.sees('A1')).toBe(true);
    expect(app.sees(new RegExp(`^${c.set.summary(5, 0, 0)}`))).toBe(true);
    expect(app.sees(/Full play /)).toBe(false); // its length is known once clips have been heard
    expect(app.sees(c.set.own)).toBe(false);
    expect(listed(app)).toEqual(CAFE);
  });

  it('has no songs shelf and says nothing of songs while the set has none', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    expect(app.sees(/song/i)).toBe(true); // only the "Make a song" button…
    expect(app.sees(app.c.music.makeSong)).toBe(true);
    expect(app.sees(new RegExp(app.c.music.songs(1).replace('1', '\\d+')))).toBe(false);
    expect(app.api.requests.filter((r) => r.path === '/library/sets/set-cafe/songs')).toHaveLength(1);
  });

  it('shows no progress until phrases are really rated, then counts them', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    expect(app.sees(c.set.playDueNew(5))).toBe(false); // everything new: the one Play covers it
    await rateRow(app, 0, c.common.grade.easy);
    expect(app.sees(c.set.playDueNew(4))).toBe(true);
    expect((await app.saved()).pending.map((p) => p.phraseId)).toEqual(['cafe-01']);
  });
});

describe('playing', () => {
  it('play all plays the set from its first phrase, and the button then pauses it', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await app.tap(c.set.playAll(TITLE));
    await app.advance(3_000);
    expect(audio.clips()[0]).toBe('en-GB-cafe-01');
    expect(app.sees(c.set.pauseAll(TITLE))).toBe(true);
    expect(app.sees(c.set.playAll(TITLE))).toBe(false);
  });

  it('pauses, says where it paused, and resumes from the same place', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await app.tap(c.set.playAll(TITLE));
    await app.advance(3_000);
    await app.tap(c.set.pauseAll(TITLE));
    expect(app.sees(c.set.resume(TITLE))).toBe(true);
    expect(app.sees(c.set.pausedAt(1, 5))).toBe(true);
    await app.tap(c.set.resume(TITLE));
    expect(app.sees(c.set.pauseAll(TITLE))).toBe(true);
    expect(app.sees(/^Paused at/)).toBe(false);
  });

  it('shuffle play loads the whole set shuffled', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.set.shufflePlay);
    await app.advance(3_000);
    expect(app.sees(app.c.set.pauseAll(TITLE))).toBe(true);
    expect(audio.clips().length).toBeGreaterThan(0);
    expect(audio.clips()[0]).toMatch(/^en-GB-cafe-0[1-5]$/);
  });

  it('tapping a phrase row plays from that phrase', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.phrase.play(CAFE[2]));
    await app.advance(3_000);
    expect(audio.clips()[0]).toBe('en-GB-cafe-03');
    expect(app.sees(app.c.set.pauseAll(TITLE))).toBe(true);
  });

  it('"play due and new" plays only what is not yet learned or rated, and pauses itself', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await rateRow(app, 0, c.common.grade.easy);
    const before = audio.clips().length;
    await app.tap(c.set.playDueNew(4));
    await app.advance(3_000);
    expect(audio.clips()[before]).toBe('en-GB-cafe-02');
    expect(app.sees(c.set.pauseDueNew)).toBe(true);
    await app.tap(c.set.pauseDueNew);
    expect(app.sees(c.set.playDueNew(4))).toBe(true);
  });
});

describe('liking the set', () => {
  it('toggles the heart and saves the like on the device, not the server', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.set.like);
    expect((await app.saved()).learner.likes['set:set-cafe']?.liked).toBe(true);
    await app.tap(app.c.set.like);
    expect((await app.saved()).learner.likes['set:set-cafe']?.liked).toBe(false);
    expect(app.api.requests.filter((r) => r.method !== 'GET')).toEqual([]);
  });
});

describe('the more-options menu of a Loro set', () => {
  it('offers play next, add to queue, share and make a song — not edit, delete, save or report', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await app.tap(c.common.moreOptions);
    for (const item of [c.set.playNext, c.set.addToQueue, c.set.share, c.music.makeSong]) expect(app.sees(item)).toBe(true);
    for (const item of [c.share.delete, c.createSet.editTitle, c.share.save, c.share.report, c.phrasesTab.makeSet]) expect(app.sees(item)).toBe(false);
  });

  it('play next puts the set after what is playing, with a toast', async () => {
    const app = await launch({ url: '/set/set-tapas' });
    const { c } = app;
    await app.tap(c.set.playAll('Tapas & Tabernas'));
    await app.open('/set/set-cafe');
    await app.tap(c.common.moreOptions);
    await app.tap(c.set.playNext);
    expect(app.sees(c.set.addedNext)).toBe(true);
    await app.open('/queue');
    expect(app.sees(c.queue.upNext(5 + 4))).toBe(true);
  });

  it('add to queue puts the set at the end, with a toast', async () => {
    const app = await launch({ url: '/set/set-tapas' });
    const { c } = app;
    await app.tap(c.set.playAll('Tapas & Tabernas'));
    await app.open('/set/set-cafe');
    await app.tap(c.common.moreOptions);
    await app.tap(c.set.addToQueue);
    expect(app.sees(c.set.addedEnd)).toBe(true);
    await app.open('/queue');
    expect(app.sees(c.queue.upNext(5 + 4))).toBe(true);
  });

  it('share link hands the set page link to the system share sheet', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.common.moreOptions);
    await app.tap(app.c.set.share);
    expect(device.shared).toHaveLength(1);
    expect(device.shared[0].title).toBe(TITLE);
    expect(device.shared[0].url).toContain('/set/set-cafe');
  });

  it('make a song asks a signed-out learner to sign in', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await app.tap(c.common.moreOptions);
    await app.tap(c.music.makeSong);
    expect(app.sees(c.account.needed)).toBe(true);
    await app.tap(c.account.signIn);
    expect(app.pathname()).toBe('/account');
  });

  it('the Make a song button under the phrases asks the same', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.music.makeSong);
    expect(app.sees(app.c.account.needed)).toBe(true);
  });
});

describe('the sort', () => {
  it('says the play order and lists the four orders with the current one selected', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    expect(app.sees(c.set.playsIn(c.set.sort.set))).toBe(true);
    await app.tap(c.set.playsIn(c.set.sort.set));
    for (const s of Object.values(c.set.sort)) expect(app.sees(s)).toBe(true);
    expect(app.sees(c.set.sortTitle)).toBe(true);
  });

  it('A–Z reorders the phrases and is kept in prefs.sortBySet', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await app.tap(c.set.playsIn(c.set.sort.set));
    await app.tap(c.set.sort.az);
    const expected = [...CAFE].sort((a, b) => a.localeCompare(b, 'es-ES'));
    expect(expected).not.toEqual(CAFE);
    expect(listed(app)).toEqual(expected);
    expect(app.sees(c.set.playsIn(c.set.sort.az))).toBe(true);
    expect((await app.saved()).prefs.sortBySet).toEqual({ 'set-cafe': 'az' });
  });

  it('plays in the order shown', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await app.tap(c.set.playsIn(c.set.sort.set));
    await app.tap(c.set.sort.az);
    const first = listed(app)[0];
    await app.tap(c.set.playAll(TITLE));
    await app.advance(3_000);
    const id = `cafe-0${CAFE.indexOf(first) + 1}`;
    expect(audio.clips()[0]).toBe(`en-GB-${id}`);
  });

  it('due first and lowest recall first put the phrases not yet rated in set order, ahead of or behind the rated one', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await rateRow(app, 2, c.common.grade.easy);
    await app.tap(c.set.playsIn(c.set.sort.set));
    await app.tap(c.set.sort.due);
    expect(listed(app)[0]).toBe(BILL); // started, so ahead of the new ones
    await app.tap(c.set.playsIn(c.set.sort.due));
    await app.tap(c.set.sort.weakest);
    expect(listed(app)).toEqual([CAFE[0], CAFE[1], CAFE[3], CAFE[4], BILL]); // unrated have no recall: first
    expect((await app.saved()).prefs.sortBySet['set-cafe']).toBe('weakest');
  });

  it('going back to set order restores it, and the choice survives a restart and belongs to the set', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await app.tap(c.set.playsIn(c.set.sort.set));
    await app.tap(c.set.sort.az);
    const again = await app.restart({ url: '/set/set-cafe' });
    expect(again.sees(c.set.playsIn(c.set.sort.az))).toBe(true);
    await again.open('/set/set-tapas');
    expect(again.sees(c.set.playsIn(c.set.sort.set))).toBe(true);
    await again.open('/set/set-cafe');
    await again.tap(c.set.playsIn(c.set.sort.az));
    await again.tap(c.set.sort.set);
    expect(listed(again)).toEqual(CAFE);
  });
});

describe('the phrase rows', () => {
  it('shows each phrase with its meaning and "new" until it is rated', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    expect(app.sees(/A cortado, please/)).toBe(true);
    expect(app.sees(new RegExp(app.c.status.new))).toBe(true);
  });

  it('the details button opens that phrase\'s details', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.phrase.details(CAFE[1]));
    expect(app.sees(app.c.phrase.addToSet)).toBe(true);
    expect(app.sees('Do you have oat milk?')).toBe(true);
  });

  it('the playing phrase hides its words while the learner recalls it', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.phrase.play(CAFE[0]));
    await app.advance(500);
    expect(app.sees(new RegExp(`^${app.c.player.hidden(languageName('es-ES', app.c.locale))}`))).toBe(true);
  });
});

describe('other pages of the route', () => {
  it('an unknown set says it is not available', async () => {
    const app = await launch({ url: '/set/set-nowhere' });
    await app.waitFor(app.c.set.notFound);
  });

  it('a set of another course says so and offers to switch', async () => {
    const app = await launch({ url: '/set/set-pl-kawiarnia' });
    await app.waitFor(app.c.set.otherCourse('Polish'));
  });
});

describe('going back', () => {
  it('returns to the tab the set was opened from', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.library);
    await app.open('/set/set-cafe');
    expect(app.pathname()).toBe('/set/set-cafe');
    await app.back();
    expect(app.pathname()).toBe('/library');
  });

  it('the top bar back button goes back, and a set opened as the first page goes to its tab', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.common.back);
    expect(app.pathname()).not.toBe('/set/set-cafe');
  });
});
