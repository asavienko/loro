import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isCompact, playerCoverSize, roomOf } from './room';

describe('room on screen', () => {
  it('a foldable cover screen is compact; a common phone is not, until its text is large', () => {
    assert.equal(isCompact(344, 1), true);
    assert.equal(isCompact(412, 1), false);
    assert.equal(isCompact(412, 1.15), true);
    assert.equal(isCompact(690, 1.3), false);
  });

  it('text smaller than 100% gives no extra room', () => {
    assert.equal(roomOf(344, 0.85), 344);
  });

  it("the player's picture shrinks with the room, between 112 and 200 dp", () => {
    assert.equal(playerCoverSize(412, 915, 1), 200);
    assert.ok(playerCoverSize(344, 882, 1) < 200);
    assert.ok(playerCoverSize(320, 820, 1.3) < playerCoverSize(344, 882, 1));
    assert.equal(playerCoverSize(280, 480, 2), 112);
  });
});
