import { describe, expect, it } from 'vitest'
import {
  clearCatalogAudioFiles,
  playbackSource,
  registerCatalogAudioFile,
  resolveCatalogAudioUri,
} from './catalogAudio'

describe('catalog audio identity', () => {
  it('plays a registered sha256 file and ignores an unmatched digest', () => {
    const sha256 = 'a'.repeat(64)
    expect(resolveCatalogAudioUri({ uri: `sha256/${sha256}`, sha256 })).toBeUndefined()
    registerCatalogAudioFile(sha256, 'file:///tmp/clip.m4a')
    expect(resolveCatalogAudioUri({ uri: `sha256/${sha256}`, sha256 })).toBe('file:///tmp/clip.m4a')
    expect(
      resolveCatalogAudioUri({ uri: `sha256/${sha256}`, sha256: 'b'.repeat(64) }),
    ).toBeUndefined()
    clearCatalogAudioFiles()
    expect(resolveCatalogAudioUri({ uri: `sha256/${sha256}`, sha256 })).toBeUndefined()
  })

  it('prefers catalog files over API TTS when the file is present', () => {
    const sha256 = 'c'.repeat(64)
    registerCatalogAudioFile(sha256, 'https://example.test/clip.wav')
    expect(playbackSource({ uri: `sha256/${sha256}`, sha256 }, false)).toBe('catalog')
    expect(playbackSource(undefined, true)).toBe('api-tts')
    expect(playbackSource(undefined, false)).toBe('unavailable')
    clearCatalogAudioFiles()
  })

  it('treats catalog identity as a cloud object, never a device path', () => {
    const sha256 = 'd'.repeat(64)
    expect(
      resolveCatalogAudioUri({
        uri: 'https://cdn.loro.test/clips/din2.m4a',
        sha256,
      }),
    ).toBe('https://cdn.loro.test/clips/din2.m4a')
    expect(
      resolveCatalogAudioUri({
        uri: 'file:///tmp/clip.m4a',
        sha256,
      }),
    ).toBeUndefined()
    expect(playbackSource({ uri: 'file:///tmp/clip.m4a', sha256 }, true)).toBe('api-tts')
    registerCatalogAudioFile(sha256, 'data:audio/m4a;base64,AA==')
    expect(resolveCatalogAudioUri({ uri: `sha256/${sha256}`, sha256 })).toBeUndefined()
  })
})
