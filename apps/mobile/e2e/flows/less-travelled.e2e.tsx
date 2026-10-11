// The less-travelled interactions the other flows don't reach (found by coverage of the UI code):
// your own phrase (moved up, deleted with its confirm, notes written by the writer, the writer
// failing, a phrase added while its notes can't be written); the notes written again (another one,
// the earlier ones shown and hidden, a failed one); the share sheet's own share button; a set of
// another course switched to, the sort sheet closed, the set's menu (make a song signed out, make a
// set and rename by the return key of an own set); the History button under the one set started;
// the Learned tile, a library list played, and the end of that list played again; a tag's phrases
// played and their details; the Newest order of shared sets; shared albums of others listed in the
// Library and an album's own share button.
import { languageName } from '@shared/copy';
import { forgetKeptNotes } from '@shared/generate/noteCache';
import { communityAlbum, communitySet, lib, seedAlbum, seedSet } from '../fakes/library';
import { FakeApi, problem } from '../fakes/api';
import { act, audio, device, DAY, fireEvent, launch, screen, type App } from '../harness';

const EMAIL = 'ana@example.com';
const CORTADO = 'Me pone un cortado, por favor';
const AVENA = '¿Tienen leche de avena?';
const TITLE = 'Café & Mañanas';
const MENTAL = 'Cortado: a cut coffee';
// The written notes are kept in memory as well as on the device: forget them between launches, as a
// new device would have none.
beforeEach(() => forgetKeptNotes());

const targetField = (app: App) => app.c.addPhrase.target(languageName('es-ES', 'en-GB'));
const nativeField = (app: App) => app.c.addPhrase.native(languageName('en-GB', 'en-GB'));

/** Opens the details of a phrase from its row on the set page. */
async function openDetails(app: App, phrase: string): Promise<void> {
  await app.tap(app.c.phrase.details(phrase));
}

/** The phrases listed on the page, top to bottom. */
function listed(app: App): string[] {
  const prefix = app.c.phrase.details('');
  return screen.queryAllByLabelText(new RegExp(`^${prefix}`)).map((n) => String(n.props.accessibilityLabel).slice(prefix.length));
}

/** Presses the last button called `name` on screen: the open sheet's, above the page's own. */
async function pressLast(name: string): Promise<void> {
  const all = screen.getAllByRole('button', { name });
  await act(async () => {
    fireEvent.press(all[all.length - 1]);
  });
}

/** Makes the learner's set "Mis cafés" from the Cortado phrase, as the phrase details do. */
async function makeMySet(app: App): Promise<void> {
  const { c } = app;
  await openDetails(app, CORTADO);
  await app.tap(c.phrase.addToSet);
  await app.tap(c.addToSet.newSet);
  await app.type(c.createSet.name, 'Mis cafés');
  await pressLast(c.createSet.create);
  await app.settle();
}

/** Adds an own phrase in the Library's Mine list, as the learner does, and leaves the form. */
async function addOwnPhrase(app: App, target: string, native: string): Promise<void> {
  await app.tap(app.c.library.addPhrase);
  await app.type(targetField(app), target);
  await app.type(nativeField(app), native);
  await app.tap(app.c.addPhrase.add);
}

describe('your own phrase', () => {
  it('moves a phrase up in your set, and it is listed above the one before it', async () => {
    const app = await launch({ url: '/set/set-cafe', signedIn: EMAIL });
    const { c } = app;
    await makeMySet(app);
    const mine = app.pathname();
    await app.open('/set/set-cafe');
    await openDetails(app, AVENA);
    await app.tap(c.phrase.addToSet);
    await app.tap('Mis cafés');
    await app.open(mine);
    expect(listed(app)).toEqual([CORTADO, AVENA]);
    await app.tap(c.phrase.details(AVENA));
    await app.tap(c.phrase.moveUp);
    expect(listed(app)).toEqual([AVENA, CORTADO]);
  });

  it('is deleted after its confirm; Cancel in the confirm keeps it', async () => {
    const app = await launch({ url: '/library?view=mine', signedIn: EMAIL });
    const { c } = app;
    await addOwnPhrase(app, 'Buenos días', 'Good morning');
    await app.tap(c.phrase.details('Buenos días'));
    await app.tap(c.phrase.delete);
    device.answer(c.common.cancel);
    await app.settle();
    expect(app.sees(c.phrase.deleteConfirm('Buenos días'))).toBe(false);
    await app.tap(c.phrase.details('Buenos días'));
    await app.tap(c.phrase.delete);
    device.answer(c.phrase.delete);
    await app.settle();
    expect(app.sees(c.phrase.deleted)).toBe(true);
    expect(app.sees('Buenos días')).toBe(false);
  });

  it('asks the writer for the notes the rules wrote, and they are replaced by the writer’s', async () => {
    const api = new FakeApi();
    lib(api).config.ai = false;
    const app = await launch({ url: '/library?view=mine', signedIn: EMAIL, api });
    const { c } = app;
    await addOwnPhrase(app, 'Buenos días', 'Good morning');
    lib(api).config.ai = true;
    await app.restart({ url: '/library?view=mine' });
    await app.tap(c.phrase.details('Buenos días'));
    expect(app.sees(c.phrase.writeNotes)).toBe(true);
    await app.tap(c.phrase.writeNotes);
    expect(app.api.calls('POST /library/generate/notes')).toHaveLength(1);
    expect(app.sees(c.phrase.writeNotes)).toBe(false);
  });

  it('says the writer did not answer, and asks again', async () => {
    const api = new FakeApi();
    lib(api).config.ai = false;
    const app = await launch({ url: '/library?view=mine', signedIn: EMAIL, api });
    const { c } = app;
    await addOwnPhrase(app, 'Buenos días', 'Good morning');
    lib(api).config.ai = true;
    await app.restart({ url: '/library?view=mine' });
    await app.tap(c.phrase.details('Buenos días'));
    app.api.failNext('POST /library/generate/notes', problem(503, 'PROVIDER_UNAVAILABLE'));
    await app.tap(c.phrase.writeNotes);
    expect(app.sees(c.phrase.notesFailed)).toBe(true);
    await app.tap(c.phrase.writeNotes);
    expect(app.sees(c.phrase.notesFailed)).toBe(false);
    expect(app.sees(c.phrase.writeNotes)).toBe(false);
  });

  it('is added even when the writer fails to write its notes, and says so', async () => {
    const api = new FakeApi();
    lib(api).config.ai = true;
    const app = await launch({ url: '/library?view=mine', signedIn: EMAIL, api });
    app.api.failNext('POST /library/generate/notes', problem(503, 'PROVIDER_UNAVAILABLE'));
    await addOwnPhrase(app, 'Buenos días', 'Good morning');
    expect(app.sees(app.c.addPhrase.added)).toBe(true);
    await app.tap(app.c.phrase.details('Buenos días'));
    expect(app.sees('Good morning')).toBe(true);
  });
});

describe('the notes written again', () => {
  it('writes another mnemonic with the writer, and shows the earlier one on request', async () => {
    const api = new FakeApi();
    lib(api).config.ai = true;
    const app = await launch({ url: '/set/set-cafe', signedIn: EMAIL, api });
    const { c } = app;
    await openDetails(app, CORTADO);
    await app.tap(c.phrase.noteAgain.mnemonic);
    expect(app.sees('Another mnemonic (2)')).toBe(true);
    expect(app.sees(c.phrase.noteEarlier(1))).toBe(true);
    expect(app.sees(MENTAL)).toBe(false);
    await app.tap(c.phrase.noteEarlier(1));
    expect(app.sees(MENTAL)).toBe(true);
    await app.tap(c.phrase.noteHideEarlier);
    expect(app.sees(MENTAL)).toBe(false);
  });

  it('a failed note keeps the one shown, and writes no earlier one', async () => {
    const api = new FakeApi();
    lib(api).config.ai = true;
    const app = await launch({ url: '/set/set-cafe', signedIn: EMAIL, api });
    const { c } = app;
    await openDetails(app, CORTADO);
    app.api.failNext('POST /library/generate/note', problem(503, 'PROVIDER_UNAVAILABLE'));
    await app.tap(c.phrase.noteAgain.mnemonic);
    expect(app.sees('Another mnemonic (2)')).toBe(false);
    expect(app.sees(MENTAL)).toBe(true);
    expect(app.sees(c.phrase.noteEarlier(1))).toBe(false);
    expect(app.sees(c.phrase.noteAgain.mnemonic)).toBe(true);
  });
});

describe('the share sheet', () => {
  it('its Share button passes the set’s link on to the system share', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    const set = seedSet(api, user, { title: 'Compras de Ana', phrases: [{ target: 'Un kilo de tomates', native: 'A kilo of tomatoes' }], visibility: 'link' });
    const app = await launch({ url: `/set/${set.id}`, signedIn: EMAIL, api });
    await app.tap(app.c.common.moreOptions);
    await app.tap(`${app.c.share.share} · ${app.c.share.link}`);
    await pressLast(app.c.share.share);
    await app.settle();
    const shared = device.shared.at(-1)!;
    expect(shared.url).toMatch(new RegExp(`/shared/${set.shareCode}$`));
  });
});

describe('a set’s page and its menu', () => {
  it('switches to the course of a set from another course', async () => {
    const app = await launch({ url: '/set/set-pl-kawiarnia' });
    const { c } = app;
    await app.waitFor(c.set.otherCourse('Polish'));
    await app.tap(c.set.switchCourse('Polish'));
    expect(app.sees(c.set.otherCourse('Polish'))).toBe(false);
  });

  it('the sort sheet closes with its Close button, and the order stays', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await app.tap(c.set.playsIn(c.set.sort.set));
    expect(app.sees(c.set.sortTitle)).toBe(true);
    await app.tap(c.common.close);
    expect(app.sees(c.set.sortTitle)).toBe(false);
    expect(app.sees(c.set.playsIn(c.set.sort.set))).toBe(true);
  });

  it('Make a song from the menu asks a signed-out learner to sign in', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await app.tap(c.common.moreOptions);
    await app.tap(c.music.makeSong);
    expect(app.sees(c.account.needed)).toBe(true);
    expect(app.api.requests.filter((r) => r.method !== 'GET')).toEqual([]);
  });

  it('Make a set from the menu of your own set opens the make page', async () => {
    const app = await launch({ url: '/set/set-cafe', signedIn: EMAIL });
    await makeMySet(app);
    await app.tap(app.c.common.moreOptions);
    await app.tap(app.c.phrasesTab.makeSet);
    expect(app.pathname()).toBe('/make');
  });

  it('renaming your set takes the return key of its name field', async () => {
    const app = await launch({ url: '/set/set-cafe', signedIn: EMAIL });
    const { c } = app;
    await makeMySet(app);
    await app.tap(c.common.moreOptions);
    await app.tap(c.createSet.editTitle);
    await app.type(c.createSet.name, 'Cafés de tarde');
    await app.submit(c.createSet.name);
    expect(app.sees('Cafés de tarde')).toBe(true);
  });
});

describe('Home and the Library', () => {
  it('a set started, and no other played, is History at the foot of Home, listing its run', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await app.tap(c.set.playAll(TITLE));
    await app.advance(8_000);
    await app.tap(c.player.rateAs(c.common.grade.easy));
    await app.open('/');
    await app.tap(c.home.history);
    expect(app.sees(c.history.title)).toBe(true);
    expect(app.sees(c.history.empty)).toBe(false);
  });

  it('the Learned figure opens the Learned list', async () => {
    const app = await launch({ url: '/library' });
    await app.tap(app.c.library.learnedNote(21, 3));
    expect(app.sees(app.c.library.empty.learned(21, 3))).toBe(true);
  });

  it('Play in a list plays its phrases from the first, and the end of the list can be played again', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await app.tap(c.phrase.play(CORTADO));
    await app.advance(8_000);
    await app.tap(c.player.rateAs(c.common.grade.easy));
    await app.open('/library?view=learning');
    await app.tap(c.library.playAll(1));
    await app.advance(3_000);
    expect(audio.clips().at(-1)).toBe('en-GB-cafe-01');
    // Rated already, it is not rated again: the player's Next takes it to the end of the list.
    await app.open('/player');
    await app.tap(c.player.next);
    expect(app.sees(c.player.end.playAgain)).toBe(true);
    await app.tap(c.player.end.playAgain);
    await app.advance(3_000);
    expect(audio.clips().at(-1)).toBe('en-GB-cafe-01');
  });
});

describe('the Explore tags', () => {
  it('a tag’s phrase plays from its row, and its details open from the same row', async () => {
    const app = await launch();
    const { c } = app;
    await app.tap(c.tabs.explore);
    await app.tap(c.common.tag.food);
    await app.tap(c.phrase.play(CORTADO));
    await app.advance(3_000);
    expect(audio.clips()[0]).toBe('en-GB-cafe-01');
    await app.tap(c.phrase.details(CORTADO));
    expect(app.sees(c.phrase.addToSet)).toBe(true);
  });
});

describe('Community', () => {
  it('Newest puts the shared sets back in the newest order after Most saved', async () => {
    const api = new FakeApi();
    communitySet(api, { title: 'Compras de Marta', displayName: 'Marta', phrases: [{ target: 'Un kilo de tomates', native: 'A kilo of tomatoes' }] });
    const app = await launch({ api });
    const { c } = app;
    await app.tap(c.tabs.explore);
    await app.tap(c.community.sortPopular);
    await app.tap(c.community.sortNew);
    expect(app.api.calls('GET /library/community').at(-1)?.path).toContain('sort=new');
  });

  it('the shared albums of others are listed in the Library, not the learner’s own', async () => {
    const api = new FakeApi();
    const set = communitySet(api, { title: 'Compras de Marta', displayName: 'Marta', phrases: [{ target: 'Un kilo de tomates', native: 'A kilo of tomatoes' }] });
    communityAlbum(api, { title: 'Álbum de Marta', displayName: 'Marta', setId: set.id });
    const app = await launch({ url: '/library?view=albums', api });
    expect(app.sees('Álbum de Marta')).toBe(true);
    expect(app.sees(app.c.community.emptyAlbums)).toBe(false);
  });

  it('an album shared by link is shared again from its own page', async () => {
    const api = new FakeApi();
    const user = api.addUser(EMAIL);
    const set = seedSet(api, user, { title: 'Compras de Ana', phrases: [{ target: 'Un kilo de tomates', native: 'A kilo of tomatoes' }], visibility: 'link' });
    const album = seedAlbum(api, user, { title: 'Álbum de Ana', visibility: 'link', setId: set.id });
    const app = await launch({ url: `/album/${album.id}`, signedIn: EMAIL, api });
    await app.tap(app.c.share.share, { index: 0 });
    await pressLast(app.c.share.share);
    await app.settle();
    expect(device.shared.at(-1)?.url).toMatch(new RegExp(`/shared/${album.shareCode}$`));
  });
});

describe('Explore: the topics once a level is chosen', () => {
  it('with a level chosen, the topics come as chips, and one narrows the sets to it', async () => {
    const app = await launch();
    const { c } = app;
    await app.tap(c.tabs.explore);
    await app.tap('A1');
    await app.tap('Eating out');
    expect(app.sees(c.explore.removeFilter('Eating out'))).toBe(true);
    expect(app.sees(c.explore.removeFilter('A1'))).toBe(true);
  });
});

describe('the queue and the end of a pass', () => {
  it('the phrase now playing opens its details from the queue', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await app.tap(c.set.playAll(TITLE));
    await app.advance(3_000);
    await app.open('/queue');
    const byTarget = c.phrase.details(CORTADO);
    await app.tap(app.sees(byTarget) ? byTarget : c.phrase.details('A cortado, please'));
    expect(app.sees(c.phrase.addToSet)).toBe(true);
  });

  it('the session summary opened from the pass notice closes with its Close button', async () => {
    const app = await launch({ url: '/set/set-cafe', learner: { prefs: { repeats: 1, playMode: 'continue' } } });
    const { c } = app;
    await app.tap(c.set.playAll(TITLE));
    await app.tap(new RegExp(`^${c.player.dialog}`));
    for (let i = 0; i < 5; i++) await app.tap(c.player.next);
    await app.tap(c.player.summary);
    expect(app.sees(c.summary.title)).toBe(true);
    await app.tap(c.common.close);
    expect(app.sees(c.summary.title)).toBe(false);
  });
});

describe('Home: the set being learned under a review', () => {
  it('with a review due, the set being learned is still offered below it, and opens', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await app.tap(c.set.playAll(TITLE));
    await app.advance(8_000);
    await app.tap(c.player.rateAs(c.common.grade.easy));
    await app.skip(DAY);
    await app.open('/');
    expect(app.sees(c.home.reviewTitle)).toBe(true);
    await app.tap(TITLE);
    expect(app.pathname()).toBe('/set/set-cafe');
  });
});

describe('the cover of a set', () => {
  it('signed out, drawing a cover asks to sign in first', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await app.tap(coverChip(app));
    expect(app.sees(c.account.needed)).toBe(true);
    await app.tap(c.account.signIn);
    expect(app.pathname()).toBe('/account');
  });

  it('when its earlier covers cannot be had, it can still be drawn', async () => {
    const app = await launch({ url: '/set/set-cafe', signedIn: EMAIL });
    const { c } = app;
    await makeMySet(app);
    const id = app.pathname().split('/').pop()!;
    app.api.failNext(`GET /library/covers/set/${id}`, problem(500, 'INTERNAL'));
    await app.tap(coverChip(app));
    expect(app.sees(c.share.coverEarlier)).toBe(false);
    expect(app.sees(c.share.cover)).toBe(true);
  });
});

/** The chip that draws the player's phrase a new cover: named by its words, so by its prefix. */
function coverChip(app: App): RegExp {
  const label = app.c.share.coverFor('');
  return new RegExp(`^${label.slice(0, label.indexOf('“') + 1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
}
