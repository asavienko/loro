/** Catalog audio identity only. Never holds PCM. */

export interface CatalogAudio {
  readonly uri: string
  readonly sha256: string
  readonly ms?: number
}

const SHA_URI = /^sha256\/([a-f0-9]{64})$/
const PLAYABLE = /^(https?:|file:|content:|blob:|data:)/i

/** Optional bundled/on-disk map from digest to a native-playable URI. */
const files = new Map<string, string>()

export function registerCatalogAudioFile(sha256: string, uri: string): void {
  if (!/^[a-f0-9]{64}$/.test(sha256) || !uri.trim()) return
  files.set(sha256, uri)
}

export function clearCatalogAudioFiles(): void {
  files.clear()
}

export function resolveCatalogAudioUri(audio: CatalogAudio | null | undefined): string | undefined {
  if (audio === undefined || audio === null) return undefined
  if (PLAYABLE.test(audio.uri)) return audio.uri
  const digest = SHA_URI.exec(audio.uri)?.[1]
  if (digest === undefined || digest !== audio.sha256) return undefined
  return files.get(digest)
}

export function playbackSource(
  audio: CatalogAudio | null | undefined,
  apiReady: boolean,
): 'catalog' | 'api-tts' | 'unavailable' {
  if (resolveCatalogAudioUri(audio) !== undefined) return 'catalog'
  if (apiReady) return 'api-tts'
  return 'unavailable'
}
