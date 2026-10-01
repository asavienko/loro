import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { fixturePack, installFixture } from './fixture';
import { applyItemCover, findContentPhrase, installedPack, installPacks, keepOnlyLoros, resetContent, songCoverUrl } from './index';

const A = '/library/covers/cover-a.svg';
const B = '/library/covers/cover-b.svg';
const C = '/library/covers/cover-c.svg';

describe('the learner’s own covers of phrases and songs', () => {
  afterEach(installFixture);

  it('show on the phrase and the song, from the pack', () => {
    installPacks([{ ...fixturePack('es-ES'), covers: { phrases: { 'cafe-01': A }, songs: { 'song-loro-cafe': B } } }]);
    assert.equal(findContentPhrase('cafe-01')?.coverUrl, A);
    assert.equal(findContentPhrase('cafe-02')?.coverUrl, undefined, 'a phrase without one keeps its icons');
    assert.equal(songCoverUrl('song-loro-cafe'), B);
    assert.equal(songCoverUrl('song-other'), undefined);
  });

  it('a pack saved before covers were served has none', () => {
    installPacks([fixturePack('es-ES')]);
    assert.equal(findContentPhrase('cafe-01')?.coverUrl, undefined);
  });

  it('one drawn just now shows at once, and the others stay', () => {
    // Only the Spanish course, so another has no pack to change.
    resetContent();
    installPacks([{ ...fixturePack('es-ES'), covers: { phrases: { 'cafe-01': A }, songs: {} } }]);
    const pack = applyItemCover('es-ES', 'phrase', 'cafe-02', C);
    assert.deepEqual(pack?.covers?.phrases, { 'cafe-01': A, 'cafe-02': C }, 'kept with the course, to be saved');
    assert.equal(findContentPhrase('cafe-02')?.coverUrl, C);
    assert.equal(findContentPhrase('cafe-01')?.coverUrl, A);
    applyItemCover('es-ES', 'song', 'song-loro-cafe', B);
    assert.equal(songCoverUrl('song-loro-cafe'), B);
    assert.equal(applyItemCover('ru-RU', 'phrase', 'x', C), undefined, 'no course installed: nothing to change');
  });

  it('go when the learner signs out', () => {
    installPacks([{ ...fixturePack('es-ES'), covers: { phrases: { 'cafe-01': A }, songs: { 'song-loro-cafe': B } } }]);
    keepOnlyLoros();
    assert.equal(findContentPhrase('cafe-01')?.coverUrl, undefined);
    assert.equal(songCoverUrl('song-loro-cafe'), undefined);
    assert.deepEqual(installedPack('es-ES')?.covers, { phrases: {}, songs: {} });
  });
});
