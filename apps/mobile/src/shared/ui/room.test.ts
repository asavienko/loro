import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isCompact, MIN_PLAYER_ART, playerArtSize, roomOf } from './room';

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

  it("the player's picture is as wide as the page where there is room", () => {
    // A tall window: the page's width (a browser's player is at most 512 dp wide, less its gutters).
    assert.equal(playerArtSize(472, 900, 1), 472);
    // A common phone (412 × 915 dp): its stage is about 600 dp high, and the picture is ~300 dp square.
    const phone = playerArtSize(372, 600, 1);
    assert.ok(phone >= 280 && phone <= 320, String(phone));
  });

  it('it gives way to large text and short screens, and goes where there is no room for it', () => {
    assert.ok(playerArtSize(372, 600, 1.3) < playerArtSize(372, 600, 1));
    assert.ok(playerArtSize(372, 600, 1, 64) < playerArtSize(372, 600, 1), 'the coach’s line for a first phrase');
    assert.ok(playerArtSize(320, 560, 1) < playerArtSize(372, 600, 1), 'a foldable cover screen');
    assert.equal(playerArtSize(336, 400, 1), MIN_PLAYER_ART + 4);
    assert.equal(playerArtSize(336, 383, 1, 64), 0, 'a phone 640 dp high, with the coach of the first phrases');
    assert.equal(playerArtSize(280, 500, 2), 0);
    assert.equal(playerArtSize(60, 900, 1), 60, 'never wider than the page');
  });
});
