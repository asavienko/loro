import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { audioDurationMs, silenceAac, silenceWav } from './audioDuration.js'
import { assertPublishable, renderCatalog, sha256Hex } from './render.js'
import { loadCatalog } from './index.js'

function catalogSlice(count = 2) {
  const catalog = loadCatalog()
  return { ...catalog, phrases: catalog.phrases.slice(0, count) }
}

const provenance = {
  provider: 'elevenlabs' as const,
  model: 'test-model',
  voiceId: 'voice-es',
  outputFormat: 'mp3_44100_128',
  locale: 'es-ES',
}

function mpeg1Layer3(frames: number, bitrateKbps: 128 | 256): Uint8Array {
  const sampleRate = 44_100
  const bitrateIndex = bitrateKbps === 256 ? 13 : 9
  const frameSize = Math.floor((144 * bitrateKbps * 1000) / sampleRate)
  const bytes = Buffer.alloc(frameSize * frames)
  for (let index = 0; index < frames; index += 1) {
    const offset = index * frameSize
    bytes[offset] = 0xff
    bytes[offset + 1] = 0xfb
    bytes[offset + 2] = bitrateIndex << 4
    bytes[offset + 3] = 0xc4
  }
  return bytes
}

describe('audio duration', () => {
  it('reads WAV duration from the container instead of estimating from text', () => {
    expect(audioDurationMs(silenceWav(250))).toBe(250)
    expect(audioDurationMs(Buffer.from('not audio'))).toBeNull()
  })

  it('walks MPEG-1 Layer III frames instead of inventing duration from text', () => {
    expect(audioDurationMs(mpeg1Layer3(2, 128))).toBe(52)
    expect(audioDurationMs(mpeg1Layer3(2, 256))).toBe(52)
  })

  it('reads ISO BMFF duration from the labeled silent AAC fixture', () => {
    expect(audioDurationMs(silenceAac())).toBe(200)
  })
})

describe('content:render pipeline', () => {
  it('dry-run estimates characters without synthesizing', async () => {
    const synthesize = vi.fn()
    const dir = await mkdtemp(join(tmpdir(), 'loro-render-'))
    const catalog = catalogSlice()
    const report = await renderCatalog(catalog, synthesize, {
      dryRun: true,
      creditCeiling: 10_000,
      locale: 'es-ES',
      voiceId: 'voice-es',
      outputDir: dir,
    })
    expect(synthesize).not.toHaveBeenCalled()
    expect(report.rendered).toBe(0)
    expect(report.estimatedCharacters).toBe(
      catalog.phrases.reduce((sum, p) => sum + p.es.length, 0),
    )
    expect(report.phrases.every((p) => p.audio === undefined)).toBe(true)
  })

  it('writes checksummed audio and provenance, then skips a verified resume', async () => {
    const wav = silenceWav(200)
    const synthesize = vi.fn(() =>
      Promise.resolve({
        bytes: wav,
        contentType: 'audio/wav',
        provenance,
        characterCount: 12,
      }),
    )
    const dir = await mkdtemp(join(tmpdir(), 'loro-render-'))
    const first = await renderCatalog(catalogSlice(1), synthesize, {
      dryRun: false,
      creditCeiling: 10_000,
      locale: 'es-ES',
      voiceId: 'voice-es',
      outputDir: dir,
    })
    expect(first.rendered).toBe(1)
    expect(first.actualCharacters).toBe(12)
    const phrase = first.phrases[0]!
    expect(phrase.audio?.ms).toBe(200)
    expect(phrase.audio?.sha256).toBe(sha256Hex(wav))
    expect(JSON.parse(await readFile(join(dir, `${phrase.audio!.sha256}.json`), 'utf8'))).toEqual(
      provenance,
    )
    const second = await renderCatalog({ ...catalogSlice(1), phrases: first.phrases }, synthesize, {
      dryRun: false,
      creditCeiling: 10_000,
      locale: 'es-ES',
      voiceId: 'voice-es',
      outputDir: dir,
    })
    expect(second.skipped).toBe(1)
    expect(synthesize).toHaveBeenCalledTimes(1)
  })

  it('refuses stub provenance, missing duration and exhausted ceiling', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'loro-render-'))
    const catalog = catalogSlice(2)
    const stub = await renderCatalog(
      catalog,
      () =>
        Promise.resolve({
          bytes: silenceWav(100),
          contentType: 'audio/wav',
          provenance: { ...provenance, provider: 'stub' as const },
          characterCount: null,
        }),
      {
        dryRun: false,
        creditCeiling: 10_000,
        locale: 'es-ES',
        voiceId: 'voice-es',
        outputDir: dir,
      },
    )
    expect(stub.rendered).toBe(0)
    expect(stub.errors[0]?.code).toBe('stub')
    expect(() => {
      assertPublishable(stub, 'elevenlabs')
    }).toThrow(/publishable/)
    expect(() => {
      assertPublishable(stub, 'stub')
    }).toThrow(/stub/)

    const empty = await renderCatalog(
      catalogSlice(1),
      () =>
        Promise.resolve({
          bytes: Buffer.from('too-small'),
          contentType: 'audio/wav',
          provenance,
          characterCount: null,
        }),
      {
        dryRun: false,
        creditCeiling: 10_000,
        locale: 'es-ES',
        voiceId: 'voice-es',
        outputDir: dir,
        measureDuration: () => null,
      },
    )
    expect(empty.errors[0]?.code).toBe('duration')

    const ceiling = await renderCatalog(
      catalogSlice(2),
      () => {
        return Promise.reject(new Error('should not synthesize'))
      },
      {
        dryRun: false,
        creditCeiling: 1,
        locale: 'es-ES',
        voiceId: 'voice-es',
        outputDir: dir,
      },
    )
    expect(ceiling.errors.every((error) => error.code === 'ceiling')).toBe(true)
  })

  it('does not rewrite an approved asset when the voice id differs', async () => {
    const wav = silenceWav(100)
    const digest = sha256Hex(wav)
    const dir = await mkdtemp(join(tmpdir(), 'loro-render-'))
    await writeFile(join(dir, `${digest}.bin`), wav)
    await writeFile(
      join(dir, `${digest}.json`),
      JSON.stringify({ ...provenance, voiceId: 'old-voice' }),
    )
    const catalog = catalogSlice(1)
    catalog.phrases[0] = {
      ...catalog.phrases[0]!,
      audio: { uri: `sha256/${digest}`, sha256: digest, ms: 100 },
    }
    const synthesize = vi.fn(() =>
      Promise.resolve({
        bytes: silenceWav(120),
        contentType: 'audio/wav',
        provenance,
        characterCount: null,
      }),
    )
    const report = await renderCatalog(catalog, synthesize, {
      dryRun: false,
      creditCeiling: 10_000,
      locale: 'es-ES',
      voiceId: 'voice-es',
      outputDir: dir,
    })
    expect(synthesize).toHaveBeenCalledTimes(1)
    expect(report.phrases[0]!.audio?.ms).toBe(120)
  })
})
