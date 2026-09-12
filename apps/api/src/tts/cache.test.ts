import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SHA256, readTtsAsset, readTtsIdentity, writeTtsRender } from './cache.js'

describe('tts disk cache', () => {
  let dir = ''

  afterEach(async () => {
    vi.unstubAllEnvs()
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('round-trips identity and rejects a checksum mismatch', async () => {
    dir = await mkdtemp(join(tmpdir(), 'loro-tts-cache-'))
    vi.stubEnv('TTS_CACHE_DIR', dir)
    const bytes = Buffer.from('loro-tts-cache-bytes')
    const { sha256 } = await writeTtsRender({
      identity: 'id-1',
      bytes,
      contentType: 'audio/wav',
      provenance: { provider: 'stub' },
      ms: 400,
    })
    expect(SHA256.test(sha256)).toBe(true)
    await expect(readTtsIdentity('id-1')).resolves.toEqual({ sha256, ms: 400 })
    const asset = await readTtsAsset(sha256)
    expect(asset?.contentType).toBe('audio/wav')
    expect(asset?.bytes.equals(bytes)).toBe(true)
    await expect(readTtsIdentity('missing')).resolves.toBeNull()
  })
})
