/**
 * Immutable content-release verification.
 *
 * This is deliberately transport- and storage-agnostic: callers fetch bytes, verify a
 * trusted signature, then pass them here before they atomically activate a release.
 * The package never contacts a provider and it does not hold signing keys.
 */

import type { Catalog } from './types.js'

export const CONTENT_MANIFEST_VERSION = 1

export type ResourceKind = 'catalog' | 'pack' | 'scenarios' | 'drops' | 'audio' | 'reference'

export interface ContentResource {
  readonly id: string
  readonly kind: ResourceKind
  readonly version: number
  readonly uri: string
  readonly sha256: string
  readonly bytes: number
}

export interface ContentSignature {
  readonly algorithm: string
  readonly keyId: string
  /** Base64url signature over canonicalManifestPayload(manifest). */
  readonly value: string
}

export interface ContentManifest {
  readonly manifestVersion: number
  readonly catalogVersion: number
  readonly lang: string
  readonly phraseCount: number
  readonly minAppVersion: string
  readonly resources: readonly ContentResource[]
  readonly signature: ContentSignature
}

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
const sha256Pattern = /^[a-f0-9]{64}$/
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

function isSafeVersion(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validateManifest(value: unknown): asserts value is ContentManifest {
  if (
    !isRecord(value) ||
    typeof value['lang'] !== 'string' ||
    typeof value['minAppVersion'] !== 'string' ||
    !Array.isArray(value['resources']) ||
    !isRecord(value['signature'])
  )
    fail('MANIFEST_INVALID', 'manifest must contain identity, resources and signature fields')
  const manifest = value as unknown as ContentManifest
  if (manifest.manifestVersion !== CONTENT_MANIFEST_VERSION)
    fail('MANIFEST_INVALID', `unsupported manifest version '${manifest.manifestVersion}'`)
  if (!isSafeVersion(manifest.catalogVersion))
    fail('MANIFEST_INVALID', 'catalogVersion must be a positive safe integer')
  if (!/^[a-z]{2,3}-[A-Z]{2}$/.test(manifest.lang))
    fail('MANIFEST_INVALID', 'lang must be a BCP-47 language-region tag')
  if (!Number.isSafeInteger(manifest.phraseCount) || manifest.phraseCount < 0)
    fail('MANIFEST_INVALID', 'phraseCount must be a non-negative safe integer')
  if (versionParts(manifest.minAppVersion) === undefined)
    fail('MANIFEST_INVALID', 'minAppVersion must be a semantic version')
  if (
    manifest.signature.algorithm !== 'ed25519' ||
    typeof manifest.signature.keyId !== 'string' ||
    typeof manifest.signature.value !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(manifest.signature.keyId) ||
    !/^[A-Za-z0-9_-]+$/.test(manifest.signature.value)
  )
    fail('MANIFEST_INVALID', 'manifest must carry an ed25519 base64url signature and key id')

  const ids = new Set<string>()
  for (const resource of manifest.resources) {
    if (
      !isRecord(resource) ||
      typeof resource.id !== 'string' ||
      typeof resource.sha256 !== 'string' ||
      !['catalog', 'pack', 'scenarios', 'drops', 'audio', 'reference'].includes(resource.kind)
    )
      fail('MANIFEST_INVALID', 'resource must contain a supported kind, id and digest')
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(resource.id) || ids.has(resource.id))
      fail('MANIFEST_INVALID', `resource id '${resource.id}' is missing, invalid, or duplicated`)
    ids.add(resource.id)
    if (
      !isSafeVersion(resource.version) ||
      !Number.isSafeInteger(resource.bytes) ||
      resource.bytes < 0
    )
      fail('MANIFEST_INVALID', `resource '${resource.id}' has an invalid version or byte count`)
    if (!sha256Pattern.test(resource.sha256) || resource.uri !== `sha256/${resource.sha256}.json`)
      fail('MANIFEST_INVALID', `resource '${resource.id}' is not content-addressed JSON`)
  }
  const catalog = manifest.resources.filter(
    (resource) => resource.id === catalogResourceId(manifest.lang),
  )
  if (
    catalog.length !== 1 ||
    catalog[0]?.kind !== 'catalog' ||
    catalog[0].version !== manifest.catalogVersion
  )
    fail('MANIFEST_INVALID', 'manifest needs exactly one version-matched catalog resource')
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
  const { manifest, resources, appVersion, installed, verifier } = input
  validateManifest(manifest)
  if (!appSatisfiesMinimum(appVersion, manifest.minAppVersion))
    fail('APP_TOO_OLD', `release requires app ${manifest.minAppVersion} or newer`)
  if (!(await verifier.verifySignature(canonicalManifestPayload(manifest), manifest.signature)))
    fail('SIGNATURE_INVALID', 'manifest signature did not verify')

  const catalogDescriptor = manifest.resources.find(
    (resource) => resource.id === catalogResourceId(manifest.lang),
  )
  if (catalogDescriptor === undefined) fail('MANIFEST_INVALID', 'manifest needs a catalog resource')
  if (installed !== undefined) {
    if (manifest.catalogVersion < installed.catalogVersion)
      fail('ROLLBACK', 'candidate catalog is older than the installed catalog')
    if (
      manifest.catalogVersion === installed.catalogVersion &&
      catalogDescriptor.sha256 !== installed.catalogSha256
    )
      fail('VERSION_COLLISION', 'a catalog version may not change its bytes')
  }

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
