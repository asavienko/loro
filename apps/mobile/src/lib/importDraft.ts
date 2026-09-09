import { NATIVE_LANGUAGES, TARGET_LOCALES, type NativeLanguage, type TargetLocale } from '@loro/core'

/** A local-only checkpoint. It never enters the sync outbox or an account payload. */
export interface ImportDraft {
  readonly targetLocale: TargetLocale
  readonly nativeLanguage: NativeLanguage
  readonly input: string
}

export function decodeImportDraft(value: string | null): ImportDraft | null {
  if (value === null) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null) return null
    const draft = parsed as Record<string, unknown>
    if (
      typeof draft.targetLocale !== 'string' ||
      typeof draft.nativeLanguage !== 'string' ||
      typeof draft.input !== 'string' ||
      !TARGET_LOCALES.includes(draft.targetLocale as TargetLocale) ||
      !NATIVE_LANGUAGES.includes(draft.nativeLanguage as NativeLanguage)
    )
      return null
    return {
      targetLocale: draft.targetLocale as TargetLocale,
      nativeLanguage: draft.nativeLanguage as NativeLanguage,
      input: draft.input,
    }
  } catch {
    return null
  }
}
