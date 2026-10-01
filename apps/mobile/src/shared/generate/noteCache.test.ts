import assert from 'node:assert/strict';
import { afterEach, before, describe, it } from 'node:test';
import { API_URL, setTokenSource } from '../api/client';
import { forgetKeptNotes, keepNote, keptNotes, keptNotesNow, MAX_KEPT_NOTES } from './noteCache';
import { rewriteNote } from './remote';

const original = globalThis.fetch;
before(() => setTokenSource({ access: async () => 'token', renew: async () => null }));
afterEach(() => {
  globalThis.fetch = original;
  forgetKeptNotes();
});

describe('notes written again', () => {
  it('keeps them newest first, by phrase, note and language, at most ten', async () => {
    assert.equal(keptNotesNow('p-1', 'mnemonic', 'ru-RU'), undefined);
    assert.deepEqual(await keptNotes('p-1', 'mnemonic', 'ru-RU'), []);
    await keepNote('p-1', 'mnemonic', 'ru-RU', { title: 'First', text: 'One.' });
    const kept = await keepNote('p-1', 'mnemonic', 'ru-RU', { title: 'Second', text: 'Two.' });
    assert.deepEqual(
      kept.map((n) => n.title),
      ['Second', 'First'],
    );
    assert.deepEqual(keptNotesNow('p-1', 'mnemonic', 'ru-RU'), kept);
    assert.deepEqual(await keptNotes('p-1', 'grammar', 'ru-RU'), []);
    assert.deepEqual(await keptNotes('p-1', 'mnemonic', 'bg-BG'), []);
    for (let i = 0; i < MAX_KEPT_NOTES + 2; i++) await keepNote('p-2', 'grammar', 'en-GB', { title: `N${i}`, text: '.' });
    const many = await keptNotes('p-2', 'grammar', 'en-GB');
    assert.equal(many.length, MAX_KEPT_NOTES);
    assert.equal(many[0]!.title, `N${MAX_KEPT_NOTES + 1}`);
  });

  it('asks the server with the language, the phrase and the notes already read', async () => {
    let asked: { url: string; body: unknown } | undefined;
    globalThis.fetch = (async (url: string, options: RequestInit) => {
      asked = { url: url.replace(API_URL, ''), body: JSON.parse(options.body as string) };
      return Response.json({ kind: 'mnemonic', note: { title: 'New hook', text: 'Another picture.' } });
    }) as typeof fetch;
    const request = {
      kind: 'mnemonic' as const,
      target: 'Един билет, моля',
      native: 'Один билет, пожалуйста',
      targetLang: 'bg-BG' as const,
      nativeLang: 'ru-RU' as const,
      previous: [{ title: 'Old hook', text: 'A picture.' }],
    };
    assert.deepEqual(await rewriteNote(request), { title: 'New hook', text: 'Another picture.' });
    assert.deepEqual(asked, { url: '/library/generate/note', body: request });
  });

  it('refuses a reply without a note', async () => {
    globalThis.fetch = (async () => Response.json({ kind: 'mnemonic' })) as unknown as typeof fetch;
    await assert.rejects(
      rewriteNote({ kind: 'grammar', target: 'Hola', native: 'Hello', targetLang: 'es-ES', nativeLang: 'en-GB', previous: [{ title: 'a', text: 'b' }] }),
    );
  });
});
