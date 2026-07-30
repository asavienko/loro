/**
 * Read-side hooks: derived views of the store, never a second copy of its data.
 *
 * Everything here is computed on render from `phrases`. A derived value that was stored
 * instead would need a writer, and a writer for a derived value is a field that can be
 * wrong (masteryBucket is `Loro.dc.html:2828` — derived, never stored).
 */

import { countMasteryBuckets, MASTERY_BUCKETS } from '@loro/core'
import { useApp } from './store'
import { toView, type PhraseView } from './view'

export const useViews = (): PhraseView[] => useApp((s) => s.phrases).map(toView)

/**
 * Phrase counts per mastery bucket, in histogram order.
 *
 * Both order and counting come from core so every histogram consumes one closed set.
 */
export function useMastery(): { key: string; count: number }[] {
  const phrases = useApp((s) => s.phrases)
  const counts = countMasteryBuckets(phrases)
  return MASTERY_BUCKETS.map((key) => ({ key, count: counts[key] }))
}
