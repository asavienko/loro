// The app boots in Node: a new learner gets onboarding, a returning one their Home, and a set plays.
import { audio, launch, MINUTE } from '../harness';

describe('boot', () => {
  it('shows onboarding to a new learner once the languages are downloaded', async () => {
    const app = await launch({ learner: 'new' });
    await app.waitFor(app.c.onboarding.welcome);
    expect(app.api.calls('GET /library/languages').length).toBeGreaterThan(0);
  });

  it('opens Home for a returning learner, with the course downloaded', async () => {
    const app = await launch();
    await app.waitFor(app.c.tabs.home);
    expect(app.pathname()).toBe('/');
    expect(app.api.calls('GET /library/pack')[0]?.path).toBe('/library/pack?target=es-ES');
  });

  it('plays a set: prompt, pause, target, echo, and a rating is saved', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.set.playAll('Café & Mañanas'));
    await app.advance(8_000);
    expect(audio.clips().slice(0, 2)).toEqual(['en-GB-cafe-01', 'es-ES-cafe-01']);
    await app.tap(app.c.player.rateAs(app.c.common.grade.easy));
    const saved = await app.saved();
    expect(saved.pending.map((p) => [p.phraseId, p.grade])).toEqual([['cafe-01', 'easy']]);
  });

  it('schedules a rating with the real FSRS model once its undo window closes', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.set.playAll('Café & Mañanas'));
    await app.advance(8_000);
    await app.tap(app.c.player.rateAs(app.c.common.grade.easy));
    await app.tap(app.c.common.pause);
    await app.advance(6 * MINUTE);
    const saved = await app.saved();
    expect(saved.pending).toEqual([]);
    const rated = saved.learner.log.filter((e) => e.kind === 'rated');
    expect(rated.map((e) => e.kind === 'rated' && [e.phraseId, e.grade])).toEqual([['cafe-01', 'easy']]);
    // The Rust core (its WASM build) scheduled it: the row says when it comes back.
    expect(app.sees(new RegExp(app.c.status.listenedNotRated))).toBe(false);
    expect(app.sees(new RegExp(app.c.player.rated(app.c.common.grade.easy, 'in 1 day')))).toBe(true);
  });
});
