import { silentWavBytes } from './wav.js'

export const MUSIC_FIXTURE_WAV = silentWavBytes()

export const MUSIC_HTTP_FIXTURES = {
  compose: {
    status: 200,
    headers: { 'content-type': 'audio/mpeg' },
    body: MUSIC_FIXTURE_WAV,
  },
  bad_prompt: {
    status: 400,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      detail: { status: 'bad_prompt', message: 'copyrighted input' },
    }),
  },
  bad_composition_plan: {
    status: 400,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      detail: { status: 'bad_composition_plan', message: 'invalid plan' },
    }),
  },
  rate_limited: {
    status: 429,
    headers: { 'retry-after': '2', 'content-type': 'application/json' },
    body: JSON.stringify({ detail: { status: 'rate_limited' } }),
  },
  truncated: {
    status: 200,
    headers: { 'content-type': 'audio/mpeg' },
    body: new Uint8Array([0xff, 0xfb]),
  },
} as const

export type MusicFixtureName = keyof typeof MUSIC_HTTP_FIXTURES
