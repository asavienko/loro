// Making a song (LIB-03, AI-05, P3-11): "Make a song" from a set's page and from an album's page, the
// sheet's setup (the set, the twelve styles, the options folded under one row, what the song is about,
// the album and the title), the lyrics written first and read, written again or changed as asked, the
// approval that has them sung, and the song watched while it is made (ready, failed, retried), with
// the phone's own word when the app is in the background and a tap on it.
//
// Covered: signed out (the sheet asks to sign in); opening from a set (its page and its ⋮ menu) and
// from an album; every set option, every one of the twelve styles; the options row (voice, tempo,
// mood, length, with their notes and the summary), what it is about (only where an AI writes),
// the album chosen (new or an own one), the title; the allowance shown before asking and spent
// (lyrics, songs); the demo-sound notes; a server with no text model (the set's phrases as they are);
// the lyrics step (writing, the draft, the failed draft, rewriting plain and as asked, back to the
// setup, approving); the song started (toast, album opened, the server's request); push registration;
// watching a song every five seconds (ready toast with Play, failed toast, a refused or removed song
// no longer asked after, offline asked again); the local notification in the background and its tap
// (ready and failed); retrying a failed song; the sheet closed while the lyrics are written; signing
// out stopping the watch.
import { SONG_LENGTH_LINES, SONG_LENGTHS, SONG_MOODS, SONG_STYLES, SONG_TEMPOS, SONG_VOICES } from '@shared/api/library';
import { problem } from '../fakes/api';
import { failSong, lib, readyLyrics, readySong, seedAlbum, seedSet } from '../fakes/library';
import { FakeApi } from '../fakes/api';
import { audio, device, launch, screen, SECOND, type App } from '../harness';

const EMAIL = 'ana@example.test';

/** Opens the café set's page, signed in, and its Make a song sheet. */
async function openSheet(more: Parameters<typeof launch>[0] = {}) {
  const app = await launch({ signedIn: EMAIL, url: '/set/set-cafe', ...more });
  await app.tap(app.c.music.makeSong, { index: 0 });
  return app;
}

/** The lyrics POST bodies the server was sent. */
const lyricsRequests = (app: App) => app.api.calls('POST /library/lyrics').map((r) => r.body as Record<string, any>);
const lastLyrics = (app: App) => lyricsRequests(app).at(-1)!;

/** Writes the lyrics and waits for the draft (the lyrics are ready on the first ask after the write). */
async function writeLyrics(app: App) {
  await app.tap(app.c.create.writeLyrics);
  await app.advance(3 * SECOND);
}

/** Is the control with this name the chosen one of its group (a chip or a radio)? */
const chosen = (name: string | RegExp) => {
  const el = screen.queryAllByRole('radio', { name }).concat(screen.queryAllByRole('button', { name }));
  return el.some((e) => e.props.accessibilityState?.selected === true || e.props.accessibilityState?.checked === true);
};

const lastSong = (app: App) => [...lib(app.api).songs.values()].at(-1)!;

describe('Make a song: opening it', () => {
  it('signed out, the sheet asks to sign in rather than offering the setup', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.music.makeSong, { index: 0 });
    expect(app.sees(app.c.account.needed)).toBe(true);
    expect(app.sees(app.c.create.writeLyrics)).toBe(false);
    expect(app.api.calls('POST /library/lyrics')).toHaveLength(0);
  });

  it('its Sign in button closes the sheet and opens the account page', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.music.makeSong, { index: 0 });
    await app.tap(app.c.account.signIn);
    expect(app.sees(app.c.create.pickSet)).toBe(false);
    expect(app.pathname()).toBe('/account');
  });

  it('a set page’s Make a song opens the setup with that set chosen', async () => {
    const app = await openSheet();
    expect(app.sees(app.c.create.pickSet)).toBe(true);
    expect(chosen(/Café & Mañanas/)).toBe(true);
    expect(chosen(/Tapas & Tabernas/)).toBe(false);
  });

  it('the set’s ⋮ menu has a Make a song that opens the same setup', async () => {
    const app = await launch({ signedIn: EMAIL, url: '/set/set-cafe' });
    await app.tap(app.c.common.moreOptions);
    await app.tap(app.c.music.makeSong, { index: 0 });
    expect(app.sees(app.c.create.pickStyle)).toBe(true);
    expect(chosen(/Café & Mañanas/)).toBe(true);
  });

  it('the Create tab’s song card opens it with no set chosen, and Write the lyrics asks for nothing until one is', async () => {
    const app = await launch({ signedIn: EMAIL });
    await app.tap(app.c.tabs.create);
    await app.tap(new RegExp(app.c.create.songTitle));
    expect(app.sees(app.c.create.pickSet)).toBe(true);
    expect(chosen(/phrases/)).toBe(false);
    await app.tap(app.c.create.writeLyrics);
    expect(app.api.calls('POST /library/lyrics')).toHaveLength(0);
    await app.tap('Mercado');
    expect(chosen(/Mercado/)).toBe(true);
    await writeLyrics(app);
    expect(lastLyrics(app).setId).toBe('set-market');
  });

  it('an own album’s page has a Make a song that opens it with that album chosen', async () => {
    const api = new FakeApi();
    const album = seedAlbum(api, api.addUser(EMAIL), { title: 'Mis canciones', setId: 'set-cafe' });
    const app = await launch({ api, signedIn: EMAIL, url: `/album/${album.id}` });
    await app.tap(app.c.music.makeSong);
    expect(chosen(/Mis canciones/)).toBe(true);
    expect(chosen(app.c.create.newAlbum)).toBe(false);
  });

  it('the sheet closes by its Close button, and opens again afresh', async () => {
    const app = await openSheet();
    await app.tap('Tapas & Tabernas');
    await app.tap(app.c.common.close);
    expect(app.sees(app.c.create.pickStyle)).toBe(false);
    await app.tap(app.c.music.makeSong, { index: 0 });
    expect(chosen(/Café & Mañanas/)).toBe(true);
    expect(chosen(/Tapas & Tabernas/)).toBe(false);
  });
});

describe('Make a song: the setup', () => {
  it('offers the course’s sets with their phrase counts; the one chosen is the one the lyrics are written for', async () => {
    const app = await openSheet();
    expect(app.sees(app.c.common.phrases(5))).toBe(true);
    await app.tap('Metro y Calles');
    expect(chosen(/Metro y Calles/)).toBe(true);
    expect(chosen(/Café & Mañanas/)).toBe(false);
    await writeLyrics(app);
    expect(lastLyrics(app)).toMatchObject({ setId: 'set-transit', nativeLang: 'en-GB' });
  });

  it('lists the learner’s own sets with Loro’s', async () => {
    const api = new FakeApi();
    const own = seedSet(api, api.addUser(EMAIL), { title: 'Mi canción', phrases: [{ target: 'Buenos días', native: 'Good morning' }] });
    const app = await launch({ api, signedIn: EMAIL, url: '/set/set-cafe' });
    await app.tap(app.c.music.makeSong, { index: 0 });
    await app.tap('Mi canción');
    await writeLyrics(app);
    expect(lastLyrics(app).setId).toBe(own.id);
  });

  it('starts on Pop, and each of the twelve styles is chosen on its own and asked for by name', async () => {
    const app = await openSheet();
    const c = app.c;
    expect(chosen(c.music.style.modern_pop)).toBe(true);
    for (const id of SONG_STYLES) {
      await app.tap(c.music.style[id]);
      expect(chosen(c.music.style[id])).toBe(true);
      for (const other of SONG_STYLES) if (other !== id) expect(chosen(c.music.style[other])).toBe(false);
    }
    // The last one chosen is the one the lyrics are written in.
    await writeLyrics(app);
    expect(lastLyrics(app).styleId).toBe('bossa_nova');
    expect(app.sees(`${c.create.draft(1)} · ${c.music.style.bossa_nova}`)).toBe(true);
  });

  it('asks for the default style (Pop) when none is chosen', async () => {
    const app = await openSheet();
    await writeLyrics(app);
    expect(lastLyrics(app)).toMatchObject({ styleId: 'modern_pop', options: { voice: 'any', tempo: 'natural', mood: null, length: 'standard', theme: null } });
  });
});

describe('Make a song: how it is sung', () => {
  it('folds the options under one row that says what is chosen', async () => {
    const app = await openSheet();
    const { c } = app;
    expect(app.sees(`${c.create.songOptions}: ${c.music.voice.any} · ${c.music.tempo.natural} · ${c.music.length.standard}`)).toBe(true);
    // Folded: none of the groups shows.
    expect(app.sees(c.create.pickVoice)).toBe(false);
    expect(app.sees(c.create.pickTempo)).toBe(false);
  });

  it('opens to voice, tempo, mood and length, and folds again', async () => {
    const app = await openSheet();
    const { c } = app;
    await app.tap(new RegExp(`^${c.create.songOptions}`));
    for (const label of [c.create.pickVoice, c.create.pickTempo, c.create.pickMood, c.create.pickLength]) expect(app.sees(label)).toBe(true);
    await app.tap(new RegExp(`^${c.create.songOptions}`));
    expect(app.sees(c.create.pickVoice)).toBe(false);
  });

  it('each voice is chosen on its own, and shows in the row’s summary', async () => {
    const app = await openSheet();
    const { c } = app;
    await app.tap(new RegExp(`^${c.create.songOptions}`));
    expect(chosen(c.music.voice.any)).toBe(true);
    for (const id of SONG_VOICES) {
      await app.tap(c.music.voice[id]);
      expect(chosen(c.music.voice[id])).toBe(true);
      expect(app.sees(new RegExp(`^${c.create.songOptions}: ${c.music.voice[id]} ·`))).toBe(true);
    }
  });

  it('each tempo is chosen on its own and says what it means beneath', async () => {
    const app = await openSheet();
    const { c } = app;
    await app.tap(new RegExp(`^${c.create.songOptions}`));
    expect(app.sees(c.create.tempoNote.natural)).toBe(true);
    for (const id of SONG_TEMPOS) {
      await app.tap(c.music.tempo[id]);
      expect(chosen(c.music.tempo[id])).toBe(true);
      expect(app.sees(c.create.tempoNote[id])).toBe(true);
    }
  });

  it('the mood starts as the style’s own; each mood is chosen on its own, and the style’s own puts it back', async () => {
    const app = await openSheet();
    const { c } = app;
    await app.tap(new RegExp(`^${c.create.songOptions}`));
    expect(chosen(c.create.moodAny)).toBe(true);
    for (const id of SONG_MOODS) {
      await app.tap(c.music.mood[id]);
      expect(chosen(c.music.mood[id])).toBe(true);
      expect(chosen(c.create.moodAny)).toBe(false);
      expect(app.sees(new RegExp(`${c.music.mood[id]} · ${c.music.length.standard}$`))).toBe(true);
    }
    await app.tap(c.create.moodAny);
    expect(chosen(c.create.moodAny)).toBe(true);
    expect(app.sees(`${c.create.songOptions}: ${c.music.voice.any} · ${c.music.tempo.natural} · ${c.music.length.standard}`)).toBe(true);
  });

  it('each length is chosen on its own and says how many lines it allows', async () => {
    const app = await openSheet();
    const { c } = app;
    await app.tap(new RegExp(`^${c.create.songOptions}`));
    for (const id of SONG_LENGTHS) {
      await app.tap(c.music.length[id]);
      expect(chosen(c.music.length[id])).toBe(true);
      expect(app.sees(c.create.lengthNote(SONG_LENGTH_LINES[id]))).toBe(true);
    }
  });

  it('what is chosen is asked for, and the draft says how it was written', async () => {
    const app = await openSheet();
    const { c } = app;
    await app.tap(new RegExp(`^${c.create.songOptions}`));
    await app.tap(c.music.voice.duet);
    await app.tap(c.music.tempo.slow);
    await app.tap(c.music.mood.calm);
    await app.tap(c.music.length.short);
    await writeLyrics(app);
    expect(lastLyrics(app).options).toEqual({ voice: 'duet', tempo: 'slow', mood: 'calm', length: 'short', theme: null });
    expect(app.sees(`${c.music.voice.duet} · ${c.music.tempo.slow} · ${c.music.mood.calm} · ${c.music.length.short}`)).toBe(true);
  });

  it('on a server with only the demo sound the options say that voice, tempo and mood are heard once songs are sung', async () => {
    const app = await openSheet();
    await app.tap(new RegExp(`^${app.c.create.songOptions}`));
    expect(app.sees(app.c.create.optionsDemo)).toBe(true);
  });
});

describe('Make a song: what it is about, its album and its title', () => {
  it('what it is about is asked for as typed, trimmed, and shown beside the draft', async () => {
    const app = await openSheet();
    const { c } = app;
    await app.type(c.create.themeLabel, '  a rainy morning  ');
    await writeLyrics(app);
    expect(lastLyrics(app).options.theme).toBe('a rainy morning');
    expect(app.sees(/“a rainy morning”/)).toBe(true);
  });

  it('what it is about is limited to 200 characters', async () => {
    const app = await openSheet();
    expect(screen.getByLabelText(app.c.create.themeLabel).props.maxLength).toBe(200);
  });

  it('on a server with no text model there is no theme field, and the set’s phrases are the lyrics as they are', async () => {
    const app = await launch({ signedIn: EMAIL, url: '/set/set-cafe' });
    lib(app.api).config.ai = false;
    await app.tap(app.c.music.makeSong, { index: 0 });
    expect(app.sees(app.c.create.themeLabel)).toBe(false);
    expect(app.sees(app.c.account.writer.phrases)).toBe(true);
    await app.tap(app.c.create.writeLyrics);
    expect(lastLyrics(app).options.theme).toBeNull();
    // Ready at once; no allowance of lyrics is spent, and there is no rewriting.
    expect(app.sees(app.c.create.lyricsPlain)).toBe(true);
    expect(app.sees(app.c.create.rewrite)).toBe(false);
    expect(app.sees(app.c.music.lyricsBy.phrases)).toBe(true);
    expect(app.api.used(app.user!.id, 'lyrics')).toBe(0);
  });

  it('a new album is the default; an own album is chosen on its own and the song goes into it', async () => {
    const api = new FakeApi();
    const album = seedAlbum(api, api.addUser(EMAIL), { title: 'Mis canciones', setId: 'set-cafe' });
    const app = await launch({ api, signedIn: EMAIL, url: '/set/set-cafe' });
    await app.tap(app.c.music.makeSong, { index: 0 });
    expect(chosen(app.c.create.newAlbum)).toBe(true);
    expect(app.sees(app.c.music.songs(1))).toBe(true);
    await app.tap('Mis canciones');
    expect(chosen(/Mis canciones/)).toBe(true);
    expect(chosen(app.c.create.newAlbum)).toBe(false);
    await writeLyrics(app);
    await app.tap(app.c.create.approve);
    expect(app.api.calls('POST /library/generate/song')[0].body).toMatchObject({ albumId: album.id });
    expect(app.pathname()).toBe(`/album/${album.id}`);
  });

  it('choosing A new album again puts an album chosen back, and sends no album', async () => {
    const api = new FakeApi();
    seedAlbum(api, api.addUser(EMAIL), { title: 'Mis canciones', setId: 'set-cafe' });
    const app = await launch({ api, signedIn: EMAIL, url: '/set/set-cafe' });
    await app.tap(app.c.music.makeSong, { index: 0 });
    await app.tap('Mis canciones');
    await app.tap(app.c.create.newAlbum);
    await writeLyrics(app);
    await app.tap(app.c.create.approve);
    expect(app.api.calls('POST /library/generate/song')[0].body).not.toHaveProperty('albumId');
  });

  it('the title is asked for as typed (trimmed); its placeholder is the set’s name and none is sent when empty', async () => {
    const app = await openSheet();
    expect(screen.getByLabelText(app.c.create.songTitleLabel).props.placeholder).toBe('Café & Mañanas');
    await writeLyrics(app);
    expect(lastLyrics(app)).not.toHaveProperty('title');
    await app.tap(app.c.create.backToSetup);
    await app.type(app.c.create.songTitleLabel, '  Mi canción  ');
    await writeLyrics(app);
    expect(lastLyrics(app).title).toBe('Mi canción');
  });

  it('the title is limited to 60 characters', async () => {
    const app = await openSheet();
    expect(screen.getByLabelText(app.c.create.songTitleLabel).props.maxLength).toBe(60);
  });
});

describe('Make a song: the allowance', () => {
  it('shows the lyrics left before asking, and one fewer once they are written', async () => {
    const app = await openSheet();
    const { c } = app;
    const limit = app.api.limits.lyrics;
    expect(app.sees(c.account.usage.lyrics(limit, limit))).toBe(true);
    await writeLyrics(app);
    expect(app.sees(c.account.usage.lyrics(limit - 1, limit))).toBe(true);
  });

  it('shows the songs left beside Sing it', async () => {
    const app = await openSheet();
    await writeLyrics(app);
    expect(app.sees(app.c.account.usage.song(app.api.limits.song, app.api.limits.song))).toBe(true);
  });

  it('with the lyrics allowance spent, says so and does not ask', async () => {
    const app = await launch({ signedIn: EMAIL, url: '/set/set-cafe' });
    app.api.limits.lyrics = 0;
    await app.tap(app.c.music.makeSong, { index: 0 });
    expect(app.sees(/^Today’s allowance is used/)).toBe(true);
    await app.tap(app.c.create.writeLyrics);
    expect(app.api.calls('POST /library/lyrics')).toHaveLength(0);
  });

  it('with the songs allowance spent, says so and Sing it asks for nothing', async () => {
    const app = await openSheet();
    await writeLyrics(app);
    app.api.limits.song = 0;
    await app.tap(app.c.create.backToSetup);
    await app.tap(app.c.create.writeLyrics);
    await app.advance(3 * SECOND);
    expect(app.sees(/^Today’s allowance is used/)).toBe(true);
    await app.tap(app.c.create.approve);
    expect(app.api.calls('POST /library/generate/song')).toHaveLength(0);
  });

  it('the server refusing for the day’s allowance is told to the learner and keeps the sheet open', async () => {
    const app = await openSheet();
    await writeLyrics(app);
    app.api.failNext('POST /library/generate/song', {
      status: 429,
      body: { type: 'about:blank', title: 'Allowance used', status: 429, code: 'LIMIT_REACHED', detail: 'Daily limit reached', kind: 'song', limit: 5, resets_at: Date.now() + 3_600_000 },
    });
    await app.tap(app.c.create.approve);
    expect(app.sees(/^Today’s allowance is used/)).toBe(true);
    expect(app.sees(app.c.create.approve)).toBe(true);
    expect(app.pathname()).toBe('/set/set-cafe');
  });
});

describe('Make a song: the lyrics', () => {
  it('while they are written, says so and the button is gone', async () => {
    const app = await openSheet();
    lib(app.api).config.lyricsPolls = Infinity;
    await app.tap(app.c.create.writeLyrics);
    expect(app.sees(app.c.create.writingLyrics)).toBe(true);
    expect(app.sees(app.c.create.writeLyrics)).toBe(false);
    expect(app.api.calls('POST /library/lyrics')).toHaveLength(1);
  });

  it('the draft shows the set, its number, the style, then each section with its lines and their meanings', async () => {
    const app = await openSheet();
    const { c } = app;
    await writeLyrics(app);
    expect(app.sees(`${c.create.draft(1)} · ${c.music.style.modern_pop}`)).toBe(true);
    expect(app.sees(c.create.lyricsReady)).toBe(true);
    expect(app.sees(c.music.section.verse.toLocaleUpperCase(c.locale))).toBe(true);
    expect(app.sees('Me pone un cortado, por favor')).toBe(true);
    expect(app.sees('A cortado, please')).toBe(true);
    expect(app.sees(c.music.lyricsBy.ai)).toBe(true);
  });

  it('waits for a draft the server is still writing, asking again, and shows it when it is ready', async () => {
    const app = await openSheet();
    lib(app.api).config.lyricsPolls = Infinity;
    await app.tap(app.c.create.writeLyrics);
    await app.advance(10 * SECOND);
    expect(app.sees(app.c.create.writingLyrics)).toBe(true);
    expect(app.api.calls('GET /library/lyrics/' + [...lib(app.api).lyrics.keys()][0]).length).toBeGreaterThan(1);
    readyLyrics(app.api, [...lib(app.api).lyrics.keys()][0]);
    await app.advance(5 * SECOND);
    expect(app.sees(app.c.create.lyricsReady)).toBe(true);
  });

  it('a draft that could not be written says so, and Sing it is not offered as ready', async () => {
    const app = await openSheet();
    lib(app.api).config.lyricsPolls = Infinity;
    await app.tap(app.c.create.writeLyrics);
    const draft = [...lib(app.api).lyrics.values()][0];
    draft.status = 'failed';
    await app.advance(5 * SECOND);
    expect(app.sees(app.c.create.lyricsFailed)).toBe(true);
    await app.tap(app.c.create.approve);
    expect(app.api.calls('POST /library/generate/song')).toHaveLength(0);
  });

  it('a refused ask for lyrics is told to the learner and leaves the setup as it was', async () => {
    const app = await openSheet();
    app.api.failNext('POST /library/lyrics', problem(503, 'PROVIDER_UNAVAILABLE', 'No writer'));
    await app.tap(app.c.create.writeLyrics);
    expect(app.sees(app.c.account.errors.unavailable)).toBe(true);
    expect(app.sees(app.c.create.writeLyrics)).toBe(true);
    expect(app.sees(app.c.create.pickStyle)).toBe(true);
  });

  it('Write again writes the same lyrics anew as a second draft, spending a lyrics allowance', async () => {
    const app = await openSheet();
    const { c } = app;
    await writeLyrics(app);
    const before = app.api.used(app.user!.id, 'lyrics');
    await app.tap(c.create.rewrite);
    await app.advance(3 * SECOND);
    const calls = app.api.calls(`POST /library/lyrics/${[...lib(app.api).lyrics.keys()][0]}/rewrite`);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({});
    expect(app.sees(`${c.create.draft(2)} · ${c.music.style.modern_pop}`)).toBe(true);
    expect(app.api.used(app.user!.id, 'lyrics')).toBe(before + 1);
  });

  it('what to change is typed, the button then reads Rewrite as asked, and the instruction goes with it', async () => {
    const app = await openSheet();
    const { c } = app;
    await writeLyrics(app);
    expect(app.sees(c.create.rewriteAsAsked)).toBe(false);
    await app.type(c.create.rewriteLabel, '  a line about the sea  ');
    expect(app.sees(c.create.rewriteAsAsked)).toBe(true);
    await app.tap(c.create.rewriteAsAsked);
    await app.advance(3 * SECOND);
    const id = [...lib(app.api).lyrics.keys()][0];
    expect(app.api.calls(`POST /library/lyrics/${id}/rewrite`)[0].body).toEqual({ instruction: 'a line about the sea' });
    expect(app.sees(c.create.draft(2) + ' · ' + c.music.style.modern_pop)).toBe(true);
  });

  it('the instruction is cleared once the new draft is in, and limited to 200 characters', async () => {
    const app = await openSheet();
    const { c } = app;
    await writeLyrics(app);
    expect(screen.getByLabelText(c.create.rewriteLabel).props.maxLength).toBe(200);
    await app.type(c.create.rewriteLabel, 'shorter');
    await app.tap(c.create.rewriteAsAsked);
    await app.advance(3 * SECOND);
    expect(screen.getByLabelText(c.create.rewriteLabel).props.value).toBe('');
    expect(app.sees(c.create.rewrite)).toBe(true);
  });

  it('while a rewrite is on its way, the buttons wait', async () => {
    const app = await openSheet();
    const { c } = app;
    await writeLyrics(app);
    lib(app.api).config.lyricsPolls = Infinity;
    await app.tap(c.create.rewrite);
    expect(app.sees(c.create.writingLyrics)).toBe(true);
    await app.tap(c.create.approve);
    await app.tap(c.create.backToSetup);
    expect(app.api.calls('POST /library/generate/song')).toHaveLength(0);
    expect(app.sees(c.create.writingLyrics)).toBe(true);
  });

  it('with the lyrics allowance spent, a rewrite is not offered', async () => {
    const app = await openSheet();
    const { c } = app;
    app.api.limits.lyrics = 1;
    await writeLyrics(app);
    expect(app.sees(/^Today’s allowance is used/)).toBe(true);
    await app.tap(c.create.rewrite);
    expect(app.api.calls(`POST /library/lyrics/${[...lib(app.api).lyrics.keys()][0]}/rewrite`)).toHaveLength(0);
  });

  it('Change the set, style or options goes back to the setup with every choice kept', async () => {
    const app = await openSheet();
    const { c } = app;
    await app.tap('Mercado');
    await app.tap(c.music.style.jazz_lounge);
    await app.type(c.create.songTitleLabel, 'Mi jazz');
    await writeLyrics(app);
    await app.tap(c.create.backToSetup);
    expect(app.sees(c.create.pickStyle)).toBe(true);
    expect(chosen(/Mercado/)).toBe(true);
    expect(chosen(c.music.style.jazz_lounge)).toBe(true);
    expect(screen.getByLabelText(c.create.songTitleLabel).props.value).toBe('Mi jazz');
    // Writing again starts a new draft, not a rewrite of the old.
    await writeLyrics(app);
    expect(lyricsRequests(app)).toHaveLength(2);
    expect(app.sees(c.create.draft(1) + ' · ' + c.music.style.jazz_lounge)).toBe(true);
  });

  it('closing the sheet while the lyrics are written takes the answer nowhere', async () => {
    const app = await openSheet();
    lib(app.api).config.lyricsPolls = Infinity;
    await app.tap(app.c.create.writeLyrics);
    await app.tap(app.c.common.close);
    readyLyrics(app.api, [...lib(app.api).lyrics.keys()][0]);
    await app.advance(10 * SECOND);
    expect(app.sees(app.c.create.lyricsReady)).toBe(false);
    expect(app.sees(app.c.create.pickStyle)).toBe(false);
  });
});

describe('Make a song: approving it', () => {
  it('Sing it asks for the song from exactly those lyrics, with the set, style, album and title chosen', async () => {
    const app = await openSheet();
    const { c } = app;
    await app.tap(c.music.style.hip_hop);
    await app.type(c.create.songTitleLabel, 'Mi rap');
    await writeLyrics(app);
    await app.tap(c.create.approve);
    const call = app.api.calls('POST /library/generate/song')[0];
    expect(call.body).toMatchObject({ setId: 'set-cafe', styleId: 'hip_hop', nativeLang: 'en-GB', title: 'Mi rap', lyricsId: [...lib(app.api).lyrics.keys()][0] });
    expect(lastSong(app)).toMatchObject({ title: 'Mi rap', styleId: 'hip_hop', status: 'rendering' });
  });

  it('the learner’s own lines are the ones sung: a rewrite’s draft, not the first', async () => {
    const app = await openSheet();
    const { c } = app;
    await writeLyrics(app);
    await app.tap(c.create.rewrite);
    await app.advance(3 * SECOND);
    await app.tap(c.create.approve);
    expect(lastSong(app).lyrics).toEqual([...lib(app.api).lyrics.values()][0].sections);
  });

  it('says the song is being made, closes the sheet and opens its album, where the song is making', async () => {
    const app = await openSheet();
    const { c } = app;
    lib(app.api).config.songPolls = Infinity;
    await writeLyrics(app);
    await app.tap(c.create.approve);
    expect(app.sees(c.create.songStarted)).toBe(true);
    expect(app.sees(c.create.pickStyle)).toBe(false);
    const song = lastSong(app);
    expect(app.pathname()).toBe(`/album/${song.albumId}`);
    expect(app.sees(c.music.rendering)).toBe(true);
    expect(app.sees(c.music.renderingNote)).toBe(true);
    expect(app.sees(`Café & Mañanas, ${c.music.rendering}`)).toBe(true);
  });

  it('spends one of the day’s songs', async () => {
    const app = await openSheet();
    await writeLyrics(app);
    await app.tap(app.c.create.approve);
    expect(app.api.used(app.user!.id, 'song')).toBe(1);
  });

  it('a refused song is told to the learner, and the sheet stays at the lyrics', async () => {
    const app = await openSheet();
    await writeLyrics(app);
    app.api.failNext('POST /library/generate/song', problem(503, 'PROVIDER_UNAVAILABLE', 'No music'));
    await app.tap(app.c.create.approve);
    expect(app.sees(app.c.account.errors.unavailable)).toBe(true);
    expect(app.sees(app.c.create.approve)).toBe(true);
    expect(app.pathname()).toBe('/set/set-cafe');
  });

  it('the demo sound is named beside Sing it', async () => {
    const app = await openSheet();
    await writeLyrics(app);
    expect(app.sees(app.c.account.writer.demo)).toBe(true);
  });

  it('a build with no EAS project keeps to local notifications: no token is given to the server', async () => {
    const app = await openSheet();
    await writeLyrics(app);
    await app.tap(app.c.create.approve);
    await app.settle();
    expect(app.api.calls('POST /library/push-tokens')).toHaveLength(0);
    expect(lib(app.api).pushTokens.size).toBe(0);
  });

  it('with an EAS project the phone’s push token goes to the server with the UI language', async () => {
    device.pushProject = 'e2e-project';
    const app = await openSheet();
    await writeLyrics(app);
    await app.tap(app.c.create.approve);
    await app.settle();
    const pushes = app.api.calls('POST /library/push-tokens');
    expect(pushes).toHaveLength(1);
    expect(pushes[0].body).toMatchObject({ token: 'ExponentPushToken[e2e-device-0000000000]', lang: 'en' });
    expect(lib(app.api).pushTokens.size).toBe(1);
  });

  it('with the token registered, no local notification is made when the song is ready in the background', async () => {
    device.pushProject = 'e2e-project';
    const app = await openSheet();
    lib(app.api).config.songPolls = Infinity;
    await writeLyrics(app);
    await app.tap(app.c.create.approve);
    await app.settle();
    const id = lastSong(app).id;
    await app.open('/');
    await app.background();
    readySong(app.api, id);
    await app.advance(5 * SECOND);
    expect(device.notifications).toEqual([]);
  });

  it('signing out takes the push token back', async () => {
    device.pushProject = 'e2e-project';
    const app = await openSheet();
    await writeLyrics(app);
    await app.tap(app.c.create.approve);
    await app.settle();
    await app.open('/account');
    await app.tap(app.c.account.signOut);
    await app.settle();
    expect(app.api.requests.some((r) => r.method === 'DELETE' && r.path.includes('/library/push-tokens/'))).toBe(true);
    expect(lib(app.api).pushTokens.size).toBe(0);
  });
});

describe('Watching a song being made', () => {
  /** Approves a song for the café set, with the server making it only when told, and returns its id. */
  async function started(more: Parameters<typeof launch>[0] = {}) {
    const app = await openSheet(more);
    lib(app.api).config.songPolls = Infinity;
    await writeLyrics(app);
    await app.tap(app.c.create.approve);
    return { app, id: lastSong(app).id };
  }

  it('asks after the song every five seconds', async () => {
    const { app, id } = await started();
    const asked = () => app.api.calls(`GET /library/songs/${id}`).length;
    const before = asked();
    await app.advance(5 * SECOND);
    expect(asked()).toBeGreaterThan(before);
    const mid = asked();
    await app.advance(5 * SECOND);
    expect(asked()).toBeGreaterThan(mid);
  });

  it('tells the learner when it is ready, wherever they are, with Play', async () => {
    const { app, id } = await started();
    const { c } = app;
    await app.tap(c.common.back);
    expect(app.pathname()).not.toContain('/album/');
    readySong(app.api, id);
    await app.advance(5 * SECOND);
    expect(app.sees(c.music.songReady('Café & Mañanas'))).toBe(true);
    expect(app.sees(c.music.play)).toBe(true);
  });

  it('Play in that toast starts the song in the one player', async () => {
    const { app, id } = await started();
    await app.tap(app.c.common.back);
    readySong(app.api, id);
    await app.advance(5 * SECOND);
    await app.tap(app.c.music.play);
    await app.advance(1 * SECOND);
    expect(audio.heard.filter((h) => h.kind === 'song')).toHaveLength(1);
    expect(audio.songPlayer()?.playing).toBe(true);
    expect(app.sees(`${app.c.music.nowPlaying}: Café & Mañanas`)).toBe(true);
  });

  it('a song that failed says so and is not asked after again', async () => {
    const { app, id } = await started();
    await app.tap(app.c.common.back);
    failSong(app.api, id);
    await app.advance(5 * SECOND);
    expect(app.sees(app.c.music.songFailed('Café & Mañanas'))).toBe(true);
    const asked = app.api.calls(`GET /library/songs/${id}`).length;
    await app.advance(30 * SECOND);
    expect(app.api.calls(`GET /library/songs/${id}`).length).toBe(asked);
  });

  it('is told once, not again at the next five seconds', async () => {
    const { app, id } = await started();
    await app.tap(app.c.common.back);
    readySong(app.api, id);
    await app.advance(5 * SECOND);
    const asked = app.api.calls(`GET /library/songs/${id}`).length;
    await app.advance(20 * SECOND);
    expect(app.api.calls(`GET /library/songs/${id}`).length).toBe(asked);
  });

  it('with no connection it asks again later and tells the learner when it can', async () => {
    const { app, id } = await started();
    await app.tap(app.c.common.back);
    app.api.offline = true;
    await app.advance(15 * SECOND);
    expect(app.sees(app.c.music.songReady('Café & Mañanas'))).toBe(false);
    app.api.offline = false;
    readySong(app.api, id);
    await app.advance(10 * SECOND);
    expect(app.sees(app.c.music.songReady('Café & Mañanas'))).toBe(true);
  });

  it('a song the server no longer has is not asked after again', async () => {
    const { app, id } = await started();
    await app.tap(app.c.common.back);
    lib(app.api).songs.delete(id);
    await app.advance(6 * SECOND);
    const asked = app.api.calls(`GET /library/songs/${id}`).length;
    await app.advance(30 * SECOND);
    expect(app.api.calls(`GET /library/songs/${id}`).length).toBe(asked);
  });

  it('a song lost for twelve minutes is given up on, without a word', async () => {
    const { app, id } = await started();
    await app.tap(app.c.common.back);
    await app.skip(13 * 60 * SECOND);
    await app.advance(10 * SECOND);
    const asked = app.api.calls(`GET /library/songs/${id}`).length;
    await app.advance(30 * SECOND);
    expect(app.api.calls(`GET /library/songs/${id}`).length).toBe(asked);
    expect(app.sees(app.c.music.songFailed('Café & Mañanas'))).toBe(false);
  });

  it('in the background, with no push registered, the phone says it is ready; a tap on it opens the album', async () => {
    const { app, id } = await started();
    const albumId = lastSong(app).albumId;
    await app.open('/');
    await app.background();
    readySong(app.api, id);
    await app.advance(5 * SECOND);
    expect(device.notifications).toEqual([
      {
        title: app.c.music.songReadyTitle,
        body: app.c.music.songReady('Café & Mañanas'),
        data: { kind: 'song', songId: id, albumId, outcome: 'ready' },
      },
    ]);
    await app.foreground();
    device.tapNotification(device.notifications[0].data);
    await app.settle();
    expect(app.pathname()).toBe(`/album/${albumId}`);
  });

  it('in the background a failed song is said too, and its tap opens the album where it can be tried again', async () => {
    const { app, id } = await started();
    const albumId = lastSong(app).albumId;
    await app.open('/');
    await app.background();
    failSong(app.api, id);
    await app.advance(5 * SECOND);
    expect(device.notifications).toHaveLength(1);
    expect(device.notifications[0]).toMatchObject({ title: app.c.music.songFailedTitle, data: { kind: 'song', songId: id, outcome: 'failed' } });
    await app.foreground();
    device.tapNotification(device.notifications[0].data);
    await app.settle();
    expect(app.pathname()).toBe(`/album/${albumId}`);
    expect(app.sees(app.c.music.retrySong('Café & Mañanas'))).toBe(true);
  });

  it('with the app in the foreground no notification is made', async () => {
    const { app, id } = await started();
    await app.open('/');
    readySong(app.api, id);
    await app.advance(5 * SECOND);
    expect(device.notifications).toEqual([]);
  });

  it('with notifications refused by the phone, nothing is made in the background and the toast waits', async () => {
    device.notificationsAllowed = false;
    const { app, id } = await started();
    await app.open('/');
    await app.background();
    readySong(app.api, id);
    await app.advance(5 * SECOND);
    expect(device.notifications).toEqual([]);
    await app.foreground();
    expect(app.sees(app.c.music.songReady('Café & Mañanas'))).toBe(true);
  });

  it('signing out stops asking after the account’s songs', async () => {
    const { app, id } = await started();
    await app.tap(app.c.common.back);
    await app.open('/account');
    await app.tap(app.c.account.signOut);
    const asked = app.api.calls(`GET /library/songs/${id}`).length;
    await app.advance(30 * SECOND);
    expect(app.api.calls(`GET /library/songs/${id}`).length).toBe(asked);
  });
});
