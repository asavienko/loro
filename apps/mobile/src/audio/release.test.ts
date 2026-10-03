import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { releasePlayer } from './release';

function player(fail: { remove?: boolean; release?: boolean } = {}) {
  const calls: string[] = [];
  return {
    calls,
    remove() {
      calls.push('remove');
      if (fail.remove) throw new Error('gone');
    },
    release() {
      calls.push('release');
      if (fail.release) throw new Error('released');
    },
  };
}

describe('letting go of a clip’s player', () => {
  it('frees the native player, not only takes it off the list', () => {
    const p = player();
    releasePlayer(p);
    assert.deepEqual(p.calls, ['remove', 'release']);
  });

  it('frees it even when it was already off the list, and never throws', () => {
    const p = player({ remove: true });
    releasePlayer(p);
    assert.deepEqual(p.calls, ['remove', 'release']);
    assert.doesNotThrow(() => releasePlayer(player({ remove: true, release: true })));
  });
});
