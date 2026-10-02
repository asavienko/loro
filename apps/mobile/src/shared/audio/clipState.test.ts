import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { awaitClip, clipStateUrl, readClipState, type ClipAnswer, type ClipIo, type ClipOutcome } from './clipState';

/** A server answering each question in turn, and waits that pass at once, counted. */
function scripted(answers: ClipAnswer[]) {
  const asked: string[] = [];
  let waited = 0;
  const io: ClipIo = {
    ask: (url, answer) => {
      asked.push(url);
      const next = answers.shift() ?? 'rendering';
      queueMicrotask(() => answer(next));
      return () => {};
    },
    wait: (ms, then) => {
      waited += ms;
      queueMicrotask(then);
      return () => {};
    },
  };
  return { io, asked, waited: () => waited };
}

function run(answers: ClipAnswer[], pace = { pollMs: 1_500, makeMs: 60_000 }) {
  const server = scripted(answers);
  let rendering = 0;
  const outcome = new Promise<ClipOutcome>((resolve) =>
    awaitClip('https://api.example/v1/library/speech/abc.mp3?v=12345678', server.io, () => (rendering += 1), resolve, pace),
  );
  return { outcome, server, rendering: () => rendering };
}

describe('a clip made on demand (P3-01)', () => {
  it('asks at the clip’s own address, .json for .mp3, keeping the voice in the query', () => {
    assert.equal(clipStateUrl('https://h/v1/library/speech/abc.mp3?v=1'), 'https://h/v1/library/speech/abc.json?v=1');
    assert.equal(clipStateUrl('/library/speech/abc.mp3'), '/library/speech/abc.json');
  });

  it('reads the server’s answer; an older server without the route is missing', () => {
    assert.equal(readClipState(200, '{"status":"rendering"}'), 'rendering');
    assert.equal(readClipState(200, '{"status":"ready"}'), 'ready');
    assert.equal(readClipState(200, '{"status":"failed"}'), 'failed');
    assert.equal(readClipState(200, 'not json'), 'failed');
    assert.equal(readClipState(503, ''), 'failed');
    assert.equal(readClipState(404, ''), 'missing');
  });

  it('plays a made clip at once, saying nothing about making it', async () => {
    const { outcome, server, rendering } = run(['ready']);
    assert.equal(await outcome, 'ready');
    assert.equal(rendering(), 0);
    assert.deepEqual(server.asked, ['https://api.example/v1/library/speech/abc.json?v=12345678']);
  });

  it('says once that it is being made, asks again until it is ready, then plays it', async () => {
    const { outcome, server, rendering } = run(['rendering', 'rendering', 'rendering', 'ready']);
    assert.equal(await outcome, 'ready');
    assert.equal(rendering(), 1);
    assert.equal(server.asked.length, 4);
    assert.equal(server.waited(), 4_500);
  });

  it('a clip the server can’t make ends the wait as unmade', async () => {
    const { outcome, rendering } = run(['rendering', 'failed']);
    assert.equal(await outcome, 'unmade');
    assert.equal(rendering(), 1);
  });

  it('a clip that takes too long to make ends the wait as unmade', async () => {
    const { outcome, server } = run([], { pollMs: 1_000, makeMs: 3_000 });
    assert.equal(await outcome, 'unmade');
    assert.equal(server.asked.length, 4);
  });

  it('no answer before it was being made is the connection; while it is, it asks again', async () => {
    assert.equal(await run(['unreachable']).outcome, 'unreachable');
    assert.equal(await run(['rendering', 'unreachable', 'ready']).outcome, 'ready');
  });

  it('an older server without the route plays the clip as before', async () => {
    assert.equal(await run(['missing']).outcome, 'ready');
  });

  it('cancelled, it ends without an outcome', async () => {
    const server = scripted(['rendering', 'ready']);
    let ended: ClipOutcome | null = null;
    const cancel = awaitClip('/library/speech/abc.mp3', server.io, () => {}, (o) => (ended = o));
    cancel();
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(ended, null);
  });
});
