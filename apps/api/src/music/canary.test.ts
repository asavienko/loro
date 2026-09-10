import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = dirname(fileURLToPath(import.meta.url))

describe('music privacy canary (p3d-14)', () => {
  it('does not reference capture, ASR, voice clone, or conditioning_ref', () => {
    const files = [
      'music.controller.ts',
      'music.service.ts',
      'lyrics.coordinator.ts',
      'repository.ts',
      '../integrations/elevenlabs/music.ts',
    ]
    for (const file of files) {
      const src = readFileSync(join(root, file), 'utf8')
      expect(src, file).not.toMatch(
        /conditioning_ref|AudioRefChunk|voiceClone|speech-to-speech|native-capture|pcmHandle|audio_path/i,
      )
    }
  })
})
