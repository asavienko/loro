import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findSamePhrase, sameKey } from './catalog';
import { clip, LIMITS } from './limits';
import { contentIsNewer } from './persistence';
import { fresh } from './testing';

describe('typed text', () => {
  it('a cut never splits an emoji', () => {
    const text = `${'a'.repeat(LIMITS.phrase - 1)}👍`;
    assert.equal(clip(text, LIMITS.phrase), 'a'.repeat(LIMITS.phrase - 1));
    assert.equal(clip('short', LIMITS.phrase), 'short');
  });

  it('"already have this" keeps ñ and й as letters, but not accents', () => {
    assert.notEqual(sameKey('Feliz año'), sameKey('Feliz ano'));
    assert.notEqual(sameKey('Мой дом'), sameKey('Мои дом'));
    assert.equal(sameKey('¿Dónde está?'), sameKey('donde esta'));
    assert.equal(sameKey('Всё'), sameKey('Все'));
    const { learner } = fresh();
    assert.equal(findSamePhrase(learner, 'Una cana, por favor'), undefined);
    assert.ok(findSamePhrase(learner, 'una caña por favor!'));
  });
});

describe('content versions', () => {
  it('compare by date, then by the edition as a number', () => {
    assert.equal(contentIsNewer('2026-09-24.10', '2026-09-24.4'), true);
    assert.equal(contentIsNewer('2026-09-25.1', '2026-09-24.9'), true);
    assert.equal(contentIsNewer('2026-09-24.4', '2026-09-24.4'), false);
    assert.equal(contentIsNewer('2026-09-23.9', '2026-09-24.1'), false);
  });
});
