import { createContext, useContext } from 'react';
import type { QueueSource } from '../state/types';
import type { Route } from './routes';

/** Everything a screen can ask the shell to do. The callbacks are stable across renders. */
export interface Navigation {
  go: (route: Route) => void;
  /** Open a set page from the current tab. */
  openSet: (setId: string) => void;
  /** Play a set (content or own); `phraseIds` narrows or reorders it (sort, due-and-new only). */
  playSet: (setId: string, options?: { phraseIds?: string[]; startIndex?: number; shuffle?: boolean }) => void;
  /** Play a phrase within its own set, from that phrase onwards. */
  playPhraseInSet: (phraseId: string) => void;
  /** Play an explicit list (reviews, liked phrases); a `source` names it and makes it play once. */
  playList: (phraseIds: string[], startIndex?: number, source?: QueueSource) => void;
  openPlayer: () => void;
  openQueue: () => void;
  openSummary: () => void;
  /** Phrase details; `ownSetId` offers "Remove from this set". */
  showDetails: (phraseId: string, context?: { ownSetId?: string }) => void;
  addToSet: (phraseIds: string[]) => void;
  /** Add a phrase of your own (optionally pre-filled), or with `editId` correct one. */
  addPhrase: (options?: { editId?: string; target?: string }) => void;
  /** New set, optionally holding these phrases; `rename` edits an own set instead. */
  createSet: (phraseIds?: string[], rename?: string) => void;
  openSettings: () => void;
}

export const NavContext = createContext<Navigation | null>(null);

export function useNav(): Navigation {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav must be used inside the app shell');
  return nav;
}
