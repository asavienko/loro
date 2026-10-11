// The Create tab and the sheets that make single things (P2-07, P2-06, LIB-02, F-01).
//
// Covered:
// - Create tab: signed out (the sign-in banner and button; the phrases card asks for an account; the
//   song card opens the song sheet); signed in (each card with the day's allowance and who writes it,
//   when the allowance resets, an allowance counting down, none left, the phrase bank's label with no
//   AI; the phrases card opens Make a set; "Your sets" and "Your albums" listed and opened).
// - Add your phrase (AddPhraseSheet): opened from Library, from Make a set's "no match" offer; signed
//   out → sign-in first; both fields needed, a phrase with nothing to say aloud refused, character
//   counts near the limit, the duplicate note, adding by the button and by the keyboard, notes
//   written by AI for it (and not for a bank phrase or without AI), the "Phrase added" toast and its
//   Play action, a failed save keeping the form, editing it (Save only once changed).
// - New set (CreateSetSheet): the name needed, a same name said, Create → POST /library/sets and the
//   set opens; Rename.
// - Add phrases to a set (PickPhrasesSheet): the search, groups, each Add / Added toggle (POST add and
//   remove), the confirmation before taking out a phrase that only this set holds, Done.
import { FIXTURE } from '@shared/content/fixture';
import { languageName } from '@shared/copy';
import { FakeApi, problem } from '../fakes/api';
import { lib, seedAlbum, seedSet } from '../fakes/library';
import { act, audio, device, fireEvent, launch, screen, type App } from '../harness';

const EMAIL = 'ana@example.com';
const targetField = (app: App) => app.c.addPhrase.target(languageName('es-ES', 'en-GB'));
const nativeField = (app: App) => app.c.addPhrase.native(languageName('en-GB', 'en-GB'));
/** Whether the button called `label` is shown disabled. */
const disabled = (label: string): boolean => screen.queryByRole('button', { name: label, disabled: true }) !== null;

/** Presses the button called `label` (a word the tab bar may share, like Create). */
async function press(app: App, label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: label }));
  });
  await app.settle();
}

const card = (title: string) => new RegExp(`^${title}\\.`);

/** A server with the learner's account on it, before the app starts. */
function server(): { api: FakeApi; user: ReturnType<FakeApi['addUser']> } {
  const api = new FakeApi();
  return { api, user: api.addUser(EMAIL) };
}

describe('Create: signed out', () => {
  it('asks to sign in, with a button that leads to the sign-in page', async () => {
    const app = await launch({ url: '/create' });
    const { c } = app;
    expect(app.sees(c.create.title)).toBe(true);
    expect(app.sees(c.account.needed)).toBe(true);
    await app.tap(c.account.signIn);
    expect(app.pathname()).toBe('/account');
  });

  it('shows both cards without an allowance, as none is known', async () => {
    const app = await launch({ url: '/create' });
    const { c } = app;
    expect(app.sees(`${c.create.phrasesTitle}. ${c.create.phrasesBody}`)).toBe(true);
    expect(app.sees(`${c.create.songTitle}. ${c.create.songBody}`)).toBe(true);
    expect(app.sees(new RegExp(c.create.none))).toBe(false);
    expect(app.api.calls('GET /library/usage')).toEqual([]);
  });

  it('the phrases card leads to the sign-in page, not to Make a set', async () => {
    const app = await launch({ url: '/create' });
    await app.tap(card(app.c.create.phrasesTitle));
    expect(app.pathname()).toBe('/account');
  });

  it('the song card opens the song sheet', async () => {
    const app = await launch({ url: '/create' });
    await app.tap(card(app.c.create.songTitle));
    expect(app.sees(app.c.music.makeSong)).toBe(true);
  });
});

describe('Create: signed in', () => {
  it('shows each card with what is left today and who writes it', async () => {
    const app = await launch({ url: '/create', signedIn: EMAIL });
    const { c } = app;
    expect(app.sees(c.account.needed)).toBe(false);
    expect(app.sees(`${c.create.phrasesTitle}. ${c.create.phrasesBody}. ${c.create.left(30)} · ${c.create.source.ai}`)).toBe(true);
    expect(app.sees(`${c.create.songTitle}. ${c.create.songBody}. ${c.create.left(5)} · ${c.create.source.demo}`)).toBe(true);
  });

  it('says when the allowance resets', async () => {
    const app = await launch({ url: '/create', signedIn: EMAIL });
    expect(app.sees(/^Resets at \d\d:\d\d$/)).toBe(true);
  });

  it('counts the allowance down as phrases are asked for', async () => {
    const app = await launch({ url: '/create', signedIn: EMAIL });
    const { c } = app;
    await app.tap(card(c.create.phrasesTitle));
    expect(app.pathname()).toBe('/make');
    await app.type(c.make.field.topic, 'hotel');
    await app.tap(c.make.suggest);
    await app.advance(2_000);
    await app.back();
    expect(app.pathname()).toBe('/create');
    expect(app.sees(`${c.create.phrasesTitle}. ${c.create.phrasesBody}. ${c.create.left(29)} · ${c.create.source.ai}`)).toBe(true);
  });

  it('says none are left when the day’s allowance is spent', async () => {
    const { api } = server();
    api.limits.phrases = 0;
    const app = await launch({ url: '/create', signedIn: EMAIL, api });
    const { c } = app;
    expect(app.sees(`${c.create.phrasesTitle}. ${c.create.phrasesBody}. ${c.create.none} · ${c.create.source.ai}`)).toBe(true);
  });

  it('names the phrase bank on a server with no AI', async () => {
    const { api } = server();
    lib(api).config.ai = false;
    const app = await launch({ url: '/create', signedIn: EMAIL, api });
    const { c } = app;
    expect(app.sees(`${c.create.phrasesTitle}. ${c.create.phrasesBody}. ${c.create.left(30)} · ${c.create.source.bank}`)).toBe(true);
  });

  it('the song card opens the song sheet', async () => {
    const app = await launch({ url: '/create', signedIn: EMAIL });
    await app.tap(card(app.c.create.songTitle));
    expect(app.sees(app.c.music.makeSong)).toBe(true);
  });

  it('lists the learner’s own sets and albums, and opens each', async () => {
    const { api, user } = server();
    const made = seedSet(api, user, { title: 'Mi viaje', phrases: [{ target: 'Buenos días', native: 'Good morning' }] });
    seedAlbum(api, user, { title: 'Mis canciones', setId: made.id, songs: [{ status: 'ready' }, { status: 'ready' }] });
    const app = await launch({ url: '/create', signedIn: EMAIL, api });
    const { c } = app;
    expect(app.sees(c.phrasesTab.yourSets)).toBe(true);
    expect(app.sees('Mi viaje')).toBe(true);
    expect(app.sees(`${c.common.phrases(1)} · ${c.share.private}`)).toBe(true);
    expect(app.sees(c.music.yours)).toBe(true);
    expect(app.sees('Mis canciones')).toBe(true);
    expect(app.sees(`${c.music.songs(2)} · ${c.share.private}`)).toBe(true);

    await app.tap('Mis canciones');
    expect(app.pathname()).toMatch(/^\/album\//);
    await app.back();
    await app.tap('Mi viaje');
    expect(app.pathname()).toBe(`/set/${made.id}`);
    expect(app.sees('Buenos días')).toBe(true);
  });

  it('lists nothing of the learner’s own when they have made none', async () => {
    const app = await launch({ url: '/create', signedIn: EMAIL });
    expect(app.sees(app.c.phrasesTab.yourSets)).toBe(false);
    expect(app.sees(app.c.music.yours)).toBe(false);
  });

  it('keeps another course’s sets out of the list', async () => {
    const { api, user } = server();
    seedSet(api, user, { title: 'Moj sutrin', targetLang: 'bg-BG', phrases: [{ target: 'Добро утро', native: 'Good morning' }] });
    const app = await launch({ url: '/create', signedIn: EMAIL, api });
    expect(app.sees('Moj sutrin')).toBe(false);
  });
});

describe('Add your phrase', () => {
  async function openForm(app: App): Promise<void> {
    await app.open('/library?view=mine');
    await app.tap(app.c.library.addPhrase);
  }

  it('asks a signed-out learner to sign in first', async () => {
    const app = await launch({ url: '/library?view=mine' });
    await app.tap(app.c.library.addPhrase);
    await app.type(targetField(app), 'Buenos días');
    await app.type(nativeField(app), 'Good morning');
    await app.tap(app.c.addPhrase.add);
    expect(app.pathname()).toBe('/account');
    expect(app.api.calls('POST /library/phrases')).toEqual([]);
  });

  it('opens empty, with both languages named and the hint about the voice', async () => {
    const app = await launch({ signedIn: EMAIL });
    await openForm(app);
    const { c } = app;
    expect(app.sees(c.addPhrase.title)).toBe(true);
    expect(screen.getByLabelText(targetField(app)).props.value).toBe('');
    expect(screen.getByLabelText(nativeField(app)).props.value).toBe('');
    expect(app.sees(c.addPhrase.hint)).toBe(true);
  });

  it('adds only once both languages have words, and something to say aloud', async () => {
    const app = await launch({ signedIn: EMAIL });
    await openForm(app);
    const { c } = app;
    const isDisabled = () => disabled(c.addPhrase.add);
    expect(isDisabled()).toBe(true);
    await app.type(targetField(app), 'Buenos días');
    expect(isDisabled()).toBe(true);
    await app.type(nativeField(app), '   ');
    expect(isDisabled()).toBe(true);
    await app.type(nativeField(app), 'Good morning');
    expect(isDisabled()).toBe(false);
    // Punctuation alone has nothing to say aloud.
    await app.type(targetField(app), '¡¡!!');
    expect(isDisabled()).toBe(true);
    await press(app, c.addPhrase.add);
    expect(app.api.calls('POST /library/phrases')).toEqual([]);
  });

  it('saves the phrase to the account, tells the learner and shows it under Mine', async () => {
    const app = await launch({ signedIn: EMAIL });
    await openForm(app);
    const { c } = app;
    await app.type(targetField(app), '  Buenos   días ');
    await app.type(nativeField(app), 'Good morning');
    await app.tap(c.addPhrase.add);

    const [call] = app.api.calls('POST /library/phrases');
    expect(call.body).toEqual({
      phrase: { target: 'Buenos días', native: 'Good morning', source: 'written' },
      targetLang: 'es-ES',
      nativeLang: 'en-GB',
      inboxTitle: c.library.myPhrases,
    });
    expect(screen.queryByLabelText(targetField(app))).toBeNull();
    expect(app.sees(c.addPhrase.added)).toBe(true);
    expect(app.pathname()).toBe('/library');
    expect(app.sees('Buenos días')).toBe(true);
    expect(app.sees('Good morning')).toBe(true);
    // The account keeps it in its set for phrases made by hand.
    const sets = [...lib(app.api).sets.values()].filter((s) => s.ownerId === app.user!.id);
    expect(sets.map((s) => s.title)).toEqual([c.library.myPhrases]);
  });

  it('plays the new phrase from the toast’s Play', async () => {
    const app = await launch({ signedIn: EMAIL });
    await openForm(app);
    await app.type(targetField(app), 'Buenos días');
    await app.type(nativeField(app), 'Good morning');
    await app.tap(app.c.addPhrase.add);
    await app.tap(app.c.common.play);
    await app.advance(1_000);
    expect(app.sees(app.c.player.dialog) || audio.heard.length > 0).toBe(true);
    expect(audio.heard.some((h) => h.kind === 'clip')).toBe(true);
  });

  it('adds with the keyboard’s Done, and Next in the first field waits for the translation', async () => {
    const app = await launch({ signedIn: EMAIL });
    await openForm(app);
    await app.type(targetField(app), 'Buenos días');
    // Without a translation, the key only moves on.
    await app.submit(targetField(app));
    expect(app.api.calls('POST /library/phrases')).toEqual([]);
    await app.type(nativeField(app), 'Good morning');
    await app.submit(nativeField(app));
    expect(app.api.calls('POST /library/phrases')).toHaveLength(1);
  });

  it('adds with the first field’s Done once the translation is there', async () => {
    const app = await launch({ signedIn: EMAIL });
    await openForm(app);
    await app.type(nativeField(app), 'Good morning');
    await app.type(targetField(app), 'Buenos días');
    await app.submit(targetField(app));
    expect(app.api.calls('POST /library/phrases')).toHaveLength(1);
  });

  it('counts the characters left near the 120-character limit', async () => {
    const app = await launch({ signedIn: EMAIL });
    await openForm(app);
    const { c } = app;
    const target = screen.getByLabelText(targetField(app));
    expect(target.props.maxLength).toBe(120);
    expect(target.props.accessibilityHint ?? '').toBe('');
    await app.type(targetField(app), 'a'.repeat(100));
    expect(screen.getByLabelText(targetField(app)).props.accessibilityHint).toBe(c.common.charsLeft(20));
    await app.type(nativeField(app), 'b'.repeat(119));
    expect(screen.getByLabelText(nativeField(app)).props.accessibilityHint).toBe(c.common.charsLeft(1));
    expect(screen.queryAllByText(c.common.charsLeft(1), { includeHiddenElements: true })).toHaveLength(1);
  });

  it('says a phrase the course already has, and still lets it be added', async () => {
    const app = await launch({ signedIn: EMAIL });
    await openForm(app);
    const { c } = app;
    await app.type(targetField(app), 'La cuenta, por favor');
    expect(app.sees(new RegExp(c.addPhrase.duplicate))).toBe(true);
    expect(app.sees('The bill, please')).toBe(true);
    await app.type(nativeField(app), 'The bill, please');
    await app.tap(c.addPhrase.add);
    expect(app.api.calls('POST /library/phrases')).toHaveLength(1);
  });

  it('has AI write its notes quietly afterwards, and keeps the phrase either way', async () => {
    const app = await launch({ signedIn: EMAIL });
    await openForm(app);
    await app.type(targetField(app), 'Buenos días amigos');
    await app.type(nativeField(app), 'Good morning friends');
    await app.tap(app.c.addPhrase.add);
    await app.advance(500);
    const notes = app.api.calls('POST /library/generate/notes');
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toEqual({ target: 'Buenos días amigos', native: 'Good morning friends', targetLang: 'es-ES', nativeLang: 'en-GB' });
    // The notes came back and were saved on the phrase.
    const saved = [...lib(app.api).phrases.values()].find((p) => p.target === 'Buenos días amigos')!;
    expect(saved.notesBy).toBe('ai');
  });

  it('asks for no notes where the server has no AI', async () => {
    const { api } = server();
    lib(api).config.ai = false;
    const app = await launch({ signedIn: EMAIL, api });
    await openForm(app);
    await app.type(targetField(app), 'Buenos días amigos');
    await app.type(nativeField(app), 'Good morning friends');
    await app.tap(app.c.addPhrase.add);
    await app.advance(500);
    expect(app.api.calls('POST /library/phrases')).toHaveLength(1);
    expect(app.api.calls('POST /library/generate/notes')).toEqual([]);
  });

  it('asks for no notes for a phrase the bank already has', async () => {
    const bank = FIXTURE.bank.phrases.find((p) => p.targetLang === 'es-ES' && p.theme === 'hotel')!;
    const app = await launch({ signedIn: EMAIL });
    await openForm(app);
    await app.type(targetField(app), bank.target);
    await app.type(nativeField(app), bank.translations['en-GB']!);
    await app.tap(app.c.addPhrase.add);
    await app.advance(500);
    expect(app.api.calls('POST /library/phrases')).toHaveLength(1);
    expect(app.api.calls('POST /library/generate/notes')).toEqual([]);
  });

  it('keeps the form and its words when the server fails, and can try again', async () => {
    const app = await launch({ signedIn: EMAIL });
    await openForm(app);
    app.api.failNext('POST /library/phrases', problem(500, 'INTERNAL'));
    await app.type(targetField(app), 'Buenos días');
    await app.type(nativeField(app), 'Good morning');
    await app.tap(app.c.addPhrase.add);
    expect(app.sees(app.c.account.errors.generic)).toBe(true);
    expect(app.sees(app.c.addPhrase.title)).toBe(true);
    expect(screen.getByLabelText(targetField(app)).props.value).toBe('Buenos días');
    await app.tap(app.c.addPhrase.add);
    expect(app.api.calls('POST /library/phrases')).toHaveLength(2);
    expect(app.sees(app.c.addPhrase.added)).toBe(true);
  });

  it('is offered from Make a set when nothing matched, and the learner stays there', async () => {
    const app = await launch({ url: '/make', signedIn: EMAIL });
    const { c } = app;
    await app.type(c.make.field.topic, 'zzzz');
    await app.tap(c.make.suggest);
    await app.advance(2_000);
    await app.tap(c.make.writeOwn);
    expect(app.sees(c.addPhrase.title)).toBe(true);
    await app.type(targetField(app), 'Buenos días');
    await app.type(nativeField(app), 'Good morning');
    await app.tap(c.addPhrase.add);
    expect(app.pathname()).toBe('/make');
    expect(app.sees(c.addPhrase.added)).toBe(true);
    expect(app.api.calls('POST /library/phrases')).toHaveLength(1);
  });

  it('edits one of the learner’s phrases, Save only once something changed', async () => {
    const { api, user } = server();
    const made = seedSet(api, user, { title: 'Mi viaje', phrases: [{ target: 'Buenos días', native: 'Good morning' }] });
    const app = await launch({ url: `/set/${made.id}`, signedIn: EMAIL, api });
    const { c } = app;
    await app.tap(c.phrase.details('Buenos días'));
    await app.tap(c.phrase.edit);
    expect(app.sees(c.addPhrase.editTitle)).toBe(true);
    const saveDisabled = () => disabled(c.common.save);
    expect(screen.getByLabelText(targetField(app)).props.value).toBe('Buenos días');
    expect(screen.getByLabelText(nativeField(app)).props.value).toBe('Good morning');
    expect(saveDisabled()).toBe(true);
    // Spacing alone is no change.
    await app.type(targetField(app), 'Buenos  días ');
    expect(saveDisabled()).toBe(true);
    await app.type(targetField(app), 'Buenas tardes');
    await app.type(nativeField(app), 'Good afternoon');
    expect(saveDisabled()).toBe(false);
    await app.tap(c.common.save);
    expect(app.sees(c.addPhrase.edited)).toBe(true);
    const saved = [...lib(api).phrases.values()].find((p) => p.target === 'Buenas tardes')!;
    expect(saved.translations['en-GB']).toBe('Good afternoon');
    expect(app.sees('Buenas tardes')).toBe(true);
  });
});

describe('New set', () => {
  async function openForm(app: App): Promise<void> {
    await app.open('/library?view=ownSets');
    await app.tap(app.c.library.newSet);
  }

  it('needs a name before Create', async () => {
    const app = await launch({ signedIn: EMAIL });
    await openForm(app);
    const { c } = app;
    expect(app.sees(c.createSet.title)).toBe(true);
    expect(disabled(c.createSet.create)).toBe(true);
    await app.type(c.createSet.name, '   ');
    expect(disabled(c.createSet.create)).toBe(true);
    await app.type(c.createSet.name, 'Mi viaje');
    expect(disabled(c.createSet.create)).toBe(false);
  });

  it('makes the set in the account, says so, and opens it', async () => {
    const app = await launch({ signedIn: EMAIL });
    await openForm(app);
    const { c } = app;
    await app.type(c.createSet.name, 'Mi viaje');
    await press(app, c.createSet.create);
    const [call] = app.api.calls('POST /library/sets');
    expect(call.body).toMatchObject({ title: 'Mi viaje', targetLang: 'es-ES', nativeLang: 'en-GB', phrases: [] });
    expect(app.sees(c.createSet.created('Mi viaje'))).toBe(true);
    expect(app.pathname()).toMatch(/^\/set\/set-u-/);
    expect(app.sees('Mi viaje')).toBe(true);
  });

  it('creates with the keyboard’s Done too', async () => {
    const app = await launch({ signedIn: EMAIL });
    await openForm(app);
    await app.type(app.c.createSet.name, 'Mi viaje');
    await app.submit(app.c.createSet.name);
    expect(app.api.calls('POST /library/sets')).toHaveLength(1);
  });

  it('says a name already used, and still allows it', async () => {
    const { api, user } = server();
    seedSet(api, user, { title: 'Mi viaje', phrases: [{ target: 'Hola', native: 'Hello' }] });
    const app = await launch({ signedIn: EMAIL, api });
    await openForm(app);
    const { c } = app;
    expect(app.sees(c.createSet.taken)).toBe(false);
    await app.type(c.createSet.name, 'mi VIAJE');
    expect(app.sees(c.createSet.taken)).toBe(true);
    await press(app, c.createSet.create);
    expect(app.api.calls('POST /library/sets')).toHaveLength(1);
  });

  it('counts the characters left near the 60-character limit', async () => {
    const app = await launch({ signedIn: EMAIL });
    await openForm(app);
    expect(screen.getByLabelText(app.c.createSet.name).props.maxLength).toBe(60);
    await app.type(app.c.createSet.name, 'a'.repeat(50));
    expect(screen.getByLabelText(app.c.createSet.name).props.accessibilityHint).toBe(app.c.common.charsLeft(10));
  });

  it('asks a signed-out learner to sign in instead of making the set', async () => {
    const app = await launch();
    await openForm(app);
    await app.type(app.c.createSet.name, 'Mi viaje');
    await press(app, app.c.createSet.create);
    expect(app.pathname()).toBe('/account');
    expect(app.api.calls('POST /library/sets')).toEqual([]);
  });

  it('makes the set holding the phrase it was opened from (Add to set → New set…)', async () => {
    const app = await launch({ url: '/set/set-cafe', signedIn: EMAIL });
    const { c } = app;
    await app.tap(c.phrase.details('La cuenta, por favor'));
    await app.tap(c.phrase.addToSet);
    await app.tap(c.addToSet.newSet);
    await app.type(c.createSet.name, 'Pagar');
    await press(app, c.createSet.create);
    const [call] = app.api.calls('POST /library/sets');
    expect(call.body).toMatchObject({ title: 'Pagar', phrases: [{ ref: 'cafe-03' }] });
    expect(app.pathname()).toMatch(/^\/set\/set-u-/);
  });

  // CreateSetSheet has a rename mode (request.rename), but nothing in the app opens it: the set menu
  // uses its own "Name and description" sheet. Dead code, or an entry point that was lost?
  it.todo('Rename: nothing calls nav.createSet(phraseIds, renameId), so the sheet’s rename mode is unreachable');
});

describe('Add phrases to a set', () => {
  async function ownSet(): Promise<{ app: App; id: string; api: FakeApi }> {
    const { api, user } = server();
    const made = seedSet(api, user, { title: 'Mi viaje', phrases: [{ target: 'Buenos días', native: 'Good morning' }] });
    const app = await launch({ url: `/set/${made.id}`, signedIn: EMAIL, api });
    await app.tap(app.c.set.addPhrases);
    return { app, id: made.id, api };
  }

  it('lists the course’s phrases by set, the learner’s own first', async () => {
    const { app } = await ownSet();
    const { c } = app;
    expect(app.sees(c.pickPhrases.search)).toBe(true);
    expect(app.sees(c.phrase.yoursShort)).toBe(true);
    expect(app.sees('Café & Mañanas')).toBe(true);
    expect(app.sees('La cuenta, por favor')).toBe(true);
    expect(app.sees(`${c.pickPhrases.added} Buenos días`)).toBe(true);
    expect(app.sees(`${c.pickPhrases.add} La cuenta, por favor`)).toBe(true);
  });

  it('searches as Explore does, and says when nothing matches', async () => {
    const { app } = await ownSet();
    const { c } = app;
    await app.type(c.pickPhrases.search, 'cuenta');
    expect(app.sees('La cuenta, por favor')).toBe(true);
    expect(app.sees('Sin gluten, por favor')).toBe(false);
    await app.type(c.pickPhrases.search, 'zzzz');
    expect(app.sees(c.explore.noPhrases('zzzz'))).toBe(true);
    await app.type(c.pickPhrases.search, '');
    expect(app.sees('Sin gluten, por favor')).toBe(true);
  });

  it('adds a course phrase to the set at once and shows it Added, and the set lists it', async () => {
    const { app, id, api } = await ownSet();
    const { c } = app;
    await app.tap(`${c.pickPhrases.add} La cuenta, por favor`);
    const calls = app.api.calls(`POST /library/sets/${id}`);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ addPhrases: [{ ref: 'cafe-03' }] });
    expect(app.sees(`${c.pickPhrases.added} La cuenta, por favor`)).toBe(true);
    expect(lib(api).sets.get(id)!.items).toContain('cafe-03');
    await app.tap(c.pickPhrases.done);
    expect(app.sees(c.pickPhrases.search)).toBe(false);
    expect(app.sees(c.phrase.details('La cuenta, por favor'))).toBe(true);
  });

  it('takes a course phrase out again with no question asked', async () => {
    const { app, id } = await ownSet();
    const { c } = app;
    await app.tap(`${c.pickPhrases.add} La cuenta, por favor`);
    await app.tap(`${c.pickPhrases.added} La cuenta, por favor`);
    expect(device.dialogs).toEqual([]);
    const calls = app.api.calls(`POST /library/sets/${id}`);
    expect(calls[1].body).toEqual({ removePhraseIds: ['cafe-03'] });
    expect(app.sees(`${c.pickPhrases.add} La cuenta, por favor`)).toBe(true);
  });

  it('asks before taking out a phrase only this set holds, and keeps it when declined', async () => {
    const { app, id, api } = await ownSet();
    const { c } = app;
    await app.tap(`${c.pickPhrases.added} Buenos días`);
    expect(device.dialogs).toHaveLength(1);
    expect(device.dialogs[0].message).toBe(c.phrase.removeDeletes('Buenos días'));
    device.answer(c.common.cancel);
    await app.settle();
    expect(app.api.calls(`POST /library/sets/${id}`)).toEqual([]);
    expect(lib(api).sets.get(id)!.items).toHaveLength(1);
    expect(app.sees(`${c.pickPhrases.added} Buenos días`)).toBe(true);
  });

  it('deletes that phrase with the set’s listing when confirmed', async () => {
    const { app, id, api } = await ownSet();
    const { c } = app;
    await app.tap(`${c.pickPhrases.added} Buenos días`);
    device.answer(c.phrase.delete);
    await app.settle();
    const calls = app.api.calls(`POST /library/sets/${id}`);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({ removePhraseIds: [expect.any(String)] });
    expect(lib(api).sets.get(id)!.items).toEqual([]);
  });

  it('Done closes the sheet', async () => {
    const { app } = await ownSet();
    await app.tap(app.c.pickPhrases.done);
    expect(app.sees(app.c.pickPhrases.search)).toBe(false);
    expect(app.pathname()).toMatch(/^\/set\//);
  });
});
