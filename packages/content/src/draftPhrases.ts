/**
 * Draft extra catalog/scenario lines for human review.
 *
 *   pnpm --filter @loro/content draft:phrases -- --topic pharmacy --target es-ES --native en
 *
 * Writes JSON to stdout. Never merges into the bundled catalog.
 */
import { NATIVE_LANGUAGES, TARGET_LOCALES, isNativeLanguage, isTargetLocale } from '@loro/core'
import { stubPhraseDraft } from './phraseDrafts.js'

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function main(): void {
  const topic = arg('--topic') ?? 'topic'
  const target = arg('--target') ?? 'es-ES'
  const native = arg('--native') ?? 'en'
  if (!isTargetLocale(target) || !isNativeLanguage(native)) {
    console.error(
      `expected --target in ${TARGET_LOCALES.join(', ')} and --native in ${NATIVE_LANGUAGES.join(', ')}`,
    )
    process.exit(2)
  }
  process.stdout.write(
    `${JSON.stringify(stubPhraseDraft({ topic, target_locale: target, native_language: native }), null, 2)}\n`,
  )
}

main()
