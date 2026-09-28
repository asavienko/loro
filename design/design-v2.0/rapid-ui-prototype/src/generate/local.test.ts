import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LanguageCode } from '../content';
import { sameKey } from '../state/catalog';
import { fresh, run, T0 } from '../state/testing';
import type { AppState } from '../state/types';
import { matchStrength, suggestLocal, termsOf } from './local';
import { DECK_SIZE, SuggestMode } from './types';

const course = (nativeLang: LanguageCode, targetLang: LanguageCode) => {
  const s = fresh();
  return { ...s, learner: { ...s.learner, profile: { ...s.learner.profile, nativeLang, targetLang } } };
};
const ask = (state: AppState, mode: SuggestMode, input: string, exclude?: Set<string>) =>
  suggestLocal(state.learner, { mode, input, nativeLang: state.learner.profile.nativeLang, targetLang: state.learner.profile.targetLang }, { exclude });

describe('terms', () => {
  it('keeps the words that carry the topic, in any language', () => {
    assert.deepEqual(termsOf('topic', 'At the pharmacy'), ['pharmacy']);
    assert.deepEqual(termsOf('keywords', 'hotel, towel; breakfast\nhotel'), ['hotel', 'towel', 'breakfast']);
    assert.deepEqual(termsOf('topic', 'В гостинице'), ['гостинице']);
    assert.deepEqual(termsOf('text', 'My flight is at 10, and I need a taxi.'), ['flight', 'taxi']);
  });

  it('reads no more of the input than the field allows', () => {
    assert.deepEqual(termsOf('topic', `${'. '.repeat(40)}pharmacy`), []);
  });
});

describe('stems', () => {
  it('match plurals and cases, never a short word inside a longer one', () => {
    assert.equal(matchStrength('towels', 'towel'), 0.75);
    assert.equal(matchStrength('аптеки', 'аптека'), 0.75);
    assert.equal(matchStrength('гостинице', 'гостиница'), 0.75);
    assert.equal(matchStrength('hot', 'hotel'), 0);
    assert.equal(matchStrength('flying', 'flight'), 0);
    assert.equal(matchStrength('rain', 'rain'), 1);
  });
});

describe('suggestLocal', () => {
  it('a topic brings its theme from the bank, the best match first', () => {
    const found = ask(fresh(), 'topic', 'pharmacy');
    assert.equal(found[0].target, '¿Dónde hay una farmacia cerca?');
    assert.equal(found[0].native, 'Where is there a pharmacy nearby?');
    assert.ok(found.length >= 6);
    assert.ok(found.every((s) => s.source === 'bank' && s.key.startsWith('bank:bank-health-es-')));
  });

  it('a topic keeps to its subject: people you meet, not every meeting', () => {
    const found = ask(fresh(), 'topic', 'Meeting people');
    assert.ok(found.some((s) => s.target === '¿De dónde eres?'));
    assert.ok(!found.some((s) => s.target === 'Llévate un paraguas'));
    assert.ok(!found.some((s) => s.target === 'Hoy no puedo, ¿otro día?'));
  });

  it('keywords find course phrases, which are added by their id and name their set', () => {
    const found = ask(fresh(), 'keywords', 'coffee, milk');
    const oat = found.find((s) => s.target === '¿Tienen leche de avena?');
    assert.ok(oat);
    assert.equal(oat.source, 'course');
    assert.equal(oat.phraseId, 'cafe-02');
    assert.equal(oat.setTitle, 'Café & Mañanas');
    assert.equal(found[0].phraseId, 'cafe-02', 'milk is in its words');
  });

  it('a text finds what it is about', () => {
    const found = ask(fresh(), 'text', 'Tomorrow we fly home. My flight is at ten and I have to check in two suitcases. I hope it does not rain!');
    assert.equal(found[0].target, 'Mi vuelo sale a las diez');
    const targets = found.map((s) => s.target);
    assert.ok(targets.includes('¿Dónde se factura el equipaje?'));
    assert.ok(targets.includes('¿Va a llover mañana?'));
  });

  it('answers in the learner’s language, for the course they are taking', () => {
    const ru = ask(course('ru-RU', 'bg-BG'), 'topic', 'аптека');
    assert.equal(ru[0].target, 'Къде има аптека наблизо?');
    assert.equal(ru[0].native, 'Где здесь поблизости аптека?');
    const bg = ask(course('bg-BG', 'es-ES'), 'topic', 'В хотела');
    assert.ok(bg.length > 0 && bg.every((s) => s.key.startsWith('bank:bank-hotel-es-')));
    assert.equal(bg.find((s) => s.target === '¿A qué hora es el desayuno?')?.native, 'В колко часа е закуската?');
  });

  it('offers nothing it does not have', () => {
    assert.deepEqual(ask(fresh(), 'topic', 'xyzzy'), []);
    assert.deepEqual(ask(fresh(), 'topic', 'the and of'), []);
  });

  it('a phrase the learner already wrote is offered as theirs, once', () => {
    const s = run(fresh(), { type: 'ADD_OWN_PHRASE', target: '¿a qué hora es el desayuno?', native: 'Breakfast when?', now: T0 });
    const found = ask(s, 'topic', 'hotel breakfast');
    const breakfast = found.filter((x) => sameKey(x.target) === sameKey('¿A qué hora es el desayuno?'));
    assert.equal(breakfast.length, 1);
    assert.equal(breakfast[0].source, 'mine');
    assert.ok(breakfast[0].phraseId?.startsWith('mine-p-'));
  });

  it('leaves out what it is told to, and never deals more than a deck', () => {
    const first = ask(fresh(), 'keywords', 'hotel, airport, weather, family');
    assert.equal(first.length, DECK_SIZE);
    const more = ask(fresh(), 'keywords', 'hotel, airport, weather, family', new Set(first.map((s) => sameKey(s.target))));
    assert.ok(more.length > 0);
    assert.ok(more.every((s) => !first.some((f) => f.key === s.key)));
  });

  it('keys are unique within a deck', () => {
    const found = ask(fresh(), 'keywords', 'hotel, card, pay, coffee, taxi');
    assert.equal(new Set(found.map((s) => s.key)).size, found.length);
  });
});
