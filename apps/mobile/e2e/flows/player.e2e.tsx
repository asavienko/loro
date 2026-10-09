// The phrase player (P3-01, P3-31, P2-24, AS-01), driven as a learner drives it.
//
// Covers:
//  - The loop of a phrase: prompt clip, the learner's turn, target clip, echo, three repetitions while
//    new, the hold for a rating, then on; the target hidden until heard (full player and mini player);
//    the steps, the repetition counter and the listened time.
//  - Transport: play/pause/resume from the full player and the mini player; next, previous (restart
//    after a few seconds, previous phrase before them); jumping to a phrase in the set's list; the
//    queue button; closing the paused mini player; opening and closing the full player; the app going
//    to the background pausing playback.
//  - Settings in the transport: speed (clip rate), repetitions (auto/1/3) and their toasts, play mode
//    (again/continue) and its toast; the action row: like, notes, add to set.
//  - Ratings: each grade from the bar over the tabs and from the full player; Undo (bar and player);
//    changing the grade after an undo; the five-minute window and the commit to the log; Missed and
//    Hard bringing a phrase back at the end of the queue; a rated phrase skipping the hold; a rating
//    in the hold moving on with an Undo for the previous phrase; one repetition for a phrase under
//    review; numbers on screen changing only after real ratings.
//  - Audio failures: a clip that never loads, a clip the server is making (then ready), a clip whose
//    making failed, a missing clip (and "show the text anyway").
//  - The end of the queue: one-pass queue (a review) and its panel (play again / next set / close),
//    repeat mode (the pass notice and the next set it offers, its dismiss button), continue mode, the
//    session summary sheet.
import { languageName } from '@shared/copy';
import { phaseStepLabel } from '@shared/ui/phase';
import { GestureDetector, State } from 'react-native-gesture-handler';
import { fireGestureHandler } from 'react-native-gesture-handler/jest-utils';
import { act, audio, DAY, fireEvent, launch, MINUTE, screen, SECOND, type App, type ReactTestInstance } from '../harness';

const SET = 'Café & Mañanas';
const CAFE_1 = { prompt: 'A cortado, please', target: 'Me pone un cortado, por favor' };
const CAFE_2 = { prompt: 'Do you have oat milk?', target: '¿Tienen leche de avena?' };

/** Launches on the café set and starts playing it: the mini player shows. */
async function playSet(options: Parameters<typeof launch>[0] = {}): Promise<App> {
  const app = await launch({ url: '/set/set-cafe', ...options });
  await app.tap(app.c.set.playAll(SET));
  return app;
}

/** Opens the full player from the mini player. */
const openPlayer = (app: App) => app.tap(new RegExp(`^${app.c.player.dialog}`));

/** Plays the set and opens the full player. */
async function playerOpen(options: Parameters<typeof launch>[0] = {}): Promise<App> {
  const app = await playSet(options);
  await openPlayer(app);
  return app;
}

/** Runs fake time on, a tenth of a second at a time, until `name` is on screen. */
async function until(app: App, name: string | RegExp, limitMs = 60 * SECOND): Promise<void> {
  for (let t = 0; !app.sees(name); t += 100) {
    if (t >= limitMs) throw new Error(`Never saw ${String(name)} in ${limitMs} ms`);
    await app.advance(100);
  }
}

const language = (app: App, code: 'en-GB' | 'es-ES') => languageName(code, app.c.locale);
const gradeWord = (app: App, g: 'missed' | 'hard' | 'easy') => app.c.common.grade[g];
/** The grade buttons over the tab bar. */
const barRate = (app: App, g: 'missed' | 'hard' | 'easy') => app.c.player.rateAs(gradeWord(app, g));
const undoRating = /^Undo rating/;

/** What the phone saved that is a committed rating, as [phrase, grade]. */
async function committed(app: App): Promise<[string, string][]> {
  const saved = await app.saved();
  return saved.learner.log.flatMap((e) => (e.kind === 'rated' ? [[e.phraseId, e.grade] as [string, string]] : []));
}
/** The ratings still in their window (undone ones left out), as [phrase, grade]. */
async function inWindow(app: App): Promise<[string, string][]> {
  const saved = await app.saved();
  return saved.pending.filter((p) => !p.undone).map((p) => [p.phraseId, p.grade]);
}

describe('the loop of a phrase', () => {
  it('plays the prompt, waits for the learner, plays the target, waits for the echo', async () => {
    const app = await playerOpen();
    const { c } = app;
    expect(app.pathname()).toBe('/player');
    await app.waitFor(c.player.instruction.native(language(app, 'en-GB')));
    expect(audio.clips()).toEqual(['en-GB-cafe-01']);

    await until(app, c.player.instruction.pause(language(app, 'es-ES')));
    expect(audio.clips()).toEqual(['en-GB-cafe-01']);

    await until(app, c.player.instruction.target(language(app, 'es-ES')));
    expect(audio.clips()).toEqual(['en-GB-cafe-01', 'es-ES-cafe-01']);

    await until(app, c.player.instruction.echo(language(app, 'es-ES')));
    // Then the second repetition begins with the prompt again.
    await until(app, c.player.instruction.native(language(app, 'en-GB')));
    expect(app.sees(c.player.repetition(2, 3))).toBe(true);
    expect(audio.clips()).toEqual(['en-GB-cafe-01', 'es-ES-cafe-01', 'en-GB-cafe-01']);
  });

  it('keeps the target hidden until it has been heard, in the player and in the mini player', async () => {
    const app = await playSet();
    const { c } = app;
    // Mini player first: only the prompt.
    expect(app.sees(new RegExp(`^${c.player.dialog}: ${CAFE_1.prompt}`))).toBe(true);
    await openPlayer(app);
    expect(app.sees(c.player.hidden(language(app, 'es-ES')))).toBe(true);
    expect(app.sees(CAFE_1.target)).toBe(false);
    await until(app, c.player.instruction.pause(language(app, 'es-ES')));
    expect(app.sees(CAFE_1.target)).toBe(false);
    // The target plays and shows from there on.
    await until(app, c.player.instruction.target(language(app, 'es-ES')));
    expect(app.sees(CAFE_1.target)).toBe(true);
    expect(app.sees(c.player.hidden(language(app, 'es-ES')))).toBe(false);
    // The mini player shows it too, once the full player is closed.
    await app.tap(c.player.close);
    expect(app.sees(new RegExp(`^${c.player.dialog}: ${CAFE_1.target}`))).toBe(true);
  });

  it('hides the target again on the next phrase', async () => {
    const app = await playerOpen();
    const { c } = app;
    await until(app, c.player.instruction.target(language(app, 'es-ES')));
    await app.tap(c.player.next);
    expect(app.sees(c.player.hidden(language(app, 'es-ES')))).toBe(true);
    expect(app.sees(CAFE_2.target)).toBe(false);
    expect(app.sees(CAFE_2.prompt)).toBe(true);
  });

  it('shows the four steps, the repetition and the time listened', async () => {
    const app = await playerOpen();
    const { c } = app;
    expect(app.sees(c.player.steps)).toBe(true);
    expect(app.sees(c.player.repetition(1, 3))).toBe(true);
    await app.advance(3_000);
    // The time listened is real: it runs while the phrase plays.
    expect(app.sees(/^0:0[2-3]/)).toBe(true);
    await until(app, c.player.repetition(2, 3));
    expect(app.sees(/^0:0[6-8]/)).toBe(true);
  });

  it('guides a first-time learner with a line while it is their turn', async () => {
    const app = await playerOpen();
    const { c } = app;
    expect(app.sees(c.player.coach)).toBe(false);
    await until(app, c.player.instruction.pause(language(app, 'es-ES')));
    expect(app.sees(c.player.coach)).toBe(true);
    await until(app, c.player.instruction.target(language(app, 'es-ES')));
    expect(app.sees(c.player.coach)).toBe(false);
  });

  it('plays three repetitions while the phrase is new, then holds for a rating, then moves on', async () => {
    const app = await playerOpen();
    const { c } = app;
    await until(app, c.player.instruction.rate);
    expect(app.sees(c.player.repetition(3, 3))).toBe(true);
    expect(audio.clips()).toEqual(Array.from({ length: 3 }, () => ['en-GB-cafe-01', 'es-ES-cafe-01']).flat());
    expect(app.sees(c.player.howDidItGo)).toBe(true);
    // Nobody rated: the hold ends (4 s) and the next phrase starts.
    await until(app, c.player.position(2, 5));
    expect(audio.clips().at(-1)).toBe('en-GB-cafe-02');
    expect(app.sees(CAFE_2.prompt)).toBe(true);
    // Not rating is not a rating.
    expect(await inWindow(app)).toEqual([]);
  });

  it('shows the instruction for the hold only while playing, and "Paused" otherwise', async () => {
    const app = await playerOpen();
    const { c } = app;
    await until(app, c.player.instruction.rate);
    await app.tap(c.common.pause);
    expect(app.sees(c.player.paused)).toBe(true);
    expect(app.sees(c.player.instruction.rate)).toBe(false);
  });
});

describe('play, pause and resume', () => {
  it('pauses and resumes from the full player', async () => {
    const app = await playerOpen();
    const { c } = app;
    await app.advance(500);
    await app.tap(c.common.pause);
    expect(app.sees(c.player.paused)).toBe(true);
    expect(app.sees(c.common.play)).toBe(true);
    const heard = audio.heard.length;
    await app.advance(30 * SECOND);
    expect(audio.heard.length).toBe(heard);
    expect(app.sees(c.player.position(1, 5))).toBe(true);
    await app.tap(c.common.play);
    expect(app.sees(c.common.pause)).toBe(true);
    expect(app.sees(c.player.paused)).toBe(false);
    // The phase plays again from its start, and the loop goes on.
    await until(app, c.player.instruction.target(language(app, 'es-ES')));
    expect(audio.clips()).toContain('es-ES-cafe-01');
  });

  it('pauses and resumes from the mini player', async () => {
    const app = await playSet();
    const { c } = app;
    await app.advance(500);
    expect(app.sees(c.common.pause)).toBe(true);
    await app.tap(c.common.pause);
    expect(app.sees(c.player.paused)).toBe(true);
    const heard = audio.heard.length;
    await app.advance(20 * SECOND);
    expect(audio.heard.length).toBe(heard);
    await app.tap(c.common.play);
    await until(app, c.common.pause);
    await app.advance(10 * SECOND);
    expect(audio.heard.length).toBeGreaterThan(heard);
  });

  it('keeps the mini player in step with the full player', async () => {
    const app = await playerOpen();
    const { c } = app;
    await app.tap(c.common.pause);
    await app.tap(c.player.close);
    expect(app.pathname()).toBe('/set/set-cafe');
    expect(app.sees(c.player.paused)).toBe(true);
    expect(app.sees(c.common.play)).toBe(true);
  });

  it('pauses when the app goes to the background and stays paused when it returns', async () => {
    const app = await playerOpen();
    const { c } = app;
    await app.advance(1_000);
    await app.background();
    expect(app.sees(c.player.paused)).toBe(true);
    const heard = audio.heard.length;
    await app.advance(30 * SECOND);
    expect(audio.heard.length).toBe(heard);
    await app.foreground();
    expect(app.sees(c.player.paused)).toBe(true);
    await app.tap(c.common.play);
    await app.advance(5 * SECOND);
    expect(audio.heard.length).toBeGreaterThan(heard);
  });
});

describe('the mini player', () => {
  it('shows the set playing, with the step it is on, and opens the full player when tapped', async () => {
    const app = await playSet();
    const { c } = app;
    expect(app.pathname()).toBe('/set/set-cafe');
    expect(app.sees(new RegExp(`^${c.player.dialog}: `))).toBe(true);
    await app.advance(500);
    // The step in a word, as the player's steps name it.
    expect(app.sees(phaseStepLabel(c, 'native', 'en-GB', 'es-ES'))).toBe(true);
    await openPlayer(app);
    expect(app.pathname()).toBe('/player');
    await app.waitFor(c.player.position(1, 5));
  });

  it('goes to the next phrase and keeps playing', async () => {
    const app = await playSet();
    const { c } = app;
    await app.advance(500);
    await app.tap(c.player.next);
    await app.advance(500);
    expect(app.sees(new RegExp(`^${c.player.dialog}: ${CAFE_2.prompt}`))).toBe(true);
    expect(audio.clips().at(-1)).toBe('en-GB-cafe-02');
    expect(app.sees(c.common.pause)).toBe(true);
  });

  it('closes when paused: the queue goes, its ratings stay', async () => {
    const app = await playSet();
    const { c } = app;
    // Playing, the bar cannot be closed.
    expect(app.sees(c.player.close)).toBe(false);
    await app.advance(500);
    await app.tap(barRate(app, 'easy'));
    await app.tap(c.common.pause);
    await app.tap(c.player.close);
    expect(app.sees(new RegExp(`^${c.player.dialog}`))).toBe(false);
    expect(app.sees(c.common.play)).toBe(false);
    expect(await inWindow(app)).toEqual([['cafe-01', 'easy']]);
  });

  it('shows the pause and the step on the bar as the loop moves', async () => {
    const app = await playSet();
    const { c } = app;
    expect(app.sees(phaseStepLabel(c, 'native', 'en-GB', 'es-ES'))).toBe(true);
    await until(app, phaseStepLabel(c, 'target', 'en-GB', 'es-ES'));
    // Playing the target: the bar names the step in a word, with its target now heard.
    expect(app.sees(new RegExp(`^${c.player.dialog}: ${CAFE_1.target}`))).toBe(true);
    expect(app.sees(c.common.pause)).toBe(true);
  });
});

describe('moving in the queue', () => {
  it('goes to the next phrase from the full player, and plays its prompt', async () => {
    const app = await playerOpen();
    const { c } = app;
    await app.advance(500);
    await app.tap(c.player.next);
    expect(app.sees(c.player.position(2, 5))).toBe(true);
    expect(app.sees(CAFE_2.prompt)).toBe(true);
    await app.advance(500);
    expect(audio.clips().at(-1)).toBe('en-GB-cafe-02');
    expect(app.sees(c.player.repetition(1, 3))).toBe(true);
  });

  it('goes to the previous phrase when pressed within three seconds of the start', async () => {
    const app = await playerOpen();
    const { c } = app;
    await app.tap(c.player.next);
    await app.advance(1_000);
    expect(app.sees(c.player.position(2, 5))).toBe(true);
    await app.tap(c.player.previous);
    expect(app.sees(c.player.position(1, 5))).toBe(true);
    await app.advance(500);
    expect(audio.clips().at(-1)).toBe('en-GB-cafe-01');
  });

  it('restarts the phrase when pressed after three seconds of listening', async () => {
    const app = await playerOpen();
    const { c } = app;
    await app.tap(c.player.next);
    await until(app, c.player.instruction.target(language(app, 'es-ES')));
    expect(app.sees(CAFE_2.target)).toBe(true);
    const before = audio.clips().length;
    await app.tap(c.player.previous);
    // Still the second phrase, from its prompt: the target is hidden again.
    expect(app.sees(c.player.position(2, 5))).toBe(true);
    expect(app.sees(CAFE_2.target)).toBe(false);
    expect(app.sees(c.player.repetition(1, 3))).toBe(true);
    await app.advance(500);
    expect(audio.clips().length).toBe(before + 1);
    expect(audio.clips().at(-1)).toBe('en-GB-cafe-02');
  });

  it('restarts the first phrase from the top, wherever it is, rather than going before it', async () => {
    const app = await playerOpen();
    const { c } = app;
    await app.advance(500);
    await app.tap(c.player.previous);
    expect(app.sees(c.player.position(1, 5))).toBe(true);
    await app.advance(500);
    expect(audio.clips()).toEqual(['en-GB-cafe-01', 'en-GB-cafe-01']);
  });

  it('keeps pause when moving: next on a paused player stays paused', async () => {
    const app = await playerOpen();
    const { c } = app;
    await app.tap(c.common.pause);
    await app.tap(c.player.next);
    expect(app.sees(c.player.position(2, 5))).toBe(true);
    expect(app.sees(c.player.paused)).toBe(true);
    const heard = audio.heard.length;
    await app.advance(10 * SECOND);
    expect(audio.heard.length).toBe(heard);
  });

  it('jumps to a phrase tapped in the set list', async () => {
    const app = await playSet();
    const { c } = app;
    await app.advance(500);
    await app.tap(CAFE_2.prompt);
    await app.advance(500);
    // The set page's row plays that phrase.
    expect(audio.clips().at(-1)).toBe('en-GB-cafe-02');
    await openPlayer(app);
    expect(app.sees(c.player.position(2, 5))).toBe(true);
  });

  it('opens the queue from the player and plays a phrase from it', async () => {
    const app = await playerOpen();
    const { c } = app;
    await app.tap(c.player.openQueue);
    expect(app.pathname()).toBe('/queue');
    await app.tap(c.queue.playNow(CAFE_2.prompt));
    await app.advance(500);
    expect(audio.clips().at(-1)).toBe('en-GB-cafe-02');
    await app.back();
    expect(app.sees(c.player.position(2, 5))).toBe(true);
  });
});

describe('closing the player', () => {
  it('closes the full player with its button and leaves the mini player playing', async () => {
    const app = await playerOpen();
    const { c } = app;
    await app.tap(c.player.close);
    expect(app.pathname()).toBe('/set/set-cafe');
    expect(app.sees(c.common.pause)).toBe(true);
    await app.advance(10 * SECOND);
    expect(audio.clips()).toContain('es-ES-cafe-01');
  });

  it('closes with the back gesture too', async () => {
    const app = await playerOpen();
    await app.back();
    expect(app.pathname()).toBe('/set/set-cafe');
  });

  it('opens straight on the player with nothing queued, offering only the way out', async () => {
    const app = await launch({ url: '/player' });
    const { c } = app;
    expect(app.sees(c.player.close)).toBe(true);
    expect(app.sees(c.common.play)).toBe(false);
    await app.tap(c.player.close);
    expect(app.pathname()).toBe('/');
  });
});

describe('the action row', () => {
  it('steps the speed through its settings, and the clips play at that rate', async () => {
    const app = await playerOpen();
    const { c } = app;
    expect(app.sees('1×')).toBe(true);
    await app.tap(c.player.speedIs(1));
    expect(app.sees('1.25×')).toBe(true);
    expect((await app.saved()).prefs.speed).toBe(1.25);
    await app.tap(c.player.speedIs(1.25));
    expect(app.sees('0.8×')).toBe(true);
    await app.tap(c.player.speedIs(0.8));
    expect(app.sees('1×')).toBe(true);
  });

  it('plays the next clips at the chosen speed', async () => {
    const app = await playerOpen();
    const { c } = app;
    await app.tap(c.player.speedIs(1));
    await app.tap(c.player.next);
    await app.advance(8 * SECOND);
    const rates = audio.heard.filter((h) => h.kind === 'clip').map((h) => h.rate);
    expect(rates[0]).toBe(1);
    expect(rates.slice(1).every((r) => r === 1.25)).toBe(true);
    expect(rates.length).toBeGreaterThan(1);
  });

  it('likes a phrase and takes the like back', async () => {
    const app = await playerOpen();
    const { c } = app;
    const checked = () => Boolean(screen.getByLabelText(c.phrase.likeLabel).props.accessibilityState?.checked);
    const liked = async () => (await app.saved()).learner.likes['phrase:cafe-01']?.liked ?? false;
    expect(checked()).toBe(false);
    await app.tap(c.phrase.likeLabel);
    expect(checked()).toBe(true);
    expect(await liked()).toBe(true);
    await app.tap(c.phrase.likeLabel);
    expect(checked()).toBe(false);
    expect(await liked()).toBe(false);
  });

  it('opens the notes for the phrase and closes them', async () => {
    const app = await playerOpen();
    const { c } = app;
    // The button is only labelled; the sheet it opens has the title as text.
    expect(screen.queryAllByText(c.phrase.notesTitle)).toHaveLength(0);
    await app.tap(c.phrase.notesTitle);
    expect(screen.queryAllByText(c.phrase.notesTitle).length).toBeGreaterThan(0);
    await app.tap(c.common.close);
    expect(screen.queryAllByText(c.phrase.notesTitle)).toHaveLength(0);
  });

  it('opens the add-to-set sheet for the phrase', async () => {
    const app = await playerOpen();
    const { c } = app;
    await app.tap(c.phrase.addToSet);
    expect(app.sees(c.addToSet.title)).toBe(true);
  });
});

describe('the transport settings', () => {
  it('steps the repetitions auto → 1 → 3 → auto, saying what each does', async () => {
    const app = await playerOpen();
    const { c } = app;
    await app.tap(c.player.repeats.auto);
    expect(app.sees(c.player.repeatsToast.one)).toBe(true);
    expect(app.sees(c.player.repeats.one)).toBe(true);
    expect((await app.saved()).prefs.repeats).toBe(1);
    await app.tap(c.player.repeats.one);
    expect(app.sees(c.player.repeatsToast.three)).toBe(true);
    expect((await app.saved()).prefs.repeats).toBe(3);
    await app.tap(c.player.repeats.three);
    expect(app.sees(c.player.repeatsToast.auto)).toBe(true);
    expect((await app.saved()).prefs.repeats).toBe('auto');
  });

  it('plays a phrase once when repetitions is 1, and the counter says so', async () => {
    const app = await playerOpen({ learner: { prefs: { repeats: 1 } } });
    const { c } = app;
    expect(app.sees(c.player.repetition(1, 1))).toBe(true);
    await until(app, c.player.instruction.rate);
    expect(audio.clips()).toEqual(['en-GB-cafe-01', 'es-ES-cafe-01']);
  });

  it('applies a new repetitions setting to the phrase playing now', async () => {
    const app = await playerOpen();
    const { c } = app;
    expect(app.sees(c.player.repetition(1, 3))).toBe(true);
    await app.tap(c.player.repeats.auto);
    expect(app.sees(c.player.repetition(1, 1))).toBe(true);
  });

  it('toggles the play mode between again and continue, saying what each does', async () => {
    const app = await playerOpen();
    const { c } = app;
    // The default is to play the queue again.
    expect(app.sees(c.player.captions.again)).toBe(true);
    await app.tap(c.player.playMode.repeat);
    expect(app.sees(c.player.playModeToast.continue)).toBe(true);
    expect(app.sees(c.player.captions.continue)).toBe(true);
    expect((await app.saved()).prefs.playMode).toBe('continue');
    await app.tap(c.player.playMode.continue);
    expect(app.sees(c.player.playModeToast.repeat)).toBe(true);
    expect((await app.saved()).prefs.playMode).toBe('repeat');
  });
});

describe('rating from the bar over the tabs', () => {
  it('offers the three grades while a phrase plays', async () => {
    const app = await playSet();
    await app.advance(500);
    for (const g of ['missed', 'hard', 'easy'] as const) expect(app.sees(barRate(app, g))).toBe(true);
  });

  it.each(['missed', 'hard', 'easy'] as const)('rates a phrase %s and keeps the rating in its window', async (grade) => {
    const app = await playSet();
    await app.advance(500);
    await app.tap(barRate(app, grade));
    expect(await inWindow(app)).toEqual([['cafe-01', grade]]);
    // The grade given turns into Undo; the others make way.
    expect(app.sees(app.c.player.undoGrade(gradeWord(app, grade)))).toBe(true);
    for (const other of ['missed', 'hard', 'easy'] as const) expect(app.sees(barRate(app, other))).toBe(false);
  });

  it('takes the rating back with Undo', async () => {
    const app = await playSet();
    await app.advance(500);
    await app.tap(barRate(app, 'hard'));
    await app.tap(app.c.player.undoGrade(gradeWord(app, 'hard')));
    expect(await inWindow(app)).toEqual([]);
    // The grades come back.
    expect(app.sees(barRate(app, 'easy'))).toBe(true);
    await app.skip(10 * MINUTE);
    expect(await committed(app)).toEqual([]);
  });

  it('can be rated again after an undo, with another grade', async () => {
    const app = await playSet();
    await app.advance(500);
    await app.tap(barRate(app, 'easy'));
    await app.tap(app.c.player.undoGrade(gradeWord(app, 'easy')));
    await app.tap(barRate(app, 'missed'));
    expect(await inWindow(app)).toEqual([['cafe-01', 'missed']]);
  });

  it('offers Undo for a few seconds, then steps aside until the window is over', async () => {
    const app = await playSet();
    await app.advance(500);
    await app.tap(barRate(app, 'easy'));
    await app.advance(3 * SECOND);
    expect(app.sees(app.c.player.undoGrade(gradeWord(app, 'easy')))).toBe(true);
    await app.advance(2 * SECOND);
    expect(app.sees(app.c.player.undoGrade(gradeWord(app, 'easy')))).toBe(false);
    expect(app.sees(barRate(app, 'easy'))).toBe(false);
    // The rating stands, uncommitted, and the grades return when its five minutes are up.
    expect(await inWindow(app)).toEqual([['cafe-01', 'easy']]);
  });
});

describe('rating from the full player', () => {
  it('shows the three grades with a line saying when to rate', async () => {
    const app = await playerOpen();
    const { c } = app;
    for (const g of ['missed', 'hard', 'easy'] as const) expect(app.sees(gradeWord(app, g))).toBe(true);
    expect(app.sees(c.player.rateAfterTurn)).toBe(true);
    await until(app, c.player.instruction.target(language(app, 'es-ES')));
    expect(app.sees(c.player.howDidItGo)).toBe(true);
  });

  it.each([
    ['easy', 'scheduled'],
    ['hard', 'backLater'],
    ['missed', 'backLater'],
  ] as const)('rates %s: shows the grade, what it did and Undo', async (grade, says) => {
    const app = await playerOpen();
    const { c } = app;
    await app.advance(500);
    await app.tap(gradeWord(app, grade));
    expect(app.sees(c.player.ratedAs(gradeWord(app, grade)))).toBe(true);
    expect(app.sees(c.player[says])).toBe(true);
    expect(app.sees(undoRating)).toBe(true);
    expect(app.sees(gradeWord(app, 'easy'))).toBe(false);
    expect(await inWindow(app)).toEqual([['cafe-01', grade]]);
  });

  it('counts the window down on the Undo button', async () => {
    const app = await playerOpen();
    await app.advance(500);
    await app.tap(gradeWord(app, 'easy'));
    await app.advance(2_000);
    expect(app.sees(/^Undo rating \(4:5\d left\)/)).toBe(true);
    await app.skip(2 * MINUTE);
    expect(app.sees(/^Undo rating \(2:5\d left\)/)).toBe(true);
  });

  it('undoes a rating, and the grades come back', async () => {
    const app = await playerOpen();
    const { c } = app;
    await app.advance(500);
    await app.tap(gradeWord(app, 'easy'));
    await app.tap(undoRating);
    expect(app.sees(c.player.ratedAs(gradeWord(app, 'easy')))).toBe(false);
    expect(app.sees(gradeWord(app, 'easy'))).toBe(true);
    expect(await inWindow(app)).toEqual([]);
  });

  it('commits the rating to the log once its five minutes are up', async () => {
    const app = await playerOpen();
    await app.advance(500);
    await app.tap(gradeWord(app, 'easy'));
    await app.skip(4 * MINUTE);
    expect(await committed(app)).toEqual([]);
    expect(await inWindow(app)).toEqual([['cafe-01', 'easy']]);
    await app.skip(2 * MINUTE);
    // The phrase has moved on by now; its rating is committed at its original time.
    const saved = await app.saved();
    expect(saved.pending.filter((p) => p.phraseId === 'cafe-01')).toEqual([]);
    expect(await committed(app)).toEqual([['cafe-01', 'easy']]);
  });

  it('lets the rating stand once undo has run out: the panel goes when the window does', async () => {
    const app = await playerOpen();
    await app.advance(500);
    await app.tap(gradeWord(app, 'easy'));
    await app.skip(5 * MINUTE + SECOND);
    expect(app.sees(undoRating)).toBe(false);
  });

  it('keeps playing the rest of the phrase after a rating, then skips the hold', async () => {
    const app = await playerOpen({ learner: { prefs: { repeats: 1 } } });
    const { c } = app;
    await app.advance(500);
    await app.tap(gradeWord(app, 'easy'));
    // Still the first phrase, still playing.
    expect(app.sees(c.player.position(1, 5))).toBe(true);
    await until(app, c.player.instruction.echo(language(app, 'es-ES')));
    await app.advance(2_000);
    // No hold: rated, so on to the second phrase at once.
    expect(app.sees(c.player.instruction.rate)).toBe(false);
    expect(app.sees(c.player.position(2, 5))).toBe(true);
  });

  it('moves on at once when rated during the hold, and offers Undo for that phrase on the next', async () => {
    const app = await playerOpen({ learner: { prefs: { repeats: 1 } } });
    const { c } = app;
    await until(app, c.player.instruction.rate);
    await app.tap(gradeWord(app, 'easy'));
    expect(app.sees(c.player.position(2, 5))).toBe(true);
    expect(app.sees(c.player.ratedPrevious(gradeWord(app, 'easy')))).toBe(true);
    await app.tap(c.common.undo);
    expect(await inWindow(app)).toEqual([]);
    expect(app.sees(c.player.ratedPrevious(gradeWord(app, 'easy')))).toBe(false);
  });

  it('brings a Missed phrase back at the end of the queue; an Easy one does not come back', async () => {
    const app = await playerOpen();
    const { c } = app;
    await app.advance(500);
    expect(app.sees(c.player.position(1, 5))).toBe(true);
    await app.tap(gradeWord(app, 'missed'));
    expect(app.sees(c.player.position(1, 6))).toBe(true);
    await app.tap(undoRating);
    await app.tap(gradeWord(app, 'easy'));
    expect(app.sees(c.player.position(1, 6))).toBe(true);
  });

  it('does not bring the last phrase of the queue back when missed', async () => {
    const app = await playerOpen();
    const { c } = app;
    for (let i = 0; i < 4; i++) await app.tap(c.player.next);
    expect(app.sees(c.player.position(5, 5))).toBe(true);
    await app.advance(500);
    await app.tap(gradeWord(app, 'missed'));
    expect(app.sees(c.player.position(5, 5))).toBe(true);
    expect(app.sees(c.player.backLater)).toBe(false);
  });
});

describe('numbers shown change only after real ratings', () => {
  it('counts a phrase as learned only once it is rated and the window has closed', async () => {
    const app = await playSet();
    const { c } = app;
    const summary = (learned: number) => c.set.summary(5, learned, 0);
    await app.advance(500);
    expect(app.sees(summary(0))).toBe(true);
    // Listening alone changes nothing.
    await app.advance(10 * SECOND);
    expect(app.sees(summary(0))).toBe(true);
    await app.tap(barRate(app, 'easy'));
    expect(app.sees(summary(0))).toBe(true);
    await app.skip(6 * MINUTE);
    await app.advance(20 * SECOND);
    expect(await committed(app)).toEqual([['cafe-01', 'easy']]);
  });

  it('ranks an undone rating as nothing: no log entry, no change', async () => {
    const app = await playSet();
    await app.advance(500);
    await app.tap(barRate(app, 'easy'));
    await app.tap(app.c.player.undoGrade(gradeWord(app, 'easy')));
    await app.skip(10 * MINUTE);
    expect(await committed(app)).toEqual([]);
    expect(app.sees(app.c.set.summary(5, 0, 0))).toBe(true);
  });
});

describe('a phrase under review', () => {
  it('plays once, not three times, after it has stuck', async () => {
    const app = await playSet();
    const { c } = app;
    await app.advance(500);
    await app.tap(barRate(app, 'easy'));
    await app.tap(c.common.pause);
    await app.tap(c.player.close);
    await app.skip(6 * MINUTE + DAY);
    // Play it again, a day on.
    await app.tap(c.set.playAll(SET));
    await openPlayer(app);
    expect(app.sees(c.player.repetition(1, 1))).toBe(true);
  });

  it('plays three times again if the last rating was Missed', async () => {
    const app = await playSet();
    const { c } = app;
    await app.advance(500);
    await app.tap(barRate(app, 'missed'));
    await app.tap(c.common.pause);
    await app.tap(c.player.close);
    await app.skip(6 * MINUTE + DAY);
    await app.tap(c.set.playAll(SET));
    await openPlayer(app);
    expect(app.sees(c.player.repetition(1, 3))).toBe(true);
  });
});

describe('when a recording cannot be played', () => {
  it('pauses with a message when a clip never loads, and says it on the bar', async () => {
    audio.silent.add('en-GB-cafe-01');
    const app = await playerOpen();
    const { c } = app;
    await app.advance(6 * SECOND);
    expect(app.sees(c.player.audioSilent)).toBe(true);
    expect(app.sees(c.player.paused)).toBe(false);
    expect(app.sees(c.common.play)).toBe(true);
    await app.tap(c.player.close);
    expect(app.sees(c.player.silent)).toBe(true);
  });

  it('plays on when Play is pressed and the clip loads this time', async () => {
    audio.silent.add('en-GB-cafe-01');
    const app = await playerOpen();
    const { c } = app;
    await app.advance(6 * SECOND);
    audio.silent.clear();
    await app.tap(c.common.play);
    expect(app.sees(c.player.audioSilent)).toBe(false);
    await app.advance(500);
    expect(audio.clips()).toEqual(['en-GB-cafe-01']);
  });

  it('says the recording is being made, then plays it when it is ready', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    app.api.clips.set('en-GB-cafe-01.mp3', 'rendering');
    await app.tap(c.set.playAll(SET));
    await openPlayer(app);
    await app.advance(2 * SECOND);
    expect(app.sees(c.player.makingAudio(language(app, 'en-GB')))).toBe(true);
    expect(audio.clips()).toEqual([]);
    app.api.clips.set('en-GB-cafe-01.mp3', 'ready');
    await until(app, c.player.instruction.native(language(app, 'en-GB')), 30 * SECOND);
    expect(app.sees(c.player.makingAudio(language(app, 'en-GB')))).toBe(false);
    await app.advance(500);
    expect(audio.clips()).toEqual(['en-GB-cafe-01']);
  });

  it('says so on the bar while a recording is being made', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    app.api.clips.set('en-GB-cafe-01.mp3', 'rendering');
    await app.tap(app.c.set.playAll(SET));
    await app.advance(2 * SECOND);
    expect(app.sees(app.c.player.making)).toBe(true);
  });

  it('pauses with the "couldn’t be made" message when the server fails to make a clip', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    app.api.clips.set('en-GB-cafe-01.mp3', 'failed');
    await app.tap(c.set.playAll(SET));
    await openPlayer(app);
    await app.advance(2 * SECOND);
    expect(app.sees(c.player.audioUnmade(language(app, 'en-GB')))).toBe(true);
    await app.tap(c.player.close);
    expect(app.sees(c.player.unmade)).toBe(true);
  });

  it('pauses with the message when the connection is lost before a clip can be had', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    app.api.offline = true;
    await app.tap(c.set.playAll(SET));
    await openPlayer(app);
    await app.advance(2 * SECOND);
    expect(app.sees(c.player.audioSilent)).toBe(true);
    expect(app.sees(c.common.play)).toBe(true);
    expect(audio.clips()).toEqual([]);
  });

  it('gives up with the "couldn’t be made" message when a recording is never made', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    const { c } = app;
    app.api.clips.set('en-GB-cafe-01.mp3', 'rendering');
    await app.tap(c.set.playAll(SET));
    await openPlayer(app);
    await app.advance(2 * SECOND);
    expect(app.sees(c.player.makingAudio(language(app, 'en-GB')))).toBe(true);
    await until(app, c.player.audioUnmade(language(app, 'en-GB')), 5 * MINUTE);
    expect(app.sees(c.player.makingAudio(language(app, 'en-GB')))).toBe(false);
    expect(app.sees(c.common.play)).toBe(true);
  });

  it('plays a clip the server has no state for, as an older server would have it', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    app.api.clips.set('en-GB-cafe-01.mp3', 'missing');
    await app.tap(app.c.set.playAll(SET));
    await app.advance(500);
    expect(audio.clips()).toEqual(['en-GB-cafe-01']);
    expect(app.sees(app.c.common.pause)).toBe(true);
  });

  it('offers to show the text anyway when the target clip could not be made', async () => {
    const app = await launch({ url: '/set/set-cafe', learner: { prefs: { repeats: 1 } } });
    const { c } = app;
    app.api.clips.set('es-ES-cafe-01.mp3', 'failed');
    await app.tap(c.set.playAll(SET));
    await openPlayer(app);
    await until(app, c.player.audioUnmade(language(app, 'es-ES')), 30 * SECOND);
    expect(app.sees(CAFE_1.target)).toBe(false);
    await app.tap(c.player.showText(language(app, 'es-ES')));
    expect(app.sees(CAFE_1.target)).toBe(true);
    expect(app.sees(c.player.showText(language(app, 'es-ES')))).toBe(false);
  });
});

describe('the end of the queue: a set that plays again, or on', () => {
  /** Plays the five phrases through with Next, the player open. */
  async function toTheEnd(app: App) {
    for (let i = 0; i < 5; i++) await app.tap(app.c.player.next);
  }

  it('starts again from the first phrase in repeat mode and says the pass is over', async () => {
    const app = await playerOpen({ learner: { prefs: { repeats: 1 } } });
    const { c } = app;
    for (let i = 0; i < 4; i++) await app.tap(c.player.next);
    expect(app.sees(c.player.position(5, 5))).toBe(true);
    expect(app.sees(c.player.pass.title)).toBe(false);
    await app.tap(c.player.next);
    expect(app.sees(c.player.position(1, 5))).toBe(true);
    expect(app.sees(c.player.pass.title)).toBe(true);
    expect(app.sees(c.player.pass.again)).toBe(true);
    await app.advance(500);
    expect(audio.clips().at(-1)).toBe('en-GB-cafe-01');
  });

  it('offers the next set at the end of a pass, and plays it', async () => {
    const app = await playerOpen({ learner: { prefs: { repeats: 1 } } });
    const { c } = app;
    await toTheEnd(app);
    const offer = String(screen.queryAllByText(/^Next set: /)[0]?.props.children);
    expect(offer).toBeTruthy();
    const next = offer.replace('Next set: ', '');
    // The set the notice offers is not the one just played.
    expect(next).not.toBe(SET);
    await app.tap(offer);
    expect(app.sees(c.player.pass.title)).toBe(false);
    expect(app.sees(c.player.position(1, 5)) || app.sees(/^1 of \d+$/)).toBe(true);
    expect(app.sees(next)).toBe(true);
    await app.advance(500);
    expect(audio.clips().at(-1)).toMatch(/^en-GB-/);
    expect(audio.clips().at(-1)).not.toBe('en-GB-cafe-01');
  });

  it('dismisses the pass notice', async () => {
    const app = await playerOpen({ learner: { prefs: { repeats: 1 } } });
    const { c } = app;
    await toTheEnd(app);
    expect(app.sees(c.player.pass.title)).toBe(true);
    await app.tap(c.toast.dismiss);
    expect(app.sees(c.player.pass.title)).toBe(false);
  });

  it('says the pass is over on the bar, with a button for the way on, when the player is closed', async () => {
    const app = await playerOpen({ learner: { prefs: { repeats: 1 } } });
    const { c } = app;
    await app.tap(c.player.close);
    await toTheEnd(app);
    expect(app.sees(/^Next set: /)).toBe(true);
    await app.tap(/^Next set: /);
    expect(app.sees(/^Next set: /)).toBe(false);
  });

  it('goes on to the next set’s phrases in continue mode instead of starting again', async () => {
    const app = await playerOpen({ learner: { prefs: { repeats: 1, playMode: 'continue' } } });
    const { c } = app;
    await toTheEnd(app);
    expect(app.sees(c.player.positionInQueue(6, 10))).toBe(true);
    expect(app.sees(c.player.pass.next('Tapas & Tabernas'))).toBe(true);
    await app.advance(500);
    expect(audio.clips().at(-1)).toBe('en-GB-tapas-01');
  });

  it('opens the session summary from the pass notice', async () => {
    const app = await playerOpen({ learner: { prefs: { repeats: 1, playMode: 'continue' } } });
    const { c } = app;
    await toTheEnd(app);
    await app.tap(c.player.summary);
    expect(app.sees(c.summary.title)).toBe(true);
  });
});

describe('the session summary', () => {
  it('says nothing was played when nothing has been heard yet', async () => {
    const app = await playerOpen();
    const { c } = app;
    await app.tap(c.player.openQueue);
    await app.tap(c.summary.title);
    expect(app.sees(c.summary.none)).toBe(true);
    expect(app.sees(c.summary.ratings)).toBe(false);
  });

  it('counts what was heard and rated, and says the ratings are still changeable', async () => {
    const app = await playerOpen({ learner: { prefs: { repeats: 1 } } });
    const { c } = app;
    await until(app, c.player.instruction.echo(language(app, 'es-ES')));
    await app.tap(gradeWord(app, 'hard'));
    await app.tap(c.player.openQueue);
    await app.tap(c.summary.title);
    expect(app.sees(c.summary.none)).toBe(false);
    expect(app.sees(c.summary.phrases)).toBe(true);
    expect(app.sees(c.summary.repetitions)).toBe(true);
    // Missed 0 · Hard 1 · Easy 0 (the spaces are no-break).
    expect(app.sees(new RegExp(`${gradeWord(app, 'missed')}\\s0.+${gradeWord(app, 'hard')}\\s1.+${gradeWord(app, 'easy')}\\s0`))).toBe(true);
    expect(app.sees(c.summary.pending(1))).toBe(true);
    expect(app.sees(c.summary.points)).toBe(true);
  });
});

describe('the end of a review', () => {
  /** Rates two phrases, lets a day pass, and plays the review from Home: two phrases, played once. */
  async function review(): Promise<App> {
    const app = await playSet({ learner: { prefs: { repeats: 1 } } });
    const { c } = app;
    await app.advance(500);
    await app.tap(barRate(app, 'hard'));
    await app.tap(c.player.next);
    await app.tap(barRate(app, 'missed'));
    await app.tap(c.common.pause);
    await app.tap(c.player.close);
    await app.skip(DAY);
    await app.open('/');
    await app.tap(c.home.playPhrases(2));
    return app;
  }

  it('stops after the last phrase on a panel with its figures and the way on', async () => {
    const app = await review();
    const { c } = app;
    expect(app.sees(c.player.position(1, 2))).toBe(true);
    await app.tap(c.player.next);
    expect(app.sees(c.player.position(2, 2))).toBe(true);
    await app.tap(gradeWord(app, 'easy'));
    await app.tap(c.player.next);
    expect(app.sees(c.player.end.reviewTitle)).toBe(true);
    expect(app.sees(new RegExp(`^${c.player.end.rated(1)}`))).toBe(true);
    // The transport and the grades give way to the panel.
    expect(app.sees(c.player.next)).toBe(false);
    expect(app.sees(gradeWord(app, 'easy'))).toBe(false);
    expect(app.sees(c.player.end.continueSet(SET))).toBe(true);
    expect(app.sees(c.player.pass.title)).toBe(false);
  });

  it('says only "Played through" when nothing was rated', async () => {
    const app = await review();
    const { c } = app;
    await app.tap(c.player.next);
    await app.tap(c.player.next);
    expect(app.sees(c.player.end.playedThrough)).toBe(true);
    expect(app.sees(c.player.end.reviewTitle)).toBe(false);
  });

  it('closes the player from the panel', async () => {
    const app = await review();
    const { c } = app;
    await app.tap(c.player.next);
    await app.tap(c.player.next);
    await app.tap(c.common.close);
    expect(app.pathname()).not.toBe('/player');
  });

  it('goes on to the set that was being learned from the panel', async () => {
    const app = await review();
    const { c } = app;
    await app.tap(c.player.next);
    await app.tap(c.player.next);
    await app.tap(c.player.end.continueSet(SET));
    expect(app.sees(c.player.end.reviewTitle)).toBe(false);
    expect(app.sees(c.common.pause)).toBe(true);
    expect(app.sees(c.player.paused)).toBe(false);
  });

  it('shows the end on the bar as well, and Play replays the last phrase', async () => {
    const app = await review();
    const { c } = app;
    await app.tap(c.player.close);
    await app.tap(c.player.next);
    await app.tap(c.player.next);
    expect(app.sees(c.player.end.playedThrough)).toBe(true);
    await app.tap(c.common.play);
    expect(app.sees(c.common.pause)).toBe(true);
    expect(app.sees(c.player.end.playedThrough)).toBe(false);
  });
});

describe('gestures', () => {
  it('pulling the full player down closes it', async () => {
    const app = await playerOpen();
    await app.swipe(app.c.player.close, { dy: 400 });
    expect(app.pathname()).toBe('/set/set-cafe');
  });

  describe('swiping the mini player', () => {
    const bar = (app: App) => new RegExp(`^${app.c.player.dialog}`);
    const titled = (app: App, p: { prompt: string }) => new RegExp(`^${app.c.player.dialog}: ${p.prompt}`);

    it('swipes left to the next phrase and right back to the previous one', async () => {
      const app = await playSet();
      await app.advance(500);
      await app.swipe(bar(app), { dx: -300 }, { gesture: 0 });
      await app.advance(3_000);
      expect(app.sees(titled(app, CAFE_2))).toBe(true);
      expect(audio.clips().at(-1)).toBe('en-GB-cafe-02');
      await app.swipe(bar(app), { dx: 300 }, { gesture: 0 });
      await app.advance(3_000);
      expect(app.sees(titled(app, CAFE_1))).toBe(true);
      expect(audio.clips().at(-1)).toBe('en-GB-cafe-01');
    });

    it('springs back from a short swipe, staying on the phrase', async () => {
      const app = await playSet();
      await app.advance(500);
      await app.swipe(bar(app), { dx: -20 }, { gesture: 0 });
      await app.advance(3_000);
      expect(app.sees(titled(app, CAFE_1))).toBe(true);
      expect(audio.clips()).not.toContain('en-GB-cafe-02');
    });

    it('does not go before the first phrase', async () => {
      const app = await playSet();
      await app.advance(500);
      await app.swipe(bar(app), { dx: 300 }, { gesture: 0 });
      await app.advance(3_000);
      expect(app.sees(titled(app, CAFE_1))).toBe(true);
      await openPlayer(app);
      expect(app.sees(app.c.player.position(1, 5))).toBe(true);
    });

    it('keeps a paused player paused when swiped to the next phrase', async () => {
      const app = await playSet();
      await app.tap(app.c.common.pause);
      await app.swipe(bar(app), { dx: -300 }, { gesture: 0 });
      await app.advance(3_000);
      expect(app.sees(titled(app, CAFE_2))).toBe(true);
      expect(app.sees(app.c.player.paused)).toBe(true);
    });
  });
  it.todo('tapping the open picture again closes it (needs the scroll back to the top to finish, which Node does not run)');

  it('dragging the paused mini player down closes it', async () => {
    const app = await playSet();
    const { c } = app;
    await app.tap(c.common.pause);
    await app.swipe(new RegExp(`^${c.player.dialog}`), { dy: 300 }, { gesture: 1 });
    expect(app.sees(new RegExp(`^${c.player.dialog}`))).toBe(false);
  });

  describe('the picture', () => {
    /** The phrase picture's frame is the last gesture in the player; opened, the page keeps room for it. */
    const frame = () => screen.UNSAFE_root.findAll((n: ReactTestInstance) => n.type === GestureDetector).at(-1)!;
    const opened = () => {
      const page = screen.UNSAFE_root.findAll((n: ReactTestInstance) => typeof n.props.onContentSizeChange === 'function')[0];
      return Boolean(page.props.contentContainerStyle[2]);
    };

    it('opens full width when tapped', async () => {
      const app = await playerOpen();
      expect(opened()).toBe(false);
      const press = () => frame().findAll((n: ReactTestInstance) => typeof n.props.onPress === 'function')[0];
      await act(async () => fireEvent.press(press()));
      await app.settle();
      expect(opened()).toBe(true);
    });

    it('opens when pulled down', async () => {
      const app = await playerOpen();
      const at = (f: number) => ({
        translationX: 0,
        translationY: 300 * f,
        x: 0,
        y: 300 * f,
        absoluteX: 0,
        absoluteY: 300 * f,
        velocityX: 0,
        velocityY: 300,
      });
      await act(async () => {
        fireGestureHandler(frame().props.gesture, [
          { state: State.BEGAN, ...at(0) },
          { state: State.ACTIVE, ...at(0.5) },
          { state: State.ACTIVE, ...at(1) },
          { state: State.END, ...at(1) },
        ] as never);
      });
      await app.settle();
      expect(opened()).toBe(true);
    });
  });
});
