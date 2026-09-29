import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { memoryKey } from '../state/memory';
import { cafe, fresh, T0 } from '../state/testing';
import type { LearnerState } from '../state/types';
import { setTokenSource } from './client';
import { syncProgress } from './progress';

/** The API's progress route, in memory: a body and a revision that refuses stale writes. */
function server() {
  const account = { body: null as Record<string, unknown> | null, revision: 0, writes: 0, refuseNext: false };
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    assert.match(url, /\/library\/progress$/);
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if ((init.method ?? 'GET') === 'GET') return json(200, { progress: account.body, revision: account.revision, updatedAt: null });
    const { progress, baseRevision } = JSON.parse(String(init.body));
    if (account.refuseNext || baseRevision !== account.revision) {
      account.refuseNext = false;
      return json(409, { code: 'CURSOR_EXPIRED' });
    }
    account.body = progress;
    account.revision += 1;
    account.writes += 1;
    return json(200, { revision: account.revision });
  }) as typeof fetch;
  return account;
}

/** The learner after hearing one phrase on one device. */
const heard = (learner: LearnerState, device: string, phraseId: string, at: number): LearnerState => ({
  ...learner,
  log: [{ id: `${device}.1`, at, device, kind: 'heard', key: memoryKey('en-GB', 'es-ES', phraseId), phraseId, setId: 'set-cafe', targetMs: null, nativeMs: null }],
});

const original = globalThis.fetch;
beforeEach(() => setTokenSource({ access: async () => 'token', renew: async () => null }));
afterEach(() => {
  globalThis.fetch = original;
  setTokenSource({ access: async () => null, renew: async () => null });
});

describe('progress in the account', () => {
  it('merges two devices’ listening, whichever syncs first', async () => {
    const account = server();
    const [a, b] = cafe();
    const phoneA = heard(fresh().learner, 'phone-a', a, T0);
    const phoneB = heard(fresh().learner, 'phone-b', b, T0 + 1000);
    await syncProgress(phoneA);
    const merged = await syncProgress(phoneB);
    assert.equal(account.writes, 2);
    assert.deepEqual(merged.log.map((e) => e.id).sort(), ['phone-a.1', 'phone-b.1']);
    // The first device gets the second's back, and has nothing new to write.
    const back = await syncProgress(phoneA);
    assert.deepEqual(back.log.map((e) => e.id).sort(), ['phone-a.1', 'phone-b.1']);
    assert.equal(account.writes, 2);
  });

  it('merges again when another device wrote in between', async () => {
    const account = server();
    const learner = fresh().learner;
    account.refuseNext = true;
    await syncProgress({ ...learner, profile: { ...learner.profile, name: 'Ana', updatedAt: T0 } });
    assert.equal(account.writes, 1);
  });
});
