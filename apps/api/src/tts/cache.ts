import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from '../common/config.js'

export const SHA256 = /^[a-f0-9]{64}$/

export interface TtsCacheAsset {
  bytes: Buffer
  contentType: string
}

export interface TtsCacheIdentity {
  sha256: string
  ms: number
}

export async function readTtsIdentity(identity: string): Promise<TtsCacheIdentity | null> {
  try {
    const mapped = JSON.parse(
      await readFile(join(config.ttsCacheDir(), 'id', `${identity}.json`), 'utf8'),
    ) as { sha256?: unknown; ms?: unknown }
    if (typeof mapped.sha256 !== 'string' || !SHA256.test(mapped.sha256)) return null
    if (typeof mapped.ms !== 'number' || !Number.isSafeInteger(mapped.ms) || mapped.ms <= 0) {
      return null
    }
    if ((await readTtsAsset(mapped.sha256)) === null) return null
    return { sha256: mapped.sha256, ms: mapped.ms }
  } catch {
    return null
  }
}

export async function readTtsAsset(sha256: string): Promise<TtsCacheAsset | null> {
  try {
    const dir = config.ttsCacheDir()
    const bytes = await readFile(join(dir, `${sha256}.bin`))
    if (createHash('sha256').update(bytes).digest('hex') !== sha256) return null
    const sidecar = JSON.parse(await readFile(join(dir, `${sha256}.json`), 'utf8')) as {
      contentType?: unknown
    }
    const contentType =
      typeof sidecar.contentType === 'string' && sidecar.contentType.length > 0
        ? sidecar.contentType
        : 'application/octet-stream'
    return { bytes, contentType }
  } catch {
    return null
  }
}

export async function writeTtsRender(input: {
  identity: string
  bytes: Uint8Array
  contentType: string
  provenance: Record<string, unknown>
  ms: number
}): Promise<{ sha256: string }> {
  const sha256 = createHash('sha256').update(input.bytes).digest('hex')
  const dir = config.ttsCacheDir()
  await mkdir(join(dir, 'id'), { recursive: true })
  const tmp = join(dir, `${sha256}.tmp`)
  await writeFile(tmp, input.bytes)
  await rename(tmp, join(dir, `${sha256}.bin`))
  await writeFile(
    join(dir, `${sha256}.json`),
    `${JSON.stringify({ ...input.provenance, contentType: input.contentType, ms: input.ms }, null, 2)}\n`,
  )
  await writeFile(
    join(dir, 'id', `${input.identity}.json`),
    `${JSON.stringify({ sha256, ms: input.ms })}\n`,
  )
  return { sha256 }
}
