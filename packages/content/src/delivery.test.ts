import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { bundledCatalog } from './catalog.js'
import {
  canonicalJson,
  catalogResourceId,
  type ContentManifest,
  ContentReleaseError,
  verifyContentRelease,
} from './delivery.js'

const encoder = new TextEncoder()
const digest = (bytes: Uint8Array): Promise<string> =>
  Promise.resolve(createHash('sha256').update(bytes).digest('hex'))
const catalogBytes = encoder.encode(canonicalJson(bundledCatalog))
const catalogHash = await digest(catalogBytes)

function fixture(overrides: Partial<ContentManifest> = {}): ContentManifest {
  return {
    manifestVersion: 1,
    catalogVersion: bundledCatalog.catalogVersion,
    lang: bundledCatalog.lang,
    phraseCount: bundledCatalog.phrases.length,
    minAppVersion: '1.0.0',
    resources: [
      {
        id: catalogResourceId(bundledCatalog.lang),
        kind: 'catalog',
        version: bundledCatalog.catalogVersion,
        uri: `sha256/${catalogHash}.json`,
        sha256: catalogHash,
        bytes: catalogBytes.byteLength,
      },
    ],
    signature: { algorithm: 'ed25519', keyId: 'release-2026', value: 'fixture-signature' },
    ...overrides,
  }
}

async function verify(
  manifest = fixture(),
  resources: ReadonlyMap<string, Uint8Array> = new Map([
    [catalogResourceId(bundledCatalog.lang), catalogBytes],
  ]),
  installed?: { catalogVersion: number; catalogSha256: string },
): Promise<void> {
  await verifyContentRelease({
    manifest,
    resources,
    appVersion: '1.0.0+1',
    ...(installed === undefined ? {} : { installed }),
    verifier: { digest, verifySignature: () => Promise.resolve(true), validateCatalog: () => true },
  })
}

describe('immutable content release verification', () => {
  it.each([
    null,
    [],
    {},
    { ...fixture(), signature: null },
    { ...fixture(), signature: { algorithm: 'ed25519', keyId: 42, value: 'signed' } },
    { ...fixture(), resources: null },
    { ...fixture(), resources: [null] },
    { ...fixture(), resources: [{ ...fixture().resources[0]!, kind: 'executable' }] },
  ])('rejects malformed wire manifests before invoking cryptography: %j', async (manifest) => {
    const verifySignature = vi.fn(() => Promise.resolve(true))
    await expect(
      verifyContentRelease({
        manifest,
        resources: new Map(),
        appVersion: '1.0.0',
        verifier: { digest, verifySignature, validateCatalog: () => true },
      }),
    ).rejects.toMatchObject({ code: 'MANIFEST_INVALID' })
    expect(verifySignature).not.toHaveBeenCalled()
  })

  it.each([null, [], {}, { lang: 'es-ES', catalogVersion: 1, phrases: null }])(
    'rejects valid JSON with a malformed catalog shape: %j',
    async (catalog) => {
      const bytes = encoder.encode(JSON.stringify(catalog))
      const hash = await digest(bytes)
      const descriptor = {
        ...fixture().resources[0]!,
        sha256: hash,
        uri: `sha256/${hash}.json`,
        bytes: bytes.byteLength,
      }
      await expect(
        verify(fixture({ resources: [descriptor] }), new Map([[descriptor.id, bytes]])),
      ).rejects.toMatchObject({ code: 'CATALOG_INVALID' })
    },
  )

  it('accepts a signed, complete, version-matched catalog', async () => {
    await expect(verify()).resolves.toBeUndefined()
  })

  it('uses deterministic canonical bytes regardless of source key order', () => {
    expect(canonicalJson({ z: [2, { b: true, a: null }], a: 'x' })).toBe(
      '{"a":"x","z":[2,{"a":null,"b":true}]}',
    )
  })

  it.each([
    [
      'rejects an invalid signature',
      fixture(),
      new Map([[catalogResourceId(bundledCatalog.lang), catalogBytes]]),
      () => Promise.resolve(false),
      'SIGNATURE_INVALID',
    ],
    [
      'rejects a missing resource',
      fixture(),
      new Map<string, Uint8Array>(),
      () => Promise.resolve(true),
      'PARTIAL_RELEASE',
    ],
    [
      'rejects tampered bytes',
      fixture(),
      new Map([[catalogResourceId(bundledCatalog.lang), encoder.encode('[]')]]),
      () => Promise.resolve(true),
      'PARTIAL_RELEASE',
    ],
  ])('%s', async (_name, manifest, resources, verifySignature, code) => {
    await expect(
      verifyContentRelease({
        manifest,
        resources,
        appVersion: '1.0.0',
        verifier: { digest, verifySignature, validateCatalog: () => true },
      }),
    ).rejects.toMatchObject({ code })
  })

  it('rejects a rollback and a same-version byte collision', async () => {
    await expect(
      verify(fixture({ catalogVersion: 1 }), undefined, {
        catalogVersion: 2,
        catalogSha256: catalogHash,
      }),
    ).rejects.toMatchObject({ code: 'ROLLBACK' })
    await expect(
      verify(undefined, undefined, { catalogVersion: 1, catalogSha256: '0'.repeat(64) }),
    ).rejects.toMatchObject({ code: 'VERSION_COLLISION' })
  })

  it('rejects an app below the declared compatibility floor', async () => {
    await expect(
      verifyContentRelease({
        manifest: fixture({ minAppVersion: '1.1.0' }),
        resources: new Map([[catalogResourceId(bundledCatalog.lang), catalogBytes]]),
        appVersion: '1.0.9',
        verifier: {
          digest,
          verifySignature: () => Promise.resolve(true),
          validateCatalog: () => true,
        },
      }),
    ).rejects.toMatchObject({ code: 'APP_TOO_OLD' })
  })

  it.each([
    ['1.0.0-rc.1', '1.0.0', false],
    ['1.0.0-beta.2', '1.0.0-beta.11', false],
    ['1.0.0-beta.11', '1.0.0-beta.2', true],
    ['1.0.0-beta', '1.0.0-beta.1', false],
    ['1.0.0-1', '1.0.0-alpha', false],
    ['1.0.0', '1.0.0-rc.1', true],
    ['1.0.0+build.2', '1.0.0+build.1', true],
    ['1.0.0-beta.01', '1.0.0-beta.1', false],
    ['01.0.0', '1.0.0', false],
  ])('checks app %s against compatibility floor %s', async (appVersion, minimum, accepted) => {
    const result = verifyContentRelease({
      manifest: fixture({ minAppVersion: minimum }),
      resources: new Map([[catalogResourceId(bundledCatalog.lang), catalogBytes]]),
      appVersion,
      verifier: {
        digest,
        verifySignature: () => Promise.resolve(true),
        validateCatalog: () => true,
      },
    })
    if (accepted) await expect(result).resolves.toEqual(bundledCatalog)
    else await expect(result).rejects.toMatchObject({ code: 'APP_TOO_OLD' })
  })

  it('requires the activation host to validate the decoded catalog', async () => {
    await expect(
      verifyContentRelease({
        manifest: fixture(),
        resources: new Map([[catalogResourceId(bundledCatalog.lang), catalogBytes]]),
        appVersion: '1.0.0',
        verifier: {
          digest,
          verifySignature: () => Promise.resolve(true),
          validateCatalog: () => false,
        },
      }),
    ).rejects.toMatchObject({ code: 'CATALOG_INVALID' })
  })

  it('rejects a mutable or malformed resource descriptor before fetching it', async () => {
    const manifest = fixture({
      resources: [{ ...fixture().resources[0]!, uri: 'https://cdn.example/catalog.json' }],
    })
    await expect(verify(manifest)).rejects.toBeInstanceOf(ContentReleaseError)
    await expect(verify(manifest)).rejects.toMatchObject({ code: 'MANIFEST_INVALID' })
  })
})
