import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { fresh, run, T0 } from '../state/testing';
import { readPhrases, SUGGEST_URL } from './remote';
import { fromWritten, suggest } from './suggest';
import type { SuggestRequest } from './types';

const request: SuggestRequest = { mode: 'topic', input: 'pharmacy', targetLang: 'es-ES', nativeLang: 'en-GB' };
const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
});

/** A server that answers the suggest route with `body`, recording what it was sent. */
function server(body: unknown, init: ResponseInit = {}) {
  const sent: unknown[] = [];
  globalThis.fetch = (async (url: string, options: RequestInit) => {
    assert.equal(url, SUGGEST_URL);
    sent.push(JSON.parse(String(options.body)));
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });
  }) as typeof fetch;
  return sent;
}

describe('readPhrases', () => {
  it('takes a list of phrases and nothing else', () => {
    assert.deepEqual(readPhrases({ phrases: [{ target: ' Hola ', native: 'Hi' }, { target: '', native: 'x' }] }), [{ target: 'Hola', native: 'Hi' }]);
    assert.equal(readPhrases({ phrases: [{ target: 1, native: 'x' }] }), null);
    assert.equal(readPhrases('<!doctype html>'), null);
    assert.equal(readPhrases({}), null);
  });
});

describe('fromWritten', () => {
  it('marks new phrases as AI-written and offers known ones as themselves', () => {
    const s = run(fresh(), { type: 'ADD_OWN_PHRASE', target: 'Tengo tos', native: 'I have a cough', now: T0 });
    const out = fromWritten(
      s.learner,
      [
        { target: '¿Hay una farmacia cerca?', native: 'Is there a pharmacy nearby?' },
        { target: 'la cuenta por favor', native: 'The bill' },
        { target: 'tengo tos', native: 'Cough' },
        { target: '¿Hay una farmacia cerca', native: 'Again' },
        { target: 'Ya lo tengo', native: 'Seen' },
      ],
      new Set(['ya lo tengo']),
    );
    assert.deepEqual(
      out.map((x) => [x.source, x.target, x.phraseId ?? null]),
      [
        ['ai', '¿Hay una farmacia cerca?', null],
        ['course', 'La cuenta, por favor', 'cafe-03'],
        ['mine', 'Tengo tos', Object.keys(s.learner.ownPhrases)[0]],
      ],
    );
    assert.equal(out[1].setTitle, 'Café & Mañanas');
  });
});

describe('suggest', () => {
  it('uses the device when the server has no writer', async () => {
    globalThis.fetch = (() => assert.fail('no request without a writer')) as typeof fetch;
    const result = await suggest(fresh().learner, request, { live: false, exclude: new Set(), avoid: [] });
    assert.equal(result.writer, 'device');
    assert.equal(result.fellBack, false);
    assert.equal(result.suggestions[0].source, 'bank');
  });

  it('asks the writer, telling it what to avoid', async () => {
    const sent = server({ phrases: [{ target: 'Necesito algo para la tos', native: 'I need something for a cough' }], model: 'm' });
    const result = await suggest(fresh().learner, request, { live: true, exclude: new Set(), avoid: ['Hola'] });
    assert.deepEqual(sent, [{ ...request, avoid: ['Hola'] }]);
    assert.equal(result.writer, 'ai');
    assert.deepEqual(result.suggestions.map((s) => s.target), ['Necesito algo para la tos']);
  });

  it('falls back to the device, and says so, when the writer fails', async () => {
    server({ error: 'unavailable' }, { status: 502 });
    const failed = await suggest(fresh().learner, request, { live: true, exclude: new Set(), avoid: [] });
    assert.equal(failed.writer, 'device');
    assert.equal(failed.fellBack, true);
    assert.ok(failed.suggestions.length > 0);
    // A static host answers with its page: not a writer either.
    globalThis.fetch = (async () => new Response('<!doctype html>', { status: 200, headers: { 'Content-Type': 'text/html' } })) as typeof fetch;
    assert.equal((await suggest(fresh().learner, request, { live: true, exclude: new Set(), avoid: [] })).fellBack, true);
  });

  it('an empty answer is not a failure: the device offers what it has', async () => {
    server({ phrases: [] });
    const result = await suggest(fresh().learner, request, { live: true, exclude: new Set(), avoid: [] });
    assert.equal(result.writer, 'device');
    assert.equal(result.fellBack, false);
  });

  it('a request replaced by a newer one rejects instead of answering late', async () => {
    globalThis.fetch = ((_url: string, options: RequestInit) =>
      new Promise((_, reject) => options.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))) as typeof fetch;
    const controller = new AbortController();
    const pending = suggest(fresh().learner, request, { live: true, exclude: new Set(), avoid: [], signal: controller.signal });
    controller.abort();
    await assert.rejects(pending);
  });
});
