import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { apiUrl } from '@shared/api/client';
import type { Song } from '@shared/api/library';
import { getSet, type Album } from '@shared/content';
import { copyFor } from '@shared/copy';
import { findPhrase, promptOf } from '@shared/state/catalog';
import { transition } from '@shared/state/machine';
import { done, fresh, load, T0 } from '@shared/state/testing';
import type { AppState } from '@shared/state/types';
import { phraseNowPlaying, phraseRatable, rasterCover, songNowPlaying } from './nowPlaying';

const c = copyFor('en');

function phraseOf(s: AppState) {
  const phrase = findPhrase(s.learner, s.player.order[s.player.index]);
  assert.ok(phrase);
  return { phrase, prompt: promptOf(phrase, s.learner.profile.nativeLang) };
}

describe('the lock screen: the phrase loop', () => {
  it('shows nothing before a phrase is loaded', () => {
    assert.equal(phraseNowPlaying(fresh(), c, T0), null);
  });

  it('keeps the target hidden until it is heard, and says what to do now', () => {
    const s = load(fresh());
    const { phrase, prompt } = phraseOf(s);
    const shown = phraseNowPlaying(s, c, T0);
    assert.ok(shown);
    assert.equal(shown.id, phrase.id);
    assert.equal(shown.title, prompt.text);
    assert.notEqual(shown.title, phrase.target);
    assert.equal(shown.artist, 'Listen in English');
    assert.equal(shown.playing, true);
    assert.equal(shown.album, getSet('set-cafe').title);
    assert.equal(shown.hasSilences, true);
    assert.equal(shown.positionMs, null);
    assert.equal(shown.durationMs, null);

    // The learner's turn: still hidden.
    const turn = done(s, T0 + 2000);
    assert.equal(turn.player.phase, 'pause');
    assert.equal(phraseNowPlaying(turn, c, T0 + 2000)?.title, prompt.text);
    assert.match(phraseNowPlaying(turn, c, T0 + 2000)?.artist ?? '', /^Your turn/);

    // Heard: the target, with the prompt under it.
    const heard = done(turn, T0 + 6000);
    assert.equal(heard.player.phase, 'target');
    const revealed = phraseNowPlaying(heard, c, T0 + 6000);
    assert.equal(revealed?.title, phrase.target);
    assert.equal(revealed?.artist, prompt.text);
  });

  it('offers the three grades in the app’s order, and marks the one given', () => {
    const s = load(fresh());
    const before = phraseNowPlaying(s, c, T0);
    assert.deepEqual(
      before?.grades?.map((g) => [g.grade, g.label, g.selected]),
      [
        ['missed', 'Missed', false],
        ['hard', 'Hard', false],
        ['easy', 'Easy', false],
      ],
    );
    // The same RATE the player dispatches.
    const rated = transition(s, { type: 'RATE', grade: 'easy', now: T0 + 1000 });
    const after = phraseNowPlaying(rated, c, T0 + 1000);
    const easy = after?.grades?.find((g) => g.selected);
    assert.equal(easy?.grade, 'easy');
    assert.match(easy?.detail ?? '', /^Rated Easy — back in /);
    assert.equal(after?.grades?.filter((g) => g.selected).length, 1);
  });

  it('a paused phrase says so; previous and next follow the queue', () => {
    const s = transition(load(fresh()), { type: 'PAUSE', now: T0 + 500 });
    const shown = phraseNowPlaying(s, c, T0 + 500);
    assert.equal(shown?.playing, false);
    assert.equal(shown?.artist, 'Paused');
    assert.equal(shown?.canPrevious, false);
    assert.equal(shown?.canNext, true);
    const second = transition(s, { type: 'NEXT', now: T0 + 600 });
    assert.equal(phraseNowPlaying(second, c, T0 + 600)?.canPrevious, true);
  });

  it('offers no grades once a queue with an end is over, as the app', () => {
    const s = load(fresh());
    const ended: AppState = { ...s, player: { ...s.player, status: 'paused', ended: true, source: { kind: 'review' } } };
    assert.equal(phraseRatable(ended), false);
    const shown = phraseNowPlaying(ended, c, T0);
    assert.equal(shown?.grades, null);
    assert.equal(shown?.canNext, false);
  });

  it('is in the learner’s language', () => {
    const s = load(fresh());
    const ru: AppState = { ...s, learner: { ...s.learner, profile: { ...s.learner.profile, nativeLang: 'ru-RU' } } };
    const shown = phraseNowPlaying(ru, copyFor('ru'), T0);
    assert.deepEqual(
      shown?.grades?.map((g) => g.label),
      ['Не помню', 'Трудно', 'Легко'],
    );
    assert.equal(shown?.channelName, copyFor('ru').player.dialog);
  });
});

describe('the lock screen: a song', () => {
  const song = { id: 'song-1', title: 'Café song', setId: 'set-cafe', albumId: 'album-1' } as Song;
  const album = { id: 'album-1', title: 'Café, sung', owner: 'loro', author: null, coverUrl: '/library/covers/cover-1.svg' } as Album;
  const base = { song, album, playing: true, positionMs: 12_400, durationMs: 95_000, index: 0, count: 2 };

  it('shows the song, its album and its place', () => {
    const shown = songNowPlaying({ ...base, rating: { count: 0, given: null } }, c);
    assert.equal(shown.title, 'Café song');
    assert.equal(shown.artist, 'Loro');
    assert.equal(shown.album, 'Café, sung');
    assert.equal(shown.positionMs, 12_400);
    assert.equal(shown.durationMs, 95_000);
    assert.equal(shown.canNext, true);
    assert.equal(shown.canPrevious, false);
    assert.equal(shown.hasSilences, false);
    // A drawn cover is an SVG the system can't show.
    assert.equal(shown.artworkUrl, null);
    // Sings none of this course's phrases: nothing to rate.
    assert.equal(shown.grades, null);
  });

  it('offers the grades when it sings the course’s phrases, and marks the one given', () => {
    const shown = songNowPlaying({ ...base, rating: { count: 3, given: 'hard' } }, c);
    assert.deepEqual(
      shown.grades?.map((g) => [g.grade, g.selected]),
      [
        ['missed', false],
        ['hard', true],
        ['easy', false],
      ],
    );
    assert.equal(shown.grades?.[1].detail, 'Hard: its 3 phrases are reviewed.');
  });
});

describe('rasterCover', () => {
  it('passes pictures, not the drawn SVG covers', () => {
    assert.equal(rasterCover('/library/covers/cover-1.svg'), null);
    assert.equal(rasterCover(null), null);
    assert.equal(rasterCover('/library/covers/cover-1.png'), apiUrl('/library/covers/cover-1.png'));
    assert.equal(rasterCover('https://example.test/a.JPG?v=2'), 'https://example.test/a.JPG?v=2');
  });
});
