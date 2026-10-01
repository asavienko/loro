import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { formatRoute, parseRoute } from './routes';

describe('routes', () => {
  const original = globalThis.URLSearchParams;
  // Expo's URLSearchParams on iOS and Android (whatwg-url-without-unicode) has no `size`.
  beforeEach(() => {
    globalThis.URLSearchParams = class extends original {
      get size(): number {
        return undefined as unknown as number;
      }
    };
  });
  afterEach(() => {
    globalThis.URLSearchParams = original;
  });

  it("Library's list and Explore's filters keep their query where URLSearchParams has no size", () => {
    assert.equal(formatRoute({ name: 'library', view: 'ownSets' }), '#/library?view=ownSets');
    assert.equal(formatRoute({ name: 'explore', level: 'A1', tag: 'food' }), '#/explore?level=A1&tag=food');
  });

  it('a route without a query has none, and every route round-trips', () => {
    assert.equal(formatRoute({ name: 'library' }), '#/library');
    assert.equal(formatRoute({ name: 'explore' }), '#/explore');
    for (const route of [{ name: 'library', view: 'albums' }, { name: 'explore', q: 'café', level: 'A2' }] as const) {
      assert.deepEqual(parseRoute(formatRoute(route)), route);
    }
  });
});
