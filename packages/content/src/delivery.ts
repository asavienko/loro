/**
 * Immutable content-release verification.
 *
 * This is deliberately transport- and storage-agnostic: callers fetch bytes, verify a
 * trusted signature, then pass them here before they atomically activate a release.
 * The package never contacts a provider and it does not hold signing keys.
 */

import {
  ContentReleaseManifestSchema,
  type ContentReleaseManifest,
  type ContentReleaseResource,
  type ContentReleaseSignature,
} from '@loro/core/api/current'
import type { Catalog } from './types.js'

export const CONTENT_MANIFEST_VERSION = 1

/** Shared API wire types. These aliases keep the Metro-safe verifier in sync with OpenAPI. */
export type ContentResource = ContentReleaseResource
export type ContentSignature = ContentReleaseSignature
export type ContentManifest = ContentReleaseManifest

export interface InstalledCatalog {
  readonly catalogVersion: number
  readonly catalogSha256: string
}

export interface ReleaseVerifier {
  readonly digest: (bytes: Uint8Array) => Promise<string>
  readonly verifySignature: (payload: Uint8Array, signature: ContentSignature) => Promise<boolean>
  /**
   * Validates the decoded catalog in the host that activates it.
   *
   * Authoring uses `runChecksForCatalog`; mobile supplies its bundled validator.
   * Keeping this injected prevents the public, Metro-safe entry point from loading
   * the Node-only authoring checker (which reads the on-disk JSON schema).
   */
  readonly validateCatalog: (catalog: Catalog) => boolean
}

export type ReleaseValidationError =
  | 'APP_TOO_OLD'
  | 'CATALOG_INVALID'
  | 'MANIFEST_INVALID'
  | 'PARTIAL_RELEASE'
  | 'ROLLBACK'
  | 'SIGNATURE_INVALID'
  | 'VERSION_COLLISION'

export class ContentReleaseError extends Error {
  constructor(
    readonly code: ReleaseValidationError,
    message: string,
  ) {
    super(message)
    this.name = 'ContentReleaseError'
  }
}

const encoder = new TextEncoder()
const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

/** Stable JSON is the only byte sequence that may be signed or hashed for a manifest. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`
}

/** The signature excludes itself, avoiding a circular integrity definition. */
export function canonicalManifestPayload(manifest: ContentManifest): Uint8Array {
  return encoder.encode(
    canonicalJson({
      manifestVersion: manifest.manifestVersion,
      catalogVersion: manifest.catalogVersion,
      lang: manifest.lang,
      phraseCount: manifest.phraseCount,
      minAppVersion: manifest.minAppVersion,
      resources: manifest.resources,
    }),
  )
}

export function catalogResourceId(lang: string): string {
  return `catalog-${lang}`
}

function fail(code: ReleaseValidationError, message: string): never {
  throw new ContentReleaseError(code, message)
}

function versionParts(value: string): [number, number, number] | undefined {
  const match = semverPattern.exec(value)
  if (match === null) return undefined
  if (match[4]?.split('.').some((part) => /^0\d+$/.test(part))) return undefined
  const parts = match.slice(1, 4).map(Number)
  if (parts.some((part) => !Number.isSafeInteger(part))) return undefined
  return parts as [number, number, number]
}

function appSatisfiesMinimum(appVersion: string, minAppVersion: string): boolean {
  const actual = versionParts(appVersion)
  const minimum = versionParts(minAppVersion)
  if (actual === undefined || minimum === undefined) return false
  for (const index of [0, 1, 2] as const) {
    if (actual[index] !== minimum[index]) return actual[index] > minimum[index]
  }
  const prerelease = (version: string): string[] | undefined => {
    const withoutBuild = version.split('+')[0] ?? ''
    const separator = withoutBuild.indexOf('-')
    return separator === -1 ? undefined : withoutBuild.slice(separator + 1).split('.')
  }
  const actualPre = prerelease(appVersion)
  const minimumPre = prerelease(minAppVersion)
  if (actualPre === undefined) return true
  if (minimumPre === undefined) return false
  for (let index = 0; index < Math.max(actualPre.length, minimumPre.length); index++) {
    const left = actualPre[index]
    const right = minimumPre[index]
    if (left === undefined) return false
    if (right === undefined) return true
    if (left === right) continue
    const leftNumeric = /^\d+$/.test(left)
    const rightNumeric = /^\d+$/.test(right)
    if (leftNumeric && rightNumeric)
      return left.length !== right.length ? left.length > right.length : left > right
    if (leftNumeric !== rightNumeric) return rightNumeric
    return left > right
  }
  return true
}

function validateManifest(value: unknown): ContentManifest {
  const result = ContentReleaseManifestSchema.safeParse(value)
  if (!result.success)
    fail('MANIFEST_INVALID', 'manifest does not match the signed release wire schema')
  return result.data
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Recheck the monotonic catalog identity at the synchronous storage boundary.
 *
 * Verification normally performs this check before downloads. Activation repeats it
 * inside its database transaction so two concurrent downloads cannot let an older
 * candidate overwrite a release that finished first.
 */
export function assertCatalogVersion(
  manifest: ContentManifest,
  installed: InstalledCatalog | undefined,
): void {
  if (installed === undefined) return
  const catalogDescriptor = manifest.resources.find(
    (resource) => resource.id === catalogResourceId(manifest.lang),
  )
  if (catalogDescriptor === undefined) fail('MANIFEST_INVALID', 'manifest needs a catalog resource')
  if (manifest.catalogVersion < installed.catalogVersion)
    fail('ROLLBACK', 'candidate catalog is older than the installed catalog')
  if (
    manifest.catalogVersion === installed.catalogVersion &&
    catalogDescriptor.sha256 !== installed.catalogSha256
  )
    fail('VERSION_COLLISION', 'a catalog version may not change its bytes')
}

/**
 * Validate an untrusted candidate before activation. All listed bytes must be present
 * and match their descriptor; callers are responsible for keeping the old release until
 * this function succeeds and their own storage transaction commits.
 */
export async function verifyContentRelease(input: {
  readonly manifest: unknown
  readonly resources: ReadonlyMap<string, Uint8Array>
  readonly appVersion: string
  readonly installed?: InstalledCatalog
  readonly verifier: ReleaseVerifier
}): Promise<Catalog> {
  const { manifest: untrustedManifest, resources, appVersion, installed, verifier } = input
  const parsedManifest = validateManifest(untrustedManifest)
  const manifest = parsedManifest
  if (!appSatisfiesMinimum(appVersion, manifest.minAppVersion))
    fail('APP_TOO_OLD', `release requires app ${manifest.minAppVersion} or newer`)
  if (!(await verifier.verifySignature(canonicalManifestPayload(manifest), manifest.signature)))
    fail('SIGNATURE_INVALID', 'manifest signature did not verify')

  assertCatalogVersion(manifest, installed)
  const catalogDescriptor = manifest.resources.find(
    (resource) => resource.id === catalogResourceId(manifest.lang),
  )
  if (catalogDescriptor === undefined) fail('MANIFEST_INVALID', 'manifest needs a catalog resource')

  for (const descriptor of manifest.resources) {
    const bytes = resources.get(descriptor.id)
    if (bytes === undefined) fail('PARTIAL_RELEASE', `missing resource '${descriptor.id}'`)
    if (
      bytes.byteLength !== descriptor.bytes ||
      (await verifier.digest(bytes)) !== descriptor.sha256
    )
      fail('PARTIAL_RELEASE', `resource '${descriptor.id}' failed its integrity check`)
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(new TextDecoder().decode(resources.get(catalogDescriptor.id)))
  } catch {
    fail('CATALOG_INVALID', 'catalog resource is not valid JSON')
  }
  if (!isRecord(decoded) || !Array.isArray(decoded['phrases']))
    fail('CATALOG_INVALID', 'catalog must be an object with a phrase array')
  const catalog = decoded as unknown as Catalog
  if (
    catalog.lang !== manifest.lang ||
    catalog.catalogVersion !== manifest.catalogVersion ||
    catalog.phrases.length !== manifest.phraseCount
  )
    fail('CATALOG_INVALID', 'catalog identity does not match its manifest')
  if (!verifier.validateCatalog(catalog)) fail('CATALOG_INVALID', 'catalog failed host validation')
  return catalog
}
