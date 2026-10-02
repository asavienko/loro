/**
 * The course writer's sets (plan 112), compiled for the seed — NODE ONLY.
 *
 * `author:run` writes each topic as shards under `v2/courses/<course>/<level>/`: the sets
 * (`<topic>.sets.json`), their phrases with English (`<topic>.phrases.jsonl`) and one file per
 * further interface language (`<topic>.<bg|ru|pl|cs>.jsonl`). The API bundles JSON, not shards, so
 * `build:courses` compiles them into `v2/courses.compiled.json`, which `v2.ts` imports as
 * `V2_CONTENT.written`; a test keeps the two equal.
 *
 * A set is published only when it is complete in every language the app speaks but the course's
 * own (ADR-0017): the pack doesn't know the learner's language, so a set missing one would show up
 * in English for that learner. Until the app filters sets by language, an incomplete set is held,
 * with what it lacks, and the `translate` stage completes it.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import type { V2Language, V2Localized, V2Phrase, V2Set } from './v2.js'

/** The interface languages a shard file can hold, by the suffix the writer gives it. */
const LOCALE_FILES = { bg: 'bg-BG', ru: 'ru-RU', pl: 'pl-PL', cs: 'cs-CZ' } as const
type LocaleFile = keyof typeof LOCALE_FILES

/** The levels the app can show (`V2Set['level']`); a set at another level waits for plan 112's 0b. */
const SHOWN_LEVELS: readonly string[] = ['A1', 'A2', 'B1'] satisfies V2Set['level'][]
const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/** A set of the writer's as the seed takes it: no songs, its subtitle in every language it ships in. */
export interface V2WrittenSet extends Omit<V2Set, 'subtitle'> {
  subtitle: Partial<V2Localized> & { en: string }
}
/** A phrase of the writer's: no notes yet (the `notes` stage), so the seed writes them by Loro's rules. */
export type V2WrittenPhrase = Omit<V2Phrase, 'notes' | 'audio' | 'durationMs'>
export interface V2HeldSet {
  id: string
  /** Why it isn't published, e.g. `missing bg-BG, cs-CZ`. */
  reason: string
}
export interface V2WrittenContent {
  /** A hash of what is published: a new batch reseeds the library (`V2_CONTENT.version`). */
  version: string
  sets: V2WrittenSet[]
  phrases: V2WrittenPhrase[]
  held: V2HeldSet[]
}

interface ShardSet {
  id: string
  title: string
  subtitle: { en: string }
  topicId: string
  level: string
  coverIcon: string
  targetLang: V2Language
  phraseIds: string[]
}
interface ShardPhrase {
  id: string
  target: string
  translations: { 'en-GB': string; 'en-US': string }
  register: V2Phrase['register']
  region: string
  tags: string[]
  image: string[]
  words: Record<string, { 'en-GB': string; 'en-US': string }>
}
type LocaleLine =
  | { kind: 'set'; id: string; subtitle: string }
  | { kind: 'phrase'; id: string; translation: string; words: Record<string, string> }

const readJsonl = <T>(path: string): T[] =>
  existsSync(path)
    ? readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as T)
    : []

const sameLanguage = (a: string, b: string) => a.slice(0, 2) === b.slice(0, 2)
const filled = (text: string | undefined): text is string => !!text && text.trim().length > 0

/** One topic's sets with their phrases, each in every interface language it is complete in. */
function compileTopic(
  dir: string,
  topic: string,
  natives: readonly V2Language[],
): { sets: V2WrittenSet[]; phrases: V2WrittenPhrase[]; held: V2HeldSet[] } {
  const sets = JSON.parse(readFileSync(join(dir, `${topic}.sets.json`), 'utf8')) as ShardSet[]
  const byId = new Map(
    readJsonl<ShardPhrase>(join(dir, `${topic}.phrases.jsonl`)).map((p) => [p.id, p]),
  )
  const locales = (Object.keys(LOCALE_FILES) as LocaleFile[]).map((file) => {
    const lines = readJsonl<LocaleLine>(join(dir, `${topic}.${file}.jsonl`))
    return {
      file,
      code: LOCALE_FILES[file],
      subtitles: new Map(
        lines.flatMap((l) => (l.kind === 'set' && filled(l.subtitle) ? [[l.id, l.subtitle]] : [])),
      ),
      phrases: new Map(lines.flatMap((l) => (l.kind === 'phrase' ? [[l.id, l]] : []))),
    }
  })
  const out = {
    sets: [] as V2WrittenSet[],
    phrases: [] as V2WrittenPhrase[],
    held: [] as V2HeldSet[],
  }
  for (const set of sets) {
    const phrases = set.phraseIds.map((id) => byId.get(id))
    if (phrases.some((p) => !p)) {
      out.held.push({ id: set.id, reason: 'a phrase is missing from its shard' })
      continue
    }
    const written = phrases as ShardPhrase[]
    // English is the pivot: both Englishes are in the phrases' own shard.
    const english = (['en-GB', 'en-US'] as const).filter(
      (code) =>
        filled(set.subtitle.en) &&
        written.every(
          (p) =>
            filled(p.translations[code]) && Object.values(p.words).every((g) => filled(g[code])),
        ),
    )
    const complete = locales.filter(
      (l) =>
        l.subtitles.has(set.id) &&
        written.every((p) => {
          const line = l.phrases.get(p.id)
          return (
            line?.kind === 'phrase' &&
            filled(line.translation) &&
            Object.keys(p.words).every((w) => filled(line.words[w]))
          )
        }),
    )
    const has = new Set<string>([...english, ...complete.map((l) => l.code)])
    const missing = natives.filter((n) => !sameLanguage(n, set.targetLang) && !has.has(n))
    if (missing.length > 0) {
      out.held.push({ id: set.id, reason: `missing ${missing.join(', ')}` })
      continue
    }
    if (!SHOWN_LEVELS.includes(set.level)) {
      out.held.push({ id: set.id, reason: `level ${set.level} is not shown by the app yet` })
      continue
    }
    const shipped = complete.filter((l) => !sameLanguage(l.code, set.targetLang))
    out.sets.push({
      id: set.id,
      title: set.title,
      subtitle: {
        en: set.subtitle.en,
        ...Object.fromEntries(shipped.map((l) => [l.file, l.subtitles.get(set.id)])),
      },
      topicId: set.topicId,
      level: set.level as V2Set['level'],
      coverIcon: set.coverIcon,
      targetLang: set.targetLang,
      phraseIds: set.phraseIds,
    })
    for (const phrase of written) {
      const lines = shipped.map((l) => ({ code: l.code, line: l.phrases.get(phrase.id) }))
      const local = (pick: (line: Extract<LocaleLine, { kind: 'phrase' }>) => string) =>
        Object.fromEntries(
          lines.flatMap(({ code, line }) => (line?.kind === 'phrase' ? [[code, pick(line)]] : [])),
        )
      out.phrases.push({
        id: phrase.id,
        target: phrase.target,
        translations: {
          'en-GB': phrase.translations['en-GB'],
          'en-US': phrase.translations['en-US'],
          ...local((line) => line.translation),
        },
        register: phrase.register,
        region: phrase.region,
        tags: phrase.tags,
        image: phrase.image,
        words: Object.fromEntries(
          Object.entries(phrase.words).map(([word, gloss]) => [
            word,
            {
              'en-GB': gloss['en-GB'],
              'en-US': gloss['en-US'],
              ...local((line) => line.words[word] ?? ''),
            },
          ]),
        ),
      })
    }
  }
  return out
}

/**
 * Every course, level and topic under `<root>/courses`, in a fixed order (course, level A1→C2,
 * topic), each topic's sets in their file's order.
 */
export function compileCourses(root: string, natives: readonly V2Language[]): V2WrittenContent {
  const coursesDir = join(root, 'courses')
  const out = {
    sets: [] as V2WrittenSet[],
    phrases: [] as V2WrittenPhrase[],
    held: [] as V2HeldSet[],
  }
  const dirs = (path: string) =>
    existsSync(path)
      ? readdirSync(path, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name)
      : []
  for (const course of dirs(coursesDir).sort()) {
    const levels = dirs(join(coursesDir, course)).sort(
      (a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b),
    )
    for (const level of levels) {
      const dir = join(coursesDir, course, level)
      const topics = readdirSync(dir)
        .filter((f) => f.endsWith('.sets.json'))
        .map((f) => f.slice(0, -'.sets.json'.length))
        .sort()
      for (const topic of topics) {
        const compiled = compileTopic(dir, topic, natives)
        out.sets.push(...compiled.sets)
        out.phrases.push(...compiled.phrases)
        out.held.push(...compiled.held)
      }
    }
  }
  const version = createHash('sha256')
    .update(JSON.stringify({ sets: out.sets, phrases: out.phrases }))
    .digest('hex')
    .slice(0, 12)
  return { version, ...out }
}
