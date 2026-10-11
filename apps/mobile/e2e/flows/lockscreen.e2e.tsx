// The player on the lock screen and in the notification shade (P3-11, P3-31), with the LoroMedia
// module present, as on the store app.
//
// Covers:
//  - The phrase loop: nothing shown before anything plays; shown on the first play (prompt as title,
//    the step as artist, the set as album, playing, next/previous, the three grades, silences); updated
//    as the phases change and as play and pause change in the app; closing the paused player hides it.
//  - Presses from the lock screen: play, pause, next, previous doing what the app's buttons do; a
//    grade rating the phrase as the bar does (pending, Undo offered, grades gone) and a grade for a
//    phrase the player has left being dropped; an interruption (pause, then play) resuming.
//  - The background: with the module the loop plays on; coming back to the app re-sends the player.
//  - A song in front: title, artist and album, position and length, seek, next and previous songs,
//    grades rating the phrases it sings, its position drift re-sent; switching between a song and
//    the phrase loop changing what is shown.
import { FakeApi } from '../fakes/api';
import { seedAlbum } from '../fakes/library';
import { audio, device, launch, SECOND, type App } from '../harness';

device.lockScreen = true;


const SET = 'Café & Mañanas';
const EMAIL = 'ana@example.test';
const CAFE_1 = { prompt: 'A cortado, please', target: 'Me pone un cortado, por favor' };
const CAFE_2 = { prompt: 'Do you have oat milk?', target: '¿Tienen leche de avena?' };

/** Launches on the café set and starts playing it. */
async function playSet(options: Parameters<typeof launch>[0] = {}): Promise<App> {
  const app = await launch({ url: '/set/set-cafe', ...options });
  await app.tap(app.c.set.playAll(SET));
  return app;
}

/** The learner's album with these songs, signed in, on its page. */
async function openAlbum(titles = ['Uno', 'Dos', 'Tres'], more: Parameters<typeof launch>[0] = {}) {
  const api = more.api ?? new FakeApi();
  const album = seedAlbum(api, api.addUser(EMAIL), { title: 'Mis canciones', setId: 'set-cafe', songs: titles.map((title) => ({ title })) });
  const app = await launch({ api, signedIn: EMAIL, url: `/album/${album.id}`, ...more });
  return { app, api, album };
}

const shown = () => {
  if (!device.nowPlaying) throw new Error('The lock screen shows nothing');
  return device.nowPlaying;
};
const gradeNames = () => shown().grades?.map((g) => g.grade) ?? null;
const rateAs = (app: App, grade: 'missed' | 'hard' | 'easy') => app.c.player.rateAs(app.c.common.grade[grade]);
const nowPlaying = (title: string) => `Now playing: ${title}`;
const lastSongId = () => /songs\/([^/]+)\/audio/.exec(audio.heard.filter((h) => h.kind === 'song').at(-1)?.uri ?? '')?.[1];
/** The ratings still in their window, as [phrase, grade]. */
async function inWindow(app: App): Promise<[string, string][]> {
  return (await app.saved()).pending.filter((p) => !p.undone).map((p) => [p.phraseId, p.grade]);
}

describe('the phrase loop on the lock screen', () => {
  it('shows nothing before anything plays', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.advance(5 * SECOND);
    expect(device.nowPlaying).toBeNull();
    expect(device.lockScreenLog).toEqual([]);
    expect(app.sees(app.c.set.playAll(SET))).toBe(true);
  });

  it('shows the phrase on the first play: prompt, step, set, controls and grades', async () => {
    const app = await playSet();
    const now = shown();
    expect(now).toMatchObject({
      id: 'cafe-01',
      title: CAFE_1.prompt,
      artist: 'English',
      album: SET,
      playing: true,
      canNext: true,
      canPrevious: false,
      positionMs: null,
      durationMs: null,
      hasSilences: true,
      nextLabel: app.c.player.next,
    });
    expect(gradeNames()).toEqual(['missed', 'hard', 'easy']);
    expect(shown().grades?.map((g) => g.label)).toEqual(['Missed', 'Hard', 'Easy']);
    expect(shown().grades?.every((g) => !g.selected)).toBe(true);
  });

  it('follows the phases: the learner’s turn, then the target with the prompt under it', async () => {
    const app = await playSet();
    await app.advance(2_500);
    expect(shown()).toMatchObject({ title: CAFE_1.prompt, artist: 'Your turn' });
    // The target is heard: it is shown, the prompt under it.
    for (let t = 0; shown().title !== CAFE_1.target && t < 30_000; t += 100) await app.advance(100);
    expect(shown()).toMatchObject({ title: CAFE_1.target, artist: CAFE_1.prompt, id: 'cafe-01' });
  });

  it('follows the app’s pause and play', async () => {
    const app = await playSet();
    await app.advance(500);
    await app.tap(app.c.common.pause);
    expect(shown()).toMatchObject({ playing: false, artist: app.c.player.paused, title: CAFE_1.prompt });
    await app.tap(app.c.common.play);
    expect(shown().playing).toBe(true);
    expect(shown().artist).not.toBe(app.c.player.paused);
  });

  it('follows the app’s next and previous', async () => {
    const app = await playSet();
    await app.tap(new RegExp(`^${app.c.player.dialog}`));
    await app.tap(app.c.player.next);
    expect(shown()).toMatchObject({ id: 'cafe-02', title: CAFE_2.prompt, canPrevious: true });
    await app.advance(500);
    await app.tap(app.c.player.previous);
    expect(shown()).toMatchObject({ id: 'cafe-01', canPrevious: false });
  });

  it('is hidden when the paused player is closed', async () => {
    const app = await playSet();
    await app.advance(500);
    await app.tap(app.c.common.pause);
    expect(device.nowPlaying).not.toBeNull();
    await app.tap(app.c.player.close);
    expect(device.nowPlaying).toBeNull();
    expect(device.lockScreenLog.at(-1)).toBe('hidden');
  });
});

describe('presses on the lock screen: the phrase loop', () => {
  it('pause stops the app’s loop, play starts it, as the buttons do', async () => {
    const app = await playSet();
    await app.advance(500);
    device.press({ type: 'pause' });
    await app.advance(0);
    expect(app.sees(app.c.common.play)).toBe(true);
    expect(app.sees(app.c.player.paused)).toBe(true);
    expect(shown().playing).toBe(false);
    const heard = audio.heard.length;
    await app.advance(20 * SECOND);
    expect(audio.heard.length).toBe(heard);
    device.press({ type: 'play' });
    await app.advance(5 * SECOND);
    expect(app.sees(app.c.common.pause)).toBe(true);
    expect(shown().playing).toBe(true);
    expect(audio.heard.length).toBeGreaterThan(heard);
  });

  it('an interruption is a pause, and the end of it a play that resumes the loop', async () => {
    const app = await playSet();
    await app.advance(500);
    device.press({ type: 'pause' });
    expect(shown().playing).toBe(false);
    device.press({ type: 'play' });
    expect(shown().playing).toBe(true);
    const clips = audio.clips().length;
    await app.advance(10 * SECOND);
    expect(audio.clips().length).toBeGreaterThan(clips);
    expect(app.sees(app.c.common.pause)).toBe(true);
  });

  it('play while already playing, and pause while already paused, change nothing', async () => {
    const app = await playSet();
    await app.advance(500);
    device.press({ type: 'play' });
    expect(shown().playing).toBe(true);
    device.press({ type: 'pause' });
    device.press({ type: 'pause' });
    expect(shown().playing).toBe(false);
    expect(app.sees(app.c.common.play)).toBe(true);
  });

  it('next moves to the next phrase and previous back, and the clips follow', async () => {
    const app = await playSet();
    await app.advance(500);
    device.press({ type: 'next' });
    await app.advance(500);
    expect(shown()).toMatchObject({ id: 'cafe-02', title: CAFE_2.prompt });
    expect(app.sees(new RegExp(`^${app.c.player.dialog}: ${CAFE_2.prompt}`))).toBe(true);
    expect(audio.clips().at(-1)).toBe('en-GB-cafe-02');
    device.press({ type: 'previous' });
    await app.advance(500);
    expect(shown()).toMatchObject({ id: 'cafe-01', canPrevious: false });
    expect(audio.clips().at(-1)).toBe('en-GB-cafe-01');
    expect(app.sees(new RegExp(`^${app.c.player.dialog}: ${CAFE_1.prompt}`))).toBe(true);
  });

  it('a grade rates the phrase as the bar does: pending, Undo offered, grades gone from the lock screen', async () => {
    const app = await playSet();
    await app.advance(500);
    device.press({ type: 'rate', grade: 'hard', id: 'cafe-01' });
    await app.advance(0);
    expect(await inWindow(app)).toEqual([['cafe-01', 'hard']]);
    expect(app.sees(app.c.player.undoGrade(app.c.common.grade.hard))).toBe(true);
    expect(app.sees(rateAs(app, 'hard'))).toBe(false);
    expect(shown().grades).toBeNull();
    expect(shown().id).toBe('cafe-01');
  });

  it('rates the same as the bar’s button does', async () => {
    const lock = await playSet();
    await lock.advance(500);
    device.press({ type: 'rate', grade: 'easy', id: 'cafe-01' });
    const fromLock = (await lock.saved()).pending.map(({ phraseId, grade }) => ({ phraseId, grade }));
    lock.unmount();
    device.reset();
    const bar = await playSet();
    await bar.advance(500);
    await bar.tap(rateAs(bar, 'easy'));
    const fromBar = (await bar.saved()).pending.map(({ phraseId, grade }) => ({ phraseId, grade }));
    expect(fromLock).toEqual(fromBar);
    expect(fromLock).toEqual([{ phraseId: 'cafe-01', grade: 'easy' }]);
  });

  it('the Undo in the app takes a lock-screen grade back, and the grades return', async () => {
    const app = await playSet();
    await app.advance(500);
    device.press({ type: 'rate', grade: 'missed', id: 'cafe-01' });
    await app.tap(app.c.player.undoGrade(app.c.common.grade.missed));
    expect(await inWindow(app)).toEqual([]);
    expect(app.sees(rateAs(app, 'missed'))).toBe(true);
    expect(gradeNames()).toEqual(['missed', 'hard', 'easy']);
  });

  it('a grade for a phrase the player has moved past is dropped', async () => {
    const app = await playSet();
    await app.advance(500);
    await app.tap(app.c.player.next);
    await app.advance(500);
    expect(shown().id).toBe('cafe-02');
    device.press({ type: 'rate', grade: 'easy', id: 'cafe-01' });
    await app.advance(0);
    expect(await inWindow(app)).toEqual([]);
    expect(app.sees(rateAs(app, 'easy'))).toBe(true);
    expect(gradeNames()).toEqual(['missed', 'hard', 'easy']);
  });

  it('a grade pressed twice rates once while its window is open', async () => {
    const app = await playSet();
    await app.advance(500);
    device.press({ type: 'rate', grade: 'easy', id: 'cafe-01' });
    device.press({ type: 'rate', grade: 'missed', id: 'cafe-01' });
    expect(await inWindow(app)).toHaveLength(1);
  });
});

describe('in the background', () => {
  it('the loop plays on when the app leaves the screen', async () => {
    const app = await playSet();
    await app.advance(1_000);
    await app.background();
    expect(shown().playing).toBe(true);
    const clips = audio.clips().length;
    await app.advance(30 * SECOND);
    expect(audio.clips().length).toBeGreaterThan(clips);
    expect(shown().playing).toBe(true);
    await app.foreground();
    expect(app.sees(app.c.common.pause)).toBe(true);
  });

  it('presses reach the loop while the app is in the background', async () => {
    const app = await playSet();
    await app.advance(500);
    await app.background();
    device.press({ type: 'next' });
    await app.advance(500);
    expect(shown().id).toBe('cafe-02');
    device.press({ type: 'pause' });
    expect(shown().playing).toBe(false);
  });

  it('coming back to the foreground sends what is shown again', async () => {
    const app = await playSet();
    await app.advance(500);
    await app.background();
    const before = device.lockScreenLog.length;
    await app.foreground();
    await app.advance(0);
    expect(device.lockScreenLog.length).toBeGreaterThan(before);
    expect(device.lockScreenLog.at(-1)).toMatchObject({ id: 'cafe-01', title: CAFE_1.prompt });
    expect(device.nowPlaying).toMatchObject({ id: 'cafe-01', playing: true });
  });
});

describe('a song on the lock screen', () => {
  /** Plays the album from its first song. */
  async function playAlbum(titles?: string[]) {
    const opened = await openAlbum(titles);
    await opened.app.tap(opened.app.c.music.playAlbum);
    await opened.app.advance(1 * SECOND);
    return opened;
  }

  it('shows the song, its album, its place and length, with the grades', async () => {
    const { app } = await playAlbum();
    expect(shown()).toMatchObject({
      title: 'Uno',
      artist: app.c.music.songKind,
      album: 'Mis canciones',
      playing: true,
      canNext: true,
      canPrevious: false,
      hasSilences: false,
      nextLabel: app.c.music.next,
    });
    expect(shown().durationMs).toBeGreaterThanOrEqual(28_000);
    expect(shown().positionMs).toBeGreaterThan(0);
    expect(shown().positionMs).toBeLessThanOrEqual(1_500);
    expect(gradeNames()).toEqual(['missed', 'hard', 'easy']);
  });

  it('follows the app’s pause and play', async () => {
    const { app } = await playAlbum();
    await app.tap(app.c.common.pause);
    expect(shown().playing).toBe(false);
    await app.tap(app.c.common.play);
    await app.advance(500);
    expect(shown().playing).toBe(true);
  });

  it('pause and play from the lock screen stop and start the song', async () => {
    const { app } = await playAlbum();
    device.press({ type: 'pause' });
    await app.advance(0);
    expect(audio.songPlayer()?.playing).toBe(false);
    expect(app.sees(app.c.player.paused)).toBe(true);
    expect(shown().playing).toBe(false);
    device.press({ type: 'play' });
    await app.advance(0);
    expect(audio.songPlayer()?.playing).toBe(true);
    await app.advance(500);
    expect(shown().playing).toBe(true);
  });

  it('next and previous move between the songs', async () => {
    const { app, album } = await playAlbum();
    device.press({ type: 'next' });
    await app.advance(1 * SECOND);
    expect(lastSongId()).toBe(album.songIds[1]);
    expect(shown()).toMatchObject({ title: 'Dos', canNext: true, canPrevious: true });
    expect(app.sees(nowPlaying('Dos'))).toBe(true);
    device.press({ type: 'next' });
    await app.advance(1 * SECOND);
    expect(shown()).toMatchObject({ title: 'Tres', canNext: false, canPrevious: true });
    // Over three seconds in, previous restarts the song; early on, it goes back.
    await app.advance(5 * SECOND);
    device.press({ type: 'previous' });
    await app.advance(1 * SECOND);
    expect(lastSongId()).toBe(album.songIds[2]);
    device.press({ type: 'previous' });
    await app.advance(1 * SECOND);
    expect(lastSongId()).toBe(album.songIds[1]);
    expect(shown().title).toBe('Dos');
  });

  it('a seek moves the song to that place and the lock screen counts from there', async () => {
    const { app } = await playAlbum();
    device.press({ type: 'seek', positionMs: 20_000 });
    await app.advance(1 * SECOND);
    expect(audio.songPlayer()?.currentTime).toBeGreaterThanOrEqual(20);
    expect(audio.songPlayer()?.currentTime).toBeLessThan(23);
    expect(shown().positionMs).toBeGreaterThanOrEqual(20_000);
    expect(shown().positionMs).toBeLessThan(23_000);
  });

  it('sends the song again when it drifts from where the lock screen counts it, not before', async () => {
    const { app } = await playAlbum();
    await app.advance(5 * SECOND);
    const steady = device.lockScreenLog.length;
    // Playing on at its own pace: the system counts it, so nothing is re-sent.
    await app.advance(10 * SECOND);
    expect(device.lockScreenLog.length).toBe(steady);
    device.press({ type: 'seek', positionMs: 25_000 });
    await app.advance(1 * SECOND);
    expect(device.lockScreenLog.length).toBeGreaterThan(steady);
    expect(shown().positionMs).toBeGreaterThanOrEqual(25_000);
  });

  it('a grade rates the phrases the song sings, then offers Undo and takes the grades away', async () => {
    const { app, album } = await playAlbum();
    const id = album.songIds[0];
    expect(shown().id).toBe(id);
    device.press({ type: 'rate', grade: 'hard', id });
    await app.advance(0);
    const pending = (await app.saved()).pending;
    expect(pending).toHaveLength(5);
    expect(pending.every((p) => p.grade === 'hard' && p.songId === id)).toBe(true);
    expect(app.sees(app.c.player.undoGrade(app.c.common.grade.hard))).toBe(true);
    expect(shown().grades).toBeNull();
    await app.tap(app.c.player.undoGrade(app.c.common.grade.hard));
    expect((await app.saved()).pending.filter((p) => !p.undone)).toHaveLength(0);
    expect(gradeNames()).toEqual(['missed', 'hard', 'easy']);
  });

  it('a grade for another song, or for a phrase, is dropped while a song is in front', async () => {
    const { app, album } = await playAlbum();
    device.press({ type: 'rate', grade: 'easy', id: album.songIds[1] });
    device.press({ type: 'rate', grade: 'easy', id: 'cafe-01' });
    await app.advance(0);
    expect((await app.saved()).pending).toHaveLength(0);
  });

  it('a grade for the song left behind is dropped after next', async () => {
    const { app, album } = await playAlbum();
    device.press({ type: 'next' });
    await app.advance(1 * SECOND);
    device.press({ type: 'rate', grade: 'easy', id: album.songIds[0] });
    await app.advance(0);
    expect((await app.saved()).pending).toHaveLength(0);
  });

  it('plays on in the background and takes presses there', async () => {
    const { app, album } = await playAlbum();
    await app.background();
    await app.advance(5 * SECOND);
    expect(audio.songPlayer()?.playing).toBe(true);
    device.press({ type: 'next' });
    await app.advance(1 * SECOND);
    expect(lastSongId()).toBe(album.songIds[1]);
    await app.foreground();
    expect(device.nowPlaying?.title).toBe('Dos');
  });
});

describe('switching between a song and the phrase loop', () => {
  it('a song after the loop shows the song, and the loop after the song shows the loop', async () => {
    const { app } = await openAlbum();
    await app.tap(app.c.music.playAlbum);
    await app.advance(1 * SECOND);
    expect(shown().title).toBe('Uno');
    // A phrase played from its set takes the front again.
    await app.open('/set/set-cafe');
    await app.tap(app.c.set.playAll(SET));
    await app.advance(500);
    expect(shown()).toMatchObject({ id: 'cafe-01', title: CAFE_1.prompt, hasSilences: true, album: SET });
    expect(shown().durationMs).toBeNull();
    expect(audio.songPlayer()?.playing).toBe(false);
  });

  it('pressing play after the song is paused for the loop resumes whichever is in front', async () => {
    const { app } = await openAlbum();
    await app.tap(app.c.music.playAlbum);
    await app.advance(1 * SECOND);
    await app.open('/set/set-cafe');
    await app.tap(app.c.set.playAll(SET));
    await app.advance(500);
    device.press({ type: 'pause' });
    expect(shown().playing).toBe(false);
    device.press({ type: 'play' });
    await app.advance(500);
    expect(shown()).toMatchObject({ id: 'cafe-01', playing: true });
    expect(audio.songPlayer()?.playing).toBe(false);
  });
});
