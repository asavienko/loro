import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import phrasesJson from './phrases.json';
import setsJson from './sets.json';
import topicsJson from './topics.json';
import languagesJson from './languages.json';
import { CONTENT_PHRASES, coursesFor, LANGUAGES, SETS, TOPICS } from './index';
import { contentProblems, PhraseJson, SetJson } from './schema';

const base = () => ({
  phrases: structuredClone(phrasesJson) as unknown as PhraseJson[],
  sets: structuredClone(setsJson) as unknown as SetJson[],
  topics: TOPICS,
  languages: LANGUAGES,
  renamed: {},
});

describe('content', () => {
  it('loads and passes every cross-file rule', () => {
    assert.deepEqual(contentProblems({ ...base(), topics: topicsJson as typeof TOPICS, languages: languagesJson as typeof LANGUAGES }), []);
    assert.ok(CONTENT_PHRASES.length > 0);
  });

  it('derives each phrase’s set from sets.json', () => {
    for (const set of SETS) for (const id of set.phraseIds) {
      assert.equal(CONTENT_PHRASES.find((p) => p.id === id)?.setId, set.id);
    }
  });

  it('every phrase has at least one note', () => {
    for (const p of CONTENT_PHRASES) assert.ok(p.notes && Object.keys(p.notes).length > 0, p.id);
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
