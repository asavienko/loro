/**
 * Draft extra catalog/scenario lines for human review.
 *
 *   pnpm --filter @loro/content draft:phrases -- --topic pharmacy --target es-ES --native en
 *
 * Writes JSON to stdout. Never merges into the bundled catalog.
 */
import { fileURLToPath } from 'node:url'
import { NATIVE_LANGUAGES, TARGET_LOCALES, isNativeLanguage, isTargetLocale } from '@loro/core'
import { stubPhraseDraft } from './phraseDrafts.js'

const KNOWN_FLAGS = new Set(['--topic', '--target', '--native'])

export function parseDraftPhraseArgs(argv: readonly string[]): {
  readonly topic: string
  readonly target_locale: (typeof TARGET_LOCALES)[number]
  readonly native_language: (typeof NATIVE_LANGUAGES)[number]
} {
  const flags = argv.filter((arg) => arg.startsWith('--'))
  const unknown = flags.filter((flag) => !KNOWN_FLAGS.has(flag))
  if (unknown.length > 0) {
    throw new Error(`unknown flag ${unknown[0] ?? ''}`)
  }
  const topic = arg(argv, '--topic')
  const target = arg(argv, '--target')
  const native = arg(argv, '--native')
  if (topic === undefined || target === undefined || native === undefined) {
    throw new Error(
      `required --topic --target (${TARGET_LOCALES.join(', ')}) --native (${NATIVE_LANGUAGES.join(', ')})`,
    )
  }
  if (!isTargetLocale(target) || !isNativeLanguage(native)) {
    throw new Error(
      `expected --target in ${TARGET_LOCALES.join(', ')} and --native in ${NATIVE_LANGUAGES.join(', ')}`,
    )
  }
  return { topic, target_locale: target, native_language: native }
}

function arg(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name)
  const value = index >= 0 ? argv[index + 1] : undefined
  return value === undefined || value.startsWith('--') ? undefined : value
}

function main(): void {
  try {
    const input = parseDraftPhraseArgs(process.argv)
    process.stdout.write(`${JSON.stringify(stubPhraseDraft(input), null, 2)}\n`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(2)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
