import assert from 'node:assert/strict';
import { afterEach, before, describe, it } from 'node:test';
import { API_URL, ApiError, setTokenSource } from './client';
import { fetchCoverHistory, fetchUsage, generateCover, wearCover } from './library';

const original = globalThis.fetch;
before(() => setTokenSource({ access: async () => 'token', renew: async () => null }));
afterEach(() => {
  globalThis.fetch = original;
});

/** A server answering each request in turn with the next body, recording what was asked. */
function server(...bodies: unknown[]) {
  const asked: string[] = [];
  globalThis.fetch = (async (url: string, options: RequestInit) => {
    asked.push(`${options.method ?? 'GET'} ${url.replace(API_URL, '')}`);
    return Response.json(bodies.shift());
  }) as typeof fetch;
  return asked;
}
const body = { kind: 'set' as const, title: 'Faros', attachTo: 'set-u-1a2b3c' };
const fast = { pollMs: 1, polls: 5 };

describe('generateCover (plan 111)', () => {
  it('waits while the server draws the cover, asking where it stands', async () => {
    const asked = server(
      { id: 'cover-1', status: 'rendering', url: null, provider: 'ai' },
      { id: 'cover-1', status: 'rendering', url: null, provider: 'ai' },
      { id: 'cover-1', status: 'ready', url: '/library/covers/cover-1.svg', provider: 'ai' },
    );
    assert.deepEqual(await generateCover(body, fast), { id: 'cover-1', status: 'ready', url: '/library/covers/cover-1.svg', provider: 'ai' });
    assert.deepEqual(asked, ['POST /library/generate/cover', 'GET /library/covers/cover-1.json', 'GET /library/covers/cover-1.json']);
  });

  it('says so when drawing failed', async () => {
    server({ id: 'cover-1', status: 'rendering', url: null, provider: 'ai' }, { id: 'cover-1', status: 'failed', url: null, provider: 'ai' });
    await assert.rejects(generateCover(body, fast), (error) => error instanceof ApiError && error.code === 'PROVIDER_UNAVAILABLE');
  });

  it('stops waiting, without calling it a failure, when drawing takes longer than the app waits', async () => {
    server(...Array.from({ length: 10 }, () => ({ id: 'cover-1', status: 'rendering', url: null, provider: 'ai' })));
    assert.equal((await generateCover(body, { pollMs: 1, polls: 2 })).status, 'rendering');
  });

  it('takes an older server’s cover, drawn before it answered, as ready, its `claude` as `ai`', async () => {
    const asked = server({ id: 'cover-1', url: '/library/covers/cover-1.svg', provider: 'claude' });
    assert.deepEqual(await generateCover(body, fast), { id: 'cover-1', url: '/library/covers/cover-1.svg', provider: 'ai' });
    assert.equal(asked.length, 1);
  });
});

describe('fetchUsage', () => {
  it('reads an older server’s `claude` writers as `ai`', async () => {
    server({ writers: { phrases: 'claude', cover: 'claude', lyrics: 'claude', music: 'demo' } });
    assert.deepEqual((await fetchUsage()).writers, { phrases: 'ai', cover: 'ai', lyrics: 'ai', music: 'demo' });
  });
});

describe('earlier covers', () => {
  it('lists the covers drawn for an item, and puts one back without drawing', async () => {
    const drawn = { id: 'cover-2', url: '/library/covers/cover-2.svg', provider: 'claude', prompt: 'A lighthouse', createdAt: 1 };
    const asked = server({ covers: [drawn], current: 'cover-1' }, { id: 'cover-2', status: 'ready', url: drawn.url, provider: 'ai' });
    assert.deepEqual(await fetchCoverHistory('phrase', 'cafe-01'), { covers: [{ ...drawn, provider: 'ai' }], current: 'cover-1' });
    assert.equal((await wearCover('cover-2', { kind: 'phrase', attachTo: 'cafe-01' })).url, drawn.url);
    assert.deepEqual(asked, ['GET /library/covers/phrase/cafe-01', 'POST /library/covers/cover-2/wear']);
  });
});
