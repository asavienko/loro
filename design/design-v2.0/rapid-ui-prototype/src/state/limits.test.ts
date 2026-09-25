import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findSamePhrase, sameKey } from './catalog';
import { clip, LIMITS } from './limits';
import { fresh, run, T0 } from './testing';

describe('typed text', () => {
  it('a cut never splits an emoji', () => {
    const text = `${'a'.repeat(LIMITS.phrase - 1)}👍`;
    assert.equal(clip(text, LIMITS.phrase), 'a'.repeat(LIMITS.phrase - 1));
    assert.equal(clip('short', LIMITS.phrase), 'short');
  });

  it('the reducer keeps a phrase within the limit the form shows', () => {
    const s = run(fresh(), { type: 'ADD_OWN_PHRASE', target: 'x'.repeat(150), native: 'y', now: T0 });
    const [own] = Object.values(s.learner.ownPhrases);
    assert.equal(own.target.length, LIMITS.phrase);
  });

  it('renaming a set to its own name changes nothing, not even its place', () => {
    let s = run(fresh(), { type: 'CREATE_SET', title: 'Trip', phraseIds: [], now: T0 });
    const [set] = Object.values(s.learner.ownSets);
    const before = s;
    s = run(s, { type: 'RENAME_SET', setId: set.id, title: '  Trip ', now: T0 + 5 });
    assert.equal(s, before);
  });

  it('"already have this" keeps ñ and й as letters, but not accents', () => {
    assert.notEqual(sameKey('Feliz año'), sameKey('Feliz ano'));
    assert.notEqual(sameKey('Мой дом'), sameKey('Мои дом'));
    assert.equal(sameKey('¿Dónde está?'), sameKey('donde esta'));
    assert.equal(sameKey('Всё'), sameKey('Все'));
    const s = run(fresh(), { type: 'ADD_OWN_PHRASE', target: 'Feliz año', native: 'Happy new year', now: T0 });
    assert.equal(findSamePhrase(s.learner, 'Feliz ano'), undefined);
    assert.ok(findSamePhrase(s.learner, 'feliz año!'));
  });
});
