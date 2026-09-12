/** Process-wide TTS transport. Nest registers this once; callers never construct per request. */

import {
  ElevenLabsTts,
  StubTts,
  parseTtsConfig,
  type TtsRequest,
  type TtsResult,
} from '../integrations/elevenlabs/tts.js'
import { config } from '../common/config.js'

export const TTS_TRANSPORT = Symbol('TTS_TRANSPORT')
export const TTS_RUNTIME_CONFIG = Symbol('TtsRuntimeConfig')

export type TtsRuntimeConfig = ReturnType<typeof parseTtsConfig> | null

export function readTtsRuntimeConfig(): TtsRuntimeConfig {
  try {
    return parseTtsConfig(config.ttsEnv())
  } catch {
    return null
  }
}

export interface TtsTransport {
  synthesize(input: TtsRequest): Promise<TtsResult>
}

export function createTtsTransport(
  parsed: TtsRuntimeConfig = readTtsRuntimeConfig(),
): TtsTransport {
  try {
    if (parsed === null) return new StubTts()
    if (parsed.provider !== 'elevenlabs') {
      return new StubTts({ stubRender: parsed.stubRender })
    }
    return new ElevenLabsTts({
      apiKey: parsed.apiKey,
      model: parsed.model,
      outputFormat: parsed.outputFormat,
      timeoutMs: 8_000,
      maxRequestBytes: 16_384,
      maxResponseBytes: 2_000_000,
      maxConcurrentRequests: 2,
    })
  } catch {
    return new StubTts()
  }
}
