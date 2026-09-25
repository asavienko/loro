import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { CONTENT_PHRASES, SETS, TOPICS } from '../content';
import { formatRoute, parseRoute, Route } from '../nav/routes';
import { ICON_NAMES } from './icons';

// PhraseText and ExploreScreen import React components; their pure helpers are
// loaded lazily so this file stays a plain node test.
const { breakUnits, tokenize, wrapRows } = await import('./PhraseText');
const { fold, matchesWords, queryWords } = await import('../screens/ExploreScreen');

describe('icons', () => {
  it('the local font holds exactly the registry', () => {
    const font = JSON.parse(fs.readFileSync(new URL('../../public/fonts/material-symbols.json', import.meta.url), 'utf8')) as { icons: string[] };
    assert.deepEqual(font.icons, [...ICON_NAMES].sort(), 'run `npm run icons` after editing src/ui/icons.ts');
  });

  it('every icon named in content is in the registry', () => {
    const names: readonly string[] = ICON_NAMES;
    for (const s of SETS) assert.ok(names.includes(s.coverIcon), s.coverIcon);
    for (const t of TOPICS) assert.ok(names.includes(t.icon), t.icon);
  });
});

describe('routes', () => {
  it('round-trip through the hash', () => {
    const routes: Route[] = [
      { name: 'home' },
      { name: 'explore', q: 'café & más', topic: 'eating-out', level: 'A1', tag: 'food' },
      { name: 'library', view: 'missed' },
      { name: 'set', id: 'set-cafe', from: 'explore' },
    ];
    for (const r of routes) assert.deepEqual(parseRoute(formatRoute(r)), r);
    assert.deepEqual(parseRoute('#/nowhere'), { name: 'home' });
    assert.deepEqual(parseRoute('#/explore?level=Z9'), { name: 'explore' });
    assert.deepEqual(parseRoute('#/explore?topic=nope'), { name: 'explore' }, 'an unknown topic is dropped');
  });
});

describe('word glosses', () => {
  it('matches multi-word units first and only whole words', () => {
    const phrase = CONTENT_PHRASES.find((p) => p.id === 'cafe-01')!;
    const tokens = tokenize(phrase, 'en-GB').filter((t) => t.gloss);
    assert.deepEqual(tokens.map((t) => t.text), ['Me', 'pone', 'un', 'cortado', 'por favor']);
    const transit = CONTENT_PHRASES.find((p) => p.id === 'transit-03')!;
    // "a" is glossed, but not the "a" inside "va".
    assert.deepEqual(tokenize(transit, 'en-GB').filter((t) => t.gloss).map((t) => t.text), ['Este', 'tren', 'va', 'a', 'Sol']);
  });
});

describe('the hidden phrase wraps by words (Q-01)', () => {
  // 10 px a character, so a row's width is easy to read.
  const measure = (text: string) => text.length * 10;
  const words = '¿Nos podemos sentar en la terraza?'.split(' ');

  it('rows add up to the text, and none is narrower than its first word', () => {
    for (const max of [60, 120, 200, 250, 340, 1000]) {
      const rows = wrapRows(words, max, measure);
      assert.equal(rows.map((r) => r.text).join(' '), words.join(' '), `max ${max}`);
      for (const row of rows) assert.ok(row.width >= Math.min(measure(row.text.split(' ')[0]), max), `max ${max}: "${row.text}" ${row.width}`);
    }
  });

  it('breaks where the browser would: before the word that would pass the width', () => {
    // 34 characters: one row of 340 px, or "…en la" / "terraza?" at 300 px, never a sliver.
    assert.deepEqual(wrapRows(words, 340, measure).map((r) => r.width), [340]);
    assert.deepEqual(wrapRows(words, 300, measure), [
      { text: '¿Nos podemos sentar en la', width: 250 },
      { text: 'terraza?', width: 80 },
    ]);
    // Each row as full as it can be: the next row's first word would not have fitted.
    const rows = wrapRows(words, 150, measure);
    for (let i = 0; i + 1 < rows.length; i++) assert.ok(measure(`${rows[i].text} ${rows[i + 1].text.split(' ')[0]}`) > 150);
  });

  it('a word wider than the column gets a row of its own, clamped to the column', () => {
    assert.deepEqual(wrapRows(['Buenísimo', 'ya'], 50, measure), [
      { text: 'Buenísimo', width: 50 },
      { text: 'ya', width: 20 },
    ]);
    assert.deepEqual(wrapRows([], 100, measure), []);
  });

  it('keeps a glossed unit whole, as the revealed heading does', () => {
    const phrase = CONTENT_PHRASES.find((p) => p.id === 'cafe-01')!;
    assert.ok(breakUnits(phrase, 'en-GB').includes('por favor'));
    assert.equal(breakUnits(phrase, 'en-GB').join(' '), phrase.target);
  });
});

describe('search', () => {
  it('folds case and accents without changing length', () => {
    assert.equal(fold('¿Dónde ESTÁ?'), '¿donde esta?');
    assert.equal(fold('Сметката').length, 'Сметката'.length);
  });

  it('matches every word in any order, ignoring punctuation', () => {
    assert.deepEqual(queryWords('  ¿Dónde, ESTÁ? '), ['donde', 'esta']);
    assert.ok(matchesWords('¿Dónde está el metro?', queryWords('metro donde')));
    assert.ok(matchesWords('La cuenta, por favor', queryWords('la cuenta por favor')));
    assert.ok(!matchesWords('La cuenta, por favor', queryWords('cuenta tapas')));
    assert.ok(matchesWords('Ещё одну', queryWords('еще')));
  });
});

describe('word gloss coverage', () => {
  it('every word of every phrase can be tapped for its meaning, in every prompt language', () => {
    for (const p of CONTENT_PHRASES) {
      for (const native of Object.keys(p.translations) as (keyof typeof p.translations)[]) {
        const gaps = tokenize(p, native)
          .filter((t) => !t.gloss)
          .map((t) => t.text)
          .join(' ')
          .split(/[^\p{L}]+/u)
          .filter(Boolean);
        assert.deepEqual(gaps, [], `${p.id} (${native})`);
      }
    }
  });
});

describe('a phrase row status', () => {
  it('says the rating just given, not recall 100%, for an hour; then the recall again (Q-03)', async () => {
    const { progressLabel } = await import('./progressLabel');
    const { phraseProgress } = await import('../state/selectors');
    const { keyOf } = await import('../state/catalog');
    const { copyFor } = await import('../copy');
    const { fresh, T0, MINUTE } = await import('../state/testing');
    const c = copyFor('en');
    const s = fresh();
    const key = keyOf(s.learner, 'cafe-01');
    const learner = {
      ...s.learner,
      log: [
        { id: 'q.h', at: T0, device: 'q', kind: 'heard' as const, key, phraseId: 'cafe-01', setId: 'set-cafe', targetMs: 1000, nativeMs: 1000 },
        { id: 'q.r', at: T0 + 1000, device: 'q', kind: 'rated' as const, key, phraseId: 'cafe-01', setId: 'set-cafe', grade: 'hard' as const },
      ],
    };
    const label = (now: number) => progressLabel(c, phraseProgress(learner, 'cafe-01', now), now);
    assert.match(label(T0 + MINUTE), /^Rated Hard — back /);
    assert.doesNotMatch(label(T0 + MINUTE), /Recall/);
    // An hour on, the recall figure means something again (or it is due by then, and says so).
    assert.match(label(T0 + 61 * MINUTE), /^(Recall \d+% · back |Due now$)/);
  });
});
