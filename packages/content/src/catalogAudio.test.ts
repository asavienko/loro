import { describe, expect, it } from 'vitest'
import { cloudCatalogAudio, isCloudAudioUri, isContentAddressedAudioUri } from './catalogAudio.js'

describe('catalog cloud audio URIs', () => {
  it('accepts https cloud objects and local authoring http', () => {
    expect(isCloudAudioUri('https://cdn.loro.test/clips/din2.m4a')).toBe(true)
    expect(isCloudAudioUri('http://127.0.0.1:3000/v1/tts/files/din2')).toBe(true)
    expect(isCloudAudioUri('http://localhost:3000/v1/tts/files/din2')).toBe(true)
    expect(isCloudAudioUri('http://[::1]:3000/v1/tts/files/din2')).toBe(true)
    expect(isCloudAudioUri('http://::1/v1/tts/files/din2')).toBe(false)
    expect(isCloudAudioUri('https://cdn.loro.test/clips/din2.m4a?sig=abc')).toBe(true)
  })

  it('rejects device paths, data URLs and credentialed URIs', () => {
    expect(isCloudAudioUri('file:///data/clip.m4a')).toBe(false)
    expect(isCloudAudioUri('data:audio/m4a;base64,AA==')).toBe(false)
    expect(isCloudAudioUri('https://user:secret@cdn.loro.test/clip.m4a')).toBe(false)
    expect(
      cloudCatalogAudio({ uri: 'file:///tmp/x', sha256: 'a'.repeat(64), ms: 1 }),
    ).toBeUndefined()
    expect(
      cloudCatalogAudio({ uri: 'https://cdn.loro.test/clip.m4a', sha256: 'a'.repeat(64), ms: 800 })
        ?.uri,
    ).toBe('https://cdn.loro.test/clip.m4a')
    const digest = 'ab'.repeat(32)
    expect(isContentAddressedAudioUri(`sha256/${digest}`, digest)).toBe(true)
    expect(isContentAddressedAudioUri(`sha256/${digest}`, 'cd'.repeat(32))).toBe(false)
    expect(isContentAddressedAudioUri('https://cdn.loro.test/clip.m4a', digest)).toBe(false)
  })
})
