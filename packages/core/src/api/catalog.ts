/** Catalog transport, distinct from the branded/camelCase domain view. F-04. */
import { z } from 'zod'
import { BROWSABLE_THEMES } from '../domain/phrase.js'

export const WordGlossSchema = z.strictObject({
  es: z.string().max(40),
  gloss: z.string().max(60),
  say: z.string().max(40).optional(),
})
export const CatalogPhraseSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]{2,12}$/),
  es: z.string().min(2).max(120),
  en: z.string().min(2).max(140),
  theme: z.enum(BROWSABLE_THEMES),
  emoji: z.string().min(1).max(8),
  register: z.enum(['neutral', 'casual', 'formal']).optional(),
  cefr: z.enum(['A1', 'A2', 'B1', 'B2']).optional(),
  resp: z.string().max(200).optional(),
  resp_ipa: z.string().max(200).optional(),
  words: z.array(WordGlossSchema).max(12).optional(),
  example: z.strictObject({ es: z.string().max(200), en: z.string().max(220) }).optional(),
  hint: z.string().max(200).optional(),
  note: z.string().max(240).optional(),
  syl: z
    .array(
      z.strictObject({
        t: z.string().max(12),
        stress: z.number().min(0).max(1),
        dur: z.number().positive(),
      }),
    )
    .max(24)
    .optional(),
  f0_native: z.array(z.number().min(0).max(1)).length(14).optional(),
  audio: z
    .strictObject({
      uri: z.string(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      ms: z.int().positive(),
    })
    .optional(),
  variants: z.array(z.strictObject({ lang: z.string(), es: z.string().max(120) })).optional(),
  deprecated_by: z.string().optional(),
})
export type CatalogPhrase = z.infer<typeof CatalogPhraseSchema>
export type WordGloss = z.infer<typeof WordGlossSchema>
