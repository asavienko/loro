import { describe, expect, it } from 'vitest'
import { playbackSource, resolveCatalogAudioUri } from './catalogAudio'

describe('catalog audio identity', () => {
  it('plays a published cloud object and ignores unpublished or device paths', () => {
    const sha256 = 'a'.repeat(64)
    expect(
      resolveCatalogAudioUri({
        uri: 'https://cdn.loro.test/clips/din2.m4a',
        sha256,
      }),
    ).toBe('https://cdn.loro.test/clips/din2.m4a')
    expect(resolveCatalogAudioUri({ uri: `sha256/${sha256}`, sha256 })).toBeUndefined()
    expect(
      resolveCatalogAudioUri({
        uri: 'file:///tmp/clip.m4a',
        sha256,
      }),
    ).toBeUndefined()
  })

  it('prefers a cloud catalog object over API TTS', () => {
    const sha256 = 'c'.repeat(64)
    expect(playbackSource({ uri: 'https://cdn.loro.test/clips/din2.m4a', sha256 }, false)).toBe(
      'catalog',
    )
    expect(playbackSource({ uri: `sha256/${sha256}`, sha256 }, true)).toBe('api-tts')
    expect(playbackSource(undefined, true)).toBe('api-tts')
    expect(playbackSource(undefined, false)).toBe('unavailable')
  })

  it('treats catalog identity as a cloud object, never a device path', () => {
    const sha256 = 'd'.repeat(64)
    expect(playbackSource({ uri: 'file:///tmp/clip.m4a', sha256 }, true)).toBe('api-tts')
    expect(resolveCatalogAudioUri({ uri: 'data:audio/m4a;base64,AA==', sha256 })).toBeUndefined()
  })
})
