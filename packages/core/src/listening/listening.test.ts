import { describe, expect, it } from 'vitest'
import { TARGET_LOCALES } from '../domain/languages.js'
import { REPEAT_TARGET, type PhraseState } from '../domain/phrase.js'
import { catalogPhraseId, userPhraseId } from '../domain/ids.js'
import {
  APPROVED_LISTENING_VOICES,
  CATALOG_REFERENCE_VOICES,
  CATALOG_TTS_MODEL_ID,
  ELEVENLABS_MULTILINGUAL_V2,
  LISTENING_ASSET_CLASS,
  LISTENING_CODEC,
  LISTENING_MIN_VOICES,
  LISTENING_MODEL_ID,
  LISTENING_REPEATS_DEFAULT,
  LISTENING_SHARE_ENABLED,
  LISTENING_VOICE_DECISION,
  REFERENCE_ASSET_CLASS,
  activeListeningPhrases,
  approvedListeningVoices,
  canGenerateListening,
  canListenFromCache,
  canShareListening,
  clampListeningRepeats,
  contentAddressFilename,
  contentAddressUri,
  isApprovedListeningVoice,
  isCatalogReferenceVoice,
  isLearnerAuthoredListeningText,
  isPinnedListeningModel,
  listeningAllowlistReady,
  listeningBlockers,
  listeningClipKey,
  listeningRepeatChoices,
  listeningShareFilename,
  listeningVoiceSequence,
  normalizeListeningText,
  planListeningBatch,
  selectLicensedListeningVoices,
} from './index.js'

/** Official default voice that expires 2026-12-31. Must never be a Loro pin. */
const EXPIRED_DEFAULT_RACHEL = '21m00Tcm4TlvDq8ikWAM'

const digestA = 'a'.repeat(64)
const digestB = 'b'.repeat(64)
const voices = [
  { id: 'voice-a', locale: 'es-ES' as const, name: 'A', licensed: true },
  { id: 'voice-b', locale: 'es-ES' as const, name: 'B', licensed: true },
]

function phrase(partial: Partial<PhraseState> & Pick<PhraseState, 'id'>): PhraseState {
  return {
    phraseId: catalogPhraseId('cafe1'),
    source: 'starter',
    difficulty: 'med',
    tags: [],
    loved: false,
    learned: false,
    note: null,
    plays: 0,
    reps: 0,
    addedAt: 1,
    lastPracticedAt: null,
    graduatedAt: null,
    srs: null,
    repsToday: 0,
    repsTodayDay: null,
    automaticity: 0,
    lockInDays: 0,
    rung: 0,
    stumbles: 0,
    cueLevel: 0,
    axPerception: 0,
    axRecall: 0,
    axProduction: 0,
    targetLocale: 'es-ES',
    ...partial,
  }
}

describe('AS-07 listening identity', () => {
  it('never lets a listening clip share a reference cache key', () => {
    const shared = {
      locale: 'es-ES' as const,
      phraseId: 'cafe1',
      textDigest: digestA,
      voiceId: 'same-voice',
      modelId: 'eleven_multilingual_v2',
      codec: LISTENING_CODEC,
    }
    expect(listeningClipKey({ ...shared, assetClass: LISTENING_ASSET_CLASS })).not.toBe(
      listeningClipKey({ ...shared, assetClass: REFERENCE_ASSET_CLASS }),
    )
  })

  it('invalidates on text digest or voice change', () => {
    const base = {
      assetClass: LISTENING_ASSET_CLASS,
      locale: 'es-ES' as const,
      phraseId: 'row-1',
      textDigest: digestA,
      voiceId: 'voice-a',
      modelId: 'model',
      codec: LISTENING_CODEC,
    }
    expect(listeningClipKey({ ...base, textDigest: digestB })).not.toBe(listeningClipKey(base))
    expect(listeningClipKey({ ...base, voiceId: 'voice-b' })).not.toBe(listeningClipKey(base))
    expect(contentAddressUri(digestA)).toBe(`sha256/${digestA}`)
    expect(contentAddressFilename(digestA)).toBe(`sha256/${digestA}.m4a`)
  })

  it('rejects an unknown codec or asset class instead of colliding keys', () => {
    const base = {
      assetClass: LISTENING_ASSET_CLASS,
      locale: 'es-ES' as const,
      phraseId: 'row-1',
      textDigest: digestA,
      voiceId: 'voice-a',
      modelId: 'model',
      codec: LISTENING_CODEC,
    }
    expect(() => listeningClipKey({ ...base, codec: 'mp3' })).toThrow(/AAC codec/)
    expect(() => listeningClipKey({ ...base, assetClass: 'practice' })).toThrow(/asset class/)
  })

  it('normalises target text so equivalent whitespace is one phrase', () => {
    expect(normalizeListeningText('  Un  café,   por favor. ')).toBe('Un café, por favor.')
  })

  it('treats learner-authored rows as a cloud-TTS consent event', () => {
    expect(isLearnerAuthoredListeningText({ phraseId: null, source: 'custom' })).toBe(true)
    expect(
      isLearnerAuthoredListeningText({ phraseId: catalogPhraseId('cafe1'), source: 'starter' }),
    ).toBe(false)
    expect(
      isLearnerAuthoredListeningText({
        phraseId: catalogPhraseId('cafe1'),
        source: 'import',
      }),
    ).toBe(true)
  })
})

describe('AS-07 listening batch', () => {
  it('keeps repeats 2–5 default 3 and independent of Stream difficulty counts', () => {
    expect(clampListeningRepeats(LISTENING_REPEATS_DEFAULT)).toBe(3)
    expect(clampListeningRepeats(1)).toBe(2)
    expect(clampListeningRepeats(9)).toBe(5)
    expect(listeningRepeatChoices()).toEqual([2, 3, 4, 5])
    expect(REPEAT_TARGET.hard).toBe(4)
    expect(REPEAT_TARGET.med).toBe(3)
    expect(REPEAT_TARGET.easy).toBe(2)
  })

  it('rotates distinct licensed voices then wraps when repeats exceed the roster', () => {
    expect(listeningVoiceSequence(voices, 3)).toEqual(['voice-a', 'voice-b', 'voice-a'])
    expect(listeningVoiceSequence(voices.slice(0, 1), 3)).toEqual([])
    expect(listeningVoiceSequence([], 3)).toEqual([])
  })

  it('plans one take per phrase×voice without mixing courses or inactive rows', () => {
    const lines = activeListeningPhrases(
      [
        phrase({ id: userPhraseId('0197a001-0000-7000-8000-000000000001'), targetLocale: 'es-ES' }),
        phrase({
          id: userPhraseId('0197a001-0000-7000-8000-000000000002'),
          targetLocale: 'bg-BG',
        }),
        phrase({
          id: userPhraseId('0197a001-0000-7000-8000-000000000003'),
          learned: true,
        }),
      ],
      'es-ES',
      () => 'Un café, por favor.',
    )
    expect(lines).toHaveLength(1)
    const batch = planListeningBatch(lines, voices, 3)
    expect(batch.map((take) => take.voiceId)).toEqual(['voice-a', 'voice-b', 'voice-a'])
    expect(new Set(batch.map((take) => take.phraseId)).size).toBe(1)
  })

  it('pins one catalog reference voice per locale, forever distinct from listening', () => {
    expect(CATALOG_TTS_MODEL_ID).toBe(ELEVENLABS_MULTILINGUAL_V2)
    const catalogIds = TARGET_LOCALES.map((locale) => CATALOG_REFERENCE_VOICES[locale].id)
    expect(new Set(catalogIds).size).toBe(TARGET_LOCALES.length)
    for (const locale of TARGET_LOCALES) {
      const voice = CATALOG_REFERENCE_VOICES[locale]
      expect(voice.locale).toBe(locale)
      expect(voice.id.length).toBeGreaterThanOrEqual(20)
      expect(voice.name.length).toBeGreaterThan(0)
      expect(isCatalogReferenceVoice(voice.id)).toBe(true)
    }
    expect(isCatalogReferenceVoice(EXPIRED_DEFAULT_RACHEL)).toBe(false)
  })

  it('pins ≥2 licensed listening voices per locale on eleven_multilingual_v2', () => {
    expect(LISTENING_VOICE_DECISION.modelId).toBe(ELEVENLABS_MULTILINGUAL_V2)
    expect(LISTENING_MODEL_ID).toBe(ELEVENLABS_MULTILINGUAL_V2)
    expect(APPROVED_LISTENING_VOICES).toBe(LISTENING_VOICE_DECISION.voices)
    expect(isPinnedListeningModel(ELEVENLABS_MULTILINGUAL_V2)).toBe(true)
    expect(isPinnedListeningModel('eleven_flash_v2_5')).toBe(false)
    expect(LISTENING_MIN_VOICES).toBe(2)
    expect(canShareListening()).toBe(false)
    expect(LISTENING_SHARE_ENABLED).toBe(false)
    const listeningIds: string[] = []
    for (const locale of TARGET_LOCALES) {
      const voices = approvedListeningVoices(locale)
      expect(listeningAllowlistReady(locale)).toBe(true)
      expect(voices.length).toBeGreaterThanOrEqual(LISTENING_MIN_VOICES)
      expect(new Set(voices.map((voice) => voice.id)).size).toBe(voices.length)
      for (const voice of voices) {
        expect(voice.licensed).toBe(true)
        expect(voice.locale).toBe(locale)
        expect(isCatalogReferenceVoice(voice.id)).toBe(false)
        expect(isApprovedListeningVoice(locale, voice.id)).toBe(true)
        listeningIds.push(voice.id)
      }
      expect(isApprovedListeningVoice(locale, CATALOG_REFERENCE_VOICES[locale].id)).toBe(false)
      expect(isApprovedListeningVoice(locale, EXPIRED_DEFAULT_RACHEL)).toBe(false)
    }
    expect(new Set(listeningIds).size).toBe(listeningIds.length)
    expect(
      canGenerateListening({
        phraseCount: 10,
        voiceCount: 2,
        modelPinned: true,
        network: true,
        configured: true,
        nativeCache: true,
        sessionBusy: false,
        diskFull: false,
        quotaExceeded: false,
      }),
    ).toBe(true)
    expect(canListenFromCache({ cacheComplete: true, nativeCache: true, sessionBusy: false })).toBe(
      true,
    )
    expect(canListenFromCache({ cacheComplete: true, nativeCache: true, sessionBusy: true })).toBe(
      false,
    )
    expect(
      canGenerateListening({
        phraseCount: 10,
        voiceCount: 2,
        modelPinned: true,
        network: true,
        configured: true,
        nativeCache: false,
        remotePlayback: true,
        sessionBusy: false,
        diskFull: false,
        quotaExceeded: false,
      }),
    ).toBe(true)
    expect(
      canListenFromCache({
        cacheComplete: true,
        nativeCache: false,
        remotePlayback: true,
        sessionBusy: false,
      }),
    ).toBe(true)
    expect(listeningShareFilename('es-ES', '2026-09-09')).toBe('loro-es-ES-2026-09-09-listen.m4a')
  })

  it('still reports empty-roster blockers and never enables Q-22 share', () => {
    expect(
      listeningBlockers({
        phraseCount: 10,
        voiceCount: 0,
        modelPinned: false,
        network: true,
        configured: false,
        nativeCache: false,
        sessionBusy: false,
        diskFull: false,
        quotaExceeded: false,
      }),
    ).toEqual(['voices-unapproved', 'model-unpinned', 'not-configured', 'native-unavailable'])
    expect(LISTENING_SHARE_ENABLED).toBe(false)
    expect(canShareListening()).toBe(false)
  })

  it('counts only licensed, locale-matching, unique ids toward the allowlist', () => {
    const catalogEs = CATALOG_REFERENCE_VOICES['es-ES'].id
    const mixed = [
      { id: 'voice-a', locale: 'es-ES' as const, name: 'A', licensed: true },
      { id: 'voice-a', locale: 'es-ES' as const, name: 'A dup', licensed: true },
      { id: 'voice-b', locale: 'es-ES' as const, name: 'B', licensed: false },
      { id: 'voice-c', locale: 'bg-BG' as const, name: 'C', licensed: true },
      { id: '', locale: 'es-ES' as const, name: 'empty', licensed: true },
      { id: catalogEs, locale: 'es-ES' as const, name: 'Aaron', licensed: true },
      { id: 'voice-d', locale: 'es-ES' as const, name: 'D', licensed: true },
    ]
    expect(selectLicensedListeningVoices(mixed, 'es-ES').map((voice) => voice.id)).toEqual([
      'voice-a',
      'voice-d',
    ])
    expect(selectLicensedListeningVoices(mixed, 'bg-BG').map((voice) => voice.id)).toEqual([
      'voice-c',
    ])
    expect(selectLicensedListeningVoices(mixed, 'ru-RU')).toEqual([])
  })
})
