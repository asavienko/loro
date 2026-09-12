/** Discover association adapter. Rust owns the order; this only shapes inputs. */
import { isCloudAudioUri } from '@loro/content'
import { coreCall } from './core'
import type { Cefr, PhraseState } from '@loro/core'

export function catalogAssociationFlags(phrase: {
  audio?: { uri: string }
  respIpa?: string
  syl?: readonly unknown[]
  hint?: string
  teaching?: Partial<Record<string, { hint?: string } | undefined>>
}): {
  hasAudio: boolean
  hasRespIpa: boolean
  hasSyl: boolean
  hasHint: boolean
} {
  return {
    hasAudio: phrase.audio !== undefined && isCloudAudioUri(phrase.audio.uri),
    hasRespIpa: phrase.respIpa !== undefined,
    hasSyl: (phrase.syl?.length ?? 0) > 0,
    hasHint:
      phrase.hint !== undefined ||
      Object.values(phrase.teaching ?? {}).some((row) => row?.hint !== undefined),
  }
}

export function ownedCountsByTheme(
  owned: readonly PhraseState[],
  catalog: readonly { id: string; theme: string }[],
): Map<string, number> {
  const byId = new Map(catalog.map((phrase) => [phrase.id, phrase.theme]))
  const counts = new Map<string, number>()
  for (const row of owned) {
    const theme = row.phraseId !== null ? byId.get(row.phraseId) : row.ownTheme
    if (theme === undefined) continue
    counts.set(theme, (counts.get(theme) ?? 0) + 1)
  }
  return counts
}

export function highestOwnedCefr(
  owned: readonly PhraseState[],
  catalog: readonly { id: string; cefr?: Cefr }[],
): Cefr | undefined {
  const rank: Record<Cefr, number> = { A1: 0, A2: 1, B1: 2, B2: 3 }
  const byId = new Map(catalog.map((phrase) => [phrase.id, phrase]))
  let best: Cefr | undefined
  for (const row of owned) {
    if (row.phraseId === null) continue
    const cefr = byId.get(row.phraseId)?.cefr
    if (cefr === undefined) continue
    if (best === undefined || rank[cefr] > rank[best]) best = cefr
  }
  return best
}

/** Fail closed: a bad payload or missing core must not substitute a JS order. */
export function orderAssociatedIds(input: unknown): string[] {
  try {
    const ids = coreCall<unknown>('assoc_order', input)
    if (!Array.isArray(ids)) return []
    const ordered = ids.filter((id): id is string => typeof id === 'string')
    if (ordered.length !== ids.length) return []
    return ordered
  } catch {
    return []
  }
}
