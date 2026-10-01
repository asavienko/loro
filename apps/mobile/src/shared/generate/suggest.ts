// Suggestions come from the server only (plan 108): a model where it writes, otherwise its phrase
// bank. The result says which, so the screen can say it too; a failure is the screen's to show.
import { coursePhrases, findSetView, promptOf, sameKey } from '../state/catalog';
import type { LearnerState } from '../state/types';
import { WrittenPhrase, writePhrases } from './remote';
import { DECK_SIZE, SuggestRequest, Suggestion } from './types';

export interface SuggestResult {
  suggestions: Suggestion[];
  /** Who wrote this deal: AI on the server, or the server's phrase bank. */
  writer: 'ai' | 'bank';
}

export interface SuggestOptions {
  /** Phrases not to offer again, by sameKey: seen in this deck, or already in the set being filled. */
  exclude: ReadonlySet<string>;
  /** The same phrases as text, for the writer. */
  avoid: string[];
  signal?: AbortSignal;
}

/**
 * Written phrases as suggestions. One the course or the learner already has is offered as that
 * phrase, so adding it never makes a duplicate; the rest are marked as AI-written or the bank's.
 */
export function fromWritten(learner: LearnerState, written: readonly WrittenPhrase[], exclude: ReadonlySet<string>): Suggestion[] {
  const existing = new Map(coursePhrases(learner).map((p) => [sameKey(p.target), p]));
  const seen = new Set(exclude);
  const out: Suggestion[] = [];
  for (const phrase of written) {
    const key = sameKey(phrase.target);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const known = existing.get(key);
    if (known) {
      const set = findSetView(learner, known.setId);
      out.push({
        key: `${known.own ? 'mine' : 'course'}:${known.id}`,
        source: known.own ? 'mine' : 'course',
        target: known.target,
        native: promptOf(known, learner.profile.nativeLang).text,
        phraseId: known.id,
        ...(set ? { setTitle: set.title } : {}),
        ...(known.image ? { image: known.image } : {}),
        ...(known.audio ? { audio: known.audio } : {}),
      });
    } else if (phrase.source === 'bank' && phrase.bankId) {
      out.push({ key: `bank:${phrase.bankId}`, source: 'bank', target: phrase.target, native: phrase.native, image: phrase.image, bankId: phrase.bankId, ...(phrase.audio ? { audio: phrase.audio } : {}) });
    } else {
      out.push({ key: `ai:${key}`, source: 'ai', target: phrase.target, native: phrase.native, image: phrase.image, notes: phrase.notes, ...(phrase.audio ? { audio: phrase.audio } : {}) });
    }
    if (out.length >= DECK_SIZE) break;
  }
  return out;
}

/** A deal of suggestions from the server. Rejects when it can't be asked, fails, or `signal` aborts it. */
export async function suggest(learner: LearnerState, request: SuggestRequest, options: SuggestOptions): Promise<SuggestResult> {
  const written = await writePhrases(request, options.avoid, options.signal);
  return { suggestions: fromWritten(learner, written.phrases, options.exclude), writer: written.provider };
}
