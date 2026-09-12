/**
 * Catalog audio is a cloud object `{uri, sha256, ms}`.
 * The device caches that URL to a file URI. JS never receives PCM.
 * Share-out-of-app stays on the Listen export route (Q-22).
 */

export function isCloudAudioUri(uri: string): boolean {
  try {
    const url = new URL(uri)
    if (url.username || url.password) return false
    if (url.protocol === 'https:') return true
    return (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === '[::1]' ||
        url.hostname === '::1')
    )
  } catch {
    return false
  }
}

export function cloudCatalogAudio<T extends { uri: string }>(audio: T | undefined): T | undefined {
  if (audio === undefined) return undefined
  return isCloudAudioUri(audio.uri) ? audio : undefined
}
