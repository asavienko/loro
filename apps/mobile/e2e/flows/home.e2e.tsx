// Home, and the tab bar that moves between the four tabs (N-04, CC-02).
//
// Covered: the greeting (with and without a name); the one hero, in its order (the demo for a learner
// who hasn't skipped it, the review of due phrases, the course done, the next set, what to continue)
// and each of its buttons (Play one phrase, Play N phrases, the review's cap of ten, the set row, Add
// your phrase, Try another course); the figures (Started, Learned, Today's line, the next-due line,
// and where the chips lead); "Jump back in" and its History sheet (a run opens its set; Close shuts
// it); "Not started yet" cards (open the set, and their play button); the settings avatar; no copy
// that shames a missed day; and the tab bar (each tab's screen and selected state, a set page keeping
// the tab it came from). Not covered: the album teaser, as the fake serves no Loro album (see it.todo).
import { greeting } from '@shared/copy';
import { FIXTURE } from '@shared/content/fixture';
import { memoryKey } from '@shared/state/memory';
import type { AppState, LogEntry } from '@shared/state/types';
import { audio, DAY, HOUR, launch, MINUTE, screen, T0, visibleText } from '../harness';

const CAFE = FIXTURE.sets.find((s) => s.id === 'set-cafe')!.phraseIds;
/** Every phrase of the Spanish course, with its set. */
const COURSE = FIXTURE.sets.filter((s) => s.targetLang === 'es-ES').flatMap((s) => s.phraseIds.map((phraseId) => ({ phraseId, setId: s.id })));

/**
 * Saved state as a learner who has played `phrases` through and rated each `grade` at `at`: the log
 * the phone would have kept, so Home reads it as it reads a real session.
 */
function rated(phrases: { phraseId: string; setId: string }[], grade: 'missed' | 'hard' | 'easy', at: number, session = 'a') {
  return (state: AppState): AppState => {
    const entries: LogEntry[] = phrases.flatMap(({ phraseId, setId }, i) => {
      const base = { device: 'e2edevice', key: memoryKey('en-GB', 'es-ES', phraseId), phraseId, setId };
      return [
        { ...base, id: `seed-h-${session}-${phraseId}`, at: at - MINUTE + i, kind: 'heard' as const, targetMs: null, nativeMs: null },
        { ...base, id: `seed-r-${session}-${phraseId}`, at: at + i, kind: 'rated' as const, grade },
      ];
    });
    return { ...state, learner: { ...state.learner, log: [...state.learner.log, ...entries] } };
  };
}

const cafeOf = (ids: string[]) => ids.map((phraseId) => ({ phraseId, setId: 'set-cafe' }));

/** A learner who played and rated Café & Mañanas, opening the app `away` after doing so. */
const returnAfter = (away: number, grade: 'missed' | 'hard' | 'easy' = 'easy') =>
  launch({ learner: { edit: rated(cafeOf(CAFE), grade, T0) }, now: T0 + 10 * MINUTE + away });

const selectedTab = (name: string) => screen.getByRole('tab', { name, selected: true });

describe('Home: the greeting and the one hero', () => {
  it('greets the learner by name', async () => {
    const app = await launch();
    await app.waitFor(greeting('es-ES', 'Ana'));
  });

  it('greets without a name when the learner gave none', async () => {
    const app = await launch({ learner: { name: '' } });
    await app.waitFor(greeting('es-ES', ''));
  });

  it('a learner who has not started is offered the first set as Start here', async () => {
    const app = await launch();
    await app.waitFor(app.c.home.startTitle);
    expect(app.sees(app.c.home.playPhrases(5))).toBe(true);
    expect(app.sees('Café & Mañanas')).toBe(true);
    // Zeros say nothing: no figures and no history on a first run.
    expect(screen.queryByLabelText(app.c.home.started)).toBeNull();
    expect(screen.queryByText(app.c.home.history)).toBeNull();
  });

  it('a learner who skipped the demo is not offered it', async () => {
    const app = await launch();
    await app.waitFor(app.c.home.startTitle);
    expect(screen.queryByText(app.c.home.demoTitle)).toBeNull();
  });

  it('a learner who has not skipped the demo is offered one phrase to try, which plays', async () => {
    const app = await launch({ learner: { prefs: { skippedDemo: false } } });
    await app.waitFor(app.c.home.demoTitle);
    expect(app.sees(app.c.home.firstRun)).toBe(true);
    await app.tap(app.c.home.demoButton);
    expect(app.pathname()).toBe('/player');
    await app.advance(500);
    expect(audio.clips()[0]).toBe(`en-GB-${CAFE[0]}`);
  });

  it('the demo gives way to Continue once a phrase has been heard', async () => {
    const app = await launch({ learner: { prefs: { skippedDemo: false } } });
    await app.tap(app.c.home.demoButton);
    await app.advance(8_000);
    await app.back();
    expect(app.pathname()).toBe('/');
    expect(screen.queryByText(app.c.home.demoTitle)).toBeNull();
    expect(app.sees(app.c.home.continueTitle)).toBe(true);
  });

  it('Start here plays the first set in the player', async () => {
    const app = await launch();
    await app.tap(app.c.home.playPhrases(5));
    expect(app.pathname()).toBe('/player');
    await app.advance(500);
    expect(audio.clips()[0]).toBe(`en-GB-${CAFE[0]}`);
  });

  it('the set in the Start here hero opens that set', async () => {
    const app = await launch();
    await app.tap('Café & Mañanas');
    expect(app.pathname()).toBe('/set/set-cafe');
  });

  it('the Not started shelf: a card opens its set', async () => {
    const app = await launch();
    await app.tap('Tapas & Tabernas');
    expect(app.pathname()).toBe('/set/set-tapas');
  });

  it("a Not started card's play button plays that set without leaving Home", async () => {
    const app = await launch();
    await app.tap(app.c.explore.quickPlay('Mercado'));
    expect(app.pathname()).toBe('/');
    await app.advance(500);
    expect(audio.clips()[0]).toBe(`en-GB-${FIXTURE.sets.find((s) => s.id === 'set-market')!.phraseIds[0]}`);
  });

  it('once a set has been through and nothing is due, Home offers the next set as Next set', async () => {
    const app = await returnAfter(HOUR);
    await app.waitFor(app.c.home.nextTitle);
    expect(app.sees('Tapas & Tabernas')).toBe(true);
    expect(app.sees(app.c.home.playPhrases(5))).toBe(true);
    // The set just played is in Jump back in, with what is learned of it.
    expect(app.sees(app.c.set.summary(5, 0, 0))).toBe(true);
  });

  it('the Next set hero plays the next set in the player', async () => {
    const app = await returnAfter(HOUR);
    await app.tap(app.c.home.playPhrases(5));
    expect(app.pathname()).toBe('/player');
  });

  it('Jump back in opens a set played before', async () => {
    const app = await returnAfter(HOUR);
    await app.waitFor(app.c.home.jumpBackIn);
    await app.tap('Café & Mañanas');
    expect(app.pathname()).toBe('/set/set-cafe');
  });

  it('phrases that have fallen due are the review hero, which plays them', async () => {
    const app = await returnAfter(DAY, 'missed');
    await app.waitFor(app.c.home.reviewTitle);
    expect(app.sees(app.c.home.reviewBody(5))).toBe(true);
    await app.tap(app.c.home.playPhrases(5));
    expect(app.pathname()).toBe('/player');
    await app.advance(500);
    expect(audio.clips()[0]).toMatch(/^en-GB-cafe-0[1-5]$/);
  });

  it('a review of more phrases than a session holds plays the ten most overdue', async () => {
    const app = await launch({ learner: { edit: rated(COURSE, 'missed', T0) }, now: T0 + 10 * MINUTE + DAY });
    await app.waitFor(app.c.home.reviewTitle);
    expect(app.sees(app.c.home.reviewBody(COURSE.length))).toBe(true);
    expect(app.sees(app.c.home.reviewCapped(10))).toBe(true);
    expect(app.sees(app.c.home.playPhrases(10))).toBe(true);
  });

  it('a learner away five days is not shamed: no missed-day copy, and nothing taken away', async () => {
    const app = await returnAfter(5 * DAY, 'missed');
    await app.waitFor(app.c.home.reviewTitle);
    expect(visibleText()).not.toMatch(/streak|behind|overdue|lost|broke|fail|you didn|fell|missed a|miss a/i);
    expect(app.sees('Café & Mañanas')).toBe(true);
    expect(app.sees(app.c.home.started)).toBe(true);
    // No "Today" line: nothing was done today.
    expect(app.sees(app.c.home.today(5, 5))).toBe(false);
  });

  it('once every phrase is learned, Home says the course is done, and offers to add phrases or try another course', async () => {
    // Four easy sessions spread over six weeks: each phrase is learned (stable, and three successes).
    const sessions = [0, 3, 14, 40].map((days, i) => (state: AppState) => rated(COURSE, 'easy', T0 + days * DAY, `s${i}`)(state));
    const app = await launch({ learner: { edit: (state) => sessions.reduce((s, apply) => apply(s), state) }, now: T0 + 60 * DAY });
    await app.waitFor(app.c.home.courseDoneTitle);
    expect(app.sees(app.c.home.learned)).toBe(true);
    expect(screen.queryByText(app.c.home.startTitle)).toBeNull();
    await app.tap(app.c.home.addOwn);
    expect(app.sees(app.c.addPhrase.title)).toBe(true);
  });

  it('the Learned chip opens the library at the phrases learned', async () => {
    const sessions = [0, 3, 14, 40].map((days, i) => (state: AppState) => rated(COURSE, 'easy', T0 + days * DAY, `s${i}`)(state));
    const app = await launch({ learner: { edit: (state) => sessions.reduce((s, apply) => apply(s), state) }, now: T0 + 60 * DAY });
    await app.waitFor(app.c.home.learned);
    await app.tap(app.c.home.learned);
    expect(app.pathname()).toBe('/library');
  });

  it('the course-done hero offers another course in Settings', async () => {
    const sessions = [0, 3, 14, 40].map((days, i) => (state: AppState) => rated(COURSE, 'easy', T0 + days * DAY, `s${i}`)(state));
    const app = await launch({ learner: { edit: (state) => sessions.reduce((s, apply) => apply(s), state) }, now: T0 + 60 * DAY });
    await app.waitFor(app.c.home.courseDoneTitle);
    await app.tap(app.c.home.otherCourse);
    expect(app.sees(app.c.settings.title)).toBe(true);
  });

  it.todo('the album teaser opens the course’s Loro album (the fake serves no Loro album in the es-ES pack yet)');

  it('a learner with phrases falling due later is told when the next come due', async () => {
    const app = await returnAfter(HOUR);
    await app.waitFor(app.c.home.nextTitle);
    expect(screen.queryByText(/^Next: 5 phrases /)).not.toBeNull();
  });
});

describe('Home: the figures and where they lead', () => {
  it('Started counts the phrases heard, and Today says what was done today', async () => {
    const app = await returnAfter(HOUR);
    await app.waitFor(app.c.home.started);
    expect(app.sees(app.c.home.today(5, 5))).toBe(true);
  });

  it('the Started chip opens the library at the phrases being learned', async () => {
    const app = await returnAfter(HOUR);
    await app.tap(app.c.home.started);
    expect(app.pathname()).toBe('/library');
    expect(selectedTab(app.c.tabs.library)).toBeTruthy();
  });

  it('History lists the sets played, and a run opens its set', async () => {
    const app = await returnAfter(HOUR);
    await app.tap(app.c.home.history);
    expect(app.sees(app.c.history.title)).toBe(true);
    await app.tap(/^5 phrases · \+\d+ pts? · /);
    expect(app.pathname()).toBe('/set/set-cafe');
  });

  it('pulling the History sheet down closes it', async () => {
    const app = await returnAfter(HOUR);
    await app.tap(app.c.home.history);
    expect(screen.queryByText(/^5 phrases · \+\d+ pts? · /)).not.toBeNull();
    // Its header is the pull handle; the title is also the Home button's text, so take the sheet's.
    await app.swipe(app.c.history.title, { dy: 400 }, { index: 1 });
    expect(screen.queryByText(/^5 phrases · \+\d+ pts? · /)).toBeNull();
    expect(app.pathname()).toBe('/');
  });

  it('History closes with its Close button, and stays on Home', async () => {
    const app = await returnAfter(HOUR);
    await app.tap(app.c.home.history);
    expect(screen.queryByText(/^5 phrases · \+\d+ pts? · /)).not.toBeNull();
    await app.tap(app.c.common.close);
    expect(screen.queryByText(/^5 phrases · \+\d+ pts? · /)).toBeNull();
    expect(app.pathname()).toBe('/');
  });
});

describe('Home: settings', () => {
  it('the avatar in the top bar opens Settings', async () => {
    const app = await launch();
    await app.tap(app.c.nav.settings('Ana'));
    expect(app.sees(app.c.settings.title)).toBe(true);
  });
});

describe('Tab bar', () => {
  it('Home is the first tab and is selected at launch', async () => {
    const app = await launch();
    await app.waitFor(app.c.home.startTitle);
    expect(selectedTab(app.c.tabs.home)).toBeTruthy();
    expect(app.pathname()).toBe('/');
  });

  it('Explore opens the Explore screen and is selected', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    expect(app.pathname()).toBe('/explore');
    expect(selectedTab(app.c.tabs.explore)).toBeTruthy();
    expect(app.sees(app.c.explore.search)).toBe(true);
  });

  it('Create opens the Create screen and is selected', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.create);
    expect(app.pathname()).toBe('/create');
    expect(selectedTab(app.c.tabs.create)).toBeTruthy();
    expect(app.sees(app.c.create.phrasesTitle)).toBe(true);
  });

  it('Library opens the Library screen and is selected', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.library);
    expect(app.pathname()).toBe('/library');
    expect(selectedTab(app.c.tabs.library)).toBeTruthy();
  });

  it('Home brings the learner back from any tab', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.library);
    await app.tap(app.c.tabs.create);
    await app.tap(app.c.tabs.home);
    expect(app.pathname()).toBe('/');
    expect(selectedTab(app.c.tabs.home)).toBeTruthy();
  });

  it('a set opened from Home keeps Home selected, and Back returns to it', async () => {
    const app = await launch();
    await app.tap('Tapas & Tabernas');
    expect(app.pathname()).toBe('/set/set-tapas');
    expect(selectedTab(app.c.tabs.home)).toBeTruthy();
    await app.back();
    expect(app.pathname()).toBe('/');
  });

  it('a set opened from Explore keeps Explore selected', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.tap('Tapas & Tabernas');
    expect(app.pathname()).toBe('/set/set-tapas');
    expect(selectedTab(app.c.tabs.explore)).toBeTruthy();
  });

  // A tab press opens the bare tab (TabBar → router.navigate('/explore')), so Explore's search,
  // kept in the route, is gone on coming back. No decision says whether a tab should keep it.
  it.todo('open question: should Explore keep its search when the learner leaves the tab and comes back?');
});
