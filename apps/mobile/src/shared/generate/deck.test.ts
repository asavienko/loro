import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fresh } from '../state/testing';
import { added, currentCard, deal, dealt, decide, edit, lastDecision, newDeck, nextCard, shown, undo, unadd } from './deck';
import { newPhrasesOf } from './publish';
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
    // Saved, both are the learner's own words: the server writes their notes (plan 108).
    assert.deepEqual(newPhrasesOf(fresh().learner, added(deck)), [
      { target: 'La cuenta, por favor ya', native: 'The bill now, please', source: 'written' },
      { target: '¿Hay farmacia?', native: ai.native, source: 'written' },
    ]);
    assert.equal(edit(deck, ai.key, '', 'x'), deck, 'empty text is refused');
    assert.deepEqual(edit(deck, course.key, course.target, course.native).edits[course.key], undefined, 'the original text drops the correction');
  });

  it('a bank card keeps its bank link, an AI card its notes, until the learner corrects the text', () => {
    const notes = {
      mnemonic: { title: 'm', text: 'x' },
      grammar: { title: 'g', text: 'y' },
      pronunciation: { title: 'p', text: 'z', ipa: '[a]', respelling: 'AH' },
    };
    const fromBank: Suggestion = { ...bank, bankId: 'bank-health-es-03', image: ['sick'] };
    const fromAi: Suggestion = { ...ai, notes, image: ['local_pharmacy'] };
    const { learner } = fresh();
    const [savedBank, savedAi] = newPhrasesOf(learner, [fromBank, fromAi]);
    assert.deepEqual('ref' in savedBank ? null : [savedBank.source, savedBank.bankId], ['bank', 'bank-health-es-03']);
    assert.deepEqual(savedAi, { target: ai.target, native: ai.native, image: ['local_pharmacy'], notes, source: 'ai' });
    const deck = edit(edit(newDeck([fromBank, fromAi]), fromBank.key, 'Me duele mucho la garganta', bank.native), fromAi.key, '¿Hay farmacia?', ai.native);
    assert.deepEqual(newPhrasesOf(learner, [currentCard(deck)!, shown(deck, fromAi)]), [
      { target: 'Me duele mucho la garganta', native: bank.native, source: 'written' },
      { target: '¿Hay farmacia?', native: ai.native, source: 'written' },
    ]);
  });

  it('saves an existing phrase by reference, keeping its one progress (plan 108)', () => {
    assert.deepEqual(newPhrasesOf(fresh().learner, [course]), [{ ref: 'cafe-03' }]);
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
