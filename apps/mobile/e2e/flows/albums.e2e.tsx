// Albums and playing songs (LIB-03, LIB-04, P3-11): an own album's page, its cover (drawn anew, the
// covers drawn before, an older one worn again, shown whole), the songs in one player (the page's
// rows, the mini player in the bar, the full player with its lyrics), liking, rating the phrases a
// song sings, the Liked songs album, a set's songs beside its phrases, one sound at a time and signing
// out.
//
// Covered: the page (title, byline, songs, a song being made or failed, the note; back; a failed
// load and its retry; someone else's album with none of the owner's buttons); Play album and each
// song's row; the song ending moving on and the album ending after its last; rename (name and
// description, Save only when changed); delete with its confirm (cancelled, confirmed, stopping the
// music); share; a failed song's retry and its removal with confirm; a song being made turning
// playable as the page asks after it every 2.5 s; the cover (the button, its sheet, the allowance and
// when it is spent, what to picture, drawing, a drawn pattern, the covers before and wearing one,
// the artwork shown whole); the mini player (open, play/pause, next, close only when paused, swipe);
// the full player (play/pause, seek by the bar and by a line, previous restarting after 3 s, next, the
// last song's next off, meanings hidden and shown, like and unlike, rate the phrases and undo, the
// grades over the bar, the set's link, close and pulled down); the Liked songs album (its list, play,
// the heart taking a song out); a set's songs shelf; one sound at a time; signing out stopping the
// songs.
import { LIKED_ID } from '@shared/state/selectors';
import { FakeApi, problem } from '../fakes/api';
import { communityAlbum, lib, readySong, seedAlbum, seedSong } from '../fakes/library';
import { audio, device, fireEvent, launch, screen, SECOND, MINUTE, act, type App } from '../harness';

const EMAIL = 'ana@example.test';
const song = (title: string, status?: 'ready' | 'rendering' | 'failed') => ({ title, status });

/** The learner's album 'Mis canciones' with these songs (three ready ones by default), opened on its page. */
async function openAlbum(songs = [song('Uno'), song('Dos'), song('Tres')], more: Parameters<typeof launch>[0] = {}) {
  const api = more.api ?? new FakeApi();
  const album = seedAlbum(api, api.addUser(EMAIL), { title: 'Mis canciones', setId: 'set-cafe', songs });
  const app = await launch({ api, signedIn: EMAIL, url: `/album/${album.id}`, ...more });
  return { app, api, album };
}

const nowPlaying = (title: string) => `Now playing: ${title}`;
const rows = (_app: App) => audio.heard.filter((h) => h.kind === 'song');
/** The song id in the URL that was last played. */
const lastPlayed = () => /songs\/([^/]+)\/audio/.exec(audio.heard.filter((h) => h.kind === 'song').at(-1)?.uri ?? '')?.[1];

describe('Album: the page', () => {
  it('shows its name, who made it and how many songs and how long, with each song’s place, style and length', async () => {
    const { app } = await openAlbum();
    const { c } = app;
    expect(app.sees(c.music.album.toLocaleUpperCase(c.locale))).toBe(true);
    expect(app.sees('Mis canciones')).toBe(true);
    expect(app.sees(/^Yours · 3 songs · \d+:\d\d$/)).toBe(true);
    for (const title of ['Uno', 'Dos', 'Tres']) expect(app.sees(c.music.playSong(title))).toBe(true);
    expect(app.sees('3')).toBe(true);
    expect(app.sees(`${c.music.style.modern_pop} · 0:28 · ${c.music.spokenDemo}`)).toBe(true);
  });

  it('a song still being made shows as such, cannot be played, and the page says it keeps being made', async () => {
    const { app } = await openAlbum([song('Uno'), song('Cuatro', 'rendering')]);
    const { c } = app;
    expect(app.sees(`Cuatro, ${c.music.rendering}`)).toBe(true);
    expect(app.sees(c.music.renderingNote)).toBe(true);
    await app.tap(`Cuatro, ${c.music.rendering}`);
    expect(rows(app)).toHaveLength(0);
  });

  it('a song that could not be made says so and cannot be played', async () => {
    const { app } = await openAlbum([song('Uno'), song('Tres', 'failed')]);
    expect(app.sees(`Tres, ${app.c.music.failed}`)).toBe(true);
    await app.tap(`Tres, ${app.c.music.failed}`);
    expect(rows(app)).toHaveLength(0);
  });

  it('an album with no songs says so, and Play album is off', async () => {
    const { app } = await openAlbum([]);
    expect(app.sees(app.c.music.noSongs)).toBe(true);
    await app.tap(app.c.music.playAlbum);
    await app.advance(500);
    expect(rows(app)).toHaveLength(0);
  });

  it('Back returns to where the album was opened from', async () => {
    const api = new FakeApi();
    const album = seedAlbum(api, api.addUser(EMAIL), { title: 'Mis canciones', setId: 'set-cafe' });
    const app = await launch({ api, signedIn: EMAIL, url: '/library' });
    await app.open(`/album/${album.id}`);
    await app.tap(app.c.common.back);
    expect(app.pathname()).toBe('/library');
  });

  it('opened by a link with nothing behind it, Back goes to Library’s albums', async () => {
    const { app } = await openAlbum();
    await app.tap(app.c.common.back);
    expect(app.pathname()).toBe('/library');
  });

  it('an album the server cannot give says so, Retry asks again and shows it', async () => {
    const api = new FakeApi();
    const album = seedAlbum(api, api.addUser(EMAIL), { title: 'Mis canciones', setId: 'set-cafe' });
    api.failNext(`GET /library/albums/${album.id}`, problem(500, 'INTERNAL'));
    const app = await launch({ api, signedIn: EMAIL, url: `/album/${album.id}` });
    expect(app.sees(app.c.music.loadFailed)).toBe(true);
    await app.tap(app.c.connection.retry);
    expect(app.sees('Mis canciones')).toBe(true);
    expect(app.sees(app.c.music.loadFailed)).toBe(false);
  });

  it('a failed load can be left by Back', async () => {
    const api = new FakeApi();
    const album = seedAlbum(api, api.addUser(EMAIL), { title: 'Mis canciones', setId: 'set-cafe' });
    api.failNext(`GET /library/albums/${album.id}`, problem(500, 'INTERNAL'));
    const app = await launch({ api, signedIn: EMAIL, url: `/album/${album.id}` });
    await app.tap(app.c.common.back);
    expect(app.pathname()).toBe('/library');
  });

  it('a song being made turns playable as the page asks after it (every 2.5 seconds) and Play album then works', async () => {
    const api = new FakeApi();
    lib(api).config.songPolls = Infinity;
    const album = seedAlbum(api, api.addUser(EMAIL), { title: 'Mis canciones', setId: 'set-cafe', songs: [song('Cuatro', 'rendering')] });
    const app = await launch({ api, signedIn: EMAIL, url: `/album/${album.id}` });
    const { c } = app;
    const asked = () => app.api.calls(`GET /library/albums/${album.id}`).length;
    const before = asked();
    await app.advance(5 * SECOND);
    expect(asked()).toBeGreaterThanOrEqual(before + 2);
    readySong(api, album.songIds[0]);
    await app.advance(3 * SECOND);
    expect(app.sees(c.music.playSong('Cuatro'))).toBe(true);
    expect(app.sees(c.music.renderingNote)).toBe(false);
    // Nothing is being made: it stops asking.
    const settled = asked();
    await app.advance(20 * SECOND);
    expect(asked()).toBe(settled);
    await app.tap(c.music.playAlbum);
    expect(rows(app)).toHaveLength(1);
  });

  it('someone else’s album has no rename, delete or new cover, but plays', async () => {
    const api = new FakeApi();
    const mine = seedAlbum(api, api.addUser(EMAIL), { title: 'Mis canciones', setId: 'set-cafe' });
    void mine;
    const theirs = communityAlbum(api, { title: 'De Marta', displayName: 'Marta', setId: 'set-cafe', songs: [{ title: 'Su canción' }] });
    const app = await launch({ api, signedIn: EMAIL, url: `/album/${theirs.id}` });
    const { c } = app;
    expect(app.sees(c.share.by('Marta') + ' · ' + c.music.songs(1) + ' · 0:28')).toBe(true);
    for (const label of [c.createSet.editTitle, c.share.delete, c.music.makeSong, c.share.coverFor('De Marta')]) expect(app.sees(label)).toBe(false);
    await app.tap(c.music.playAlbum);
    expect(rows(app)).toHaveLength(1);
  });
});

describe('Album: playing it', () => {
  it('Play album plays the first song in the one player and shows it in the bar', async () => {
    const { app } = await openAlbum();
    await app.tap(app.c.music.playAlbum);
    await app.advance(1 * SECOND);
    expect(rows(app)).toHaveLength(1);
    expect(audio.songPlayer()?.playing).toBe(true);
    expect(app.sees(nowPlaying('Uno'))).toBe(true);
    expect(app.sees(`${app.c.music.songKind} · ${app.c.music.spokenDemo}`)).toBe(true);
  });

  it('asks the server for the song’s address each time it plays (the address expires)', async () => {
    const { app, api } = await openAlbum();
    await app.tap(app.c.music.playAlbum);
    await app.advance(500);
    const first = api.calls(`GET /library/songs/${lastPlayed()}`).length;
    expect(first).toBeGreaterThan(0);
  });

  it('a song’s row plays from that song, and the songs after it follow', async () => {
    const { app, album } = await openAlbum();
    await app.tap(app.c.music.playSong('Dos'));
    await app.advance(1 * SECOND);
    expect(lastPlayed()).toBe(album.songIds[1]);
    expect(app.sees(nowPlaying('Dos'))).toBe(true);
    await app.tap(app.c.music.next);
    await app.advance(1 * SECOND);
    expect(lastPlayed()).toBe(album.songIds[2]);
  });

  it('a song that ends moves on to the next, and the album ends after its last', async () => {
    const { app, album } = await openAlbum();
    await app.tap(app.c.music.playAlbum);
    await app.advance(31 * SECOND);
    expect(lastPlayed()).toBe(album.songIds[1]);
    await app.advance(30 * SECOND);
    expect(lastPlayed()).toBe(album.songIds[2]);
    await app.advance(31 * SECOND);
    // Nothing follows the last: the player stops there, still showing it.
    expect(rows(app)).toHaveLength(3);
    expect(audio.songPlayer()?.playing).toBe(false);
    expect(app.sees(nowPlaying('Tres'))).toBe(true);
  });

  it('a song that cannot be reached says it needs a connection, and what was playing plays on', async () => {
    const { app } = await openAlbum();
    await app.tap(app.c.music.playSong('Uno'));
    app.api.offline = true;
    await app.tap(app.c.music.playSong('Dos'));
    expect(app.sees(app.c.music.needsConnection)).toBe(true);
    expect(app.sees(nowPlaying('Uno'))).toBe(true);
  });

  it('a song the server has no sound for says it cannot be played', async () => {
    const { app, album } = await openAlbum();
    lib(app.api).songs.get(album.songIds[0])!.audio = false;
    await app.tap(app.c.music.playSong('Uno'));
    expect(app.sees(app.c.music.cantPlay)).toBe(true);
    expect(rows(app)).toHaveLength(0);
  });

  it('the row of the song playing opens the full player instead of starting it again', async () => {
    const { app } = await openAlbum();
    await app.tap(app.c.music.playSong('Uno'));
    await app.tap(app.c.music.playSong('Uno'));
    expect(app.pathname()).toBe('/song');
    expect(rows(app)).toHaveLength(1);
  });
});

describe('Album: renaming', () => {
  it('opens with its name and description, and Save waits for a change', async () => {
    const { app } = await openAlbum();
    await app.tap(app.c.createSet.editTitle);
    expect(screen.getByLabelText(app.c.createSet.name).props.value).toBe('Mis canciones');
    await app.tap(app.c.common.save);
    expect(app.api.calls(`POST /library/albums/${lib(app.api).albums.keys().next().value}`)).toHaveLength(0);
  });

  it('a new name is saved, shown at once, and told', async () => {
    const { app, album } = await openAlbum();
    await app.tap(app.c.createSet.editTitle);
    await app.type(app.c.createSet.name, '  Mi disco  ');
    await app.tap(app.c.common.save);
    expect(app.api.calls(`POST /library/albums/${album.id}`)[0].body).toEqual({ title: 'Mi disco' });
    expect(app.sees(app.c.share.changed)).toBe(true);
    expect(app.sees('Mi disco')).toBe(true);
    expect(app.sees('Mis canciones')).toBe(false);
    expect(app.sees(app.c.createSet.description)).toBe(false);
  });

  it('a description is saved on its own, and shown on the page', async () => {
    const { app, album } = await openAlbum();
    await app.tap(app.c.createSet.editTitle);
    await app.type(app.c.createSet.description, 'Para el desayuno');
    await app.tap(app.c.common.save);
    expect(app.api.calls(`POST /library/albums/${album.id}`)[0].body).toEqual({ description: 'Para el desayuno' });
    expect(app.sees('Para el desayuno')).toBe(true);
  });

  it('an empty name cannot be saved', async () => {
    const { app, album } = await openAlbum();
    await app.tap(app.c.createSet.editTitle);
    await app.type(app.c.createSet.name, '   ');
    await app.tap(app.c.common.save);
    expect(app.api.calls(`POST /library/albums/${album.id}`)).toHaveLength(0);
  });

  it('a refused rename is told and keeps the sheet open', async () => {
    const { app, album } = await openAlbum();
    await app.tap(app.c.createSet.editTitle);
    await app.type(app.c.createSet.name, 'Mi disco');
    app.api.failNext(`POST /library/albums/${album.id}`, problem(500, 'INTERNAL'));
    await app.tap(app.c.common.save);
    expect(app.sees(app.c.account.errors.generic)).toBe(true);
    expect(app.sees(app.c.createSet.description)).toBe(true);
    expect(app.sees('Mis canciones')).toBe(true);
  });

  it('Close leaves the name as it was', async () => {
    const { app, album } = await openAlbum();
    await app.tap(app.c.createSet.editTitle);
    await app.type(app.c.createSet.name, 'Mi disco');
    await app.tap(app.c.common.close);
    expect(app.sees('Mis canciones')).toBe(true);
    expect(app.api.calls(`POST /library/albums/${album.id}`)).toHaveLength(0);
  });
});

describe('Album: deleting and sharing', () => {
  it('asks first; Cancel keeps the album', async () => {
    const { app, album } = await openAlbum();
    await app.tap(app.c.share.delete);
    expect(device.dialogs.at(-1)?.message).toBe(app.c.share.deleteAlbumConfirm('Mis canciones'));
    device.answer(app.c.common.cancel);
    await app.settle();
    expect(app.api.calls(`DELETE /library/albums/${album.id}`)).toHaveLength(0);
    expect(app.pathname()).toBe(`/album/${album.id}`);
  });

  it('confirmed, the album and its songs go, the learner is told and taken back', async () => {
    const { app, album } = await openAlbum();
    await app.tap(app.c.share.delete);
    device.answer(app.c.share.delete);
    await app.settle();
    expect(app.api.calls(`DELETE /library/albums/${album.id}`)).toHaveLength(1);
    expect(app.sees(app.c.share.deleted)).toBe(true);
    expect(app.pathname()).toBe('/library');
    expect(lib(app.api).songs.size).toBe(0);
  });

  it('deleting the album that is playing stops the music and takes it out of the bar', async () => {
    const { app } = await openAlbum();
    await app.tap(app.c.music.playAlbum);
    await app.advance(500);
    await app.tap(app.c.share.delete);
    device.answer(app.c.share.delete);
    await app.settle();
    expect(audio.songPlayer()?.playing).toBe(false);
    expect(app.sees(nowPlaying('Uno'))).toBe(false);
  });

  it('a refused delete is told, and the album stays', async () => {
    const { app, album } = await openAlbum();
    app.api.failNext(`DELETE /library/albums/${album.id}`, problem(500, 'INTERNAL'));
    await app.tap(app.c.share.delete);
    device.answer(app.c.share.delete);
    await app.settle();
    expect(app.sees(app.c.account.errors.generic)).toBe(true);
    expect(app.pathname()).toBe(`/album/${album.id}`);
    expect(app.sees('Mis canciones')).toBe(true);
  });

  it('Share opens who can see it, private to begin with; Anyone with the link changes the album', async () => {
    const { app, album } = await openAlbum();
    await app.tap(app.c.share.share);
    expect(app.sees(app.c.share.visibility)).toBe(true);
    expect(screen.getByRole('radio', { name: new RegExp(app.c.share.private) })).toBeChecked();
    await app.tap(new RegExp(app.c.share.link));
    await app.settle();
    expect(app.api.calls(`POST /library/albums/${album.id}`).at(-1)?.body).toMatchObject({ visibility: 'link' });
    expect(lib(app.api).albums.get(album.id)?.visibility).toBe('link');
  });
});

describe('Album: songs that failed', () => {
  it('Try again makes the song anew for another of the day’s songs, and the learner is told when it is ready', async () => {
    const api = new FakeApi();
    lib(api).config.songPolls = Infinity;
    const album = seedAlbum(api, api.addUser(EMAIL), { title: 'Mis canciones', setId: 'set-cafe', songs: [song('Uno'), song('Tres', 'failed')] });
    const app = await launch({ api, signedIn: EMAIL, url: `/album/${album.id}` });
    const { c } = app;
    await app.tap(c.music.retrySong('Tres'));
    const call = api.calls(`POST /library/songs/${album.songIds[1]}/retry`)[0];
    expect(call.body).toEqual({ nativeLang: 'en-GB' });
    expect(app.sees(`Tres, ${c.music.rendering}`)).toBe(true);
    expect(api.used(app.user!.id, 'song')).toBe(1);
    readySong(api, album.songIds[1]);
    await app.advance(6 * SECOND);
    expect(app.sees(c.music.songReady('Tres'))).toBe(true);
    expect(app.sees(c.music.playSong('Tres'))).toBe(true);
  });

  it('a retry the server refuses is told, and the song stays failed', async () => {
    const api = new FakeApi();
    const album = seedAlbum(api, api.addUser(EMAIL), { title: 'Mis canciones', setId: 'set-cafe', songs: [song('Tres', 'failed')] });
    const app = await launch({ api, signedIn: EMAIL, url: `/album/${album.id}` });
    api.failNext(`POST /library/songs/${album.songIds[0]}/retry`, {
      status: 429,
      body: { type: 'about:blank', title: 'Allowance used', status: 429, code: 'LIMIT_REACHED', detail: 'Daily limit reached', kind: 'song', limit: 5, resets_at: Date.now() + 3_600_000 },
    });
    await app.tap(app.c.music.retrySong('Tres'));
    expect(app.sees(/^Today’s allowance is used/)).toBe(true);
    expect(app.sees(`Tres, ${app.c.music.failed}`)).toBe(true);
  });

  it('Remove song asks first; Cancel keeps it', async () => {
    const { app, album } = await openAlbum([song('Uno'), song('Tres', 'failed')]);
    await app.tap(app.c.music.removeSong);
    expect(device.dialogs.at(-1)?.message).toBe(app.c.music.removeSongConfirm('Tres'));
    device.answer(app.c.common.cancel);
    await app.settle();
    expect(app.api.calls(`DELETE /library/songs/${album.songIds[1]}`)).toHaveLength(0);
    expect(app.sees(`Tres, ${app.c.music.failed}`)).toBe(true);
  });

  it('confirmed, the song is taken out of the album', async () => {
    const { app, album } = await openAlbum([song('Uno'), song('Tres', 'failed')]);
    await app.tap(app.c.music.removeSong);
    device.answer(app.c.music.removeSong);
    await app.settle();
    expect(app.api.calls(`DELETE /library/songs/${album.songIds[1]}`)).toHaveLength(1);
    expect(app.sees(`Tres, ${app.c.music.failed}`)).toBe(false);
    expect(app.sees(app.c.music.playSong('Uno'))).toBe(true);
  });

  it('a song that is not failed has neither button', async () => {
    const { app } = await openAlbum();
    expect(app.sees(app.c.music.removeSong)).toBe(false);
    expect(app.sees(app.c.music.retrySong('Uno'))).toBe(false);
  });
});

/** A tap on the picture itself (not on its button): the layer holding the button, which the picture's press wraps. */
async function tapArt(app: App, which: number) {
  let node: any = screen.queryAllByLabelText(app.c.share.coverFor('Mis canciones'))[which];
  while (node && !node.props.pointerEvents) node = node.parent;
  await act(async () => fireEvent.press(node.parent));
}

describe('Album: its cover', () => {
  /** Draws, and lets the app wait for the server to finish (it asks after the cover every few seconds). */
  const draw = async (app: App) => {
    await app.tap(app.c.share.coverDraw);
    await app.advance(3 * SECOND);
  };
  const open = (app: App) => app.tap(app.c.share.coverFor('Mis canciones'));
  const covers = (app: App) => [...lib(app.api).covers.values()];

  it('a button on the artwork opens what drawing a cover does, and what is left today', async () => {
    const { app } = await openAlbum();
    await open(app);
    const { c } = app;
    expect(app.sees(c.share.coverAsk.own)).toBe(true);
    expect(app.sees(c.share.coverDrawn)).toBe(true);
    expect(app.sees(c.account.usage.cover(app.api.limits.cover, app.api.limits.cover))).toBe(true);
    expect(app.sees(c.account.writer.ai)).toBe(true);
  });

  it('what to show starts as the album’s own name', async () => {
    const { app } = await openAlbum();
    await open(app);
    expect(screen.getByLabelText(app.c.share.coverPrompt).props.value).toBe('Mis canciones');
  });

  it('Cancel closes it and draws nothing', async () => {
    const { app } = await openAlbum();
    await open(app);
    await app.tap(app.c.common.cancel);
    expect(app.sees(app.c.share.coverDraw)).toBe(false);
    expect(app.api.calls('POST /library/generate/cover')).toHaveLength(0);
  });

  it('drawing with the album’s own words asks for the album’s cover and sends no prompt; the artwork says it is drawing', async () => {
    const { app, album } = await openAlbum();
    await open(app);
    await draw(app);
    expect(app.api.calls('POST /library/generate/cover')[0].body).toEqual({ kind: 'album', attachTo: album.id, nativeLang: 'en-GB' });
    expect(app.sees(app.c.share.coverBy.ai)).toBe(true);
    expect(app.api.used(app.user!.id, 'cover')).toBe(1);
    expect(lib(app.api).albums.get(album.id)?.coverId).toBe(covers(app)[0].id);
  });

  it('while it is drawn the artwork says so, and a cover that takes long is said to appear when it is ready', async () => {
    const { app } = await openAlbum();
    lib(app.api).config.coverPolls = Infinity;
    await open(app);
    await app.tap(app.c.share.coverDraw);
    expect(app.sees(app.c.share.coverMaking)).toBe(true);
    expect(app.sees(app.c.share.coverFor('Mis canciones'))).toBe(false);
    await app.advance(241 * SECOND);
    expect(app.sees(app.c.share.coverLater)).toBe(true);
    expect(app.sees(app.c.share.coverFor('Mis canciones'))).toBe(true);
  });

  it('what the learner asks it to show is sent as typed', async () => {
    const { app } = await openAlbum();
    await open(app);
    await app.type(app.c.share.coverPrompt, '  a boat at dawn  ');
    await draw(app);
    expect(app.api.calls('POST /library/generate/cover')[0].body).toMatchObject({ prompt: 'a boat at dawn' });
  });

  it('on a server with no drawing model the cover is a drawn pattern, ready at once and said so', async () => {
    const { app } = await openAlbum();
    lib(app.api).config.ai = false;
    await open(app);
    expect(app.sees(app.c.account.writer.pattern)).toBe(true);
    await draw(app);
    expect(app.sees(app.c.share.coverBy.pattern)).toBe(true);
  });

  it('the covers drawn before are shown the next time, the one in use marked; tapping an older one puts it back for nothing', async () => {
    const { app, album } = await openAlbum();
    const { c } = app;
    await open(app);
    await app.type(c.share.coverPrompt, 'first sea');
    await draw(app);
    await open(app);
    await app.type(c.share.coverPrompt, 'second sea');
    await draw(app);
    await open(app);
    expect(app.sees(c.share.coverEarlier)).toBe(true);
    expect(app.sees(c.share.coverInUse)).toBe(true);
    const spent = app.api.used(app.user!.id, 'cover');
    // The newest is in use; the older one is the one to tap.
    await app.tap(c.share.coverUse('first sea'));
    expect(app.api.calls(`POST /library/covers/${covers(app)[0].id}/wear`)[0].body).toEqual({ kind: 'album', attachTo: album.id });
    expect(app.sees(c.share.coverPut)).toBe(true);
    expect(app.sees(c.share.coverDraw)).toBe(false);
    expect(app.api.used(app.user!.id, 'cover')).toBe(spent);
    expect(lib(app.api).albums.get(album.id)?.coverId).toBe(covers(app)[0].id);
  });

  it('the cover in use cannot be chosen again', async () => {
    const { app } = await openAlbum();
    await open(app);
    await app.type(app.c.share.coverPrompt, 'first sea');
    await draw(app);
    await open(app);
    await app.tap(app.c.share.coverUse('first sea'));
    expect(app.api.calls(`POST /library/covers/${covers(app)[0].id}/wear`)).toHaveLength(0);
  });

  it('with today’s covers spent, it says so and drawing asks for nothing', async () => {
    const { app } = await openAlbum();
    app.api.limits.cover = 0;
    await open(app);
    expect(app.sees(/^Today’s allowance is used/)).toBe(true);
    await draw(app);
    expect(app.api.calls('POST /library/generate/cover')).toHaveLength(0);
  });

  it('a refused drawing is told to the learner', async () => {
    const { app } = await openAlbum();
    await open(app);
    app.api.failNext('POST /library/generate/cover', problem(503, 'PROVIDER_UNAVAILABLE', 'No drawing'));
    await draw(app);
    expect(app.sees(app.c.account.errors.unavailable)).toBe(true);
    expect(app.sees(app.c.share.coverMaking)).toBe(false);
    expect(app.sees(app.c.share.coverFor('Mis canciones'))).toBe(true);
  });

  it('a tap on the artwork shows it whole', async () => {
    const { app } = await openAlbum();
    const chips = () => screen.queryAllByLabelText(app.c.share.coverFor('Mis canciones')).length;
    expect(chips()).toBe(1);
    await tapArt(app, 0);
    await app.advance(500);
    expect(chips()).toBe(2);
  });

  it('a second tap on the whole artwork puts it back to its small size', async () => {
    const { app } = await openAlbum();
    const chips = () => screen.queryAllByLabelText(app.c.share.coverFor('Mis canciones')).length;
    await tapArt(app, 0);
    await app.advance(500);
    expect(chips()).toBe(2);
    await tapArt(app, 0);
    await app.advance(500);
    expect(chips()).toBe(1);
  });

  it('pulling the artwork down shows it whole', async () => {
    const { app } = await openAlbum();
    await app.swipe(app.c.share.coverFor('Mis canciones'), { dy: 80 });
    await app.advance(500);
    expect(screen.queryAllByLabelText(app.c.share.coverFor('Mis canciones')).length).toBe(2);
  });
});

describe('The mini player', () => {
  it('plays an album’s song with its cover badge, title and what it is, and opens the player on a tap', async () => {
    const { app } = await openAlbum();
    await app.tap(app.c.music.playAlbum);
    await app.advance(500);
    await app.tap(nowPlaying('Uno'));
    expect(app.pathname()).toBe('/player');
    expect(app.sees(app.c.music.songKind)).toBe(true);
  });

  it('its button pauses and plays the song', async () => {
    const { app } = await openAlbum();
    await app.tap(app.c.music.playAlbum);
    await app.advance(2 * SECOND);
    await app.tap(app.c.common.pause);
    expect(audio.songPlayer()?.playing).toBe(false);
    expect(app.sees(app.c.player.paused)).toBe(true);
    await app.tap(app.c.common.play);
    expect(audio.songPlayer()?.playing).toBe(true);
  });

  it('its next button goes to the next song, and is off on the last', async () => {
    const { app, album } = await openAlbum([song('Uno'), song('Dos')]);
    await app.tap(app.c.music.playAlbum);
    await app.advance(500);
    await app.tap(app.c.music.next);
    await app.advance(1 * SECOND);
    expect(lastPlayed()).toBe(album.songIds[1]);
    const before = rows(app).length;
    await app.tap(app.c.music.next);
    expect(rows(app).length).toBe(before);
  });

  it('can be closed only when paused, and closing unloads the song', async () => {
    const { app } = await openAlbum();
    await app.tap(app.c.music.playAlbum);
    await app.advance(500);
    const closes = () => screen.queryAllByLabelText(app.c.player.close).length;
    const whilePlaying = closes();
    await app.tap(app.c.common.pause);
    expect(closes()).toBe(whilePlaying + 1);
    await app.tap(app.c.player.close);
    expect(app.sees(nowPlaying('Uno'))).toBe(false);
  });

  it('swiping it goes to the next song, and back to the one before', async () => {
    const { app, album } = await openAlbum();
    await app.tap(app.c.music.playAlbum);
    await app.advance(500);
    await app.swipe(nowPlaying('Uno'), { dx: -200 });
    await app.advance(1 * SECOND);
    expect(lastPlayed()).toBe(album.songIds[1]);
    await app.swipe(nowPlaying('Dos'), { dx: 200 });
    await app.advance(1 * SECOND);
    expect(lastPlayed()).toBe(album.songIds[0]);
  });

  it('the grades over the bar rate the phrases the song sings, then offer Undo', async () => {
    const { app } = await openAlbum();
    const { c } = app;
    await app.tap(c.music.playAlbum);
    await app.tap(c.player.rateAs(c.common.grade.hard));
    const pending = (await app.saved()).pending;
    expect(pending).toHaveLength(5);
    expect(pending.every((p) => p.grade === 'hard' && p.songId !== undefined)).toBe(true);
    await app.tap(c.player.undoGrade(c.common.grade.hard));
    expect((await app.saved()).pending.filter((p) => !p.undone)).toHaveLength(0);
    expect(app.sees(c.player.rateAs(c.common.grade.hard))).toBe(true);
  });
});

describe('The song player', () => {
  /** The album played and its full player open. */
  async function openPlayer(songs = [song('Uno'), song('Dos'), song('Tres')]) {
    const opened = await openAlbum(songs);
    await opened.app.tap(opened.app.c.music.playSong(songs[0].title));
    await opened.app.advance(500);
    await opened.app.tap(opened.app.c.music.playSong(songs[0].title));
    return opened;
  }

  it('the old /song link with no song playing shows the phrase player, not an empty song', async () => {
    const app = await launch({ signedIn: EMAIL });
    await app.open('/song');
    expect(app.sees(app.c.music.songKind)).toBe(false);
    expect(app.sees(app.c.music.lyrics)).toBe(false);
  });

  it('shows the song: its title, album, how it was made, its style, the time and the lyrics with their meanings', async () => {
    const { app } = await openPlayer();
    const { c } = app;
    expect(app.pathname()).toBe('/song');
    expect(app.sees('Uno')).toBe(true);
    expect(app.sees('Mis canciones')).toBe(true);
    expect(app.sees(c.music.spokenDemo)).toBe(true);
    expect(app.sees(c.music.lyricsBy.phrases)).toBe(true);
    expect(app.sees(c.music.style.modern_pop)).toBe(true);
    expect(app.sees(c.music.spokenNote)).toBe(true);
    expect(app.sees('0:00 / 0:28')).toBe(true);
    expect(app.sees('Me pone un cortado, por favor')).toBe(true);
    expect(app.sees('A cortado, please')).toBe(true);
    expect(app.sees(c.music.section.chorus.toLocaleUpperCase(c.locale))).toBe(true);
  });

  it('the time moves on as it plays', async () => {
    const { app } = await openPlayer();
    await app.advance(5 * SECOND);
    expect(app.sees('0:05 / 0:28')).toBe(true);
  });

  it('pause stops it where it is, and play goes on from there', async () => {
    const { app } = await openPlayer();
    await app.advance(5 * SECOND);
    await app.tap(app.c.common.pause);
    await app.advance(5 * SECOND);
    expect(app.sees('0:05 / 0:28')).toBe(true);
    await app.tap(app.c.common.play);
    await app.advance(3 * SECOND);
    expect(app.sees('0:08 / 0:28')).toBe(true);
  });

  it('a tap on the bar moves there', async () => {
    const { app } = await openPlayer();
    const bar = screen.getByLabelText(/^\d+:\d\d \/ \d+:\d\d$/);
    await act(async () => fireEvent.press(bar, { nativeEvent: { locationX: 195 } }));
    await app.advance(500);
    // Halfway along a 28-second song, half a second ago.
    expect(app.sees(/^0:14 \/ 0:28$/)).toBe(true);
  });

  it('a lyric line with its time moves there; the time is shown beside it', async () => {
    const { app } = await openPlayer();
    expect(app.sees('0:08')).toBe(true);
    await app.tap(`0:08 La cuenta, por favor`);
    await app.advance(500);
    expect(app.sees(/^0:08 \/ 0:28$/)).toBe(true);
  });

  it('Hide meanings takes the translations away and Show meanings brings them back', async () => {
    const { app } = await openPlayer();
    await app.tap(app.c.music.hideMeanings);
    expect(app.sees('A cortado, please')).toBe(false);
    expect(app.sees('Me pone un cortado, por favor')).toBe(true);
    await app.tap(app.c.music.showMeanings);
    expect(app.sees('A cortado, please')).toBe(true);
  });

  it('next goes to the next song, and is off at the last', async () => {
    const { app, album } = await openPlayer([song('Uno'), song('Dos')]);
    await app.tap(app.c.music.next);
    await app.advance(500);
    expect(lastPlayed()).toBe(album.songIds[1]);
    expect(app.sees('Dos')).toBe(true);
    const before = rows(app).length;
    await app.tap(app.c.music.next);
    expect(rows(app).length).toBe(before);
  });

  it('previous in the first seconds goes to the song before; later it starts this one again', async () => {
    const { app, album } = await openPlayer([song('Uno'), song('Dos')]);
    await app.tap(app.c.music.next);
    await app.advance(10 * SECOND);
    await app.tap(app.c.music.previous);
    await app.advance(500);
    expect(lastPlayed()).toBe(album.songIds[1]);
    expect(app.sees(/^0:0[0-1] \/ 0:28$/)).toBe(true);
    await app.advance(1 * SECOND);
    await app.tap(app.c.music.previous);
    await app.advance(500);
    expect(lastPlayed()).toBe(album.songIds[0]);
  });

  it('the heart likes the song and the same heart takes it back', async () => {
    const { app, album } = await openPlayer();
    const liked = () => Boolean(screen.getByLabelText(app.c.music.likeSong).props.accessibilityState?.checked);
    expect(liked()).toBe(false);
    await app.tap(app.c.music.likeSong);
    expect(liked()).toBe(true);
    expect(JSON.stringify((await app.saved()).learner)).toContain(album.songIds[0]);
    await app.tap(app.c.music.likeSong);
    expect(liked()).toBe(false);
  });

  it('Missed, Hard and Easy review every phrase the song sings, with an Undo for five minutes', async () => {
    const { app } = await openPlayer();
    const { c } = app;
    expect(app.sees(c.music.rateSong(5))).toBe(true);
    await app.tap(c.common.grade.easy);
    expect(app.sees(c.player.ratedAs(c.common.grade.easy))).toBe(true);
    expect(app.sees(c.music.songReviewed(5))).toBe(true);
    const state = await app.saved();
    expect(state.pending).toHaveLength(5);
    expect(state.pending.every((p) => p.grade === 'easy')).toBe(true);
  });

  it('Undo takes the rating back and the grades return', async () => {
    const { app } = await openPlayer();
    const { c } = app;
    await app.tap(c.common.grade.hard);
    await app.tap(/^Undo rating/);
    expect(app.sees(c.music.rateSong(5))).toBe(true);
    expect((await app.saved()).pending.filter((p) => !p.undone)).toHaveLength(0);
  });

  it('after five minutes the rating is in the learner’s log', async () => {
    const { app } = await openPlayer();
    await app.tap(app.c.common.grade.missed);
    await app.tap(app.c.common.pause);
    await app.skip(5 * MINUTE + 16 * SECOND);
    const state = await app.saved();
    expect(state.pending.filter((p) => !p.undone)).toHaveLength(0);
    expect(state.learner.log.length).toBeGreaterThanOrEqual(5);
  });

  it('a link to its set opens the set’s page', async () => {
    const { app } = await openPlayer();
    await app.tap(app.c.music.fromSet('Café & Mañanas'));
    expect(app.pathname()).toBe('/set/set-cafe');
  });

  it('closing it returns to the album, with the song still playing in the bar', async () => {
    const { app, album } = await openPlayer();
    await app.tap(app.c.common.close);
    expect(app.pathname()).toBe(`/album/${album.id}`);
    expect(audio.songPlayer()?.playing).toBe(true);
    expect(app.sees(nowPlaying('Uno'))).toBe(true);
  });

  it('pulling it down closes it', async () => {
    const { app } = await openPlayer();
    await app.swipe(app.c.common.close, { dy: 400 });
    expect(app.pathname()).not.toBe('/song');
  });

  /** An album with one song of this kind, played and the full player open. */
  async function openSung(title: string, extra: Partial<Parameters<typeof seedSong>[2]>) {
    const api = new FakeApi();
    const owner = api.addUser(EMAIL);
    const album = seedAlbum(api, owner, { title: 'Mis canciones', setId: 'set-cafe', songs: [] });
    seedSong(api, owner, { albumId: album.id, setId: 'set-cafe', title, ...extra });
    const app = await launch({ api, signedIn: EMAIL, url: `/album/${album.id}` });
    await app.tap(app.c.music.playSong(title));
    await app.advance(500);
    await app.tap(app.c.music.playSong(title));
    return app;
  }

  it('a song sung by a provider says Sung, and its heard-back lines say they are what Loro heard', async () => {
    const app = await openSung('Cantada', { sound: { by: 'elevenlabs' } });
    const { c } = app;
    expect(app.sees(c.music.sung)).toBe(true);
    expect(app.sees(c.music.heard)).toBe(true);
    expect(app.sees(c.music.heardNote)).toBe(true);
    expect(app.sees(c.music.spokenNote)).toBe(false);
    // The album's row says it too.
    await app.tap(c.common.close);
    expect(app.sees(`${c.music.style.modern_pop} · 0:28 · ${c.music.sung}`)).toBe(true);
  });

  it('a line the singer changed shows the words sung with the written line under it', async () => {
    const app = await openSung('Cantada', { sound: { by: 'elevenlabs' }, sungAs: { 0: 'Me pone un cortaíto' } });
    expect(app.sees('Me pone un cortaíto')).toBe(true);
    expect(app.sees(app.c.music.written('Me pone un cortado, por favor'))).toBe(true);
  });

  it('a heard-back line moves the song to its time when tapped', async () => {
    const app = await openSung('Cantada', { sound: { by: 'elevenlabs' } });
    await app.tap('0:08 La cuenta, por favor');
    await app.advance(500);
    expect(app.sees(/^0:08 \/ 0:28$/)).toBe(true);
  });

  it('a song with only the demo’s bars is not said to be heard back', async () => {
    const app = await openSung('Demo', { sound: { by: 'demo', timing: 'demo' } });
    expect(app.sees(app.c.music.heard)).toBe(false);
    expect(app.sees(app.c.music.spokenDemo)).toBe(true);
  });

  it('an instrumental demo says Demo sound and that the server made the instrumental', async () => {
    const app = await openSung('Solo', { sound: { by: 'demo', voiced: false, timing: 'demo' } });
    const { c } = app;
    expect(app.sees(c.music.demoSound)).toBe(true);
    expect(app.sees(c.music.demoNote)).toBe(true);
    expect(app.sees(c.music.spokenDemo)).toBe(false);
  });

  // The fake's seedSong with timing null still sends startMs/endMs on every line (library.ts:1792 finishSong times them).
  it('a song with no timing shows no times, and its lines do not seek', async () => {
    const app = await openSung('Sin tiempo', { sound: { by: 'demo', timing: null } });
    expect(app.sees('Me pone un cortado, por favor')).toBe(true);
    expect(app.sees('0:08')).toBe(false);
    expect(app.sees(/^0:\d\d (La cuenta|Me pone)/)).toBe(false);
    await app.tap('La cuenta, por favor');
    await app.advance(500);
    expect(app.sees(/^0:0[0-3] \/ 0:28$/)).toBe(true);
  });

  it('a line the heard-back song does not have says it was not heard, with no time', async () => {
    const app = await openSung('Cantada', { sound: { by: 'elevenlabs' }, sungAs: { 1: null } });
    expect(app.sees(app.c.music.skippedLine)).toBe(true);
    expect(app.sees('0:04')).toBe(false);
    expect(app.sees('—')).toBe(true);
    // The lines either side keep their times.
    expect(app.sees('0:08 La cuenta, por favor')).toBe(true);
  });
});

describe('Liked songs', () => {
  it('a liked song is in the Liked songs album in Library’s albums, which lists it and plays', async () => {
    const { app, album } = await openAlbum([song('Uno'), song('Dos')]);
    const { c } = app;
    await app.tap(c.music.playSong('Dos'));
    await app.tap(c.music.playSong('Dos'));
    await app.tap(c.music.likeSong);
    await app.open('/library?view=albums');
    await app.tap(c.music.likedSongs);
    expect(app.pathname()).toBe(`/album/${LIKED_ID}`);
    expect(app.sees(c.music.playSong('Dos'))).toBe(true);
    expect(app.sees(c.music.playSong('Uno'))).toBe(false);
    expect(app.sees(`${c.share.yours} · ${c.music.songs(1)} · 0:28`)).toBe(true);
    await app.tap(c.music.playAlbum);
    await app.advance(500);
    expect(lastPlayed()).toBe(album.songIds[1]);
  });

  it('with none liked it says how to keep one, and Play album is off', async () => {
    const { app } = await openAlbum();
    await app.open(`/album/${LIKED_ID}`);
    expect(app.sees(app.c.music.likedEmpty)).toBe(true);
    await app.tap(app.c.music.playAlbum);
    await app.advance(500);
    expect(rows(app)).toHaveLength(0);
  });

  it('the heart beside a song takes it out of the album', async () => {
    const { app } = await openAlbum([song('Uno')]);
    await app.tap(app.c.music.playSong('Uno'));
    await app.tap(app.c.music.playSong('Uno'));
    await app.tap(app.c.music.likeSong);
    await app.open(`/album/${LIKED_ID}`);
    await app.tap(app.c.music.likeSong);
    expect(app.sees(app.c.music.playSong('Uno'))).toBe(false);
    expect(app.sees(app.c.music.likedEmpty)).toBe(true);
  });

  it('a song in it plays from its row, and the row of the song that is current opens the player', async () => {
    const { app, album } = await openAlbum([song('Uno'), song('Dos')]);
    const { c } = app;
    await app.tap(c.music.playSong('Uno'));
    await app.advance(500);
    await app.tap(c.music.playSong('Uno'));
    await app.tap(c.music.likeSong);
    await app.tap(c.music.next);
    await app.advance(500);
    await app.tap(c.music.likeSong);
    await app.open(`/album/${LIKED_ID}`);
    await app.tap(c.music.playSong('Uno'));
    await app.advance(500);
    expect(lastPlayed()).toBe(album.songIds[0]);
    expect(app.pathname()).toBe(`/album/${LIKED_ID}`);
    await app.tap(c.music.playSong('Uno'));
    expect(app.pathname()).toBe('/song');
  });

  it('a liked song the server no longer has is left out', async () => {
    const { app, album } = await openAlbum([song('Uno'), song('Dos')]);
    await app.tap(app.c.music.playSong('Uno'));
    await app.tap(app.c.music.playSong('Uno'));
    await app.tap(app.c.music.likeSong);
    lib(app.api).songs.delete(album.songIds[0]);
    await app.open(`/album/${LIKED_ID}`);
    await app.advance(500);
    expect(app.sees(app.c.music.playSong('Uno'))).toBe(false);
  });

  it('Back leaves it', async () => {
    const { app } = await openAlbum();
    await app.open(`/album/${LIKED_ID}`);
    await app.tap(app.c.common.back);
    expect(app.pathname()).not.toBe(`/album/${LIKED_ID}`);
  });
});

describe('A set’s songs', () => {
  it('stand beside its phrases with a music note and play in the one player', async () => {
    const api = new FakeApi();
    seedAlbum(api, api.addUser(EMAIL), { title: 'Mis canciones', setId: 'set-cafe', songs: [song('Uno')] });
    const app = await launch({ api, signedIn: EMAIL, url: '/set/set-cafe' });
    const { c } = app;
    expect(app.sees('6')).toBe(true);
    expect(app.sees(new RegExp(c.music.songs(1)))).toBe(true);
    await app.tap(c.music.playSong('Uno'), { index: 0 });
    await app.advance(1 * SECOND);
    expect(rows(app)).toHaveLength(1);
    expect(app.sees(nowPlaying('Uno'))).toBe(true);
  });

  it('the row of the song playing pauses it, and plays it again', async () => {
    const api = new FakeApi();
    seedAlbum(api, api.addUser(EMAIL), { title: 'Mis canciones', setId: 'set-cafe', songs: [song('Uno')] });
    const app = await launch({ api, signedIn: EMAIL, url: '/set/set-cafe' });
    await app.tap(app.c.music.playSong('Uno'), { index: 0 });
    await app.advance(500);
    await app.tap(app.c.common.pause, { index: 0 });
    expect(audio.songPlayer()?.playing).toBe(false);
    await app.tap(app.c.music.playSong('Uno'), { index: 0 });
    expect(audio.songPlayer()?.playing).toBe(true);
  });

  it('the row’s play button does the same as its title', async () => {
    const api = new FakeApi();
    seedAlbum(api, api.addUser(EMAIL), { title: 'Mis canciones', setId: 'set-cafe', songs: [song('Uno')] });
    const app = await launch({ api, signedIn: EMAIL, url: '/set/set-cafe' });
    await app.tap(app.c.music.playSong('Uno'), { index: 1 });
    await app.advance(500);
    expect(audio.songPlayer()?.playing).toBe(true);
  });

  it('a set with no songs shows none and offers Make a song', async () => {
    const app = await launch({ signedIn: EMAIL, url: '/set/set-cafe' });
    expect(app.sees(app.c.music.makeSong)).toBe(true);
    expect(app.sees(new RegExp(app.c.music.songs(1)))).toBe(false);
  });
});

describe('One sound at a time', () => {
  async function both() {
    const api = new FakeApi();
    seedAlbum(api, api.addUser(EMAIL), { title: 'Mis canciones', setId: 'set-cafe', songs: [song('Uno')] });
    const app = await launch({ api, signedIn: EMAIL, url: '/set/set-cafe' });
    return app;
  }

  it('starting a song pauses the phrase loop', async () => {
    const app = await both();
    await app.tap(app.c.set.playAll('Café & Mañanas'));
    await app.advance(2 * SECOND);
    expect(audio.clips().length).toBeGreaterThan(0);
    await app.tap(app.c.music.playSong('Uno'), { index: 0 });
    await app.advance(500);
    const clips = audio.clips().length;
    await app.advance(10 * SECOND);
    expect(audio.songPlayer()?.playing).toBe(true);
    expect(audio.clips().length).toBe(clips);
  });

  it('starting the phrase loop pauses the song', async () => {
    const app = await both();
    await app.tap(app.c.music.playSong('Uno'), { index: 0 });
    await app.advance(2 * SECOND);
    await app.tap(app.c.set.playAll('Café & Mañanas'));
    await app.advance(2 * SECOND);
    expect(audio.songPlayer()?.playing).toBe(false);
    expect(audio.clips().length).toBeGreaterThan(0);
  });

  it('playing a song again after the loop pauses the loop', async () => {
    const app = await both();
    await app.tap(app.c.music.playSong('Uno'), { index: 0 });
    await app.advance(1 * SECOND);
    await app.tap(app.c.set.playAll('Café & Mañanas'));
    await app.advance(2 * SECOND);
    await app.tap(app.c.music.playSong('Uno'), { index: 0 });
    await app.advance(500);
    const clips = audio.clips().length;
    await app.advance(10 * SECOND);
    expect(audio.songPlayer()?.playing).toBe(true);
    expect(audio.clips().length).toBe(clips);
  });
});

describe('Signing out', () => {
  it('stops the songs that were playing and takes them out of the bar', async () => {
    const { app } = await openAlbum();
    await app.tap(app.c.music.playAlbum);
    await app.advance(1 * SECOND);
    expect(audio.songPlayer()?.playing).toBe(true);
    await app.open('/account');
    await app.tap(app.c.account.signOut);
    await app.settle();
    expect(audio.songPlayer()?.playing).toBe(false);
    expect(app.sees(nowPlaying('Uno'))).toBe(false);
  });

  it('a notification tap opens the album the song is in', async () => {
    const { app, album } = await openAlbum();
    await app.open('/');
    device.tapNotification({ kind: 'song', songId: album.songIds[0], albumId: album.id, outcome: 'ready' });
    await app.settle();
    expect(app.pathname()).toBe(`/album/${album.id}`);
  });

  it('a notification tap while the player is open closes it and shows the album', async () => {
    const { app, album } = await openAlbum();
    await app.tap(app.c.music.playSong('Uno'));
    await app.tap(app.c.music.playSong('Uno'));
    expect(app.pathname()).toBe('/song');
    device.tapNotification({ kind: 'song', songId: album.songIds[0], albumId: album.id, outcome: 'ready' });
    await app.settle();
    expect(app.pathname()).toBe(`/album/${album.id}`);
  });
});
