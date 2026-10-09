// Make a set with AI (route /make; P2-04, P2-06, AI-05, AI-06, LIB-02, F-01).
//
// Covered:
// - Asking: signed out (sign-in banner; no field); the three modes (Topic / Keywords / Text) with
//   their field, hint and placeholder, the text kept per mode; Suggest disabled until two characters;
//   the character counts; the keyboard's Go; a topic chip asking at once; the writer's byline (AI, or
//   the phrase bank when the server has no AI, AI-05); opened from Explore with a topic ("Suggest
//   phrases about…") and from an own set; pending state and Cancel; a spent allowance (LIB-02), a
//   server failure, a failed deck, offline; nothing found (with "Add your own phrase").
// - The deck: progress and added count; the card's source label ("Written by AI · not checked",
//   AI-06; the bank's; a phrase of the learner's own); Add / Skip by button and by swiping right and
//   left (a short swipe springs back); Undo (button, and from the end screen); Correct a card (save,
//   cancel, empty field), Listen (the server's clip, one voice at a time); the end screen (Save N
//   phrases, More suggestions, Try something else, Undo); More dealing further cards with the dealt
//   ones sent to avoid, and its end; Try something else keeping what was added; Done in the header.
// - Saving: the name prefilled and editable (empty refused, a same name said), the kept phrases and
//   leaving one out, back to the suggestions, the cover switch, Save → POST /library/sets with the
//   kept phrases, the set opening with the phrases and their AI label (AI-06), usage counted; a
//   failure keeping the flow; the set limit; saving into one of the learner's own sets.
// - Closing: Close and the back button with phrases added offer them back (Reopen); with none they
//   don't; saved phrases aren't offered.
import { FIXTURE } from '@shared/content/fixture';
import { FakeApi, problem } from '../fakes/api';
import { lib, seedSet } from '../fakes/library';
import { act, audio, fireEvent, launch, screen, type App } from '../harness';

const EMAIL = 'ana@example.com';

/** The bank's hotel phrases for this course, as the fake server deals them for "hotel". */
const HOTEL = FIXTURE.bank.phrases
  .filter((p) => p.targetLang === 'es-ES' && p.theme === 'hotel')
  .map((p) => ({ id: p.id, target: p.target, native: p.translations['en-GB']! }));

function server(): { api: FakeApi; user: ReturnType<FakeApi['addUser']> } {
  const api = new FakeApi();
  return { api, user: api.addUser(EMAIL) };
}

/** Opens /make as the signed-in learner. */
const open = (api?: FakeApi, url = '/make') => launch({ url, signedIn: EMAIL, ...(api ? { api } : {}) });

/** Types a topic and asks; the deck is written, and read once the server's poll has waited. */
async function ask(app: App, text = 'hotel'): Promise<void> {
  await app.type(app.c.make.field.topic, text);
  await app.tap(app.c.make.suggest);
  await app.advance(2_000);
}

/** Whether the button called `label` is shown disabled. */
const disabled = (label: string): boolean => screen.queryByRole('button', { name: label, disabled: true }) !== null;

async function flip(app: App, label: string, value: boolean): Promise<void> {
  await act(async () => {
    fireEvent(screen.getByLabelText(label), 'valueChange', value);
  });
  await app.settle();
}

/** Adds the next `n` cards, by their buttons. */
async function addCards(app: App, from: number, n: number): Promise<void> {
  for (let i = from; i < from + n; i++) await app.tap(app.c.make.addLabel(HOTEL[i].target));
}

const listed = (app: App) => app.api.calls('POST /library/decks');

describe('Make a set: signed out', () => {
  it('asks to sign in and offers no field', async () => {
    const app = await launch({ url: '/make' });
    const { c } = app;
    expect(app.sees(c.make.title)).toBe(true);
    expect(app.sees(c.account.needed)).toBe(true);
    expect(app.sees(c.make.intro)).toBe(false);
    expect(screen.queryByLabelText(c.make.field.topic)).toBeNull();
    await app.tap(c.account.signIn);
    expect(app.pathname()).toBe('/account');
  });

  it('a topic from Explore waits for an account, and asks nothing meanwhile', async () => {
    const app = await launch({ url: '/make?input=hotel' });
    expect(app.sees(app.c.account.needed)).toBe(true);
    expect(app.api.calls('POST /library/decks')).toEqual([]);
  });
});

describe('Make a set: asking', () => {
  it('opens on Topic with its field, hint and chips, and the byline of who writes', async () => {
    const app = await open();
    const { c } = app;
    expect(app.sees(c.make.intro)).toBe(true);
    expect(app.sees(c.make.hintTopic)).toBe(true);
    expect(screen.getByLabelText(c.make.field.topic).props.placeholder).toBe(c.make.placeholder.topic);
    expect(screen.getByRole('radio', { name: c.make.modes.topic, checked: true })).toBeTruthy();
    expect(app.sees(c.make.tryTopics)).toBe(true);
    expect(app.sees('At the hotel')).toBe(true);
    expect(app.sees(c.make.byAi)).toBe(true);
  });

  it('says the phrase bank writes where the server has no AI (AI-05)', async () => {
    const { api } = server();
    lib(api).config.ai = false;
    const app = await open(api);
    expect(app.sees(app.c.make.byBank)).toBe(true);
    expect(app.sees(app.c.make.byAi)).toBe(false);
  });

  it('switches between Topic, Keywords and Text, each with its own field and hint', async () => {
    const app = await open();
    const { c } = app;
    await app.tap(c.make.modes.keywords);
    expect(screen.getByLabelText(c.make.field.keywords).props.placeholder).toBe(c.make.placeholder.keywords);
    expect(app.sees(c.make.hintKeywords)).toBe(true);
    expect(app.sees(c.make.tryTopics)).toBe(false);
    await app.tap(c.make.modes.text);
    expect(screen.getByLabelText(c.make.field.text).props.multiline).toBe(true);
    expect(app.sees(c.make.hintText('Spanish'))).toBe(true);
    await app.tap(c.make.modes.topic);
    expect(app.sees(c.make.hintTopic)).toBe(true);
    expect(app.sees(c.make.tryTopics)).toBe(true);
  });

  it('keeps what was typed in each mode while switching between them', async () => {
    const app = await open();
    const { c } = app;
    await app.type(c.make.field.topic, 'hotel');
    await app.tap(c.make.modes.keywords);
    expect(screen.getByLabelText(c.make.field.keywords).props.value).toBe('');
    await app.type(c.make.field.keywords, 'towel, breakfast');
    await app.tap(c.make.modes.topic);
    expect(screen.getByLabelText(c.make.field.topic).props.value).toBe('hotel');
    await app.tap(c.make.modes.keywords);
    expect(screen.getByLabelText(c.make.field.keywords).props.value).toBe('towel, breakfast');
  });

  it('keeps Suggest disabled until two characters, and asks nothing when pressed disabled', async () => {
    const app = await open();
    const { c } = app;
    expect(disabled(c.make.suggest)).toBe(true);
    await app.type(c.make.field.topic, 'h');
    expect(disabled(c.make.suggest)).toBe(true);
    await app.type(c.make.field.topic, '   ');
    expect(disabled(c.make.suggest)).toBe(true);
    await app.tap(c.make.suggest);
    expect(listed(app)).toEqual([]);
    await app.type(c.make.field.topic, 'ho');
    expect(disabled(c.make.suggest)).toBe(false);
  });

  it('shows the characters left near each mode’s limit', async () => {
    const app = await open();
    const { c } = app;
    expect(screen.getByLabelText(c.make.field.topic).props.maxLength).toBe(80);
    await app.type(c.make.field.topic, 'a'.repeat(70));
    expect(screen.getByLabelText(c.make.field.topic).props.accessibilityHint).toContain(c.common.charsLeft(10));
    expect(screen.queryAllByText(c.common.charsLeft(10), { includeHiddenElements: true })).toHaveLength(1);
    await app.tap(c.make.modes.keywords);
    expect(screen.getByLabelText(c.make.field.keywords).props.maxLength).toBe(200);
    await app.tap(c.make.modes.text);
    expect(screen.getByLabelText(c.make.field.text).props.maxLength).toBe(2000);
  });

  it('asks for a topic and sends the mode, the words and the learner’s two languages', async () => {
    const app = await open();
    await ask(app, '  at the   hotel ');
    const [call] = listed(app);
    expect(call.body).toEqual({ mode: 'topic', input: 'at the hotel', targetLang: 'es-ES', nativeLang: 'en-GB', avoid: [] });
    expect(app.sees(app.c.make.progress(1, 6))).toBe(true);
  });

  it('asks from keywords', async () => {
    const app = await open();
    const { c } = app;
    await app.tap(c.make.modes.keywords);
    await app.type(c.make.field.keywords, 'hotel, towel');
    await app.tap(c.make.suggest);
    await app.advance(2_000);
    expect(listed(app)[0].body).toMatchObject({ mode: 'keywords', input: 'hotel, towel' });
    expect(app.sees(c.make.progress(1, 6))).toBe(true);
  });

  it('asks from a pasted text', async () => {
    const app = await open();
    const { c } = app;
    await app.tap(c.make.modes.text);
    await app.type(c.make.field.text, 'I need a room at the hotel for two nights.');
    await app.tap(c.make.suggest);
    await app.advance(2_000);
    expect(listed(app)[0].body).toMatchObject({ mode: 'text', input: 'I need a room at the hotel for two nights.' });
    expect(app.sees(c.make.progress(1, 6))).toBe(true);
  });

  it('asks with the keyboard’s Go in the topic field', async () => {
    const app = await open();
    const { c } = app;
    await app.type(c.make.field.topic, 'hotel');
    await app.submit(c.make.field.topic);
    await app.advance(2_000);
    expect(listed(app)).toHaveLength(1);
    expect(app.sees(c.make.progress(1, 6))).toBe(true);
  });

  it('asks with the keyboard’s Go in the keywords field', async () => {
    const app = await open();
    const { c } = app;
    await app.tap(c.make.modes.keywords);
    await app.type(c.make.field.keywords, 'airport');
    await app.submit(c.make.field.keywords);
    await app.advance(2_000);
    expect(listed(app)[0].body).toMatchObject({ mode: 'keywords', input: 'airport' });
  });

  it('does not ask with Go while the field is too short', async () => {
    const app = await open();
    await app.type(app.c.make.field.topic, 'h');
    await app.submit(app.c.make.field.topic);
    expect(listed(app)).toEqual([]);
  });

  it('a topic chip fills the field and asks at once', async () => {
    const app = await open();
    await app.tap('At the hotel');
    await app.advance(2_000);
    expect(listed(app)[0].body).toMatchObject({ mode: 'topic', input: 'At the hotel' });
    expect(app.sees(app.c.make.progress(1, 6))).toBe(true);
  });

  it('opened from Explore’s "Suggest phrases about…", asks at once for that topic', async () => {
    const app = await open(undefined, '/explore');
    const { c } = app;
    await app.type(c.explore.search, 'zzqx');
    await app.advance(300);
    await app.tap(c.make.fromExplore('zzqx'));
    await app.advance(2_000);
    expect(app.pathname()).toBe('/make');
    expect(listed(app)[0].body).toMatchObject({ mode: 'topic', input: 'zzqx' });
    expect(screen.getByLabelText(c.make.field.topic).props.value).toBe('zzqx');
  });

  it('shows the pending state while the writer works, and Cancel stops waiting', async () => {
    const { api } = server();
    lib(api).config.deckPolls = 50;
    const app = await open(api);
    const { c } = app;
    await app.type(c.make.field.topic, 'hotel');
    await app.tap(c.make.suggest);
    expect(app.sees(c.make.writing)).toBe(true);
    expect(disabled(c.make.writing)).toBe(true);
    expect(screen.getByLabelText(c.make.field.topic).props.editable).toBe(false);
    await app.advance(3_000);
    const polled = app.api.calls(`GET /library/decks/${[...lib(api).decks.keys()][0]}`).length;
    expect(polled).toBeGreaterThan(0);

    await app.tap(c.common.cancel);
    expect(app.sees(c.make.writing)).toBe(false);
    expect(app.sees(c.make.suggest)).toBe(true);
    expect(screen.getByLabelText(c.make.field.topic).props.editable).toBe(true);
    // Nothing more is asked for, and nothing arrives late.
    await app.advance(10_000);
    expect(app.api.calls(`GET /library/decks/${[...lib(api).decks.keys()][0]}`)).toHaveLength(polled);
    expect(app.sees(c.make.progress(1, 6))).toBe(false);
    expect(app.sees(c.make.intro)).toBe(true);
  });

  it('waits for a deck still being written and shows it when it is ready', async () => {
    const { api } = server();
    lib(api).config.deckPolls = 2;
    const app = await open(api);
    await app.type(app.c.make.field.topic, 'hotel');
    await app.tap(app.c.make.suggest);
    expect(app.sees(app.c.make.writing)).toBe(true);
    await app.advance(5_000);
    expect(app.sees(app.c.make.progress(1, 6))).toBe(true);
  });

  it('a topic chip is disabled while a deck is being written', async () => {
    const { api } = server();
    lib(api).config.deckPolls = 50;
    const app = await open(api);
    await app.type(app.c.make.field.topic, 'hotel');
    await app.tap(app.c.make.suggest);
    expect(disabled('At the hotel')).toBe(true);
  });

  it('says the day’s allowance is used when asking, and shows no deck (LIB-02)', async () => {
    const { api } = server();
    api.limits.phrases = 0;
    const app = await open(api);
    await ask(app);
    expect(app.sees(new RegExp(`^${app.c.account.spent('00:00').slice(0, 20)}`))).toBe(true);
    expect(app.sees(app.c.make.progress(1, 6))).toBe(false);
    expect(app.sees(app.c.make.suggest)).toBe(true);
  });

  it('says the allowance is used when More asks after the last of it was spent', async () => {
    const { api } = server();
    api.limits.phrases = 1;
    const app = await open(api);
    const { c } = app;
    await ask(app);
    for (const phrase of HOTEL) await app.tap(c.make.skipLabel(phrase.target));
    await app.tap(c.make.more);
    await app.advance(2_000);
    expect(app.sees(new RegExp(`^${c.account.spent('00:00').slice(0, 20)}`))).toBe(true);
    expect(app.sees(c.make.endTitle(6))).toBe(true);
    expect(app.sees(c.make.more)).toBe(true);
  });

  it('says so when the server fails, and keeps the field for another try', async () => {
    const app = await open();
    app.api.failNext('POST /library/decks', problem(500, 'INTERNAL'));
    await ask(app);
    expect(app.sees(app.c.account.errors.generic)).toBe(true);
    expect(screen.getByLabelText(app.c.make.field.topic).props.value).toBe('hotel');
    await app.tap(app.c.make.suggest);
    await app.advance(2_000);
    expect(app.sees(app.c.make.progress(1, 6))).toBe(true);
  });

  it('says the writer is unavailable when a deck fails in the background', async () => {
    const { api } = server();
    lib(api).config.deckPolls = 50;
    const app = await open(api);
    await app.type(app.c.make.field.topic, 'hotel');
    await app.tap(app.c.make.suggest);
    for (const deck of lib(api).decks.values()) deck.status = 'failed';
    await app.advance(2_000);
    expect(app.sees(app.c.account.errors.unavailable)).toBe(true);
    expect(app.sees(app.c.make.suggest)).toBe(true);
  });

  it('says when it is offline', async () => {
    const app = await open();
    await app.type(app.c.make.field.topic, 'hotel');
    app.api.offline = true;
    await app.tap(app.c.make.suggest);
    await app.advance(2_000);
    expect(app.sees(app.c.account.errors.offline)).toBe(true);
  });

  it('says when nothing was found, offers to write the phrase, and clears the note on typing', async () => {
    const app = await open();
    const { c } = app;
    await ask(app, 'zzzz');
    expect(app.sees(c.make.none('zzzz'))).toBe(true);
    expect(app.sees(c.make.noneHint)).toBe(true);
    expect(app.sees(c.make.writeOwn)).toBe(true);
    await app.type(c.make.field.topic, 'zzzzz');
    expect(app.sees(c.make.none('zzzz'))).toBe(false);
  });

  it('opens a topic from a link with the topic already in the field when signed in', async () => {
    const app = await open(undefined, '/make?input=airport');
    await app.advance(2_000);
    expect(listed(app)[0].body).toMatchObject({ input: 'airport' });
    expect(app.sees(app.c.make.progress(1, 6))).toBe(true);
  });
});

describe('Make a set: the deck', () => {
  it('shows the first card with where it came from, its meaning, and the count', async () => {
    const app = await open();
    const { c } = app;
    await ask(app);
    expect(app.sees(c.make.progress(1, 6))).toBe(true);
    expect(app.sees(c.make.addedCount(0))).toBe(true);
    expect(app.sees(HOTEL[0].target)).toBe(true);
    expect(app.sees(HOTEL[0].native)).toBe(true);
    expect(app.sees(c.make.cardLabel(1, 6))).toBe(true);
    // AI-06: written by AI and not checked by a native speaker, said on the card.
    expect(app.sees(c.make.source.ai)).toBe(true);
    expect(app.sees(c.make.swipeHint)).toBe(true);
  });

  it('labels bank suggestions as Loro’s phrase bank where the server has no AI (AI-05)', async () => {
    const { api } = server();
    lib(api).config.ai = false;
    const app = await open(api);
    await ask(app);
    expect(app.sees(app.c.make.source.bank)).toBe(true);
    expect(app.sees(app.c.make.source.ai)).toBe(false);
    expect(app.api.calls('GET /library/usage').length).toBeGreaterThan(0);
  });

  it('labels a suggestion that is already the learner’s own as theirs', async () => {
    const { api, user } = server();
    seedSet(api, user, { title: 'Mi hotel', phrases: [{ target: HOTEL[0].target, native: HOTEL[0].native }] });
    const app = await open(api);
    await ask(app);
    expect(app.sees(app.c.make.source.mine)).toBe(true);
  });

  it('Add keeps the card and shows the next; the count follows', async () => {
    const app = await open();
    const { c } = app;
    await ask(app);
    await app.tap(c.make.addLabel(HOTEL[0].target));
    expect(app.sees(c.make.progress(2, 6))).toBe(true);
    expect(app.sees(c.make.addedCount(1))).toBe(true);
    expect(app.sees(HOTEL[1].target)).toBe(true);
    // Done shows once something is kept.
    expect(app.sees(c.make.done)).toBe(true);
  });

  it('Skip moves on without adding', async () => {
    const app = await open();
    const { c } = app;
    await ask(app);
    expect(app.sees(c.make.done)).toBe(false);
    await app.tap(c.make.skipLabel(HOTEL[0].target));
    expect(app.sees(c.make.progress(2, 6))).toBe(true);
    expect(app.sees(c.make.addedCount(0))).toBe(true);
    expect(app.sees(c.make.done)).toBe(false);
  });

  it('swiping right adds the card, swiping left skips it', async () => {
    const app = await open();
    const { c } = app;
    await ask(app);
    await app.swipe(HOTEL[0].target, { dx: 220 });
    expect(app.sees(c.make.addedCount(1))).toBe(true);
    expect(app.sees(c.make.progress(2, 6))).toBe(true);
    await app.swipe(HOTEL[1].target, { dx: -220 });
    expect(app.sees(c.make.addedCount(1))).toBe(true);
    expect(app.sees(c.make.progress(3, 6))).toBe(true);
  });

  it('a short swipe springs back and decides nothing', async () => {
    const app = await open();
    const { c } = app;
    await ask(app);
    await app.swipe(HOTEL[0].target, { dx: 40 });
    expect(app.sees(c.make.progress(1, 6))).toBe(true);
    expect(app.sees(c.make.addedCount(0))).toBe(true);
  });

  it('Undo is disabled at the start and takes back the last decision', async () => {
    const app = await open();
    const { c } = app;
    await ask(app);
    expect(disabled(c.common.undo)).toBe(true);
    await app.tap(c.make.addLabel(HOTEL[0].target));
    await app.tap(c.make.skipLabel(HOTEL[1].target));
    expect(app.sees(c.make.progress(3, 6))).toBe(true);
    await app.tap(c.make.undoLabel(HOTEL[1].target));
    expect(app.sees(c.make.progress(2, 6))).toBe(true);
    expect(app.sees(c.make.addedCount(1))).toBe(true);
    // The card taken back can be decided the other way.
    await app.tap(c.make.addLabel(HOTEL[1].target));
    expect(app.sees(c.make.addedCount(2))).toBe(true);
    await app.tap(c.make.undoLabel(HOTEL[1].target));
    await app.tap(c.make.undoLabel(HOTEL[0].target));
    expect(app.sees(c.make.progress(1, 6))).toBe(true);
    expect(app.sees(c.make.addedCount(0))).toBe(true);
    expect(disabled(c.common.undo)).toBe(true);
  });

  it('Listen plays the server’s clip of the card', async () => {
    const app = await open();
    await ask(app);
    await app.tap(app.c.make.listen(HOTEL[0].target));
    await app.advance(500);
    expect(audio.clips()).toContain(`es-ES-${HOTEL[0].id}`);
  });

  it('a card being heard pauses the loop that was playing: one voice at a time', async () => {
    const app = await launch({ url: '/set/set-cafe', signedIn: EMAIL });
    const { c } = app;
    await app.tap(c.set.playAll('Café & Mañanas'));
    await app.advance(1_500);
    expect(audio.clips().some((clip) => clip.includes('cafe-'))).toBe(true);
    await app.open('/make');
    await ask(app);
    await app.tap(c.make.listen(HOTEL[0].target));
    const before = audio.clips().length;
    await app.advance(30_000);
    expect(audio.clips()).toContain(`es-ES-${HOTEL[0].id}`);
    // Nothing of the loop was heard after the card's clip.
    expect(audio.clips().slice(before).filter((clip) => clip.includes('cafe-'))).toEqual([]);
  });

  it('Correct opens both fields; Cancel leaves the card as it was', async () => {
    const app = await open();
    const { c } = app;
    await ask(app);
    await app.tap(c.make.editLabel(HOTEL[0].target));
    const target = c.addPhrase.target('Spanish');
    expect(screen.getByLabelText(target).props.value).toBe(HOTEL[0].target);
    // While one is corrected the card can't be decided.
    expect(disabled(c.make.addLabel(HOTEL[0].target))).toBe(true);
    expect(disabled(c.make.skipLabel(HOTEL[0].target))).toBe(true);
    await app.type(target, 'Otra cosa');
    await app.tap(c.common.cancel);
    expect(app.sees(HOTEL[0].target)).toBe(true);
    expect(app.sees('Otra cosa')).toBe(false);
  });

  it('Correct saves the new words on the card, which then carries them when added', async () => {
    const app = await open();
    const { c } = app;
    await ask(app);
    await app.tap(c.make.editLabel(HOTEL[0].target));
    await app.type(c.addPhrase.target('Spanish'), 'A qué hora desayunamos');
    await app.type(c.addPhrase.native('English'), 'When do we have breakfast');
    await app.tap(c.common.save);
    expect(app.sees('A qué hora desayunamos')).toBe(true);
    expect(app.sees('When do we have breakfast')).toBe(true);
    expect(app.sees(HOTEL[0].target)).toBe(false);
    // A corrected card has no clip of the server's to hear.
    expect(screen.queryByLabelText(c.make.listen('A qué hora desayunamos'))).toBeNull();
    await app.tap(c.make.addLabel('A qué hora desayunamos'));
    await app.tap(c.make.done);
    expect(app.sees('A qué hora desayunamos')).toBe(true);
  });

  it('Correct won’t save an empty field', async () => {
    const app = await open();
    const { c } = app;
    await ask(app);
    await app.tap(c.make.editLabel(HOTEL[0].target));
    await app.type(c.addPhrase.native('English'), '   ');
    expect(disabled(c.common.save)).toBe(true);
    await app.type(c.addPhrase.native('English'), 'Breakfast time?');
    expect(disabled(c.common.save)).toBe(false);
  });

  it('Correct saves with the keyboard’s Done in the meaning field', async () => {
    const app = await open();
    const { c } = app;
    await ask(app);
    await app.tap(c.make.editLabel(HOTEL[0].target));
    await app.type(c.addPhrase.native('English'), 'Breakfast time?');
    await app.submit(c.addPhrase.native('English'));
    expect(app.sees('Breakfast time?')).toBe(true);
    expect(screen.queryByLabelText(c.addPhrase.target('Spanish'))).toBeNull();
  });

  it('swiping does nothing while a card is being corrected', async () => {
    const app = await open();
    const { c } = app;
    await ask(app);
    await app.tap(c.make.editLabel(HOTEL[0].target));
    await app.swipe(c.addPhrase.target('Spanish'), { dx: 220 });
    expect(app.sees(c.make.progress(1, 6))).toBe(true);
    expect(app.sees(c.make.addedCount(0))).toBe(true);
  });

  it('at the end says how many were suggested and added, and offers to save them', async () => {
    const app = await open();
    const { c } = app;
    await ask(app);
    await addCards(app, 0, 2);
    for (const phrase of HOTEL.slice(2)) await app.tap(c.make.skipLabel(phrase.target));
    expect(app.sees(c.make.endTitle(6))).toBe(true);
    expect(app.sees(c.make.endAdded(2))).toBe(true);
    expect(app.sees(c.make.review(2))).toBe(true);
    expect(app.sees(c.make.more)).toBe(true);
    expect(app.sees(c.make.another)).toBe(true);
  });

  it('at the end after skipping everything, there is nothing to save', async () => {
    const app = await open();
    const { c } = app;
    await ask(app);
    for (const phrase of HOTEL) await app.tap(c.make.skipLabel(phrase.target));
    expect(app.sees(c.make.endAdded(0))).toBe(true);
    expect(app.sees(c.make.review(0))).toBe(false);
    expect(app.sees(c.make.done)).toBe(false);
  });

  it('at the end, Undo takes back the last card', async () => {
    const app = await open();
    const { c } = app;
    await ask(app);
    for (const phrase of HOTEL.slice(0, 5)) await app.tap(c.make.skipLabel(phrase.target));
    await app.tap(c.make.addLabel(HOTEL[5].target));
    expect(app.sees(c.make.endTitle(6))).toBe(true);
    await app.tap(c.common.undo);
    expect(app.sees(c.make.endTitle(6))).toBe(false);
    expect(app.sees(HOTEL[5].target)).toBe(true);
    expect(app.sees(c.make.addedCount(0))).toBe(true);
  });

  it('More suggestions asks again with every dealt phrase to avoid, and deals the further cards', async () => {
    const app = await open();
    const { c } = app;
    await ask(app, 'meeting');
    // "meeting" is in three themes: twelve are dealt at first.
    expect(app.sees(c.make.progress(1, 12))).toBe(true);
    const first = listed(app)[0].body as { avoid: string[] };
    expect(first.avoid).toEqual([]);
    for (let i = 0; i < 12; i++) await app.tap(/^Add /, { index: 0 });
    expect(app.sees(c.make.endTitle(12))).toBe(true);
    await app.tap(c.make.more);
    await app.advance(2_000);
    const second = listed(app)[1].body as { avoid: string[]; input: string };
    expect(second.input).toBe('meeting');
    expect(second.avoid).toHaveLength(12);
    expect(app.sees(c.make.progress(13, 18))).toBe(true);
    expect(app.sees(c.make.addedCount(12))).toBe(true);
  });

  it('More finding nothing new says there are no more, and the button goes', async () => {
    const app = await open();
    const { c } = app;
    await ask(app);
    for (const phrase of HOTEL) await app.tap(c.make.skipLabel(phrase.target));
    await app.tap(c.make.more);
    await app.advance(2_000);
    expect(app.sees(c.make.noMore)).toBe(true);
    expect(app.sees(c.make.more)).toBe(false);
  });

  // P2-04: "Suggestions re-rank toward 'more like' the phrase just added". More sends only what was
  // dealt (avoid), not what was added, so nothing steers the next deal toward it. The intended
  // mechanism (a field of the request? the server's own ranking?) isn't written down in the docs.
  it.todo('P2-04: More sends the phrases the learner added so the server can re-rank toward them');

  it('Try something else goes back to asking, and the cards added stay and wait', async () => {
    const app = await open();
    const { c } = app;
    await ask(app);
    await app.tap(c.make.addLabel(HOTEL[0].target));
    for (const phrase of HOTEL.slice(1)) await app.tap(c.make.skipLabel(phrase.target));
    await app.tap(c.make.another);
    expect(app.sees(c.make.intro)).toBe(true);
    expect(app.sees(c.make.backToDeck)).toBe(true);
    await app.tap(c.make.backToDeck);
    expect(app.sees(c.make.endTitle(6))).toBe(true);
    expect(app.sees(c.make.endAdded(1))).toBe(true);
  });

  it('Try something else then a new topic deals its cards after the old ones, keeping what was added', async () => {
    const app = await open();
    const { c } = app;
    await ask(app);
    await app.tap(c.make.addLabel(HOTEL[0].target));
    for (const phrase of HOTEL.slice(1)) await app.tap(c.make.skipLabel(phrase.target));
    await app.tap(c.make.another);
    await app.type(c.make.field.topic, 'airport');
    await app.tap(c.make.suggest);
    await app.advance(2_000);
    expect(app.sees(c.make.progress(7, 12))).toBe(true);
    expect(app.sees(c.make.addedCount(1))).toBe(true);
  });
});

describe('Make a set: saving', () => {
  async function toSave(app: App, count = 2, topic = 'hotel'): Promise<void> {
    await ask(app, topic);
    await addCards(app, 0, count);
    await app.tap(app.c.make.done);
  }

  it('Done in the header goes to the save step, with the name suggested and the kept phrases', async () => {
    const app = await open();
    const { c } = app;
    await toSave(app);
    expect(app.sees(c.make.saveTitle)).toBe(true);
    expect(screen.getByLabelText(c.createSet.name).props.value).toBe('Hotel');
    expect(app.sees(c.make.keptHeading(2))).toBe(true);
    expect(app.sees(HOTEL[0].target)).toBe(true);
    expect(app.sees(HOTEL[1].target)).toBe(true);
    expect(app.sees(c.create.saveToAccount)).toBe(true);
    // AI-written phrases carry their label here too (AI-06).
    expect(screen.getAllByLabelText(c.make.source.ai)).toHaveLength(2);
  });

  it('names a set made from keywords by the words, and from a text "From my text"', async () => {
    const app = await open();
    const { c } = app;
    await app.tap(c.make.modes.keywords);
    await app.type(c.make.field.keywords, 'hotel;towel');
    await app.tap(c.make.suggest);
    await app.advance(2_000);
    await app.tap(c.make.addLabel(HOTEL[0].target));
    await app.tap(c.make.done);
    expect(screen.getByLabelText(c.createSet.name).props.value).toBe('Hotel, towel');
  });

  it('names a set made from a text "From my text"', async () => {
    const app = await open();
    const { c } = app;
    await app.tap(c.make.modes.text);
    await app.type(c.make.field.text, 'Hotel booking for two nights');
    await app.tap(c.make.suggest);
    await app.advance(2_000);
    await app.tap(c.make.addLabel(HOTEL[0].target));
    await app.tap(c.make.done);
    expect(screen.getByLabelText(c.createSet.name).props.value).toBe(c.make.defaultTitleText);
  });

  it('the end screen’s Save N phrases goes to the same step', async () => {
    const app = await open();
    const { c } = app;
    await ask(app);
    await addCards(app, 0, 1);
    for (const phrase of HOTEL.slice(1)) await app.tap(c.make.skipLabel(phrase.target));
    await app.tap(c.make.review(1));
    expect(app.sees(c.make.saveTitle)).toBe(true);
  });

  it('refuses an empty name, says a name already used, and still allows it', async () => {
    const { api, user } = server();
    seedSet(api, user, { title: 'Hotel', phrases: [{ target: 'Hola', native: 'Hello' }] });
    const app = await open(api);
    const { c } = app;
    await toSave(app);
    expect(app.sees(c.createSet.taken)).toBe(true);
    expect(disabled(c.create.saveToAccount)).toBe(false);
    await app.type(c.createSet.name, '   ');
    expect(disabled(c.create.saveToAccount)).toBe(true);
    expect(app.sees(c.createSet.taken)).toBe(false);
    await app.type(c.createSet.name, 'Mi hotel');
    expect(disabled(c.create.saveToAccount)).toBe(false);
  });

  it('counts the name’s characters near its limit of 60', async () => {
    const app = await open();
    const { c } = app;
    await toSave(app);
    expect(screen.getByLabelText(c.createSet.name).props.maxLength).toBe(60);
    await app.type(c.createSet.name, 'a'.repeat(55));
    expect(screen.getByLabelText(c.createSet.name).props.accessibilityHint).toBe(c.common.charsLeft(5));
  });

  it('leaves a phrase out, and with the last one gone there is nothing to save', async () => {
    const app = await open();
    const { c } = app;
    await toSave(app);
    await app.tap(c.make.remove(HOTEL[0].target));
    expect(app.sees(c.make.keptHeading(1))).toBe(true);
    expect(app.sees(HOTEL[0].target)).toBe(false);
    await app.tap(c.make.remove(HOTEL[1].target));
    expect(app.sees(c.make.keptHeading(0))).toBe(true);
    expect(disabled(c.create.saveToAccount)).toBe(true);
    await app.tap(c.create.saveToAccount);
    expect(app.api.calls('POST /library/sets')).toEqual([]);
  });

  it('goes back to the suggestions with the cards as they were, and a phrase left out is skipped there', async () => {
    const app = await open();
    const { c } = app;
    await toSave(app, 2);
    await app.tap(c.make.remove(HOTEL[1].target));
    await app.tap(c.make.backToDeck);
    expect(app.sees(c.make.progress(3, 6))).toBe(true);
    expect(app.sees(c.make.addedCount(1))).toBe(true);
    expect(app.sees(HOTEL[2].target)).toBe(true);
  });

  it('saves the kept phrases to the account and opens the new set with them', async () => {
    const app = await open();
    const { c } = app;
    await toSave(app);
    await app.type(c.createSet.name, 'En el hotel');
    await app.tap(c.create.saveToAccount);

    const [call] = app.api.calls('POST /library/sets');
    expect(call.body).toMatchObject({
      title: 'En el hotel',
      targetLang: 'es-ES',
      nativeLang: 'en-GB',
      visibility: 'private',
      phrases: [
        { target: HOTEL[0].target, native: HOTEL[0].native, source: 'ai' },
        { target: HOTEL[1].target, native: HOTEL[1].native, source: 'ai' },
      ],
    });
    // Each AI phrase carries its picture and all three notes.
    const first = (call.body as { phrases: { image: string[]; notes: Record<string, unknown> }[] }).phrases[0];
    expect(first.image.length).toBeGreaterThan(0);
    expect(Object.keys(first.notes).sort()).toEqual(['grammar', 'mnemonic', 'pronunciation']);

    expect(app.sees(c.create.savedToAccount)).toBe(true);
    expect(app.pathname()).toMatch(/^\/set\/set-u-/);
    expect(app.sees('En el hotel')).toBe(true);
    expect(app.sees(HOTEL[0].target)).toBe(true);
    expect(app.sees(HOTEL[1].target)).toBe(true);
    expect(app.sees(c.common.phrases(2)) || app.sees(new RegExp(`^${c.set.summary(2, 0, 0)}`))).toBe(true);
  });

  it('the new set is in the course: under Library’s My sets and on the Create tab', async () => {
    const app = await open();
    const { c } = app;
    await toSave(app);
    await app.tap(c.create.saveToAccount);
    await app.open('/create');
    expect(app.sees('Hotel')).toBe(true);
    await app.open('/library?view=ownSets');
    expect(app.sees('Hotel')).toBe(true);
  });

  it('keeps the AI label on the saved phrases: written by AI, not checked (AI-06)', async () => {
    const app = await open();
    const { c } = app;
    await toSave(app);
    await app.tap(c.create.saveToAccount);
    await app.tap(c.phrase.details(HOTEL[0].target));
    expect(app.sees(c.make.originAi)).toBe(true);
  });

  it('keeps the bank’s label on bank phrases where the server has no AI (AI-05)', async () => {
    const { api } = server();
    lib(api).config.ai = false;
    const app = await open(api);
    const { c } = app;
    await toSave(app);
    await app.tap(c.create.saveToAccount);
    const [call] = app.api.calls('POST /library/sets');
    expect((call.body as { phrases: { source: string; bankId: string }[] }).phrases).toEqual([
      expect.objectContaining({ source: 'bank', bankId: HOTEL[0].id }),
      expect.objectContaining({ source: 'bank', bankId: HOTEL[1].id }),
    ]);
    await app.tap(c.phrase.details(HOTEL[0].target));
    expect(app.sees(c.make.originBank)).toBe(true);
    expect(app.sees(c.make.originAi)).toBe(false);
  });

  it('saves a phrase the learner already has by reference, not a copy', async () => {
    const { api, user } = server();
    const made = seedSet(api, user, { title: 'Mi hotel', phrases: [{ target: HOTEL[0].target, native: HOTEL[0].native }] });
    const app = await open(api);
    const { c } = app;
    await ask(app);
    await app.tap(c.make.addLabel(HOTEL[0].target));
    await app.tap(c.make.addLabel(HOTEL[1].target));
    await app.tap(c.make.done);
    await app.tap(c.create.saveToAccount);
    const [call] = app.api.calls('POST /library/sets');
    expect((call.body as { phrases: unknown[] }).phrases[0]).toEqual({ ref: lib(api).sets.get(made.id)!.items[0] });
  });

  it('saves a corrected card as a phrase the learner wrote, for the server to write notes for', async () => {
    const app = await open();
    const { c } = app;
    await ask(app);
    await app.tap(c.make.editLabel(HOTEL[0].target));
    await app.type(c.addPhrase.target('Spanish'), 'A qué hora desayunamos');
    await app.tap(c.common.save);
    await app.tap(c.make.addLabel('A qué hora desayunamos'));
    await app.tap(c.make.done);
    await app.tap(c.create.saveToAccount);
    const [call] = app.api.calls('POST /library/sets');
    expect((call.body as { phrases: unknown[] }).phrases).toEqual([{ target: 'A qué hora desayunamos', native: HOTEL[0].native, source: 'written' }]);
  });

  it('draws the cover in the background when asked, and not when the switch is off', async () => {
    const app = await open();
    const { c } = app;
    await toSave(app);
    expect((screen.getByLabelText(c.create.withCover).props as { value: boolean }).value).toBe(true);
    await app.tap(c.create.saveToAccount);
    await app.advance(500);
    const covers = app.api.calls('POST /library/generate/cover');
    expect(covers).toHaveLength(1);
    expect(covers[0].body).toMatchObject({ kind: 'set', title: 'Hotel', attachTo: expect.stringMatching(/^set-u-/) });

    const off = await open();
    await toSave(off);
    await flip(off, off.c.create.withCover, false);
    await off.tap(off.c.create.saveToAccount);
    await off.advance(500);
    expect(off.api.calls('POST /library/generate/cover')).toEqual([]);
  });

  it('counts the phrases against today’s allowance once saved', async () => {
    const app = await open();
    const { c } = app;
    await toSave(app);
    await app.tap(c.create.saveToAccount);
    await app.open('/create');
    expect(app.sees(new RegExp(`${c.create.left(29)}`))).toBe(true);
  });

  it('says so when saving fails, and keeps the step so Save can be tried again', async () => {
    const app = await open();
    const { c } = app;
    await toSave(app);
    app.api.failNext('POST /library/sets', problem(500, 'INTERNAL'));
    await app.tap(c.create.saveToAccount);
    expect(app.sees(c.account.errors.generic)).toBe(true);
    expect(app.sees(c.make.saveTitle)).toBe(true);
    expect(app.pathname()).toBe('/make');
    await app.tap(c.create.saveToAccount);
    expect(app.api.calls('POST /library/sets')).toHaveLength(2);
    expect(app.pathname()).toMatch(/^\/set\/set-u-/);
  });

  it('says the set limit is reached', async () => {
    const { api } = server();
    api.kept.sets = 0;
    const app = await open(api);
    await toSave(app);
    await app.tap(app.c.create.saveToAccount);
    expect(app.sees(app.c.account.errors.full)).toBe(true);
    expect(app.pathname()).toBe('/make');
  });

  it('adds the phrases to a set of the learner’s own when opened from it, and closes', async () => {
    const { api, user } = server();
    const made = seedSet(api, user, { title: 'Mi viaje', phrases: [{ target: 'Hola', native: 'Hello' }] });
    const app = await open(api, `/set/${made.id}`);
    const { c } = app;
    await app.tap(c.make.fromSet);
    expect(app.pathname()).toBe('/make');
    expect(app.sees(c.make.into('Mi viaje'))).toBe(true);
    await ask(app);
    await addCards(app, 0, 2);
    await app.tap(c.make.done);
    // No name to give: the set is the one being filled.
    expect(screen.queryByLabelText(c.createSet.name)).toBeNull();
    expect(app.sees(c.make.addInto(2, 'Mi viaje'))).toBe(true);
    expect(screen.queryByLabelText(c.create.withCover)).toBeNull();
    await app.tap(c.make.addInto(2, 'Mi viaje'));

    const calls = app.api.calls(`POST /library/sets/${made.id}`);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({ addPhrases: [{ target: HOTEL[0].target, source: 'ai' }, { target: HOTEL[1].target, source: 'ai' }] });
    expect(app.api.calls('POST /library/sets')).toEqual([]);
    expect(app.pathname()).toBe(`/set/${made.id}`);
    expect(app.sees(c.make.addedInto(2, 'Mi viaje'))).toBe(true);
    expect(app.sees(HOTEL[0].target)).toBe(true);
  });

  it('does not suggest phrases the set already holds, and sends them to avoid', async () => {
    const { api, user } = server();
    const made = seedSet(api, user, { title: 'Mi viaje', phrases: [{ target: HOTEL[0].target, native: HOTEL[0].native }] });
    const app = await open(api, `/make?setId=${made.id}`);
    await ask(app);
    expect((listed(app)[0].body as { avoid: string[] }).avoid).toEqual([HOTEL[0].target]);
    expect(app.sees(app.c.make.progress(1, 5))).toBe(true);
    expect(app.sees(HOTEL[0].target)).toBe(false);
  });
});

describe('Make a set: closing', () => {
  it('Close with phrases added offers them back, and Reopen restores the flow as it was', async () => {
    const app = await launch({ url: '/create', signedIn: EMAIL });
    const { c } = app;
    await app.tap(new RegExp(`^${c.create.phrasesTitle}\\.`));
    await ask(app);
    await addCards(app, 0, 2);
    await app.tap(c.common.close);
    expect(app.pathname()).toBe('/create');
    expect(app.sees(c.make.unsaved(2))).toBe(true);
    await app.tap(c.make.reopen);
    expect(app.pathname()).toBe('/make');
    expect(app.sees(c.make.progress(3, 6))).toBe(true);
    expect(app.sees(c.make.addedCount(2))).toBe(true);
    expect(app.api.calls('POST /library/decks')).toHaveLength(1);
  });

  it('the system back button offers them back too', async () => {
    const app = await launch({ url: '/create', signedIn: EMAIL });
    const { c } = app;
    await app.tap(new RegExp(`^${c.create.phrasesTitle}\\.`));
    await ask(app);
    await addCards(app, 0, 1);
    await app.back();
    expect(app.sees(c.make.unsaved(1))).toBe(true);
  });

  it('offers nothing back when no phrase was added', async () => {
    const app = await launch({ url: '/create', signedIn: EMAIL });
    const { c } = app;
    await app.tap(new RegExp(`^${c.create.phrasesTitle}\\.`));
    await ask(app);
    await app.tap(c.make.skipLabel(HOTEL[0].target));
    await app.tap(c.common.close);
    expect(app.sees(c.make.unsaved(1))).toBe(false);
    expect(app.sees(c.make.reopen)).toBe(false);
  });

  it('offers nothing back once the phrases are saved', async () => {
    const app = await launch({ url: '/create', signedIn: EMAIL });
    const { c } = app;
    await app.tap(new RegExp(`^${c.create.phrasesTitle}\\.`));
    await ask(app);
    await addCards(app, 0, 1);
    await app.tap(c.make.done);
    await app.tap(c.create.saveToAccount);
    expect(app.sees(c.make.unsaved(1))).toBe(false);
    await app.back();
    expect(app.sees(c.make.unsaved(1))).toBe(false);
  });

  it('opening Make a set again starts afresh, not with the phrases left unsaved', async () => {
    const app = await launch({ url: '/create', signedIn: EMAIL });
    const { c } = app;
    await app.tap(new RegExp(`^${c.create.phrasesTitle}\\.`));
    await ask(app);
    await addCards(app, 0, 1);
    await app.tap(c.common.close);
    await app.tap(new RegExp(`^${c.create.phrasesTitle}\\.`));
    expect(app.sees(c.make.intro)).toBe(true);
    expect(screen.getByLabelText(c.make.field.topic).props.value).toBe('');
  });
});
