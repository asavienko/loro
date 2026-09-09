import { rustCoreFacade } from '../coreFacade'
import { EMPTY_REFRAIN_RESUME } from '../state'
/**
 * The learner's collection: adding a phrase, removing it, and the flags they set on it.
 *
 * Everything here writes a field the LEARNER owns — difficulty, tags, loved, learned, the
 * note. Nothing here writes a progress field; those arrive as a `ProgressDelta` and go
 * through `slices/practice.ts`.
 */

import { catalogPhraseId, type PhraseState } from '@loro/core'
import { copy } from '../../lib/copy'
import { loadLearningCatalog } from '../catalog'
import { blankPhraseState, newOwnPhrase } from '../phraseFactory'
import type { Slice, SliceContext } from '../types'

/**
 * Replace one row, by row id, leaving the array otherwise untouched.
 *
 * Five actions differed only in the patch, and each spelled out the same `map` — one of
 * them getting the identity check wrong is invisible in review. NOT for a progress field:
 * those are `applyDelta`'s alone.
 */
function updatePhrase(
  ctx: SliceContext,
  id: string,
  patch: (p: PhraseState) => Partial<PhraseState>,
): void {
  ctx.set((st) => ({
    phrases: st.phrases.map((p) => (p.id === id ? { ...p, ...patch(p) } : p)),
  }))
}

export const createPhrasesSlice: Slice<
  | 'addPhrase'
  | 'addOwnPhrase'
  | 'removePhrase'
  | 'setDifficulty'
  | 'toggleTag'
  | 'toggleLoved'
  | 'markLearned'
  | 'setNote'
> = (ctx) => {
  const { set, get, deps } = ctx

  return {
    addPhrase: (catalogId, o = {}) => {
      const cat = loadLearningCatalog(get().targetLocale, get().nativeLanguage).phrases.find(
        (p) => p.id === catalogId,
      )
      if (cat === undefined) return
      // Adding the same phrase twice is a no-op (Loro.dc.html:3602). The guard compares
      // CATALOG ids: comparing row ids would never match, since every row id is fresh.
      if (get().phrases.some((p) => p.phraseId === catalogPhraseId(catalogId))) return

      const next = {
        ...blankPhraseState(
          deps.newId(),
          catalogPhraseId(cat.id),
          o.source ?? 'discover',
          deps.clock.now(),
        ),
        difficulty: o.difficulty ?? 'med',
        tags: o.tags ?? [],
      }
      set((st) => ({ phrases: [...st.phrases, next] }))
      // Undo removes the row that was just created, by its row id. Passing the catalog
      // id here would have removed nothing.
      get().showToast(copy.toast.added, () => {
        get().removePhrase(next.id)
      })
    },

    addOwnPhrase: (draft, o = {}) => {
      const next = {
        ...newOwnPhrase(deps.newId(), draft, deps.clock.now(), o.source ?? 'custom'),
        ownMeaningLanguage: get().nativeLanguage,
        targetLocale: get().targetLocale,
        difficulty: o.difficulty ?? 'med',
        tags: o.tags ?? [],
      }
      set((st) => ({ phrases: [...st.phrases, next] }))
      get().showToast(copy.toast.addedOwn, () => {
        get().removePhrase(next.id)
      })
      return next.id
    },

    /**
     * Remove a row, and offer it back for the length of the toast.
     *
     * ── Why the undo restores rather than re-adds (`P2-13`) ──
     * A re-`addPhrase` typechecks and is the wrong fix: it mints a fresh row id, zeroes `reps`,
     * `srs` and `lockInDays`, and loses the note, the tags and the difficulty — a different
     * phrase wearing the same Spanish. So the removed `PhraseState` is kept in the closure and
     * put back verbatim, at the INDEX it held, and today's set is repaired around it.
     *
     * Removing used to be silent: no confirmation, which FS §3 omits on purpose, AND no undo,
     * which is what was supposed to cover it. The phrase, its tags, its memory hook and its whole
     * practice history went with one tap and no acknowledgement of any kind.
     *
     * `router.back()` fires immediately at the call site, so the toast has to outlive the
     * navigation. `ToastHost` is mounted in `_layout.tsx` above the stack, so it does.
     */
    removePhrase: (id) => {
      const before = get()
      const index = before.phrases.findIndex((p) => p.id === id)
      if (index < 0) return
      const row = before.phrases[index]
      if (row === undefined) return
      // Captured BEFORE the write, because `ensureRefrainSet` may substitute a replacement into
      // the hole this leaves, and putting the row back has to undo that too.
      const refrainSet = before.refrainSet
      const refrainSubstituted = before.refrainSubstituted
      const wasSelected = before.selectedId === id

      set((st) => ({
        phrases: st.phrases.filter((p) => p.id !== id),
        refrainResume: EMPTY_REFRAIN_RESUME,
        selectedId: wasSelected ? null : st.selectedId,
        refrainSet: st.refrainSet.filter((x) => x !== id),
        refrainSubstituted: st.refrainSubstituted.filter((x) => x !== id),
      }))
      // A day's set that loses a member must be refilled, not left short: "you always
      // see today" turns into "you see nothing today" once the last member is deleted.
      get().ensureRefrainSet()

      get().showToast(copy.toast.removed, () => {
        if (get().targetLocale !== before.targetLocale) return
        set((st) => {
          const restored = [...st.phrases]
          restored.splice(Math.min(index, restored.length), 0, row)
          return {
            phrases: restored,
            refrainSet,
            refrainSubstituted,
            ...(wasSelected ? { selectedId: id } : {}),
          }
        })
      })
    },

    setDifficulty: (id, d) => {
      updatePhrase(ctx, id, (phrase) => ({ difficulty: d, srs: rustCoreFacade.rerate(phrase, d) }))
      // The toast explains the CONSEQUENCE — that's what teaches the model.
      //
      get().showToast(copy.toast.difficulty[d])
    },

    toggleTag: (id, t) => {
      updatePhrase(ctx, id, (p) => ({
        tags: p.tags.includes(t) ? p.tags.filter((x) => x !== t) : [...p.tags, t],
      }))
    },

    toggleLoved: (id) => {
      const wasLoved = get().phrases.find((p) => p.id === id)?.loved ?? false
      updatePhrase(ctx, id, (p) => ({ loved: !p.loved }))
      get().showToast(wasLoved ? copy.toast.loved.removed : copy.toast.loved.added)
    },

    markLearned: (id, learned) => {
      updatePhrase(ctx, id, () => ({ learned }))
      get().showToast(learned ? copy.toast.learned.marked : copy.toast.learned.unmarked)
    },

    setNote: (id, note) => {
      updatePhrase(ctx, id, () => ({ note }))
    },
  }
}
