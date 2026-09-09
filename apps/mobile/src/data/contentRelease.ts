/**
 * Mobile-safe signed content activation.
 *
 * Fetching and cryptography stay injected so this module cannot acquire a provider
 * credential or import Node authoring code. The caller supplies verified candidate
 * bytes; this boundary only verifies and commits an activation alongside the
 * catalog installation transaction.
 */
import type { Catalog } from '@loro/content'
import {
  assertCatalogVersion,
  catalogResourceId,
  type ContentManifest,
  type InstalledCatalog,
  type ReleaseVerifier,
  verifyContentRelease,
} from '@loro/content'
import type { SqlDriver } from '@loro/core'
import { ContentReleaseManifestSchema } from '@loro/core/api/current'
import { readLocalValue, writeLocalValue } from './database'

interface StoredRelease extends InstalledCatalog {
  readonly lang: string
}

function releaseKey(lang: string): string {
  return `content.release.${lang}`
}

function catalogHash(manifest: ContentManifest): string {
  const descriptor = manifest.resources.find(
    (resource) => resource.id === catalogResourceId(manifest.lang),
  )
  if (descriptor === undefined) throw new Error('verified manifest is missing its catalog resource')
  return descriptor.sha256
}

export function readInstalledContentRelease(
  driver: SqlDriver,
  lang: string,
): StoredRelease | undefined {
  const raw = readLocalValue(driver, releaseKey(lang))
  if (raw === null) return undefined
  try {
    const value: unknown = JSON.parse(raw)
    if (
      value !== null &&
      typeof value === 'object' &&
      (value as Record<string, unknown>)['lang'] === lang &&
      Number.isSafeInteger((value as Record<string, unknown>)['catalogVersion']) &&
      ((value as Record<string, unknown>)['catalogVersion'] as number) > 0 &&
      typeof (value as Record<string, unknown>)['catalogSha256'] === 'string' &&
      /^[a-f0-9]{64}$/.test((value as Record<string, unknown>)['catalogSha256'] as string)
    )
      return value as StoredRelease
  } catch {
    // A corrupt pointer is not a release. The next verified candidate may replace it.
  }
  return undefined
}

export async function activateContentRelease(input: {
  readonly driver: SqlDriver
  readonly manifest: unknown
  readonly resources: ReadonlyMap<string, Uint8Array>
  readonly appVersion: string
  readonly verifier: ReleaseVerifier
  /** Called inside the same SQLite transaction as the release pointer write. */
  readonly installCatalog: (catalog: Catalog) => void
}): Promise<Catalog> {
  const installed =
    input.manifest !== null && typeof input.manifest === 'object' && 'lang' in input.manifest
      ? readInstalledContentRelease(input.driver, String(input.manifest.lang))
      : undefined
  const parsed = await verifyContentRelease({
    manifest: input.manifest,
    resources: input.resources,
    appVersion: input.appVersion,
    ...(installed === undefined ? {} : { installed }),
    verifier: input.verifier,
  })

  // `verifyContentRelease` has already made this same schema check before hashing.
  // Parsing again gives this storage boundary a typed, untrusted-input-safe manifest.
  const manifest = ContentReleaseManifestSchema.parse(input.manifest)
  input.driver.transaction(() => {
    // A second monotonic check closes the async download-to-commit race.
    assertCatalogVersion(manifest, readInstalledContentRelease(input.driver, manifest.lang))
    input.installCatalog(parsed)
    writeLocalValue(
      input.driver,
      releaseKey(manifest.lang),
      JSON.stringify({
        lang: manifest.lang,
        catalogVersion: manifest.catalogVersion,
        catalogSha256: catalogHash(manifest),
      } satisfies StoredRelease),
    )
  })
  return parsed
}
