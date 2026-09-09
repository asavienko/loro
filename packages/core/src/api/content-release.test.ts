import { describe, expect, it } from 'vitest'
import {
  ContentReleaseManifestQuerySchema,
  ContentReleaseManifestSchema,
} from './content-release.js'

const resource = {
  id: 'catalog-es-ES',
  kind: 'catalog',
  version: 1,
  uri: `sha256/${'a'.repeat(64)}.json`,
  sha256: 'a'.repeat(64),
  bytes: 1,
}
const manifest = {
  manifestVersion: 1,
  catalogVersion: 1,
  lang: 'es-ES',
  phraseCount: 1,
  minAppVersion: '1.0.0',
  resources: [resource],
  signature: { algorithm: 'ed25519', keyId: 'release-1', value: 'signature' },
}

describe('signed content release wire schema', () => {
  it('accepts immutable text-release metadata', () => {
    expect(ContentReleaseManifestSchema.parse(manifest)).toEqual(manifest)
    expect(ContentReleaseManifestQuerySchema.parse({ lang: 'es-ES' })).toEqual({ lang: 'es-ES' })
  })

  it.each([
    {
      ...manifest,
      resources: [
        { ...resource, id: 'duplicate' },
        { ...resource, id: 'duplicate' },
      ],
    },
    { ...manifest, resources: [{ ...resource, version: 2 }] },
    { ...manifest, resources: [{ ...resource, uri: 'https://example.test/catalog.json' }] },
    { ...manifest, signature: { ...manifest.signature, algorithm: 'rsa' } },
  ])('rejects mutable or mismatched release metadata', (candidate) => {
    expect(ContentReleaseManifestSchema.safeParse(candidate).success).toBe(false)
  })
})
