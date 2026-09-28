// One way to ask for suggestions: the AI writer when the server has one, otherwise (or when it
// fails) the phrases on the device. The result says which, so the screen can say it too.
import { coursePhrases, findSetView, promptOf, sameKey } from '../state/catalog';
import type { LearnerState } from '../state/types';
import { suggestLocal } from './local';
import { WrittenPhrase, writePhrases } from './remote';
import { DECK_SIZE, SuggestRequest, Suggestion } from './types';

export interface SuggestResult {
  suggestions: Suggestion[];
  /** Who wrote this deal: AI on the server, or the phrases on this device. */
  writer: 'ai' | 'device';
  /** The AI writer was asked and failed; these are the device's instead. */
  fellBack: boolean;
}

export interface SuggestOptions {
  /** Ask the AI writer (the server has one). */
  live: boolean;
  /** Phrases not to offer again, by sameKey: seen in this deck, or already in the set being filled. */
  exclude: ReadonlySet<string>;
  /** The same phrases as text, for the writer. */
  avoid: string[];
  signal?: AbortSignal;
}

/**
 * Written phrases as suggestions. One the course or the learner already has is offered as that
 * phrase, so adding it never makes a duplicate; the rest are marked as AI-written.
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
      });
    } else {
      out.push({ key: `ai:${key}`, source: 'ai', target: phrase.target, native: phrase.native, image: phrase.image, notes: phrase.notes });
    }
    if (out.length >= DECK_SIZE) break;
  }
  return out;
}

/** A deal of suggestions. Rejects only when `signal` aborts it (a newer request replaced it). */
export async function suggest(learner: LearnerState, request: SuggestRequest, options: SuggestOptions): Promise<SuggestResult> {
  const onDevice = (fellBack: boolean): SuggestResult => ({ suggestions: suggestLocal(learner, request, { exclude: options.exclude }), writer: 'device', fellBack });
  if (!options.live) return onDevice(false);
  try {
    const written = await writePhrases(request, options.avoid, options.signal);
    const suggestions = fromWritten(learner, written, options.exclude);
    // The writer found nothing to say (a subject it declined): the device may still have something.
    return suggestions.length > 0 ? { suggestions, writer: 'ai', fellBack: false } : onDevice(false);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return onDevice(true);
  }
}
