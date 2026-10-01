import assert from 'node:assert/strict';
import { afterEach, before, describe, it } from 'node:test';
import { setTokenSource } from '../api/client';
import { installOwnSet } from '../content/fixture';
import { fresh } from '../state/testing';
import { readPhrases, SUGGEST_URL, writePhrases } from './remote';
import { fromWritten, suggest } from './suggest';
import type { SuggestRequest } from './types';

const request: SuggestRequest = { mode: 'topic', input: 'pharmacy', targetLang: 'es-ES', nativeLang: 'en-GB' };
const NOTES = {
  mnemonic: { title: 'Tos, toss', text: 'Sounds alike.' },
  grammar: { title: 'Para', text: 'For something.' },
  pronunciation: { title: 'Soft d', text: 'Like th.', ipa: '[ˈa.ʝa]', respelling: 'AH-yah' },
};
/** A written phrase as the server sends it: its picture and all three notes. */
const w = (target: string, native: string) => ({ target, native, image: ['medication'], notes: NOTES, source: 'ai' as const });
const original = globalThis.fetch;
before(() => setTokenSource({ access: async () => 'token', renew: async () => null }));
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
    assert.deepEqual(readPhrases({ phrases: [{ ...w(' Hola ', 'Hi'), image: ['medication', 'nope'] }, w('', 'x')] })?.phrases, [{ ...w('Hola', 'Hi'), source: 'ai' }]);
    // A phrase without its picture or whole notes is left out.
    assert.deepEqual(readPhrases({ phrases: [{ target: 'Hola', native: 'Hi' }, { ...w('Adiós', 'Bye'), image: ['nope'] }] })?.phrases, []);
    assert.deepEqual(readPhrases({ phrases: [{ ...w('Hola', 'Hi'), notes: { ...NOTES, grammar: { title: 'x' } } }] })?.phrases, []);
    assert.equal(readPhrases({ phrases: [{ target: 1, native: 'x' }] }), null);
    assert.equal(readPhrases('<!doctype html>'), null);
    assert.equal(readPhrases({}), null);
  });

  it('keeps who answered, a bank phrase’s id and the clips', () => {
    const read = readPhrases({
      provider: 'bank',
      phrases: [{ ...w('Hola', 'Hi'), source: 'bank', bankId: 'bank-hi-01', audio: { 'es-ES': '/library/speech/a.mp3', 'en-GB': 7 } }],
    });
    assert.equal(read?.provider, 'bank');
    assert.equal(read?.phrases[0].bankId, 'bank-hi-01');
    assert.deepEqual(Object.keys(read?.phrases[0].audio ?? {}), ['es-ES']);
    assert.match(read?.phrases[0].audio?.['es-ES'] ?? '', /^https?:\/\/.+\/library\/speech\/a\.mp3$/);
  });
});

describe('fromWritten', () => {
  it('marks new phrases as AI-written and offers known ones as themselves', () => {
    installOwnSet('set-u-tos', [{ id: 'u-tos-01', target: 'Tengo tos', native: 'I have a cough' }]);
    const s = fresh();
    const out = fromWritten(
      s.learner,
      [
        w('¿Hay una farmacia cerca?', 'Is there a pharmacy nearby?'),
        w('la cuenta por favor', 'The bill'),
        w('tengo tos', 'Cough'),
        w('¿Hay una farmacia cerca', 'Again'),
        w('Ya lo tengo', 'Seen'),
      ],
      new Set(['ya lo tengo']),
    );
    assert.deepEqual(
      out.map((x) => [x.source, x.target, x.phraseId ?? null]),
      [
        ['ai', '¿Hay una farmacia cerca?', null],
        ['course', 'La cuenta, por favor', 'cafe-03'],
        ['mine', 'Tengo tos', 'u-tos-01'],
      ],
    );
    assert.equal(out[1].setTitle, 'Café & Mañanas');
    assert.deepEqual([out[0].image, out[0].notes], [['medication'], NOTES], 'an AI card carries its picture and notes');
    assert.deepEqual(out[1].image, ['receipt_long', 'payments'], 'a course card shows the course phrase’s picture');
  });
});

describe('suggest', () => {
  it('asks the server, telling it what to avoid', async () => {
    const sent = server({ provider: 'ai', phrases: [w('Necesito algo para la tos', 'I need something for a cough')] });
    const result = await suggest(fresh().learner, request, { exclude: new Set(), avoid: ['Hola'] });
    assert.deepEqual(sent, [{ ...request, avoid: ['Hola'] }]);
    assert.equal(result.writer, 'ai');
    assert.deepEqual(result.suggestions.map((s) => s.target), ['Necesito algo para la tos']);
  });

  it('reads an older server’s `claude` as a model’s answer (plan 111)', async () => {
    server({ provider: 'claude', phrases: [w('Necesito algo para la tos', 'I need something for a cough')] });
    const result = await suggest(fresh().learner, request, { exclude: new Set(), avoid: [] });
    assert.equal(result.writer, 'ai');
  });

  it('keeps the bank’s answer as the bank’s phrases', async () => {
    server({ provider: 'bank', phrases: [{ ...w('¿Tiene algo para la tos?', 'Have you got something for a cough?'), source: 'bank', bankId: 'bank-pharmacy-es-01' }] });
    const result = await suggest(fresh().learner, request, { exclude: new Set(), avoid: [] });
    assert.equal(result.writer, 'bank');
    assert.deepEqual(result.suggestions.map((s) => [s.source, s.bankId]), [['bank', 'bank-pharmacy-es-01']]);
  });

  it('waits while the server writes the deck in the background (plan 111)', async () => {
    const asked: string[] = [];
    const answers = [
      { id: 'deck-1a2b3c', status: 'writing' },
      { id: 'deck-1a2b3c', status: 'writing' },
      { id: 'deck-1a2b3c', status: 'ready', provider: 'ai', phrases: [w('Necesito algo para la tos', 'I need something for a cough')], themes: [] },
    ];
    globalThis.fetch = (async (url: string, options: RequestInit) => {
      asked.push(`${options.method ?? 'GET'} ${url}`);
      return Response.json(answers.shift());
    }) as typeof fetch;
    const written = await writePhrases(request, [], undefined, { pollMs: 1, polls: 5 });
    assert.equal(written.provider, 'ai');
    assert.deepEqual(written.phrases.map((p) => p.target), ['Necesito algo para la tos']);
    assert.deepEqual(asked, [`POST ${SUGGEST_URL}`, `GET ${SUGGEST_URL}/deck-1a2b3c`, `GET ${SUGGEST_URL}/deck-1a2b3c`]);
  });

  it('fails when the deck could not be written, and stops asking when the learner leaves', async () => {
    globalThis.fetch = (async (_url: string, options: RequestInit) =>
      Response.json(options.method === 'POST' ? { id: 'deck-1a2b3c', status: 'writing' } : { id: 'deck-1a2b3c', status: 'failed' })) as typeof fetch;
    await assert.rejects(writePhrases(request, [], undefined, { pollMs: 1, polls: 5 }));
    globalThis.fetch = (async () => Response.json({ id: 'deck-1a2b3c', status: 'writing' })) as typeof fetch;
    const leaving = new AbortController();
    const pending = writePhrases(request, [], leaving.signal, { pollMs: 50, polls: 5 });
    leaving.abort();
    await assert.rejects(pending);
  });

  it('fails when the server fails or answers nonsense: the device has no phrases of its own', async () => {
    server({ error: 'unavailable' }, { status: 502 });
    await assert.rejects(suggest(fresh().learner, request, { exclude: new Set(), avoid: [] }));
    // A static host answers with its page: not a writer either.
    globalThis.fetch = (async () => new Response('<!doctype html>', { status: 200, headers: { 'Content-Type': 'text/html' } })) as typeof fetch;
    await assert.rejects(suggest(fresh().learner, request, { exclude: new Set(), avoid: [] }));
  });

  it('a request replaced by a newer one rejects instead of answering late', async () => {
    globalThis.fetch = ((_url: string, options: RequestInit) =>
      new Promise((_, reject) => options.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))) as typeof fetch;
    const controller = new AbortController();
    const pending = suggest(fresh().learner, request, { exclude: new Set(), avoid: [], signal: controller.signal });
    controller.abort();
    await assert.rejects(pending);
  });
});
