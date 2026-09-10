import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const modules = join(dirname(fileURLToPath(import.meta.url)), '../../modules')
const iosCache = readFileSync(
  join(modules, 'loro-audio-cache/ios/LoroAudioCacheModule.swift'),
  'utf8',
)
const androidCache = readFileSync(
  join(
    modules,
    'loro-audio-cache/android/src/main/java/expo/modules/loroaudiocache/LoroAudioCacheModule.kt',
  ),
  'utf8',
)
const iosSpeech = readFileSync(
  join(modules, 'loro-audio-speech/ios/LoroAudioSpeechModule.swift'),
  'utf8',
)
const androidSpeech = readFileSync(
  join(
    modules,
    'loro-audio-speech/android/src/main/java/expo/modules/loroaudiospeech/LoroAudioSpeechModule.kt',
  ),
  'utf8',
)

describe('iOS/Android listening cache and playFile parity', () => {
  it('keeps mux/share gated, sends download auth, and re-hashes on lookup and restore', () => {
    for (const source of [iosCache, androidCache]) {
      expect(source).toMatch(/shareEnabled = false/)
      expect(source).toMatch(/share-gated/)
      expect(source).toContain('Authorization')
      expect(source).toContain('X-Loro-Device')
      expect(source).toContain('checksum-mismatch')
      expect(source).toContain('expectedSha256')
      expect(source).toMatch(/sha256Hex|sha256File/)
    }
    expect(iosCache).toContain('RedirectDeny')
    expect(iosCache).toContain('timeoutIntervalForResource = 15')
    expect(iosCache).toContain('httpShouldSetCookies = false')
    expect(androidCache).toContain('instanceFollowRedirects = false')
    expect(androidCache).toContain('useCaches = false')
    expect(androidCache).toContain('setRequestProperty("Cookie", "")')
    expect(androidCache).toContain('fixture-http-download')
    expect(iosCache).toContain('fixture-http-download')
    expect(androidCache).toContain('listen-fixture.m4a')
    expect(iosCache).toContain('listen-fixture.m4a')
    expect(androidCache).toContain('ServerSocket')
  })

  it('stops cached playFile off-foreground and refuses missing files on both platforms', () => {
    expect(androidSpeech).toContain('OnActivityEntersBackground')
    expect(androidSpeech).toContain('stopPlayback()')
    expect(androidSpeech).toContain('!foreground')
    expect(androidSpeech).toContain('File(path).isFile')
    expect(iosSpeech).toContain('didEnterBackgroundNotification')
    expect(iosSpeech).toContain('stopPlayback()')
    expect(iosSpeech).toContain('applicationState == .active')
    expect(iosSpeech).toContain('fileExists(atPath: url.path)')
    expect(iosSpeech.match(/func audioPlayerDidFinishPlaying/g)).toHaveLength(1)
    expect(androidSpeech).toContain('playFile uri=')
    expect(iosSpeech).toContain('playFile uri=')
  })
})
