import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RATING_WINDOW_MS } from '../state/memory';
import { transition } from '../state/machine';
import { currentPhraseId, pendingFor, windowLeft } from '../state/selectors';
import { done, fresh, load, run, T0 } from '../state/testing';
import type { AppState } from '../state/types';
import { barLoopRating, barRating, recentLoopRating, UNDO_OFFER_MS } from './rating';

/** The bar for the phrase playing, as MiniPlayer reads it at `now`. */
function bar(s: AppState, now: number) {
  const id = currentPhraseId(s.player)!;
  const pending = pendingFor(s, id);
  const rated = pending !== undefined && windowLeft(pending, now) > 0;
  return barRating({ ratable: true, rated }, barLoopRating(s.pending, id, now), now);
}

/** Plays the current phrase to its rating hold. */
function toHold(s: AppState, now: number): AppState {
  let out = s;
  for (let i = 0; out.player.phase !== 'rate' && i < 20; i++) out = done(out, now + i);
  return out;
}

describe('the bar’s rating', () => {
  it('offers the grades while the phrase playing can be rated', () => {
    assert.deepEqual(bar(load(fresh()), T0), { kind: 'grades' });
    assert.deepEqual(barRating({ ratable: false, rated: false }, null, T0), { kind: 'none' });
  });

  it('a rating gives Undo for a few seconds, then nothing for the rest of its window', () => {
    let s = transition(load(fresh()), { type: 'RATE', grade: 'hard', now: T0 + 1000 });
    assert.deepEqual(bar(s, T0 + 1000), { kind: 'undo', grade: 'hard', at: T0 + 1000, left: UNDO_OFFER_MS });
    assert.deepEqual(bar(s, T0 + 1000 + UNDO_OFFER_MS - 1), { kind: 'undo', grade: 'hard', at: T0 + 1000, left: 1 });
    assert.deepEqual(bar(s, T0 + 1000 + UNDO_OFFER_MS), { kind: 'none' }, 'hidden while it can still change');
    assert.deepEqual(bar(s, T0 + 1000 + RATING_WINDOW_MS - 1), { kind: 'none' });
    assert.deepEqual(bar(s, T0 + 1000 + RATING_WINDOW_MS), { kind: 'grades' }, 'the window has closed: it can be rated again');
    // Undone: the grades come back at once.
    s = transition(s, { type: 'UNRATE', now: T0 + 2000 });
    assert.deepEqual(bar(s, T0 + 2000), { kind: 'grades' });
  });

  it('a moment early still counts as now (a clock read before the rating)', () => {
    const s = transition(load(fresh()), { type: 'RATE', grade: 'easy', now: T0 + 1000 });
    assert.deepEqual(bar(s, T0 + 990), { kind: 'undo', grade: 'easy', at: T0 + 1000, left: UNDO_OFFER_MS });
  });

  it('rated in the hold, the loop moves on: the bar offers the next phrase’s grades at once', () => {
    let s = toHold(load(fresh()), T0);
    const rated = currentPhraseId(s.player);
    const at = T0 + 30_000;
    s = transition(s, { type: 'RATE', grade: 'missed', now: at });
    assert.notEqual(currentPhraseId(s.player), rated, 'moved on');
    assert.equal(recentLoopRating(s.pending, at + 100)?.phraseId, rated);
    assert.deepEqual(bar(s, at + 100), { kind: 'grades' }, 'not the rated phrase’s Undo: the next phrase’s grades');
    assert.equal(barLoopRating(s.pending, currentPhraseId(s.player), at + 100), null);
    // The player's own Undo still reaches the phrase that was rated.
    s = transition(s, { type: 'UNRATE', phraseId: rated!, now: at + 1000 });
    assert.equal(pendingFor(s, rated!), undefined);
    assert.equal(recentLoopRating(s.pending, at + 1000), null);
  });

  it('a grade changed in its window offers Undo again; a song’s ratings are the song’s', () => {
    let s = transition(load(fresh()), { type: 'RATE', grade: 'hard', now: T0 });
    s = transition(s, { type: 'RATE', grade: 'easy', now: T0 + 60_000 });
    assert.deepEqual(bar(s, T0 + 60_500), { kind: 'undo', grade: 'easy', at: T0 + 60_000, left: UNDO_OFFER_MS - 500 });
    const song = run(fresh(), { type: 'RATE_PHRASES', songId: 'song-1', phraseIds: ['cafe-01', 'cafe-02'], setId: 'set-cafe', grade: 'easy', now: T0 });
    assert.equal(song.pending.length, 2);
    assert.equal(recentLoopRating(song.pending, T0), null);
  });

  it('switched to the next phrase during Undo, the bar offers its grades, not the Undo', () => {
    let s = transition(load(fresh()), { type: 'RATE', grade: 'easy', now: T0 });
    assert.equal(bar(s, T0 + 500).kind, 'undo');
    s = run(s, { type: 'NEXT', now: T0 + 1000 });
    assert.deepEqual(bar(s, T0 + 1500), { kind: 'grades' });
  });

  it('the latest of the loop’s ratings is the one offered', () => {
    let s = transition(load(fresh()), { type: 'RATE', grade: 'hard', now: T0 });
    s = run(s, { type: 'NEXT', now: T0 + 500 }, { type: 'RATE', grade: 'easy', now: T0 + 1000 });
    assert.equal(recentLoopRating(s.pending, T0 + 1500)?.grade, 'easy');
  });
});
