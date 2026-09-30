// Phrases and sets made on this device before they lived in the learner's account (plan 108), uploaded
// once they sign in: each set as a set of theirs under its device id, listing Loro's phrases it had by
// reference; phrases in no set into their "My phrases" set. Every phrase keeps its id, so its progress
// carries on. What was uploaded is then marked deleted in learner state, which every device syncs.
import { useEffect, useRef } from 'react';
import { addPhrase, createSet, NewPhrase, SetItem } from '@shared/api/library';
import { keepSetChange } from '@shared/api/contentCache';
import { findContentPhrase, findSet } from '@shared/content';
import type { LearnerState, OwnPhrase } from '@shared/state/types';
import { useToast } from '../ui/Toast';
import { useAccount } from './account';
import { useContent } from './content';
import { useCopy, useStore } from './store';

/** What the server holds in one set. */
const MAX_SET_PHRASES = 40;

/** This device's own phrases and sets not yet in the learner's account. */
export function onDevice(learner: LearnerState) {
  return {
    phrases: Object.values(learner.ownPhrases).filter((p) => !p.deleted),
    sets: Object.values(learner.ownSets).filter((s) => !s.deleted),
  };
}

function asNew(own: OwnPhrase): NewPhrase {
  return {
    id: own.id,
    target: own.target,
    native: own.native,
    source: own.origin ?? 'written',
    ...(own.bankId ? { bankId: own.bankId } : {}),
    // Notes AI wrote for it travel with it; otherwise the server writes them (or the bank has them).
    ...(own.notes && own.image ? { notes: own.notes, image: own.image, notesBy: 'ai' as const } : {}),
  };
}

/** A phrase of Loro's or already the learner's, which a set may list; another learner's is left out. */
function listable(id: string): boolean {
  const owner = findSet(findContentPhrase(id)?.setId)?.owner;
  return owner === 'loro' || owner === 'me';
}

/** Uploads what is on the device; resolves to the ids now in the account. */
export async function uploadDevice(learner: LearnerState, inboxTitle: string): Promise<{ phraseIds: string[]; setIds: string[] }> {
  const { phrases, sets } = onDevice(learner);
  const byId = new Map(phrases.map((p) => [p.id, p]));
  const phraseIds = new Set<string>();
  const setIds: string[] = [];
  for (const set of sets) {
    const items: SetItem[] = set.phraseIds.flatMap((id): SetItem[] => {
      const own = byId.get(id);
      if (own) return [asNew(own)];
      return listable(id) ? [{ ref: id }] : [];
    });
    // A device set may be longer than the server's: the rest go in sets of their own, numbered.
    const chunks = items.length === 0 ? [[]] : Array.from({ length: Math.ceil(items.length / MAX_SET_PHRASES) }, (_, i) => items.slice(i * MAX_SET_PHRASES, (i + 1) * MAX_SET_PHRASES));
    for (const [index, chunk] of chunks.entries()) {
      const detail = await createSet({
        ...(index === 0 ? { id: set.id } : {}),
        title: index === 0 ? set.title : `${set.title} (${index + 1})`,
        targetLang: set.targetLang,
        nativeLang: learner.profile.nativeLang,
        visibility: 'private',
        phrases: chunk,
      });
      await keepSetChange(detail);
    }
    setIds.push(set.id);
    for (const item of items) if ('id' in item && item.id) phraseIds.add(item.id);
  }
  for (const own of phrases) {
    if (phraseIds.has(own.id)) continue;
    await keepSetChange(await addPhrase({ phrase: asNew(own), targetLang: own.targetLang, nativeLang: own.nativeLang, inboxTitle }));
    phraseIds.add(own.id);
  }
  return { phraseIds: [...phraseIds], setIds };
}

/** Uploads this device's own phrases and sets once the learner is signed in. */
export function useDeviceUpload(): void {
  const c = useCopy();
  const { state, actions } = useStore();
  const account = useAccount();
  const content = useContent();
  const { toast } = useToast();
  const running = useRef(false);
  const waiting = onDevice(state.learner);
  const count = waiting.phrases.length + waiting.sets.length;
  const signedIn = account.status === 'signedIn';
  const ready = content.status === 'ready';

  useEffect(() => {
    if (!signedIn || !ready || count === 0 || running.current) return;
    running.current = true;
    uploadDevice(state.learner, c.library.myPhrases)
      .then(
        ({ phraseIds, setIds }) => {
          actions.ownUploaded(phraseIds, setIds);
          toast(c.library.uploaded, { tone: 'success' });
          void content.refresh();
        },
        // Offline or refused: it is tried again the next time the app is signed in and ready.
        () => {},
      )
      .finally(() => {
        running.current = false;
      });
    // Once per sign-in and batch: the state it reads is the one it saw when it started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, ready, count]);
}
