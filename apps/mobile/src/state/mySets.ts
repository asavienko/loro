// The learner's own sets and phrases, kept in their account (plan 108): every change goes to the API,
// shows at once from the set it returns, and the course is downloaded again behind it, since a change
// to one set (a phrase deleted, one that moved) can reach another. Signed out, it asks for sign-in.
import { addPhrase, createSet, deletePhrase, deleteSet, editPhrase, SetDetail, SetItem, updateSet } from '@shared/api/library';
import { forgetSet, keepSetChange } from '@shared/api/contentCache';
import { findContentPhrase, findSet, PhraseSet } from '@shared/content';
import type { WrittenNotes } from '@shared/generate/remote';
import { useNav } from '@shared/nav/NavContext';
import { notesIn } from '@shared/generate/publish';
import { findPhrase, promptOf, sameKey } from '@shared/state/catalog';
import type { LearnerState } from '@shared/state/types';
import { tidy } from '@shared/state/limits';
import { problemText } from '../ui/problems';
import { useToast } from '../ui/Toast';
import { useAccount } from './account';
import { useContent } from './content';
import { useCopy, useStore } from './store';

/**
 * What a set of the learner's lists for these phrases: Loro's and their own by reference, so each
 * keeps one progress; another learner's (from a set they saved) as a copy, which the server allows.
 */
function itemsFor(learner: LearnerState, phraseIds: string[]): SetItem[] {
  return [...new Set(phraseIds)].flatMap((id): SetItem[] => {
    const phrase = findPhrase(learner, id);
    if (!phrase) return [];
    const owner = findSet(phrase.setId)?.owner;
    if (owner === 'loro' || owner === 'me') return [{ ref: id }];
    const native = learner.profile.nativeLang;
    return [{ target: phrase.target, native: promptOf(phrase, native).text, image: [...phrase.image], notes: notesIn(phrase, native), source: 'course' }];
  });
}

export function useMySets() {
  const c = useCopy();
  const nav = useNav();
  const account = useAccount();
  const content = useContent();
  const { toast } = useToast();
  const { state } = useStore();
  const { targetLang, nativeLang } = state.learner.profile;
  const signedIn = account.status === 'signedIn';

  /** Runs a change; resolves to its result, or undefined when signed out or it failed (and said so). */
  const run = async <T>(work: () => Promise<T>): Promise<T | undefined> => {
    if (!signedIn) {
      nav.openAccount();
      return undefined;
    }
    try {
      const out = await work();
      void content.refresh();
      return out;
    } catch (error) {
      toast(problemText(c, error));
      return undefined;
    }
  };
  const kept = async (detail: SetDetail) => {
    await keepSetChange(detail);
    return detail;
  };

  return {
    signedIn,
    /** A new set of the learner's, listing `phraseIds`; resolves to its id. */
    createSet: (title: string, phraseIds: string[] = []) =>
      run(async () => (await kept(await createSet({ title: tidy(title), targetLang, nativeLang, visibility: 'private', phrases: itemsFor(state.learner, phraseIds) }))).set.id),
    addToSet: (setId: string, phraseIds: string[]) => run(async () => kept(await updateSet(setId, { addPhrases: itemsFor(state.learner, phraseIds) }))),
    /** Takes a phrase out of a set: one the set holds and no other lists is deleted with it. */
    removeFromSet: (setId: string, phraseId: string) => run(async () => kept(await updateSet(setId, { removePhraseIds: [phraseId] }))),
    /** Puts a listed phrase back where it was. */
    restoreToSet: (set: PhraseSet, phraseId: string, at: number) =>
      run(async () => {
        const order = set.phraseIds.filter((id) => id !== phraseId);
        order.splice(at, 0, phraseId);
        return kept(await updateSet(set.id, { addPhrases: [{ ref: phraseId }], order }));
      }),
    move: (set: PhraseSet, phraseId: string, delta: -1 | 1) =>
      run(async () => {
        const order = [...set.phraseIds];
        const from = order.indexOf(phraseId);
        const to = from + delta;
        if (from === -1 || to < 0 || to >= order.length) return undefined;
        [order[from], order[to]] = [order[to], order[from]];
        return kept(await updateSet(set.id, { order }));
      }),
    rename: (setId: string, title: string) => run(async () => kept(await updateSet(setId, { title: tidy(title) }))),
    deleteSet: (setId: string) =>
      run(async () => {
        await deleteSet(setId);
        await forgetSet(setId);
        return true;
      }),
    /**
     * A phrase the learner wrote: into `setId`, or their "My phrases" set. The server writes its notes
     * and picture (plan 108); resolves to the new phrase's id.
     */
    addPhrase: (target: string, native: string, setId?: string) =>
      run(async () => {
        const detail = await kept(
          await addPhrase({ phrase: { target: tidy(target), native: tidy(native), source: 'written' }, targetLang, nativeLang, ...(setId ? { setId } : {}), inboxTitle: c.library.myPhrases }),
        );
        const key = sameKey(target);
        return [...detail.phrases].reverse().find((p) => p.setId === detail.set.id && sameKey(p.target) === key)?.id;
      }),
    /** New words for a phrase the learner holds; notes sent (the AI writer's) are kept, otherwise written again. */
    editPhrase: (phraseId: string, target: string, native: string, notes?: WrittenNotes) =>
      run(async () => {
        const home = findSet(findContentPhrase(phraseId)?.setId);
        if (!home) throw new Error('not held');
        const written = notes ? { notes: notes.notes, image: notes.image, notesBy: notes.provider } : {};
        return kept(await editPhrase(home.id, phraseId, { target: tidy(target), native: tidy(native), ...written }));
      }),
    /** Deletes a phrase of the learner's from every set of theirs. */
    deletePhrase: (phraseId: string) =>
      run(async () => {
        await deletePhrase(phraseId);
        await content.refresh();
        return true;
      }),
  };
}

export type MySets = ReturnType<typeof useMySets>;
