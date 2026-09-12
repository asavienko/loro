/**
 * Catalog audio is a cloud object `{uri, sha256, ms}`.
 * `content:render` writes a content-addressed `sha256/<digest>` identity first;
 * publish replaces that with an `https` URL. The device caches the URL to a file
 * URI. JS never receives PCM. Share-out-of-app stays on Listen export (Q-22).
 */

const CONTENT_ADDRESSED = /^sha256\/([a-f0-9]{64})$/

export function isContentAddressedAudioUri(uri: string, sha256: string): boolean {
  const digest = CONTENT_ADDRESSED.exec(uri)?.[1]
  return digest !== undefined && digest === sha256
}

export function isCloudAudioUri(uri: string): boolean {
  try {
    const url = new URL(uri)
    if (url.username || url.password) return false
    if (url.protocol === 'https:') return true
    return (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]')
    )
  } catch {
    return false
  }
}

export function cloudCatalogAudio<T extends { uri: string }>(audio: T | undefined): T | undefined {
  if (audio === undefined) return undefined
  return isCloudAudioUri(audio.uri) ? audio : undefined
}
