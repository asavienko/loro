import { createContext, useContext } from 'react';
import type { QueueSource } from '../state/types';
import type { Route } from './routes';

/** A set or album as the share sheet needs it. */
export interface Shareable {
  kind: 'set' | 'album';
  id: string;
  title: string;
  visibility: 'private' | 'link' | 'public';
  shareCode: string | null;
  owner: 'loro' | 'me' | 'other';
  hidden?: boolean;
}

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
  /**
   * Make a set from suggested phrases, swiped through one at a time. `input` starts from a topic
   * (and suggests at once); `setId` fills one of the learner's sets instead of making a new one.
   */
  makeSet: (options?: { input?: string; setId?: string }) => void;
  /** An album's page (plan 106), from the current tab. */
  openAlbum: (albumId: string) => void;
  /** Make a song from a set (plan 106), optionally for one set or into one album. */
  makeSong: (options?: { setId?: string; albumId?: string }) => void;
  /** Who can see a set or album of the learner's, and its link (plan 106); `onChanged` after a change. */
  share: (item: Shareable, onChanged?: () => void) => void;
  /** Signing in, or the account when signed in (plan 106). */
  openAccount: () => void;
  openSettings: () => void;
  /** Settings, scrolled to its voice pickers with the first one focused (the player's voice line). */
  openVoiceSettings: () => void;
}

export const NavContext = createContext<Navigation | null>(null);

export function useNav(): Navigation {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav must be used inside the app shell');
  return nav;
}
