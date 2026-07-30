/**
 * Read-side hooks: derived views of the store, never a second copy of its data.
 *
 * Everything here is computed on render from `phrases`. A derived value that was stored
 * instead would need a writer, and a writer for a derived value is a field that can be
 * wrong (masteryBucket is `Loro.dc.html:2828` — derived, never stored).
 */

import { masteryBucket, type MasteryBucket } from '@loro/core'
import { useApp } from './store'
import { toView, type PhraseView } from './view'

export const useViews = (): PhraseView[] => useApp((s) => s.phrases).map(toView)

/**
 * Phrase counts per mastery bucket, in histogram order.
 *
 * `Record<MasteryBucket, number>` rather than a bare object literal: a bucket added to the
 * union is then a type error at this declaration, instead of a bar the histogram silently
 * omits. Declaration order IS the display order.
 *
 * The bucket list itself is spelled out in four places across the repo (here, `progress.tsx`,
 * and two in core). The fix is not another local constant — it is a `MASTERY_BUCKETS` export
 * beside `DIFFICULTIES` and `TAGS` (`packages/core/src/domain/phrase.ts:38-39`), which is the
 * pattern core already uses for exactly this. That's a `packages/core` change, so it isn't
 * made here; typing the record is the part that can be done without one.
 */
export function useMastery(): { key: string; count: number }[] {
  const phrases = useApp((s) => s.phrases)
  const counts: Record<MasteryBucket, number> = { new: 0, learning: 0, strong: 0, mastered: 0 }
  for (const p of phrases) counts[masteryBucket(p)]++
  return Object.entries(counts).map(([key, count]) => ({ key, count }))
}
