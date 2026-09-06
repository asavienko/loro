import { z } from 'zod'
import { CatalogPhraseSchema } from './catalog.js'
import {
  CountSchema,
  ResourceIdSchema,
  Sha256Schema,
  LocaleSchema,
  CatalogIdSchema,
} from './common.js'
export const AssetSchema = z.looseObject({
  uri: z.string().regex(/^sha256\/[a-f0-9]{64}(?:\.[a-z0-9]+)?$/),
  sha256: Sha256Schema,
  bytes: CountSchema,
})
export const ResourceSchema = AssetSchema.extend({
  id: ResourceIdSchema,
  kind: z.enum(['catalog', 'pack', 'scenarios', 'drops', 'chat_topics', 'audio', 'reference']),
  version: CountSchema,
})
export const PackSummarySchema = z.looseObject({
  id: ResourceIdSchema,
  label: z.string(),
  emoji: z.string(),
  count: CountSchema,
  sha256: Sha256Schema,
  onboarding: z.boolean(),
  trip: z.boolean(),
})
export const ScenarioSchema = z.looseObject({
  id: ResourceIdSchema,
  label: z.string(),
  emoji: z.string(),
  phrases: z.array(CatalogIdSchema),
  arc: z.string().optional(),
})
export const ManifestSchema = z.looseObject({
  catalog_version: CountSchema,
  lang: LocaleSchema,
  phrase_count: CountSchema,
  packs: z.array(PackSummarySchema),
  scenarios: z.array(ScenarioSchema),
  audio_base: z.url(),
  resource_base: z.url(),
  min_app_version: z.string(),
  full_catalog: AssetSchema,
  resources: z.array(ResourceSchema),
})
/** Response parsers tolerate future catalog fields; the authoring schema remains strict. */
export const CatalogResponsePhraseSchema = CatalogPhraseSchema.loose()
export const DiffSchema = z.looseObject({
  from: CountSchema,
  to: CountSchema,
  upserts: z.array(CatalogResponsePhraseSchema),
  deprecations: z.array(z.looseObject({ id: CatalogIdSchema, deprecated_by: CatalogIdSchema })),
  full_resync_required: z.boolean(),
})
export const PackSchema = z
  .looseObject({
    id: ResourceIdSchema,
    label: z.string(),
    promised_count: CountSchema,
    phrases: z.array(CatalogResponsePhraseSchema),
    catalog_version: CountSchema,
  })
  .refine(
    (pack) => pack.promised_count === pack.phrases.length,
    'Promised count must equal returned membership',
  )
export const FullCatalogSchema = z.looseObject({
  catalog_version: CountSchema,
  lang: LocaleSchema,
  phrases: z.array(CatalogResponsePhraseSchema),
  packs: z.array(PackSummarySchema.extend({ phrases: z.array(CatalogIdSchema) })),
  scenarios: z.array(ScenarioSchema),
})
export type Manifest = z.infer<typeof ManifestSchema>
export type ContentDiff = z.infer<typeof DiffSchema>
export type Pack = z.infer<typeof PackSchema>
export type FullCatalog = z.infer<typeof FullCatalogSchema>

export type Asset = z.infer<typeof AssetSchema>

export type Resource = z.infer<typeof ResourceSchema>

export type PackSummary = z.infer<typeof PackSummarySchema>

export type Scenario = z.infer<typeof ScenarioSchema>

export type Diff = z.infer<typeof DiffSchema>
