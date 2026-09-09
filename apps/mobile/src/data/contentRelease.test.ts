import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  bundledCatalog,
  canonicalJson,
  catalogResourceId,
  type Catalog,
  type ContentManifest,
} from '@loro/content'
import { openNodeSqlite } from './driver.node'
import { readLocalValue } from './database'
import { activateContentRelease, readInstalledContentRelease } from './contentRelease'

const digest = (value: Uint8Array) =>
  Promise.resolve(createHash('sha256').update(value).digest('hex'))

function fixture(version = bundledCatalog.catalogVersion): {
  readonly manifest: ContentManifest
  readonly bytes: Uint8Array
} {
  const catalog = JSON.parse(
    canonicalJson({ ...bundledCatalog, catalogVersion: version }),
  ) as Catalog
  const bytes = new TextEncoder().encode(canonicalJson(catalog))
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  return {
    bytes,
    manifest: {
      manifestVersion: 1,
      catalogVersion: version,
      lang: bundledCatalog.lang,
      phraseCount: catalog.phrases.length,
      minAppVersion: '1.0.0',
      resources: [
        {
          id: catalogResourceId(bundledCatalog.lang),
          kind: 'catalog',
          version,
          uri: `sha256/${sha256}.json`,
          sha256,
          bytes: bytes.byteLength,
        },
      ],
      signature: { algorithm: 'ed25519', keyId: 'test-key', value: 'fixture-signature' },
    },
  }
}

const verifier = {
  digest,
  verifySignature: () => Promise.resolve(true),
  validateCatalog: () => true,
}

describe('signed content release activation', () => {
  it('commits the catalog installation and release pointer together', async () => {
    const driver = openNodeSqlite()
    try {
      driver.exec(
        'CREATE TABLE kv(k TEXT PRIMARY KEY, v TEXT NOT NULL); CREATE TABLE catalog_install(id TEXT)',
      )
      const release = fixture()
      await activateContentRelease({
        driver,
        manifest: release.manifest,
        resources: new Map([[catalogResourceId(bundledCatalog.lang), release.bytes]]),
        appVersion: '1.0.0',
        verifier,
        installCatalog: (catalog) => {
          driver.run('INSERT INTO catalog_install VALUES(?)', [catalog.lang])
        },
      })
      expect(driver.all('SELECT * FROM catalog_install')).toEqual([{ id: 'es-ES' }])
      expect(readInstalledContentRelease(driver, 'es-ES')).toEqual({
        lang: 'es-ES',
        catalogVersion: bundledCatalog.catalogVersion,
        catalogSha256: release.manifest.resources[0]!.sha256,
      })
    } finally {
      driver.close()
    }
  })

  it('retains the last good release when installation fails', async () => {
    const driver = openNodeSqlite()
    try {
      driver.exec(
        'CREATE TABLE kv(k TEXT PRIMARY KEY, v TEXT NOT NULL); CREATE TABLE catalog_install(id TEXT)',
      )
      const first = fixture()
      await activateContentRelease({
        driver,
        manifest: first.manifest,
        resources: new Map([[catalogResourceId(bundledCatalog.lang), first.bytes]]),
        appVersion: '1.0.0',
        verifier,
        installCatalog: () => {
          driver.run('INSERT INTO catalog_install VALUES(?)', ['old'])
        },
      })
      const next = fixture(bundledCatalog.catalogVersion + 1)
      await expect(
        activateContentRelease({
          driver,
          manifest: next.manifest,
          resources: new Map([[catalogResourceId(bundledCatalog.lang), next.bytes]]),
          appVersion: '1.0.0',
          verifier,
          installCatalog: () => {
            driver.run('INSERT INTO catalog_install VALUES(?)', ['new'])
            throw new Error('disk full')
          },
        }),
      ).rejects.toThrow('disk full')
      expect(driver.all('SELECT * FROM catalog_install')).toEqual([{ id: 'old' }])
      expect(readLocalValue(driver, 'content.release.es-ES')).toContain(
        `"catalogVersion":${String(bundledCatalog.catalogVersion)}`,
      )
    } finally {
      driver.close()
    }
  })

  it('rejects a late rollback at the storage boundary', async () => {
    const driver = openNodeSqlite()
    try {
      driver.exec('CREATE TABLE kv(k TEXT PRIMARY KEY, v TEXT NOT NULL)')
      const newer = fixture(2)
      await activateContentRelease({
        driver,
        manifest: newer.manifest,
        resources: new Map([[catalogResourceId(bundledCatalog.lang), newer.bytes]]),
        appVersion: '1.0.0',
        verifier,
        installCatalog: () => undefined,
      })
      const older = fixture(1)
      await expect(
        activateContentRelease({
          driver,
          manifest: older.manifest,
          resources: new Map([[catalogResourceId(bundledCatalog.lang), older.bytes]]),
          appVersion: '1.0.0',
          verifier,
          installCatalog: () => undefined,
        }),
      ).rejects.toMatchObject({ code: 'ROLLBACK' })
    } finally {
      driver.close()
    }
  })

  it('fails closed when the installed release pointer is corrupt', async () => {
    const driver = openNodeSqlite()
    try {
      driver.exec('CREATE TABLE kv(k TEXT PRIMARY KEY, v TEXT NOT NULL)')
      const newer = fixture(2)
      await activateContentRelease({
        driver,
        manifest: newer.manifest,
        resources: new Map([[catalogResourceId(bundledCatalog.lang), newer.bytes]]),
        appVersion: '1.0.0',
        verifier,
        installCatalog: () => undefined,
      })
      driver.run('UPDATE kv SET v = ? WHERE k = ?', ['{not-json', 'content.release.es-ES'])
      const older = fixture(1)
      await expect(
        activateContentRelease({
          driver,
          manifest: older.manifest,
          resources: new Map([[catalogResourceId(bundledCatalog.lang), older.bytes]]),
          appVersion: '1.0.0',
          verifier,
          installCatalog: () => undefined,
        }),
      ).rejects.toThrow('Corrupt installed content release pointer')
      expect(readLocalValue(driver, 'content.release.es-ES')).toBe('{not-json')
    } finally {
      driver.close()
    }
  })
})
