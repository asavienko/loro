// A phrase's details, and the sheets around it (P3-01, CC-03, CC-04, P2-07). Covers: opening the
// details from a set's row; what they show (set name, phrase, meaning, sounds, language, status,
// tags, register, no AI by-line on a Loro phrase); Play; play next / add to queue (and disabled
// for the phrase playing); liking and unliking; the notes tabs (mnemonic, grammar, sounds) and
// "write another" asking a signed-out learner to sign in; add to set → the add-to-set sheet, the
// "New set…" sheet (name, create, signed out → sign-in); the sheet's Close and pulling it down; no report in a Loro
// phrase's details; the Library "+" sheet (add a phrase, new set, make a set); a set the learner
// made, signed in (create from a phrase, add to it, rename, move and remove phrases, delete with
// its confirm dialog); and the "Liked phrases" set page (summary, play, rows, details, unlike,
// empty).
import { audio, device, launch, screen, type App } from '../harness';

const TITLE = 'Café & Mañanas';
const CORTADO = 'Me pone un cortado, por favor';
const AVENA = '¿Tienen leche de avena?';

/** Opens the details of a phrase from its row on the set page. */
async function openDetails(app: App, phrase: string): Promise<void> {
  await app.tap(app.c.phrase.details(phrase));
}

/** The requests the app sent with this method to a path matching `path`. */
const sent = (app: App, method: string, path: RegExp) => app.api.requests.filter((r) => r.method === method && path.test(r.path.split('?')[0]));

/** The sheet's Create button (the tab bar has a "Create" too; the sheet's is the last on screen). */
async function createButton(app: App): Promise<void> {
  const all = screen.queryAllByText(app.c.createSet.create);
  await app.tap(app.c.createSet.create, { index: all.length - 1 });
}

describe('opening the details', () => {
  it('shows the phrase, its meaning, sounds, status and tags under its set', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await openDetails(app, CORTADO);
    expect(app.sees('A cortado, please')).toBe(true);
    expect(app.sees('[me ˈpo.ne uŋ koɾˈta.ðo poɾ faˈβoɾ]')).toBe(true);
    expect(app.sees(new RegExp(`^${c.status.new}`))).toBe(true);
    for (const tag of ['request', 'food', 'politeness'] as const) expect(app.sees(c.common.tag[tag])).toBe(true);
    expect(app.sees(c.phrase.notesByAi)).toBe(false);
    expect(app.sees(c.phrase.edit)).toBe(false); // not the learner's own
    expect(app.sees(c.phrase.delete)).toBe(false);
    expect(app.sees(c.phrase.removeFromSet)).toBe(false);
  });

  it('Close shuts the sheet and leaves the set page as it was', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await openDetails(app, CORTADO);
    expect(app.sees(app.c.phrase.addToSet)).toBe(true);
    await app.tap(app.c.common.close);
    expect(app.sees(app.c.phrase.addToSet)).toBe(false);
    expect(app.pathname()).toBe('/set/set-cafe');
  });

  it('pulling the sheet down closes it', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await openDetails(app, CORTADO);
    await app.swipe(app.c.common.close, { dy: 600 });
    await app.advance(1_000);
    expect(app.sees(app.c.phrase.addToSet)).toBe(false);
    expect(app.pathname()).toBe('/set/set-cafe');
  });

  it('has no report: only a set someone else shares can be reported', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await openDetails(app, CORTADO);
    expect(app.sees(app.c.share.report)).toBe(false);
  });

  it('a heard phrase says how often', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.phrase.play(CORTADO));
    await app.advance(8_000);
    await app.tap(app.c.player.rateAs(app.c.common.grade.easy));
    await openDetails(app, CORTADO);
    expect(app.sees(/heard \d+×/)).toBe(true);
  });
});

describe('Play, queue and like', () => {
  it('Play closes the sheet and plays that phrase', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await openDetails(app, AVENA);
    await app.tap(app.c.common.play);
    await app.advance(3_000);
    expect(app.sees(app.c.phrase.addToSet)).toBe(false);
    expect(audio.clips()[0]).toBe('en-GB-cafe-02');
  });

  it('Play next toasts and closes the sheet', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.set.playAll(TITLE));
    await openDetails(app, '¿Nos podemos sentar en la terraza?');
    await app.tap(app.c.phrase.playNext);
    expect(app.sees(app.c.set.addedNext)).toBe(true);
    expect(app.sees(app.c.phrase.addToSet)).toBe(false);
  });

  it('Add to queue toasts and closes the sheet', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.set.playAll(TITLE));
    await openDetails(app, 'Sin gluten, por favor');
    await app.tap(app.c.phrase.addToQueue);
    expect(app.sees(app.c.set.addedEnd)).toBe(true);
    expect(app.sees(app.c.phrase.addToSet)).toBe(false);
  });

  it('the phrase that is playing cannot be queued after itself', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.set.playAll(TITLE)); // cafe-01, whose words stay hidden while it is recalled
    await openDetails(app, 'A cortado, please');
    await app.tap(app.c.phrase.playNext);
    await app.tap(app.c.phrase.addToQueue);
    expect(app.sees(app.c.set.addedNext)).toBe(false);
    expect(app.sees(app.c.set.addedEnd)).toBe(false);
    expect(app.sees(app.c.phrase.addToSet)).toBe(true); // still open
  });

  it('like and unlike toggle the heart and are saved on the device', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await openDetails(app, CORTADO);
    await app.tap(app.c.phrase.like);
    expect(app.sees(app.c.phrase.liked)).toBe(true);
    expect((await app.saved()).learner.likes['phrase:cafe-01']?.liked).toBe(true);
    await app.tap(app.c.phrase.liked);
    expect(app.sees(app.c.phrase.like)).toBe(true);
    expect((await app.saved()).learner.likes['phrase:cafe-01']?.liked).toBe(false);
  });
});

describe('the notes', () => {
  it('open on the mnemonic, with tabs for grammar and sounds', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await openDetails(app, CORTADO);
    expect(app.sees('Cortado: a cut coffee')).toBe(true);
    await app.tap(c.phrase.notes.grammar);
    expect(app.sees('«Me pone…»')).toBe(true);
    expect(app.sees(/the everyday way to order in Spain/)).toBe(true);
    expect(app.sees('Cortado: a cut coffee')).toBe(false);
    await app.tap(c.phrase.notes.pronunciation);
    expect(app.sees('Soft d, ng before c')).toBe(true);
    expect(app.sees(/The d in cortado is soft/)).toBe(true);
    await app.tap(c.phrase.notes.mnemonic);
    expect(app.sees('Cortado: a cut coffee')).toBe(true);
  });

  it('writing another mnemonic asks a signed-out learner to sign in', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await openDetails(app, CORTADO);
    await app.tap(c.phrase.noteAgain.mnemonic);
    expect(app.sees(c.account.needed)).toBe(true);
    expect(app.api.requests.filter((r) => r.method !== 'GET')).toEqual([]);
  });

  it('explaining the grammar another way asks the same, and the message goes with the tab', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await openDetails(app, CORTADO);
    await app.tap(c.phrase.notes.grammar);
    await app.tap(c.phrase.noteAgain.grammar);
    expect(app.sees(c.account.needed)).toBe(true);
    await app.tap(c.phrase.notes.mnemonic);
    expect(app.sees(c.account.needed)).toBe(false);
  });

  it('the sounds tab has no "write again" button', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await openDetails(app, CORTADO);
    await app.tap(app.c.phrase.notes.pronunciation);
    expect(app.sees(app.c.phrase.noteAgain.mnemonic)).toBe(false);
    expect(app.sees(app.c.phrase.noteAgain.grammar)).toBe(false);
  });
});

describe('add to set, signed out', () => {
  it('lists no sets yet and offers a new one', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await openDetails(app, CORTADO);
    await app.tap(c.phrase.addToSet);
    expect(app.sees(c.addToSet.title)).toBe(true);
    expect(app.sees(c.addToSet.none)).toBe(true);
    expect(app.sees(c.addToSet.newSet)).toBe(true);
  });

  it('the new-set sheet needs a name, then sends a signed-out learner to sign in', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await openDetails(app, CORTADO);
    await app.tap(c.phrase.addToSet);
    await app.tap(c.addToSet.newSet);
    expect(app.sees(c.createSet.title)).toBe(true);
    // Create is disabled while the name is empty.
    await createButton(app);
    expect(app.sees(c.createSet.title)).toBe(true); // nothing happened
    await app.type(c.createSet.name, 'Mis cafés');
    await createButton(app);
    expect(app.pathname()).toBe('/account');
    expect(app.api.requests.filter((r) => r.method !== 'GET')).toEqual([]);
  });

  it('submitting the name with the keyboard does the same', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    await openDetails(app, CORTADO);
    await app.tap(c.phrase.addToSet);
    await app.tap(c.addToSet.newSet);
    await app.type(c.createSet.name, 'Mis cafés');
    await app.submit(c.createSet.name);
    expect(app.pathname()).toBe('/account');
  });

  it('Close on the add-to-set sheet leaves the learner on the set', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await openDetails(app, CORTADO);
    await app.tap(app.c.phrase.addToSet);
    await app.tap(app.c.common.close);
    expect(app.sees(app.c.addToSet.title)).toBe(false);
    expect(app.pathname()).toBe('/set/set-cafe');
  });
});

describe('the Library "+" sheet', () => {
  // AddSheet (add a phrase / new set / make a set) is mounted by the shell, but nothing in the app
  // calls the shell's openAdd any more, so a learner cannot open it.
  it.todo('lists add a phrase, new set and make a set, each handing over to its own sheet or screen');
});

describe('a set the learner made (signed in)', () => {
  const EMAIL = 'ana@example.test';

  /** Makes "Mis cafés" holding the cortado phrase, through details → add to set → new set. */
  async function makeSet(app: App): Promise<void> {
    const { c } = app;
    await openDetails(app, CORTADO);
    await app.tap(c.phrase.addToSet);
    await app.tap(c.addToSet.newSet);
    await app.type(c.createSet.name, 'Mis cafés');
    await createButton(app);
  }

  it('is created from a phrase, opens on the new set page, and shows it as the learner\'s own', async () => {
    const app = await launch({ url: '/set/set-cafe', signedIn: EMAIL });
    await makeSet(app);
    expect(app.api.calls('POST /library/sets')).toHaveLength(1);
    expect(app.pathname()).toMatch(/^\/set\/(?!set-cafe)/);
    expect(app.sees('Mis cafés')).toBe(true);
    expect(app.sees(app.c.set.own)).toBe(true);
    expect(app.sees(CORTADO)).toBe(true);
    expect(app.sees(app.c.createSet.created('Mis cafés'))).toBe(true);
  });

  it('a second phrase is added to it from the add-to-set sheet, and a repeat says it is already there', async () => {
    const app = await launch({ url: '/set/set-cafe', signedIn: EMAIL });
    await makeSet(app);
    await app.open('/set/set-cafe');
    await openDetails(app, AVENA);
    await app.tap(app.c.phrase.addToSet);
    await app.tap('Mis cafés');
    expect(app.sees(app.c.addToSet.added('Mis cafés'))).toBe(true);
    await openDetails(app, AVENA);
    await app.tap(app.c.phrase.addToSet);
    await app.tap('Mis cafés');
    expect(app.sees(app.c.addToSet.already('Mis cafés'))).toBe(true);
  });

  it('renames through its menu and the name and description are sent to the server', async () => {
    const app = await launch({ url: '/set/set-cafe', signedIn: EMAIL });
    await makeSet(app);
    await app.tap(app.c.common.moreOptions);
    await app.tap(app.c.createSet.editTitle);
    await app.type(app.c.createSet.name, 'Cafés de Madrid');
    await app.type(app.c.createSet.description, 'Los de mi barrio');
    await app.tap(app.c.common.save);
    expect(sent(app, 'POST', /^\/library\/sets\/[^/]+$/)).toHaveLength(1);
    expect(app.sees('Cafés de Madrid')).toBe(true);
    expect(app.sees(app.c.share.changed)).toBe(true);
  });

  it('delete asks first: cancel keeps the set, confirm removes it and goes back', async () => {
    const app = await launch({ url: '/library', signedIn: EMAIL });
    await app.open('/set/set-cafe');
    await makeSet(app);
    const here = app.pathname();
    await app.tap(app.c.common.moreOptions);
    await app.tap(app.c.share.delete);
    expect(device.dialogs).toHaveLength(1);
    device.answer(app.c.common.cancel);
    await app.settle();
    expect(app.pathname()).toBe(here);
    expect(sent(app, 'DELETE', /^\/library\/sets\/[^/]+$/)).toHaveLength(0);
    await app.tap(app.c.common.moreOptions);
    await app.tap(app.c.share.delete);
    device.answer(app.c.share.delete);
    await app.settle();
    expect(sent(app, 'DELETE', /^\/library\/sets\/[^/]+$/)).toHaveLength(1);
    expect(app.pathname()).not.toBe(here);
  });

  it('a phrase can be moved down and up in it, and taken out with an undo', async () => {
    const app = await launch({ url: '/set/set-cafe', signedIn: EMAIL });
    await makeSet(app);
    const mine = app.pathname();
    await app.open('/set/set-cafe');
    await openDetails(app, AVENA);
    await app.tap(app.c.phrase.addToSet);
    await app.tap('Mis cafés');
    await app.open(mine);
    await app.tap(app.c.phrase.details(CORTADO));
    expect(app.sees(app.c.phrase.moveDown)).toBe(true);
    expect(app.sees(app.c.phrase.moveUp)).toBe(false);
    await app.tap(app.c.phrase.moveDown);
    await app.tap(app.c.phrase.details(CORTADO));
    expect(app.sees(app.c.phrase.moveUp)).toBe(true);
    await app.tap(app.c.phrase.removeFromSet);
    expect(app.sees(app.c.phrase.removedFromSet)).toBe(true);
    await app.tap(app.c.common.undo);
    expect(app.sees(CORTADO)).toBe(true);
  });
});

describe('the "Liked phrases" set', () => {
  it('is empty until a phrase is liked', async () => {
    const app = await launch({ url: '/set/liked' });
    const { c } = app;
    expect(app.sees(c.library.likedPhrases)).toBe(true);
    expect(app.sees(c.library.empty.liked)).toBe(true);
    expect(app.sees(c.set.summary(0, 0, 0))).toBe(true);
  });

  it('lists liked phrases, newest like first, with real figures, and plays them', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    for (const phrase of [CORTADO, AVENA]) {
      await openDetails(app, phrase);
      await app.tap(c.phrase.like);
      await app.tap(c.common.close);
      await app.advance(1_000); // the later like is the newer
    }
    await app.open('/set/liked');
    expect(app.sees(c.set.summary(2, 0, 0))).toBe(true);
    const rows = screen.queryAllByLabelText(new RegExp(`^${c.phrase.details('')}`)).map((n) => String(n.props.accessibilityLabel));
    expect(rows).toEqual([c.phrase.details(AVENA), c.phrase.details(CORTADO)]);
    await app.tap(c.library.playAll(2));
    await app.advance(3_000);
    expect(audio.clips()[0]).toBe('en-GB-cafe-02');
  });

  it('a row plays from that phrase, its details open, and unliking there takes the phrase off the list', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    for (const phrase of [CORTADO, AVENA]) {
      await openDetails(app, phrase);
      await app.tap(c.phrase.like);
      await app.tap(c.common.close);
      await app.advance(1_000); // the later like is the newer
    }
    await app.open('/set/liked');
    await app.tap(c.phrase.play(CORTADO));
    await app.advance(3_000);
    expect(audio.clips()[0]).toBe('en-GB-cafe-01');
    await openDetails(app, CORTADO);
    await app.tap(c.phrase.liked);
    await app.tap(c.common.close);
    expect(app.sees(c.phrase.details(CORTADO))).toBe(false);
    expect(app.sees(c.phrase.details(AVENA))).toBe(true);
  });

  it('back leaves the page', async () => {
    const app = await launch({ url: '/library' });
    await app.open('/set/liked');
    await app.tap(app.c.common.back);
    expect(app.pathname()).toBe('/library');
  });

  it('opens from the Library\'s sets list', async () => {
    const app = await launch({ url: '/library' });
    await app.tap(app.c.library.setsSegment);
    await app.tap(app.c.library.likedPhrases);
    expect(app.pathname()).toBe('/set/liked');
  });
});
