import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { added, currentCard, deal, dealt, decide, edit, lastDecision, newDeck, nextCard, picksOf, undo, unadd } from './deck';
import type { Suggestion } from './types';

const ai: Suggestion = { key: 'ai:a', source: 'ai', target: '¿Hay una farmacia cerca?', native: 'Is there a pharmacy nearby?' };
const bank: Suggestion = { key: 'bank:bank-health-es-03', source: 'bank', target: 'Me duele la garganta', native: 'I have a sore throat' };
const course: Suggestion = { key: 'course:cafe-03', source: 'course', target: 'La cuenta, por favor', native: 'The bill, please', phraseId: 'cafe-03', setTitle: 'Café & Mañanas' };

describe('deck', () => {
  it('deals in order, one decision per card, and ends', () => {
    let deck = newDeck([ai, bank, course]);
    assert.equal(currentCard(deck)?.key, ai.key);
    assert.equal(nextCard(deck)?.key, bank.key);
    deck = decide(decide(decide(deck, true), false), true);
    assert.equal(currentCard(deck), null);
    assert.equal(nextCard(deck), null);
    assert.equal(decide(deck, true), deck, 'nothing left to decide');
    assert.deepEqual(added(deck).map((c) => c.key), [ai.key, course.key]);
  });

  it('undo brings the last card back, with its decision undone', () => {
    let deck = decide(decide(newDeck([ai, bank, course]), true), false);
    assert.deepEqual(lastDecision(deck), { card: bank, added: false });
    deck = undo(deck);
    assert.equal(currentCard(deck)?.key, bank.key);
    deck = undo(undo(deck));
    assert.equal(currentCard(deck)?.key, ai.key);
    assert.equal(lastDecision(deck), null);
    assert.deepEqual(added(deck), []);
  });

  it('a corrected card is a new phrase that keeps where it came from', () => {
    let deck = edit(newDeck([course, ai]), course.key, ' La cuenta,  por favor ya ', 'The bill now, please');
    const card = currentCard(deck)!;
    assert.deepEqual([card.target, card.native, card.phraseId, card.source], ['La cuenta, por favor ya', 'The bill now, please', undefined, 'course']);
    deck = edit(deck, ai.key, '¿Hay farmacia?', ai.native);
    deck = decide(decide(deck, true), true);
    assert.deepEqual(picksOf(added(deck)), [
      { target: 'La cuenta, por favor ya', native: 'The bill now, please' },
      { target: '¿Hay farmacia?', native: ai.native, origin: 'ai' },
    ]);
    assert.equal(edit(deck, ai.key, '', 'x'), deck, 'empty text is refused');
    assert.deepEqual(edit(deck, course.key, course.target, course.native).edits[course.key], undefined, 'the original text drops the correction');
  });

  it('saves existing phrases by id and the rest with their origin', () => {
    assert.deepEqual(picksOf([course, bank, ai]), [
      { phraseId: 'cafe-03' },
      { target: bank.target, native: bank.native, origin: 'bank' },
      { target: ai.target, native: ai.native, origin: 'ai' },
    ]);
  });

  it('more cards join at the end, never twice', () => {
    let deck = decide(newDeck([ai]), true);
    deck = deal(deck, [{ ...bank }, { ...ai, key: 'ai:again', target: '¿hay una farmacia cerca' }]);
    assert.deepEqual(deck.cards.map((c) => c.key), [ai.key, bank.key]);
    assert.equal(currentCard(deck)?.key, bank.key);
    assert.equal(deal(deck, [bank]), deck);
    assert.deepEqual(dealt(deck).texts, [ai.target, bank.target]);
    assert.ok(dealt(deck).keys.has('me duele la garganta'));
  });

  it('an added card can be left out at the end', () => {
    let deck = decide(decide(newDeck([ai, bank]), true), true);
    deck = unadd(deck, ai.key);
    assert.deepEqual(added(deck).map((c) => c.key), [bank.key]);
    assert.equal(unadd(deck, ai.key), deck);
  });
});
