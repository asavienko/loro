/**
 * Immutable, signed content-release wire format.
 *
 * This is intentionally distinct from the legacy `/content/*` catalog summary and
 * the learner-facing `/content/v2/*` views. A client downloads every byte named by
 * this manifest, verifies it locally, and only then activates the release.
 */
import { z } from 'zod'
import { CountSchema, ResourceIdSchema, Sha256Schema } from './common.js'
import type { Operation } from './operation.js'

export const ContentReleaseResourceKindSchema = z.enum([
  'catalog',
  'pack',
  'scenarios',
  'drops',
  'audio',
  'reference',
])

const ContentAddressSchema = z.string().regex(/^sha256\/[a-f0-9]{64}\.json$/)
const ReleaseLocaleSchema = z.string().regex(/^[a-z]{2,3}-[A-Z]{2}$/)
const ReleaseVersionSchema = z.int().positive()
const SemverSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
  )

export const ContentReleaseResourceSchema = z.strictObject({
  id: ResourceIdSchema,
  kind: ContentReleaseResourceKindSchema,
  version: ReleaseVersionSchema,
  uri: ContentAddressSchema,
  sha256: Sha256Schema,
  bytes: CountSchema,
})

export const ContentReleaseSignatureSchema = z.strictObject({
  algorithm: z.literal('ed25519'),
  keyId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  value: z.string().regex(/^[A-Za-z0-9_-]+$/),
})

export const ContentReleaseManifestSchema = z
  .strictObject({
    manifestVersion: z.literal(1),
    catalogVersion: ReleaseVersionSchema,
    lang: ReleaseLocaleSchema,
    phraseCount: CountSchema,
    minAppVersion: SemverSchema,
    resources: z.array(ContentReleaseResourceSchema).min(1),
    signature: ContentReleaseSignatureSchema,
  })
  .superRefine((manifest, context) => {
    const ids = new Set<string>()
    for (const [index, resource] of manifest.resources.entries()) {
      if (ids.has(resource.id))
        context.addIssue({
          code: 'custom',
          path: ['resources', index, 'id'],
          message: 'Resource ids must be unique',
        })
      ids.add(resource.id)
    }
    const catalog = manifest.resources.filter(
      (resource) => resource.id === `catalog-${manifest.lang}`,
    )
    if (
      catalog.length !== 1 ||
      catalog[0]?.kind !== 'catalog' ||
      catalog[0].version !== manifest.catalogVersion
    )
      context.addIssue({
        code: 'custom',
        path: ['resources'],
        message: 'Manifest needs exactly one version-matched catalog resource',
      })
  })

export const ContentReleaseManifestQuerySchema = z.strictObject({ lang: ReleaseLocaleSchema })

export type ContentReleaseResource = z.infer<typeof ContentReleaseResourceSchema>
export type ContentReleaseSignature = z.infer<typeof ContentReleaseSignatureSchema>
export type ContentReleaseManifest = z.infer<typeof ContentReleaseManifestSchema>
export type ContentReleaseManifestQuery = z.infer<typeof ContentReleaseManifestQuerySchema>

export function contentReleaseOperations(problem: z.ZodType): readonly Operation[] {
  return [
    {
      id: 'contentReleaseManifest',
      method: 'get',
      path: '/content/release/manifest',
      summary: 'Signed immutable content-release manifest',
      status: 'planned',
      auth: 'none',
      requirements: ['F-04', 'AS-01'],
      owner: 61,
      query: { lang: ContentReleaseManifestQuerySchema.shape.lang },
      responses: {
        200: { schema: ContentReleaseManifestSchema },
        422: { schema: problem, mediaType: 'application/problem+json' },
        503: { schema: problem, mediaType: 'application/problem+json' },
      },
      behavior:
        'Only publishes exact-material-approved releases. Resource bytes are fetched by content address without forwarding API credentials, verified on device, and atomically activated with the last good release retained on failure.',
    },
  ]
}
