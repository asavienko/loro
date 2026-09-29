/**
 * ElevenLabs Music for library songs (plan 106): one request per song, the lyrics in the prompt.
 * Only used when `MUSIC_PROVIDER=elevenlabs` and `MUSIC_API_KEY` are set; otherwise songs get the
 * demo instrumental. Provider bodies and the key are never logged or returned.
 */
import { musicStylePack } from '@loro/content'
import { config } from '../common/config.js'
import type { SongSection } from './writers.js'

const LANGUAGE_NAMES: Record<string, string> = { 'es-ES': 'Spanish (Spain)', 'bg-BG': 'Bulgarian' }
const MAX_AUDIO_BYTES = 12 * 1024 * 1024

export function liveMusicConfigured(): boolean {
  return config.musicProvider() === 'elevenlabs' && Boolean(config.musicApiKey()?.trim())
}

/** The song as MP3, or throws; the caller records the failure on the song. */
export async function composeLive(input: {
  sections: SongSection[]
  styleId: string
  targetLang: string
  lengthMs: number
  send?: typeof fetch
}): Promise<{ bytes: Uint8Array; contentType: 'audio/mpeg' }> {
  const apiKey = config.musicApiKey()?.trim()
  if (!apiKey) throw new Error('unavailable')
  const pack = musicStylePack(input.styleId)
  const lyrics = input.sections
    .map((section) => `[${section.name}]\n${section.lines.map((line) => line.text).join('\n')}`)
    .join('\n\n')
  const prompt = [
    `A ${pack.positive_styles.join(', ')} song sung in ${LANGUAGE_NAMES[input.targetLang] ?? input.targetLang}.`,
    'Sing these lyrics exactly, slowly and clearly enough for a language learner to follow every word:',
    lyrics,
    `Avoid: ${pack.negative_styles.join(', ')}.`,
  ].join('\n\n')
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
