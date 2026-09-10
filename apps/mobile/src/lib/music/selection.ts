import { isActive, MUSIC_MAX_PHRASES, MUSIC_MIN_PHRASES } from '@loro/core'
import type { PhraseView } from '../../store/view'

export { MUSIC_MAX_PHRASES, MUSIC_MIN_PHRASES }

export function isCatalogMusicRow(view: PhraseView): boolean {
  return view.phraseId !== null && view.catalog !== null && view.catalog.deprecatedBy === undefined
}

export function musicPickerRows(views: readonly PhraseView[]): PhraseView[] {
  return views.filter((view) => isCatalogMusicRow(view) && (isActive(view) || view.loved))
}

export function uniqueCatalogIds(views: readonly PhraseView[]): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const view of views) {
    if (view.phraseId === null || seen.has(view.phraseId)) continue
    seen.add(view.phraseId)
    ids.push(view.phraseId)
  }
  return ids
}

export function todayPresetCatalogIds(
  views: readonly PhraseView[],
  refrainSet: readonly string[],
): string[] {
  const preset = uniqueCatalogIds(
    views.filter((view) => refrainSet.includes(view.id) && isCatalogMusicRow(view)),
  )
  return preset.length >= MUSIC_MIN_PHRASES ? preset.slice(0, MUSIC_MAX_PHRASES) : []
}

export function selectionInBounds(catalogIds: readonly string[]): boolean {
  const unique = new Set(catalogIds)
  return (
    unique.size === catalogIds.length &&
    unique.size >= MUSIC_MIN_PHRASES &&
    unique.size <= MUSIC_MAX_PHRASES
  )
}
