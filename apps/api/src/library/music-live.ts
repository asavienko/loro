/**
 * ElevenLabs Music for library songs (plan 106): one request per song, the lyrics in the prompt.
 * Only used when `MUSIC_PROVIDER=elevenlabs` and `MUSIC_API_KEY` are set; otherwise songs get the
 * demo instrumental. Provider bodies and the key are never logged or returned.
 */
import { musicStylePack } from '@loro/content'
import { DEFAULT_SONG_OPTIONS, type SongOptions } from '@loro/core'
import { config } from '../common/config.js'
import type { SongSection } from './writers.js'

const LANGUAGE_NAMES: Record<string, string> = {
  'en-GB': 'British English',
  'es-ES': 'Spanish (Spain)',
  'bg-BG': 'Bulgarian',
  'ru-RU': 'Russian',
  'en-US': 'American English',
  'pl-PL': 'Polish',
  'cs-CZ': 'Czech',
}
const MAX_AUDIO_BYTES = 12 * 1024 * 1024

/**
 * The learner's options as the music model reads them (plan 113). The theme is not here: it shaped
 * the lyrics, which are in the prompt, and the learner's own words never reach the music provider.
 */
const VOICE: Record<SongOptions['voice'], string | null> = {
  any: null,
  female: 'a female lead vocal',
  male: 'a male lead vocal',
  duet: 'a duet of a female and a male voice, trading lines and singing the chorus together',
}
/** `natural` is the style's own pace: its pack already says it. */
const TEMPO: Record<SongOptions['tempo'], string | null> = {
  slow: 'Keep a slow tempo, leaving space after each line',
  natural: null,
  lively: 'Keep a lively, upbeat tempo',
}
/** A pack's own words for its pace, left out when the learner chose another. */
const PACE_WORDS = /tempo|\bslow\b|\bfast\b/i
const MOOD: Record<NonNullable<SongOptions['mood']>, string> = {
  cheerful: 'cheerful, bright',
  calm: 'calm, soothing',
  romantic: 'romantic, warm',
  nostalgic: 'nostalgic, bittersweet',
  energetic: 'energetic, driving',
  playful: 'playful, light-hearted',
}

/** The words the music model is given for a song: style, mood, voice, tempo and the lyrics. */
export function livePrompt(input: {
  sections: SongSection[]
  styleId: string
  options?: SongOptions | undefined
  targetLang: string
}): string {
  const options = input.options ?? DEFAULT_SONG_OPTIONS
  const pack = musicStylePack(input.styleId)
  const lyrics = input.sections
    .map((section) => `[${section.name}]\n${section.lines.map((line) => line.text).join('\n')}`)
    .join('\n\n')
  const ownPace = TEMPO[options.tempo] === null
  const styles = [
    ...(options.mood ? [MOOD[options.mood]] : []),
    ...pack.positive_styles.filter((style) => ownPace || !PACE_WORDS.test(style)),
  ]
  const voice = VOICE[options.voice]
  const tempo = TEMPO[options.tempo]
  return [
    `A ${styles.join(', ')} song sung in ${LANGUAGE_NAMES[input.targetLang] ?? input.targetLang}${voice ? `, with ${voice}` : ''}.`,
    `${tempo ? `${tempo}. ` : ''}Sing these lyrics exactly, clearly enough for a language learner to follow every word:`,
    lyrics,
    `Avoid: ${pack.negative_styles.join(', ')}.`,
  ].join('\n\n')
}

export function liveMusicConfigured(): boolean {
  return config.musicProvider() === 'elevenlabs' && Boolean(config.musicApiKey()?.trim())
}

/** The song as MP3, or throws; the caller records the failure on the song. */
export async function composeLive(input: {
  sections: SongSection[]
  styleId: string
  options?: SongOptions | undefined
  targetLang: string
  lengthMs: number
  send?: typeof fetch
}): Promise<{ bytes: Uint8Array; contentType: 'audio/mpeg' }> {
  const apiKey = config.musicApiKey()?.trim()
  if (!apiKey) throw new Error('unavailable')
  const prompt = livePrompt(input)
  const response = await (input.send ?? fetch)(
    `${config.musicBaseUrl()}/v1/music?output_format=mp3_44100_128`,
    {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(180_000),
      headers: { 'content-type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({ prompt, music_length_ms: input.lengthMs, model_id: 'music_v1' }),
    },
  )
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(response.status === 429 ? 'rate_limited' : 'provider')
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength < 1024 || bytes.byteLength > MAX_AUDIO_BYTES)
    throw new Error('invalid_audio')
  return { bytes, contentType: 'audio/mpeg' }
}
