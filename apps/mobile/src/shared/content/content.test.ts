import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import phrasesJson from '../../../../../packages/content/v2/phrases.json';
import setsJson from '../../../../../packages/content/v2/sets.json';
import topicsJson from '../../../../../packages/content/v2/topics.json';
import languagesJson from '../../../../../packages/content/v2/languages.json';
import noteTranslationsJson from '../../../../../packages/content/v2/note-translations.json';
import bankJson from '../../../../../packages/content/v2/bank.json';
import bankNoteTranslationsJson from '../../../../../packages/content/v2/bank-note-translations.json';
import { BANK_PHRASES, BANK_THEMES, CONTENT_PHRASES, coursesFor, LANGUAGES, SETS, TARGET_LANGUAGES, TOPICS } from './index';
import { z } from 'zod';
import { BankJson, bankProblems, contentProblems, PhraseJson, phraseSchema, SetJson } from './schema';
import { validateContent } from './validate';

const base = () => ({
  phrases: structuredClone(phrasesJson) as unknown as PhraseJson[],
  sets: structuredClone(setsJson) as unknown as SetJson[],
  topics: TOPICS,
  languages: LANGUAGES,
  renamed: {},
});

describe('content', () => {
  it('passes every schema and cross-file rule (the build runs the same check)', () => {
    assert.deepEqual(validateContent(), []);
    assert.deepEqual(contentProblems({ ...base(), topics: topicsJson as typeof TOPICS, languages: languagesJson as typeof LANGUAGES }), []);
    assert.ok(CONTENT_PHRASES.length > 0);
  });

  it('derives each phrase’s set from sets.json', () => {
    for (const set of SETS) for (const id of set.phraseIds) {
      assert.equal(CONTENT_PHRASES.find((p) => p.id === id)?.setId, set.id);
    }
  });

  it('every phrase has an image, its sounds, a mnemonic and a grammar rule', () => {
    for (const p of CONTENT_PHRASES) {
      assert.ok(p.image && p.image.length > 0, `${p.id}: image`);
      assert.deepEqual(Object.keys(p.notes ?? {}).sort(), ['grammar', 'mnemonic', 'pronunciation'], p.id);
      assert.match(p.notes!.pronunciation.ipa, /^\[.+\]$/, p.id);
      assert.ok(p.notes!.pronunciation.respelling, p.id);
    }
  });

  it('a phrase missing a note or its image fails validation', () => {
    const missing = structuredClone(phrasesJson) as unknown as Record<string, unknown>[];
    delete (missing[0].notes as Record<string, unknown>).mnemonic;
    delete missing[1].image;
    const result = z.array(phraseSchema).safeParse(missing);
    assert.equal(result.success, false);
    const paths = result.error!.issues.map((i) => i.path.join('.'));
    assert.ok(paths.includes('0.notes.mnemonic'), paths.join());
    assert.ok(paths.includes('1.image'), paths.join());
  });

  it('every note has Bulgarian and Russian versions where the learner could need them', () => {
    const problems = contentProblems({ ...base(), noteTranslations: noteTranslationsJson });
    assert.deepEqual(problems, []);
    const missing = structuredClone(noteTranslationsJson) as Record<string, Record<string, unknown>>;
    delete missing['cafe-01.grammar']['ru-RU'];
    assert.match(contentProblems({ ...base(), noteTranslations: missing as typeof noteTranslationsJson }).join('\n'), /cafe-01.grammar: missing ru-RU note/);
  });

  it('each topic holds at least two sets', () => {
    for (const t of TOPICS) assert.ok(SETS.filter((s) => s.topicId === t.id).length >= 2, t.id);
  });

  it('a course is never in the learner’s own language', () => {
    assert.deepEqual(coursesFor('bg-BG'), ['es-ES']);
  });

  it('catches duplicates, orphans, missing translations and glosses not in the phrase', () => {
    const c = base();
    c.phrases.push({ ...c.phrases[0] });
    c.sets[0].phraseIds.push('nowhere-01');
    delete c.phrases[1].translations['ru-RU'];
    c.phrases[2].words['zzz'] = { 'en-GB': 'x', 'bg-BG': 'x', 'ru-RU': 'x' };
    const problems = contentProblems(c).join('\n');
    assert.match(problems, /duplicate phrase id cafe-01/);
    assert.match(problems, /unknown phrase nowhere-01/);
    assert.match(problems, /cafe-02: missing ru-RU translation/);
    assert.match(problems, /glossed word "zzz" is not in the phrase/);
  });
});

describe('phrase bank', () => {
  const bank = () => structuredClone(bankJson) as unknown as BankJson;
  const problems = (b: BankJson, notes?: typeof bankNoteTranslationsJson) =>
    bankProblems(b, phrasesJson as unknown as PhraseJson[], setsJson as unknown as SetJson[], LANGUAGES, notes).join('\n');

  it('every theme has phrases in every course language', () => {
    for (const theme of BANK_THEMES) {
      for (const lang of TARGET_LANGUAGES) assert.ok(BANK_PHRASES.some((p) => p.theme === theme.id && p.targetLang === lang), `${theme.id} ${lang}`);
    }
  });

  it('catches unknown themes, missing translations, long phrases and phrases the course already has', () => {
    const b = bank();
    b.phrases[0].theme = 'nowhere';
    delete b.phrases[1].translations['ru-RU'];
    b.phrases[2].target = 'uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece';
    b.phrases[3].target = 'la cuenta, por favor.';
    b.phrases.push({ ...b.phrases[4], id: 'bank-health-es-99' });
    const found = problems(b);
    assert.match(found, /bank-health-es-01: unknown theme nowhere/);
    assert.match(found, /bank-health-es-02: missing ru-RU translation/);
    assert.match(found, /bank-health-es-03: 13 words, at most 12/);
    assert.match(found, /bank-health-es-04: the course already has it as cafe-03/);
    assert.match(found, /bank-health-es-99: the same phrase as bank-health-es-05/);
  });

  it('every bank phrase has an image, its sounds, a mnemonic and a grammar rule, in every UI language', () => {
    assert.equal(problems(bank(), bankNoteTranslationsJson), '');
    for (const p of BANK_PHRASES) {
      assert.ok(p.image.length > 0, p.id);
      assert.deepEqual(Object.keys(p.notes).sort(), ['grammar', 'mnemonic', 'pronunciation'], p.id);
      const langs = p.targetLang === 'bg-BG' ? ['ru-RU'] : ['bg-BG', 'ru-RU'];
      for (const kind of ['mnemonic', 'grammar', 'pronunciation'] as const) assert.deepEqual(Object.keys(p.noteTranslations[kind] ?? {}).sort(), langs, `${p.id}.${kind}`);
    }
    const missing = structuredClone(bankNoteTranslationsJson) as Record<string, Record<string, unknown>>;
    delete missing['bank-hotel-es-02.grammar']['bg-BG'];
    missing['bank-nowhere-es-01.mnemonic'] = {};
    const found = problems(bank(), missing as typeof bankNoteTranslationsJson);
    assert.match(found, /bank-hotel-es-02.grammar: missing bg-BG note/);
    assert.match(found, /bank: note translation for unknown note bank-nowhere-es-01.mnemonic/);
  });

  it('a Bulgarian phrase has no Bulgarian translation', () => {
    const b = bank();
    const bg = b.phrases.find((p) => p.targetLang === 'bg-BG')!;
    bg.translations['bg-BG'] = 'x';
    assert.match(problems(b), new RegExp(`${bg.id}: translation into its own language`));
  });
});
