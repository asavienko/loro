// The deck of "Make a set": suggestions dealt in order, one decision per card (add or skip), undo
// of the last decision, and corrections made on a card before adding it. Pure, like the state.
import { sameKey } from '../state/catalog';
import { clip, LIMITS, tidy } from '../state/limits';
import type { PhrasePick } from '../state/types';
import type { Suggestion } from './types';

export interface Deck {
  /** Every card dealt, in order; more are dealt at the end. */
  cards: Suggestion[];
  /** One per decided card, in card order: true for added. The next card is `cards[decisions.length]`. */
  decisions: boolean[];
  /** Cards the learner corrected, by key: what they wrote. */
  edits: Record<string, { target: string; native: string }>;
}

export const newDeck = (cards: Suggestion[]): Deck => ({ cards, decisions: [], edits: {} });

/** The card to decide now, as corrected; null when every card is decided. */
export function currentCard(deck: Deck): Suggestion | null {
  const card = deck.cards[deck.decisions.length];
  return card ? shown(deck, card) : null;
}

/** The card after the current one (drawn under it), as corrected. */
export function nextCard(deck: Deck): Suggestion | null {
  const card = deck.cards[deck.decisions.length + 1];
  return card ? shown(deck, card) : null;
}

/**
 * A card with the learner's correction, if any. A corrected card is a new phrase: it no longer adds
 * an existing one, and the notes and clips of its old text (the bank's, AI's) no longer fit it. Its
 * picture, which shows what it is about, stays.
 */
export function shown(deck: Deck, card: Suggestion): Suggestion {
  const edit = deck.edits[card.key];
  if (!edit) return card;
  const { phraseId: _phraseId, setTitle: _setTitle, bankId: _bankId, notes: _notes, audio: _audio, ...rest } = card;
  return { ...rest, target: edit.target, native: edit.native };
}

export function decide(deck: Deck, add: boolean): Deck {
  return deck.decisions.length < deck.cards.length ? { ...deck, decisions: [...deck.decisions, add] } : deck;
}

/** Takes back the last decision: that card is the current one again. */
export function undo(deck: Deck): Deck {
  return deck.decisions.length > 0 ? { ...deck, decisions: deck.decisions.slice(0, -1) } : deck;
}

/** The last decision, for its Undo: the card and whether it was added. */
export function lastDecision(deck: Deck): { card: Suggestion; added: boolean } | null {
  const i = deck.decisions.length - 1;
  return i >= 0 ? { card: shown(deck, deck.cards[i]), added: deck.decisions[i] } : null;
}

/**
 * Corrects a card, stored as the phrase form would store it. Empty text is refused, and writing
 * back the original text drops the correction.
 */
export function edit(deck: Deck, key: string, target: string, native: string): Deck {
  const card = deck.cards.find((c) => c.key === key);
  const t = clip(tidy(target), LIMITS.phrase);
  const n = clip(tidy(native), LIMITS.phrase);
  if (!card || !t || !n) return deck;
  const { [key]: _old, ...others } = deck.edits;
  return { ...deck, edits: t === card.target && n === card.native ? others : { ...others, [key]: { target: t, native: n } } };
}

/** Deals more cards after the last, leaving out any already in the deck. */
export function deal(deck: Deck, more: Suggestion[]): Deck {
  const keys = new Set(deck.cards.map((c) => sameKey(c.target)));
  const fresh = more.filter((c) => !keys.has(sameKey(c.target)));
  return fresh.length > 0 ? { ...deck, cards: [...deck.cards, ...fresh] } : deck;
}

/** The cards added, in the order they were added, as corrected. */
export function added(deck: Deck): Suggestion[] {
  return deck.decisions.flatMap((add, i) => (add ? [shown(deck, deck.cards[i])] : []));
}

/** Leaves an added card out after all (the save step's Remove). */
export function unadd(deck: Deck, key: string): Deck {
  const i = deck.cards.findIndex((c) => c.key === key);
  if (i === -1 || !deck.decisions[i]) return deck;
  const decisions = [...deck.decisions];
  decisions[i] = false;
  return { ...deck, decisions };
}

/** Every phrase dealt so far, by sameKey and as text: what the next deal must not repeat. */
export function dealt(deck: Deck): { keys: Set<string>; texts: string[] } {
  const texts = deck.cards.map((c) => shown(deck, c).target);
  return { keys: new Set([...deck.cards.map((c) => sameKey(c.target)), ...texts.map(sameKey)]), texts };
}

/** What to save: an existing phrase by its id, anything else as a new phrase that says where it came from. */
export function picksOf(cards: Suggestion[]): PhrasePick[] {
  return cards.map((card) => {
    if (card.phraseId) return { phraseId: card.phraseId };
    const origin = card.source === 'ai' ? 'ai' : card.source === 'bank' ? 'bank' : undefined;
    return {
      target: card.target,
      native: card.native,
      ...(origin ? { origin } : {}),
      ...(card.bankId ? { bankId: card.bankId } : {}),
      ...(card.notes ? { notes: card.notes, ...(card.image ? { image: [...card.image] } : {}) } : {}),
    };
  });
}
