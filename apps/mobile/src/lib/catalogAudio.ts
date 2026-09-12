/** Catalog audio identity only. Never holds PCM.
 * Cloud URL in; `practiceTts` caches the file on native. */
import { isCloudAudioUri } from '@loro/content'

export interface CatalogAudio {
  readonly uri: string
  readonly sha256: string
  readonly ms?: number
}

export function resolveCatalogAudioUri(audio: CatalogAudio | null | undefined): string | undefined {
  if (audio === undefined || audio === null) return undefined
  return isCloudAudioUri(audio.uri) ? audio.uri : undefined
}

export function playbackSource(
  audio: CatalogAudio | null | undefined,
  apiReady: boolean,
): 'catalog' | 'api-tts' | 'unavailable' {
  if (resolveCatalogAudioUri(audio) !== undefined) return 'catalog'
  if (apiReady) return 'api-tts'
  return 'unavailable'
}
