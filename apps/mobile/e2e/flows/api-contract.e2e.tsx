// The fake API's library routes, called with the app's own client functions: the shapes the app reads,
// who may do what, and the allowances. If these pass, a flow can rely on the fake answering as
// apps/api does.
import * as client from '@shared/api/library';
import { rewriteNote, writeNotes, writePhrases } from '@shared/generate/remote';
import { launch, DAY, type App } from '../harness';
import { FakeApi } from '../fakes/api';
import { communityAlbum, communitySet, failSong, lib, readyCover, readySong, seedAlbum, seedSet } from '../fakes/library';

const CAFE = [
  { target: 'Un café, por favor', native: 'A coffee, please' },
  { target: 'La cuenta, por favor', native: 'The bill, please' },
];

/** Signed in as a@b.test, with the app up. */
async function start(): Promise<{ app: App; api: FakeApi; me: NonNullable<App['user']> }> {
  const app = await launch({ signedIn: 'a@b.test' });
  return { app, api: app.api, me: app.user! };
}

/** Lets the app's polling (which waits in fake time) run until `promise` settles. */
async function finish<T>(app: App, promise: Promise<T>): Promise<T> {
  let done = false;
  promise.then(
    () => (done = true),
    () => (done = true),
  );
  for (let i = 0; i < 100 && !done; i++) await app.advance(3000);
  return promise;
}

const newPhrase = (target: string, native: string) => ({ target, native, source: 'written' as const });
const makeSet = (title: string, extra: Partial<Parameters<typeof client.createSet>[0]> = {}) =>
  client.createSet({ title, targetLang: 'es-ES', nativeLang: 'en-GB', visibility: 'private', phrases: CAFE.map((p) => newPhrase(p.target, p.native)), ...extra });
const refused = (status: number, code: string) => ({ status, code });

describe('sets and phrases', () => {
  it('makes a set the learner owns, with its phrases, clips and share code', async () => {
    await start();
    const { set, phrases } = await makeSet('Mi café');
    expect(set).toMatchObject({ title: 'Mi café', owner: 'me', visibility: 'private', targetLang: 'es-ES', saved: false, songCount: 0, level: 'A2' });
    expect(set.shareCode).toMatch(/^[a-z0-9]{10}$/);
    expect(set.phraseIds).toEqual(phrases.map((p) => p.id));
    expect(phrases[0]).toMatchObject({ target: 'Un café, por favor', translations: { 'en-GB': 'A coffee, please' }, setId: set.id, source: 'written', notesBy: 'rules' });
    expect(phrases[0].audio).toHaveProperty('es-ES');
    expect(phrases[0].notes.pronunciation.ipa).toMatch(/^\[.+\]$/);
    expect((await client.fetchSet(set.id)).set.id).toBe(set.id);
  });

  it('keeps the id a device gave a set, and uploading it again changes nothing', async () => {
    const { api } = await start();
    const first = await makeSet('Mine', { id: 'mine-s-abc123', phrases: [{ ...newPhrase('Hola', 'Hello'), id: 'mine-p-xyz789' }] });
    expect(first.set.id).toBe('mine-s-abc123');
    expect(first.set.phraseIds).toEqual(['mine-p-xyz789']);
    const again = await makeSet('Mine', { id: 'mine-s-abc123', phrases: [{ ...newPhrase('Hola', 'Hello'), id: 'mine-p-xyz789' }] });
    expect(again.set.id).toBe('mine-s-abc123');
    expect([...lib(api).sets.keys()]).toEqual(['mine-s-abc123']);
  });

  it('changes a set: words, visibility, added, removed and reordered phrases', async () => {
    await start();
    const { set, phrases } = await makeSet('Mi café');
    const [a, b] = phrases.map((p) => p.id);
    let detail = await client.updateSet(set.id, { title: 'Mi café 2', description: 'Morning', visibility: 'link', addPhrases: [newPhrase('Gracias', 'Thanks')] });
    expect(detail.set).toMatchObject({ title: 'Mi café 2', description: 'Morning', visibility: 'link' });
    const c = detail.set.phraseIds[2];
    detail = await client.updateSet(set.id, { order: [c, b, a] });
    expect(detail.set.phraseIds).toEqual([c, b, a]);
    detail = await client.updateSet(set.id, { removePhraseIds: [b] });
    expect(detail.set.phraseIds).toEqual([c, a]);
    expect(detail.phrases.map((p) => p.id)).toEqual([c, a]);
    detail = await client.updateSet(set.id, { description: null });
    expect(detail.set.description).toBeNull();
  });

  it('writes a phrase again, and deletes it from every set that lists it', async () => {
    await start();
    const one = await makeSet('One');
    const [first] = one.phrases;
    const two = await makeSet('Two', { phrases: [{ ref: first.id }] });
    expect(two.set.phraseIds).toEqual([first.id]);
    const edited = await client.editPhrase(one.set.id, first.id, { target: 'Un cortado', native: 'A cortado' });
    expect(edited.phrases.find((p) => p.id === first.id)).toMatchObject({ target: 'Un cortado', source: 'written', translations: { 'en-GB': 'A cortado' } });
    await client.deletePhrase(first.id);
    expect((await client.fetchSet(one.set.id)).set.phraseIds).not.toContain(first.id);
    expect((await client.fetchSet(two.set.id)).set.phraseIds).toEqual([]);
    await expect(client.deletePhrase(first.id)).rejects.toMatchObject(refused(404, 'NOT_FOUND'));
  });

  it('moves a phrase to the other set listing it when its own set goes', async () => {
    await start();
    const one = await makeSet('One');
    const keep = one.phrases[0].id;
    const two = await makeSet('Two', { phrases: [{ ref: keep }] });
    await client.deleteSet(one.set.id);
    const left = await client.fetchSet(two.set.id);
    expect(left.phrases.map((p) => p.id)).toEqual([keep]);
    expect(left.phrases[0].setId).toBe(two.set.id);
    await expect(client.fetchSet(one.set.id)).rejects.toMatchObject(refused(404, 'NOT_FOUND'));
  });

  it('puts phrases added on their own in "My phrases", made the first time', async () => {
    await start();
    const body = { phrase: newPhrase('Hola', 'Hello'), targetLang: 'es-ES' as const, nativeLang: 'en-GB' as const, inboxTitle: 'My phrases' };
    const first = await client.addPhrase(body);
    expect(first.set).toMatchObject({ title: 'My phrases', inbox: true, visibility: 'private' });
    const second = await client.addPhrase({ ...body, phrase: newPhrase('Adiós', 'Goodbye') });
    expect(second.set.id).toBe(first.set.id);
    expect(second.set.phraseIds).toHaveLength(2);
    const into = await makeSet('Other');
    const third = await client.addPhrase({ ...body, setId: into.set.id });
    expect(third.set.id).toBe(into.set.id);
    await expect(client.addPhrase({ ...body, targetLang: 'bg-BG', setId: into.set.id })).rejects.toMatchObject(refused(422, 'VALIDATION_FAILED'));
  });

  it('refuses what the API refuses: bad words, links, a course in the learner’s language', async () => {
    await start();
    await expect(makeSet('')).rejects.toMatchObject(refused(422, 'VALIDATION_FAILED'));
    await expect(makeSet('x'.repeat(61))).rejects.toMatchObject(refused(422, 'VALIDATION_FAILED'));
    await expect(makeSet('See www.example.com')).rejects.toMatchObject(refused(422, 'VALIDATION_FAILED'));
    await expect(makeSet('Same', { nativeLang: 'es-ES' })).rejects.toMatchObject(refused(422, 'VALIDATION_FAILED'));
    await expect(makeSet('Unknown ref', { phrases: [{ ref: 'nope-01' }] })).rejects.toMatchObject(refused(422, 'VALIDATION_FAILED'));
    await expect(makeSet('Too many', { phrases: Array.from({ length: 41 }, (_, i) => newPhrase(`P${i}`, `N${i}`)) })).rejects.toMatchObject(refused(422, 'VALIDATION_FAILED'));
  });

  it('lists Loro’s phrases by reference, and keeps a private set private', async () => {
    const { api, me } = await start();
    const mine = await makeSet('With Loro', { phrases: [{ ref: 'cafe-01' }] });
    expect(mine.phrases[0]).toMatchObject({ id: 'cafe-01', source: 'loro' });
    const other = seedSet(api, api.addUser('other@b.test'), { title: 'Theirs', phrases: CAFE });
    await expect(client.fetchSet(other.id)).rejects.toMatchObject(refused(404, 'NOT_FOUND'));
    await expect(client.updateSet(other.id, { title: 'Mine now' })).rejects.toMatchObject(refused(404, 'NOT_FOUND'));
    await expect(client.deleteSet(other.id)).rejects.toMatchObject(refused(404, 'NOT_FOUND'));
    void me;
  });

  it('needs a signed-in learner to write', async () => {
    const app = await launch();
    await expect(makeSet('Nope')).rejects.toMatchObject(refused(401, 'UNAUTHENTICATED'));
    expect(app.api.calls('POST /library/sets')).toHaveLength(0);
  });
});

describe('sharing and Community', () => {
  it('opens a set by its share code, but not a private one', async () => {
    const { api } = await start();
    const maker = api.addUser('maker@b.test');
    const linked = seedSet(api, maker, { title: 'Linked', phrases: CAFE, visibility: 'link' });
    const hidden = seedSet(api, maker, { title: 'Hidden', phrases: CAFE });
    const shared = await client.fetchShared(linked.shareCode);
    expect(shared.kind === 'set' && shared.set).toMatchObject({ id: linked.id, owner: 'other', visibility: 'link' });
    await expect(client.fetchShared(hidden.shareCode)).rejects.toMatchObject(refused(404, 'NOT_FOUND'));
    await expect(client.fetchShared('abcdefghij')).rejects.toMatchObject(refused(404, 'NOT_FOUND'));
  });

  it('opens an album by its share code, with its songs', async () => {
    const { api } = await start();
    const set = communitySet(api, { title: 'Cafe', displayName: 'Maria', phrases: CAFE });
    const album = communityAlbum(api, { title: 'Cafe songs', displayName: 'Maria', setId: set.id, songs: [{ title: 'One' }, { title: 'Two' }] });
    const shared = await client.fetchShared(album.shareCode);
    expect(shared.kind).toBe('album');
    if (shared.kind !== 'album') return;
    expect(shared.album).toMatchObject({ title: 'Cafe songs', author: 'Maria', owner: 'other', songCount: 2 });
    expect(shared.songs.map((s) => s.title)).toEqual(['One', 'Two']);
    expect(shared.songs[0]).toMatchObject({ status: 'ready', audioBy: 'demo', voiced: true, timingBy: 'demo' });
    expect(shared.songs[0].audioUrl).toMatch(/^\/library\/songs\/.+\/audio\?/);
    expect(shared.songs[0].sections[0].lines[0]).toMatchObject({ startMs: 0, phraseId: expect.any(String) });
  });

  it('lists public sets and albums in Community: search, sort, savedBy, the maker’s name', async () => {
    const { api } = await start();
    const first = communitySet(api, { title: 'Hotel talk', displayName: 'Maria', phrases: CAFE });
    const second = communitySet(api, { title: 'Beach words', displayName: 'Pavel', phrases: CAFE });
    communitySet(api, { title: 'Secret', displayName: 'Maria', phrases: CAFE, visibility: 'link' });
    communitySet(api, { title: 'En français', displayName: 'Maria', phrases: [{ target: 'Bonjour', native: 'Hello' }], targetLang: 'bg-BG' });
    await client.saveItem('set', first.id);
    const newest = await client.fetchCommunitySets('es-ES');
    expect(newest.sets.map((s) => s.title)).toEqual(['Beach words', 'Hotel talk']);
    expect(newest.sets[1]).toMatchObject({ author: 'Maria', owner: 'other', saved: true, savedBy: 1 });
    expect(newest.phrases.map((p) => p.setId).sort()).toEqual([first.id, first.id, second.id, second.id].sort());
    expect((await client.fetchCommunitySets('es-ES', '', 'popular')).sets[0].title).toBe('Hotel talk');
    expect((await client.fetchCommunitySets('es-ES', 'beach')).sets.map((s) => s.title)).toEqual(['Beach words']);
    expect((await client.fetchCommunitySets('es-ES', 'zzz')).sets).toEqual([]);

    const album = communityAlbum(api, { title: 'Hotel songs', displayName: 'Maria', setId: first.id });
    communityAlbum(api, { title: 'Nothing sung', displayName: 'Maria', setId: first.id, songs: [] });
    expect((await client.fetchCommunityAlbums('es-ES')).albums.map((a) => a.id)).toEqual([album.id]);
  });

  it('lists the maker’s other public sets and albums', async () => {
    const { api } = await start();
    const one = communitySet(api, { title: 'One', displayName: 'Maria', phrases: CAFE });
    const two = communitySet(api, { title: 'Two', displayName: 'Maria', phrases: CAFE });
    communitySet(api, { title: 'Not hers', displayName: 'Pavel', phrases: CAFE });
    const more = await client.fetchMoreSets(one.id);
    expect(more.sets.map((s) => s.id)).toEqual([two.id]);
    expect(more.phrases).toHaveLength(2);
    const a = communityAlbum(api, { title: 'A', displayName: 'Maria', setId: one.id });
    const b = communityAlbum(api, { title: 'B', displayName: 'Maria', setId: one.id });
    expect((await client.fetchMoreAlbums(a.id)).albums.map((x) => x.id)).toEqual([b.id]);
    expect((await client.fetchMoreSets('set-cafe')).sets).toEqual([]);
  });

  it('takes a public set out of Community after three reports, and shows its owner', async () => {
    const { app, api } = await start();
    const target = communitySet(api, { title: 'Spam', displayName: 'Mallory', phrases: CAFE });
    await expect(client.reportItem('set', target.id, 'spam')).resolves.toEqual({ reported: true });
    for (const n of [1, 2]) {
      const other = api.addUser(`r${n}@b.test`);
      const { access_token } = api.issue(other);
      await api.fetch(`/v1/library/reports`, { method: 'POST', headers: { Authorization: `Bearer ${access_token}` }, body: JSON.stringify({ kind: 'set', id: target.id, reason: 'spam' }) });
    }
    expect((await client.fetchCommunitySets('es-ES')).sets).toEqual([]);
    expect((await client.fetchSet(target.id)).set.id).toBe(target.id);
    void app;
  });

  it('refuses to report your own set or Loro’s', async () => {
    await start();
    const mine = await makeSet('Mine');
    await expect(client.reportItem('set', mine.set.id, 'spam')).rejects.toMatchObject(refused(422, 'VALIDATION_FAILED'));
    await expect(client.reportItem('set', 'set-cafe', 'spam')).rejects.toMatchObject(refused(422, 'VALIDATION_FAILED'));
  });

  it('saves and unsaves other learners’ sets and albums, and the pack carries them', async () => {
    const { api } = await start();
    const set = communitySet(api, { title: 'Hotel talk', displayName: 'Maria', phrases: CAFE });
    const album = communityAlbum(api, { title: 'Hotel songs', displayName: 'Maria', setId: set.id });
    const hidden = seedSet(api, api.addUser('maria2@b.test'), { title: 'Private', phrases: CAFE });
    await expect(client.saveItem('set', hidden.id)).rejects.toMatchObject(refused(404, 'NOT_FOUND'));
    expect(await client.saveItem('set', set.id)).toEqual({ saved: true });
    await client.saveItem('album', album.id);
    let pack = await client.fetchPack('es-ES');
    expect(pack.sets.find((s) => s.id === set.id)).toMatchObject({ saved: true, owner: 'other', author: 'Maria' });
    expect(pack.phrases.filter((p) => p.setId === set.id)).toHaveLength(2);
    expect(pack.albums.map((a) => a.id)).toEqual([album.id]);
    await client.unsaveItem('set', set.id);
    await client.unsaveItem('album', album.id);
    pack = await client.fetchPack('es-ES');
    expect(pack.sets.find((s) => s.id === set.id)).toBeUndefined();
    expect(pack.albums).toEqual([]);
  });
});

describe('the pack', () => {
  it('carries the learner’s own sets and albums, and its version moves with every change', async () => {
    const { api, me } = await start();
    const before = await client.fetchPack('es-ES');
    const mine = seedSet(api, me, { title: 'Seeded', phrases: CAFE, visibility: 'public' });
    const other = await client.fetchPack('es-ES');
    expect(other.version).not.toBe(before.version);
    expect(other.sets.find((s) => s.id === mine.id)).toMatchObject({ owner: 'me', title: 'Seeded', shareCode: mine.shareCode });
    expect(other.phrases.find((p) => p.id === mine.phraseIds[0])?.audio).toBeDefined();
    expect(other.sets.length).toBe(before.sets.length + 1);
    await makeSet('Via the app');
    expect((await client.fetchPack('es-ES')).version).not.toBe(other.version);
    // Another course gets none of it.
    expect((await client.fetchPack('bg-BG')).sets.some((s) => s.owner === 'me')).toBe(false);
  });

  it('is Loro’s alone for someone signed out', async () => {
    const app = await launch();
    seedSet(app.api, app.api.addUser('x@b.test'), { title: 'Not shown', phrases: CAFE, visibility: 'public' });
    expect((await client.fetchPack('es-ES')).sets.every((s) => s.owner === 'loro')).toBe(true);
  });
});

describe('albums and songs', () => {
  it('makes, renames, shares and deletes an album', async () => {
    await start();
    const made = await client.createAlbum({ title: 'Road trip', targetLang: 'es-ES', visibility: 'private' });
    expect(made.album).toMatchObject({ title: 'Road trip', owner: 'me', songCount: 0, durationMs: 0 });
    expect(made.songs).toEqual([]);
    const renamed = await client.updateAlbum(made.album.id, { title: 'Road', description: 'Songs', visibility: 'link' });
    expect(renamed.album).toMatchObject({ title: 'Road', description: 'Songs', visibility: 'link' });
    await client.deleteAlbum(made.album.id);
    await expect(client.fetchAlbum(made.album.id)).rejects.toMatchObject(refused(404, 'NOT_FOUND'));
    await expect(client.createAlbum({ title: 'See http://x.com', targetLang: 'es-ES', visibility: 'private' })).rejects.toMatchObject(refused(422, 'VALIDATION_FAILED'));
  });

  it('lists a set’s songs with their albums, only the ones the reader may hear', async () => {
    const { api, me } = await start();
    const set = seedSet(api, me, { title: 'Cafe', phrases: CAFE, visibility: 'public' });
    const mine = seedAlbum(api, me, { setId: set.id });
    const maker = api.addUser('m@b.test');
    const hers = seedAlbum(api, maker, { setId: set.id, visibility: 'public', title: 'Hers' });
    seedAlbum(api, maker, { setId: set.id, title: 'Private' });
    seedAlbum(api, maker, { setId: set.id, visibility: 'public', title: 'Making', songs: [{ status: 'rendering' }] });
    const listed = await client.fetchSetSongs(set.id);
    expect(listed.albums.map((a) => a.id).sort()).toEqual([mine.id, hers.id].sort());
    expect(listed.songs.every((s) => s.status === 'ready')).toBe(true);
    expect((await client.fetchSet(set.id)).set.songCount).toBe(2);
    expect((await client.fetchAlbum(hers.id)).songs).toHaveLength(1);
  });

  it('writes lyrics, rewrites them, and sings a song from them that is ready after it is asked after', async () => {
    const { app, api, me } = await start();
    const set = seedSet(api, me, { title: 'Cafe', phrases: CAFE });
    const draft = await finish(app, client.writeLyrics({ setId: set.id, styleId: 'jazz_lounge', nativeLang: 'en-GB' }, { pollMs: 1000, polls: 5 }));
    expect(draft).toMatchObject({ status: 'ready', lyricsBy: 'ai', revision: 1, instruction: null, setId: set.id, styleId: 'jazz_lounge', options: client.DEFAULT_SONG_OPTIONS });
    expect(draft.sections[0].lines[0]).toEqual({ text: 'Un café, por favor', meaning: 'A coffee, please', phraseId: expect.any(String) });
    const again = await finish(app, client.rewriteLyrics(draft.id, 'More cheerful', { pollMs: 1000, polls: 5 }));
    expect(again).toMatchObject({ status: 'ready', revision: 2, instruction: 'More cheerful' });
    expect(again.sections[0].lines[0].text).toBe('La cuenta, por favor');
    expect((await client.fetchLyrics(draft.id)).revision).toBe(2);

    const { song, album } = await client.generateSong({ setId: set.id, styleId: 'jazz_lounge', nativeLang: 'en-GB', lyricsId: draft.id });
    expect(song).toMatchObject({ status: 'rendering', setId: set.id, albumId: album.id, audioUrl: null, lyricsBy: 'ai', title: 'Cafe' });
    expect(album).toMatchObject({ owner: 'me', title: 'Cafe', songCount: 0, visibility: 'private' });
    expect(song.sections[0].lines[0]).toMatchObject({ text: 'La cuenta, por favor', startMs: null });
    expect((await client.fetchSong(song.id)).status).toBe('rendering');
    const ready = await client.fetchSong(song.id);
    expect(ready).toMatchObject({ status: 'ready', audioBy: 'demo', error: null });
    expect(ready.audioUrl).toMatch(/audio\?exp=\d+&sig=/);
    expect(ready.durationMs).toBeGreaterThan(0);
    expect((await client.fetchAlbum(album.id)).album).toMatchObject({ songCount: 1, durationMs: ready.durationMs });

    await client.deleteSong(song.id);
    expect((await client.fetchAlbum(album.id)).songs).toEqual([]);
  });

  it('refuses lyrics the learner has not approved, or another set’s', async () => {
    const { app, api, me } = await start();
    const set = seedSet(api, me, { title: 'Cafe', phrases: CAFE });
    const other = seedSet(api, me, { title: 'Other', phrases: CAFE });
    const writing = await client.writeLyrics({ setId: set.id, styleId: 'jazz_lounge', nativeLang: 'en-GB' }, { pollMs: 1, polls: 0 });
    expect(writing.status).toBe('writing');
    await expect(client.generateSong({ setId: set.id, styleId: 'jazz_lounge', nativeLang: 'en-GB', lyricsId: writing.id })).rejects.toMatchObject(refused(422, 'VALIDATION_FAILED'));
    await expect(client.rewriteLyrics(writing.id, undefined, { pollMs: 1, polls: 0 })).rejects.toMatchObject(refused(422, 'VALIDATION_FAILED'));
    const ready = await finish(app, client.writeLyrics({ setId: set.id, styleId: 'jazz_lounge', nativeLang: 'en-GB' }, { pollMs: 1000, polls: 5 }));
    await expect(client.generateSong({ setId: other.id, styleId: 'jazz_lounge', nativeLang: 'en-GB', lyricsId: ready.id })).rejects.toMatchObject(refused(422, 'VALIDATION_FAILED'));
    await expect(client.fetchLyrics('lyrics-nobody')).rejects.toMatchObject(refused(404, 'NOT_FOUND'));
  });

  it('answers lyrics at once from the set’s phrases when the server has no text model', async () => {
    const { api, me } = await start();
    lib(api).config.ai = false;
    const set = seedSet(api, me, { title: 'Cafe', phrases: CAFE });
    const draft = await client.writeLyrics({ setId: set.id, styleId: 'modern_pop', nativeLang: 'en-GB' });
    expect(draft).toMatchObject({ status: 'ready', lyricsBy: 'phrases' });
    await expect(client.rewriteLyrics(draft.id, 'Again')).rejects.toMatchObject(refused(503, 'PROVIDER_UNAVAILABLE'));
    expect((await client.fetchUsage()).daily.lyrics.used).toBe(0);
    expect((await client.fetchUsage()).writers).toEqual({ phrases: 'bank', cover: 'pattern', lyrics: 'phrases', music: 'demo' });
  });

  it('makes a failed song again for another of the day’s songs, and gives a failed one back', async () => {
    const { api, me } = await start();
    const set = seedSet(api, me, { title: 'Cafe', phrases: CAFE });
    const { song } = await client.generateSong({ setId: set.id, styleId: 'modern_pop', nativeLang: 'en-GB' });
    expect((await client.fetchUsage()).daily.song.used).toBe(1);
    await expect(client.retrySong(song.id, 'en-GB')).rejects.toMatchObject(refused(422, 'VALIDATION_FAILED'));
    await expect(client.deleteSong(song.id)).rejects.toMatchObject(refused(422, 'VALIDATION_FAILED'));
    failSong(api, song.id);
    expect((await client.fetchUsage()).daily.song.used).toBe(0);
    expect(await client.fetchSong(song.id)).toMatchObject({ status: 'failed', error: 'The music service failed' });
    const retried = await client.retrySong(song.id, 'en-GB');
    expect(retried.status).toBe('rendering');
    expect((await client.fetchUsage()).daily.song.used).toBe(1);
    readySong(api, song.id);
    expect((await client.fetchSong(song.id)).status).toBe('ready');
  });

  it('stops at the day’s songs, with when the allowance resets, and starts again the next day', async () => {
    const { api, me } = await start();
    const set = seedSet(api, me, { title: 'Cafe', phrases: CAFE });
    api.limits.song = 2;
    const albumId = (await client.generateSong({ setId: set.id, styleId: 'modern_pop', nativeLang: 'en-GB' })).album.id;
    await client.generateSong({ setId: set.id, styleId: 'modern_pop', nativeLang: 'en-GB', albumId });
    const error = await client.generateSong({ setId: set.id, styleId: 'modern_pop', nativeLang: 'en-GB', albumId }).catch((e) => e);
    expect(error).toMatchObject({ status: 429, code: 'LIMIT_REACHED', extra: { kind: 'song', limit: 2, resets_at: Date.UTC(2026, 8, 2) } });
    expect((await client.fetchUsage()).daily.song).toEqual({ used: 2, limit: 2 });
    jest.setSystemTime(Date.now() + DAY);
    expect((await client.fetchUsage()).daily.song).toEqual({ used: 0, limit: 2 });
    await client.generateSong({ setId: set.id, styleId: 'modern_pop', nativeLang: 'en-GB', albumId });
  });

  it('keeps at most so many sets, albums and songs', async () => {
    const { api } = await start();
    api.kept.sets = 1;
    api.kept.albums = 1;
    await makeSet('One');
    await expect(makeSet('Two')).rejects.toMatchObject({ status: 429, code: 'LIMIT_REACHED', extra: { kind: 'sets', limit: 1, resets_at: null } });
    await client.createAlbum({ title: 'A', targetLang: 'es-ES', visibility: 'private' });
    await expect(client.createAlbum({ title: 'B', targetLang: 'es-ES', visibility: 'private' })).rejects.toMatchObject({ status: 429, code: 'LIMIT_REACHED' });
    expect((await client.fetchUsage()).kept).toMatchObject({ sets: { used: 1, limit: 1 }, albums: { used: 1, limit: 1 } });
  });
});

describe('covers', () => {
  it('draws a cover in the background, waits for it, and the set wears it', async () => {
    const { app, api, me } = await start();
    const set = seedSet(api, me, { title: 'Cafe', phrases: CAFE });
    const cover = await finish(app, client.generateCover({ kind: 'set', attachTo: set.id }, { pollMs: 1000, polls: 5 }));
    expect(cover).toMatchObject({ status: 'ready', provider: 'ai', url: expect.stringMatching(/^\/library\/covers\/cover-.+\.svg$/) });
    expect((await client.fetchSet(set.id)).set.coverUrl).toBe(cover.url);
    expect((await client.fetchUsage()).daily.cover.used).toBe(1);
    // A cover not put on anything yet is for its own title; the learner may use it as `coverId`.
    const loose = await finish(app, client.generateCover({ kind: 'set', title: 'Beach' }, { pollMs: 1000, polls: 5 }));
    const made = await makeSet('Beach', { coverId: loose.id });
    expect(made.set.coverUrl).toBe(loose.url);
    await expect(makeSet('Bad', { coverId: 'cover-nobody' })).rejects.toMatchObject(refused(422, 'VALIDATION_FAILED'));
  });

  it('answers still rendering until the app has asked, and a test can finish it', async () => {
    const { app, api, me } = await start();
    lib(api).config.coverPolls = 2;
    const set = seedSet(api, me, { title: 'Cafe', phrases: CAFE });
    const pending = await finish(app, client.generateCover({ kind: 'set', attachTo: set.id }, { pollMs: 1000, polls: 1 }));
    expect(pending.status).toBe('rendering');
    expect((await client.fetchSet(set.id)).set.coverUrl).toBeNull();
    readyCover(api, pending.id);
    expect((await client.fetchSet(set.id)).set.coverUrl).toBe(`/library/covers/${pending.id}.svg`);
  });

  it('draws at once with the server’s pattern when it has no model', async () => {
    const { api, me } = await start();
    lib(api).config.ai = false;
    const set = seedSet(api, me, { title: 'Cafe', phrases: CAFE });
    const cover = await client.generateCover({ kind: 'set', attachTo: set.id });
    expect(cover).toMatchObject({ status: 'ready', provider: 'pattern' });
    expect((await client.fetchSet(set.id)).set.coverUrl).toBe(cover.url);
  });

  it('copies one of Loro’s sets for the learner, who then owns the copy and its cover', async () => {
    const { app } = await start();
    const cover = await finish(app, client.generateCover({ kind: 'set', attachTo: 'set-cafe', nativeLang: 'en-GB' }, { pollMs: 1000, polls: 5 }));
    expect(cover.copy).toMatchObject({ kind: 'set', id: expect.stringMatching(/^set-u-/) });
    const copy = await client.fetchSet(cover.copy!.id);
    expect(copy.set).toMatchObject({ owner: 'me', visibility: 'private', coverUrl: cover.url, title: 'Café & Mañanas' });
    expect(copy.set.phraseIds).toEqual((await client.fetchSet('set-cafe')).set.phraseIds);
    expect(copy.phrases[0]).toMatchObject({ source: 'loro' });
  });

  it('keeps the covers drawn for an item, newest first, and puts an earlier one back without spending', async () => {
    const { app, api, me } = await start();
    const set = seedSet(api, me, { title: 'Cafe', phrases: CAFE });
    const first = await finish(app, client.generateCover({ kind: 'set', attachTo: set.id }, { pollMs: 1000, polls: 5 }));
    const second = await finish(app, client.generateCover({ kind: 'set', attachTo: set.id, prompt: 'A sunny terrace' }, { pollMs: 1000, polls: 5 }));
    const history = await client.fetchCoverHistory('set', set.id);
    expect(history.current).toBe(second.id);
    expect(history.covers.map((c) => [c.id, c.prompt, c.provider])).toEqual([
      [second.id, 'A sunny terrace', 'ai'],
      [first.id, null, 'ai'],
    ]);
    const worn = await client.wearCover(first.id, { kind: 'set', attachTo: set.id });
    expect(worn).toMatchObject({ id: first.id, status: 'ready', url: first.url });
    expect((await client.fetchSet(set.id)).set.coverUrl).toBe(first.url);
    expect((await client.fetchUsage()).daily.cover.used).toBe(2);
    await expect(client.wearCover(first.id, { kind: 'set', attachTo: 'set-cafe' })).rejects.toMatchObject(refused(404, 'NOT_FOUND'));
  });

  it('gives a learner their own cover of a phrase or a song, shown in their pack only', async () => {
    const { app, api, me } = await start();
    const set = seedSet(api, me, { title: 'Cafe', phrases: CAFE });
    const phraseId = set.phraseIds[0];
    const cover = await finish(app, client.generateCover({ kind: 'phrase', attachTo: phraseId }, { pollMs: 1000, polls: 5 }));
    expect((await client.fetchPack('es-ES')).covers?.phrases[phraseId]).toBe(cover.url);
    expect((await client.fetchCoverHistory('phrase', phraseId)).current).toBe(cover.id);
    const album = seedAlbum(api, me, { setId: set.id });
    const songCover = await finish(app, client.generateCover({ kind: 'song', attachTo: album.songIds[0] }, { pollMs: 1000, polls: 5 }));
    expect((await client.fetchPack('es-ES')).covers?.songs[album.songIds[0]]).toBe(songCover.url);
  });

  it('refuses a cover for nothing, or for someone else’s set, and stops at the day’s allowance', async () => {
    const { app, api, me } = await start();
    await expect(client.generateCover({ kind: 'set' })).rejects.toMatchObject(refused(422, 'VALIDATION_FAILED'));
    await expect(client.generateCover({ kind: 'phrase', title: 'x' })).rejects.toMatchObject(refused(422, 'VALIDATION_FAILED'));
    const others = communitySet(api, { title: 'Hers', displayName: 'Maria', phrases: CAFE });
    await expect(client.generateCover({ kind: 'set', attachTo: others.id })).rejects.toMatchObject(refused(404, 'NOT_FOUND'));
    expect((await client.fetchUsage()).daily.cover.used).toBe(0);
    api.limits.cover = 1;
    const mine = seedSet(api, me, { title: 'Mine', phrases: CAFE });
    await finish(app, client.generateCover({ kind: 'set', attachTo: mine.id }, { pollMs: 1000, polls: 5 }));
    await expect(client.generateCover({ kind: 'set', attachTo: mine.id })).rejects.toMatchObject({ status: 429, code: 'LIMIT_REACHED', extra: { kind: 'cover', limit: 1 } });
  });
});

describe('writing for the learner', () => {
  const request = { mode: 'topic', input: 'hotel', targetLang: 'es-ES', nativeLang: 'en-GB', count: 5 } as const;

  it('writes a deck in the background, labelled, with clips, from the phrase bank’s words', async () => {
    const { app, api } = await start();
    const deck = await finish(app, writePhrases(request, [], undefined, { pollMs: 1000, polls: 5 }));
    expect(deck.provider).toBe('ai');
    expect(deck.phrases.length).toBeGreaterThan(0);
    expect(deck.phrases.length).toBeLessThanOrEqual(5);
    expect(deck.phrases[0]).toMatchObject({ source: 'ai', image: expect.any(Array), notes: { mnemonic: expect.anything() } });
    expect(deck.phrases[0].audio).toBeDefined();
    expect((await client.fetchUsage()).daily.phrases.used).toBe(1);
    // What the learner already has is not suggested again.
    const avoid = deck.phrases.map((p) => p.target);
    const next = await finish(app, writePhrases(request, avoid, undefined, { pollMs: 1000, polls: 5 }));
    expect(next.phrases.map((p) => p.target).filter((t) => avoid.includes(t))).toEqual([]);
    void api;
  });

  it('answers a deck at once from the bank, labelled, when the server has no model; none for words no theme fits', async () => {
    const { api } = await start();
    lib(api).config.ai = false;
    const deck = await writePhrases(request, []);
    expect(deck.provider).toBe('bank');
    expect(deck.phrases[0]).toMatchObject({ source: 'bank', bankId: expect.stringMatching(/^bank-/) });
    expect((await client.fetchUsage()).daily.phrases.used).toBe(0);
    expect((await writePhrases({ ...request, input: 'zzzzzz' }, [])).phrases).toEqual([]);
  });

  it('writes notes for a phrase from the day’s allowance, and rewrites a note with the model', async () => {
    const { api } = await start();
    const notes = await writeNotes({ target: 'Hola', native: 'Hello', targetLang: 'es-ES', nativeLang: 'en-GB' });
    expect(notes.provider).toBe('ai');
    expect(notes.image.length).toBeGreaterThan(0);
    expect(notes.notes.pronunciation.ipa).toMatch(/^\[.+\]$/);
    const note = await rewriteNote({ kind: 'mnemonic', target: 'Hola', native: 'Hello', targetLang: 'es-ES', nativeLang: 'en-GB', previous: [notes.notes.mnemonic] });
    expect(note).toEqual({ title: expect.any(String), text: expect.any(String) });
    expect((await client.fetchUsage()).daily.phrases.used).toBe(2);
    api.limits.phrases = 2;
    await expect(writeNotes({ target: 'Adiós', native: 'Bye', targetLang: 'es-ES', nativeLang: 'en-GB' })).rejects.toMatchObject({ status: 429, code: 'LIMIT_REACHED' });
    await expect(writePhrases(request, [])).rejects.toMatchObject({ status: 429, code: 'LIMIT_REACHED' });
  });

  it('writes notes by Loro’s rules for free, and has no other note to give, without a model', async () => {
    const { api } = await start();
    lib(api).config.ai = false;
    expect((await writeNotes({ target: 'Hola', native: 'Hello', targetLang: 'es-ES', nativeLang: 'en-GB' })).provider).toBe('rules');
    await expect(rewriteNote({ kind: 'grammar', target: 'Hola', native: 'Hello', targetLang: 'es-ES', nativeLang: 'en-GB', previous: [{ title: 'a', text: 'b' }] })).rejects.toMatchObject(refused(503, 'PROVIDER_UNAVAILABLE'));
    expect((await client.fetchUsage()).daily.phrases.used).toBe(0);
  });
});

describe('the learner’s account', () => {
  it('reports the allowances and what is kept, as the app reads them', async () => {
    const { api, me } = await start();
    seedSet(api, me, { title: 'One', phrases: CAFE });
    const usage = await client.fetchUsage();
    expect(usage).toMatchObject({
      day: '2026-09-01',
      resetsAt: Date.UTC(2026, 8, 2),
      daily: { phrases: { used: 0, limit: 30 }, cover: { used: 0, limit: 10 }, song: { used: 0, limit: 5 }, lyrics: { used: 0, limit: 20 } },
      kept: { sets: { used: 1, limit: 100 }, albums: { used: 0, limit: 30 }, songs: { used: 0, limit: 120 } },
      writers: { phrases: 'ai', cover: 'ai', lyrics: 'ai', music: 'demo' },
    });
  });

  it('registers and forgets a push token', async () => {
    const { api, me } = await start();
    const token = 'ExponentPushToken[abcdefgh12345678]';
    await expect(client.registerPushToken({ token, lang: 'en', platform: 'ios' })).resolves.toEqual({ registered: true });
    expect(lib(api).pushTokens.get(token)).toMatchObject({ userId: me.id, lang: 'en', platform: 'ios' });
    await expect(client.registerPushToken({ token: 'nope', lang: 'en' })).rejects.toMatchObject(refused(422, 'VALIDATION_FAILED'));
    await client.forgetPushToken(token);
    expect(lib(api).pushTokens.size).toBe(0);
  });

  it('deletes everything the learner keeps, but not the sign-in or the day’s allowance', async () => {
    const { api, me } = await start();
    await client.setDisplayName('Ana B');
    const set = seedSet(api, me, { title: 'Mine', phrases: CAFE, visibility: 'public' });
    seedAlbum(api, me, { setId: set.id });
    const theirs = communitySet(api, { title: 'Hers', displayName: 'Maria', phrases: CAFE });
    await client.saveItem('set', theirs.id);
    await client.generateSong({ setId: set.id, styleId: 'modern_pop', nativeLang: 'en-GB' });
    await expect(client.deleteEverything()).resolves.toEqual({ deleted: true });
    const pack = await client.fetchPack('es-ES');
    expect(pack.sets.filter((s) => s.owner !== 'loro')).toEqual([]);
    expect(pack.albums).toEqual([]);
    expect((await client.fetchCommunitySets('es-ES')).sets.map((s) => s.id)).toEqual([theirs.id]);
    expect((await client.fetchUsage()).daily.song.used).toBe(1);
    expect(api.users.get(me.id)?.displayName).toBeNull();
    await expect(client.fetchSet(set.id)).rejects.toMatchObject(refused(404, 'NOT_FOUND'));
  });

  it('deletes the account: its things, its sessions and the user', async () => {
    const { api, me } = await start();
    seedSet(api, me, { title: 'Mine', phrases: CAFE, visibility: 'public' });
    await expect(client.deleteAccount()).resolves.toEqual({ deleted: true });
    expect(api.users.has(me.id)).toBe(false);
    expect([...api.refresh.values()]).not.toContain(me.id);
    expect((await client.fetchCommunitySets('es-ES')).sets).toEqual([]);
    await expect(client.fetchUsage()).rejects.toMatchObject({ status: 401 });
  });
});

describe('in the app', () => {
  it('shows a signed-in learner’s own set, seeded on the server, in their library after launch', async () => {
    const api = new FakeApi();
    const me = api.addUser('a@b.test');
    seedSet(api, me, { title: 'Mi café', phrases: CAFE });
    const app = await launch({ api, signedIn: 'a@b.test' });
    await app.tap(app.c.tabs.library);
    await app.tap(app.c.library.setsSegment);
    await app.tap(app.c.library.filters.ownSets);
    await app.waitFor('Mi café');
    expect(app.api.calls('GET /library/pack')[0].userId).toBe(me.id);
  });
});
