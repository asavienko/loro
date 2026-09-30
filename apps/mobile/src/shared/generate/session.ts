// Make a set's session: what the flow holds between its steps, and the name it suggests for the set.
import type { Copy } from '../copy';
import { clip, LIMITS, tidy } from '../state/limits';
import type { Deck } from './deck';
import type { SuggestMode, SuggestRequest } from './types';

/** Everything the flow holds, so a flow closed by mistake can be opened again as it was. */
export interface MakeSession {
  /** The learner's set being filled; null makes a new one. */
  setId: string | null;
  mode: SuggestMode;
  /** What is typed in each mode's field, kept while switching between them. */
  texts: Record<SuggestMode, string>;
  /** The last request dealt, which More repeats. */
  asked: SuggestRequest | null;
  deck: Deck | null;
  /** Who wrote the last deal: AI on the server, or its phrase bank. */
  writer: 'ai' | 'bank';
  /** More found nothing new. */
  exhausted: boolean;
  step: 'ask' | 'deck' | 'save';
  /** The new set's name, suggested from the first request. */
  title: string;
  /** The last request found nothing: said under the field. */
  nothingFor: string | null;
}

export interface MakeRequest {
  input?: string;
  setId?: string;
  resume?: MakeSession;
}

const capitalized = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** A name for the new set from what was asked: the topic, the keywords, or "From my text". */
export function defaultTitle(c: Copy, request: SuggestRequest): string {
  if (request.mode === 'text') return c.make.defaultTitleText;
  const words = request.mode === 'keywords' ? request.input.split(/[,;\n]+/).map(tidy).filter(Boolean).join(', ') : tidy(request.input);
  return clip(capitalized(words), LIMITS.title);
}
