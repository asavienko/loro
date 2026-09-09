import {
  LearningManifestSchema,
  LearningPackSchema,
  LearningDiffSchema,
} from '@loro/core/api/current'
import { describe, expect, it } from 'vitest'
import { LearningContentController } from './learning-content.controller.js'
import { ContentController } from './content.controller.js'
import { NATIVE_LANGUAGES, TARGET_LOCALES, supportsPair } from '@loro/core'

describe('F-08 versioned content API', () => {
  const controller = new LearningContentController()
  it('validates all seven pairs and exposes real membership counts', () => {
    for (const native of NATIVE_LANGUAGES)
      for (const target of TARGET_LOCALES) {
        if (!supportsPair(native, target)) {
          expect(() => controller.manifest(target, native)).toThrow()
          continue
        }
        expect(LearningManifestSchema.parse(controller.manifest(target, native)).phraseCount).toBe(
          31,
        )
        expect(LearningPackSchema.safeParse(controller.pack('cafe', target, native)).success).toBe(
          true,
        )
        expect(LearningDiffSchema.safeParse(controller.diff('0', target, native)).success).toBe(
          true,
        )
        expect(controller.pack('cafe', target, native).phrases).toHaveLength(4)
        expect(controller.diff('0', target, native).upserts[0]?.targetLocale).toBe(target)
        expect(controller.diff('1', target, native).upserts).toHaveLength(0)
      }
  })
  it('rejects unavailable catalogs, unknown packs and malformed versions', () => {
    expect(() => controller.manifest('fr-FR', 'bg')).toThrow()
    expect(() => controller.pack('missing')).toThrow()
    for (const value of ['1x', '-1', '1.5', '9007199254740993'])
      expect(() => controller.diff(value)).toThrow()
  })
  it('retains the original Spanish/English contract', () => {
    const legacy = new ContentController().pack('cafe')
    expect(legacy.phrases[0]?.es).toBe('Me pone un cortado, por favor')
    expect(legacy.phrases[0]?.en).toBe('A cortado, please')
    expect(legacy.phrases[0]).not.toHaveProperty('targetText')
  })
})
