/**
 * What the writer reads from disk before a call (plan 112 §3): the accepted phrases of a course,
 * from the legacy files and the new shards; the hand-written examples; the icons. Read once per
 * run, never during a call, so a request is a function of files alone.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { V2_CONTENT, V2_ICON_NAMES, type V2Language, type V2Set } from '@loro/content/v2'
import { COURSE_CODES, type Level, type Slot } from './slot.js'

export const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
export const CONTENT_ROOT = join(REPO_ROOT, 'packages/content/v2')
export const CACHE_ROOT = join(REPO_ROOT, '.cache/authoring')

/** An English-side phrase as the shards keep it: the pivot, no other language yet. */
export interface ShardPhrase {
  id: string
  target: string
  translations: { 'en-GB': string; 'en-US': string }
  register: 'formal' | 'informal' | 'neutral'
  region: string
  tags: string[]
  image: string[]
  words: Record<string, { 'en-GB': string; 'en-US': string }>
  grammar: string[]
  functions: string[]
  uses: string[]
}

export interface ShardSet {
  id: string
  title: string
  subtitle: { en: string }
  topicId: string
  situation: string
  level: Level
  coverIcon: string
  targetLang: V2Language
  phraseIds: string[]
  grammarFocus: string[]
  provenance: {
    writer: 'deepseek'
    provider: string
    model: string
    run: string
    promptVersion: string
    briefHash: string
  }
}

/** A phrase as the request shows it: text, level and set, nothing more. */
export interface KnownPhrase {
  id: string
  target: string
  english: string
  level: Level
  setId: string
  topicId: string
  words?: Record<string, string>
  register?: string
  image?: string[]
}

export interface AuthoringContext {
  course: V2Language
  code: string
  /** Every accepted phrase of the course, legacy and shard. */
  phrases: KnownPhrase[]
  /** Fold → id, for the duplicate check across course and bank. */
  textKeys: Map<string, string>
  icons: readonly string[]
}

/** Text as compared: no accents, case or punctuation. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export function shardPaths(slot: Slot): { sets: string; phrases: string } {
  const dir = join(CONTENT_ROOT, 'courses', COURSE_CODES[slot.course], slot.level)
  return {
    sets: join(dir, `${slot.topic}.sets.json`),
    phrases: join(dir, `${slot.topic}.phrases.jsonl`),
  }
}

export function readShardSets(path: string): ShardSet[] {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as ShardSet[]) : []
}

export function readShardPhrases(path: string): ShardPhrase[] {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ShardPhrase)
}

/** Appends a set and its phrases; existing lines are never rewritten (ADR-0017). */
export function appendShard(slot: Slot, set: ShardSet, phrases: ShardPhrase[]): void {
  const paths = shardPaths(slot)
  mkdirSync(dirname(paths.sets), { recursive: true })
  const sets = readShardSets(paths.sets)
  if (sets.some((s) => s.id === set.id)) throw new Error(`${set.id} is already in ${paths.sets}`)
  writeFileSync(paths.sets, `${JSON.stringify([...sets, set], null, 2)}\n`)
  const lines = phrases.map((p) => JSON.stringify(p)).join('\n')
  const existing = existsSync(paths.phrases) ? readFileSync(paths.phrases, 'utf8') : ''
  writeFileSync(paths.phrases, `${existing}${lines}\n`)
}

function walkShards(course: V2Language): { sets: ShardSet[]; phrases: ShardPhrase[] } {
  const root = join(CONTENT_ROOT, 'courses', COURSE_CODES[course])
  const out = { sets: [] as ShardSet[], phrases: [] as ShardPhrase[] }
  if (!existsSync(root)) return out
  for (const level of readdirSync(root)) {
    const dir = join(root, level)
    for (const file of readdirSync(dir)) {
      if (file.endsWith('.sets.json')) out.sets.push(...readShardSets(join(dir, file)))
      if (file.endsWith('.phrases.jsonl')) out.phrases.push(...readShardPhrases(join(dir, file)))
    }
  }
  return out
}

/** `shards: false` reads the hand-written content only: a frozen context for snapshot tests. */
export function loadContext(
  course: V2Language,
  options: { shards?: boolean } = {},
): AuthoringContext {
  const phrases: KnownPhrase[] = []
  const textKeys = new Map<string, string>()
  const legacySets = V2_CONTENT.sets.filter((s) => s.targetLang === course)
  const setOf = new Map<string, V2Set>()
  for (const set of legacySets) for (const id of set.phraseIds) setOf.set(id, set)
  for (const phrase of V2_CONTENT.phrases) {
    const set = setOf.get(phrase.id)
    if (!set) continue
    phrases.push({
      id: phrase.id,
      target: phrase.target,
      english: phrase.translations['en-GB'] ?? '',
      level: set.level,
      setId: set.id,
      topicId: set.topicId,
      words: Object.fromEntries(
        Object.entries(phrase.words).map(([w, g]) => [w, g['en-GB'] ?? '']),
      ),
      register: phrase.register,
      image: phrase.image,
    })
  }
  const shards = options.shards === false ? { sets: [], phrases: [] } : walkShards(course)
  const shardSetOf = new Map<string, ShardSet>()
  for (const set of shards.sets) for (const id of set.phraseIds) shardSetOf.set(id, set)
  for (const phrase of shards.phrases) {
    const set = shardSetOf.get(phrase.id)
    if (!set) continue
    phrases.push({
      id: phrase.id,
      target: phrase.target,
      english: phrase.translations['en-GB'],
      level: set.level,
      setId: set.id,
      topicId: set.topicId,
    })
  }
  for (const p of phrases) textKeys.set(fold(p.target), p.id)
  for (const bank of V2_CONTENT.bank.phrases) {
    if (bank.targetLang === course) textKeys.set(fold(bank.target), bank.id)
  }
  return { course, code: COURSE_CODES[course], phrases, textKeys, icons: V2_ICON_NAMES }
}

export function ensureCacheDir(sub: string): string {
  const dir = join(CACHE_ROOT, sub)
  mkdirSync(dir, { recursive: true })
  return dir
}
