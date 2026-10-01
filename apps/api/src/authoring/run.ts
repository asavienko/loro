/**
 * `author:run` (plan 112 §3): writes the `phrases` stage for the selected slots with DeepSeek, each
 * set judged before it is written. The work is derived from the committed content: a slot whose set
 * exists in its shard is skipped, a cached request is not sent again, and nothing already written
 * is ever rewritten here. `--stage judge` alone reviews written sets into `v2/reviews/` instead.
 *
 *   pnpm --filter @loro/api author:run --course es-ES --level A1 --topic eating-out [--set id]
 *        [--stage phrases,judge,translate] [--lang ru,pl] [--max-sets N] [--limit-usd 2]
 *        [--dry-run] [--run-id name]
 *
 * `--lang` names interface languages; the `translate` stage writes each into its own file for the
 * sets already written, and nothing else.
 *
 * `main.ts` never imports this file, so the server bundle never carries it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadEnvFile } from 'node:process'
import { parseArgs } from 'node:util'
import type { V2Language } from '@loro/content/v2'
import { config } from '../common/config.js'
import { textModel } from '../integrations/models.js'
import { ProviderFailure } from '../integrations/provider-failure.js'
import type { StructuredTextModel } from '../integrations/text-model.js'
import {
  clearAttempts,
  logRequest,
  readAttempts,
  readCached,
  writeAttempts,
  writeCached,
} from './cache.js'
import {
  CONTENT_ROOT,
  REPO_ROOT,
  appendShard,
  loadContext,
  readShardPhrases,
  readShardSets,
  shardPaths,
  type AuthoringContext,
  type ShardPhrase,
  type ShardSet,
} from './context.js'
import {
  checkCandidate,
  makeRoom,
  MIN_COVERAGE,
  select,
  type Checked,
  type Selection,
} from './checks.js'
import { phraseId } from './hash.js'
import {
  appendReviews,
  applyTranslateVerdicts,
  applyVerdicts,
  contentHashOf,
  summarize,
  translateContentHash,
  type ReviewRow,
  type Verdict,
} from './judge.js'
import { buildJudgeRequest, RawJudgeAnswer, type JudgeInput } from './prompt/judge.js'
import {
  buildTranslateRequest,
  INTERFACE_LANGS,
  RawTranslateAnswer,
  type InterfaceLang,
  type TranslateInput,
} from './prompt/translate.js'
import {
  appendLocaleShard,
  checkTranslation,
  isTranslated,
  localeShardPath,
  readLocaleShard,
  type LocaleLine,
} from './translate.js'
import {
  buildJudgeTranslateRequest,
  RawJudgeTranslateAnswer,
  type JudgeTranslateInput,
} from './prompt/judge-translate.js'
import {
  buildPhrasesRequest,
  describe,
  RawPhrasesAnswer,
  siblingsFor,
  type BuiltRequest,
  type PriorAttempt,
} from './prompt/phrases.js'
import { COURSE_CODES, LEVELS, loadPlanFile, type Level, type Slot } from './slot.js'

const MAX_REPAIRS = 2
const STAGES = ['phrases', 'judge', 'translate', 'judge-translate'] as const
type Stage = (typeof STAGES)[number]

interface Pricing {
  source: string
  perMillion: Record<string, { input: number; output: number }>
}

const pricing = JSON.parse(
  readFileSync(new URL('./pricing.json', import.meta.url), 'utf8'),
) as Pricing

function costUsd(model: string, usage: { inputTokens: number; outputTokens: number }): number {
  const price = pricing.perMillion[model] ?? pricing.perMillion['default']
  if (!price) return 0
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000
}

const out = (line: string) => process.stdout.write(`${line}\n`)

interface Options {
  course: V2Language
  levels: Level[]
  topics: string[]
  sets: string[]
  stages: Stage[]
  langs: InterfaceLang[]
  maxSets: number
  limitUsd: number
  dryRun: boolean
  runId: string
}

function parse(argv: string[]): Options {
  const { values } = parseArgs({
    args: argv,
    options: {
      course: { type: 'string' },
      level: { type: 'string', multiple: true },
      topic: { type: 'string', multiple: true },
      set: { type: 'string', multiple: true },
      stage: { type: 'string', multiple: true },
      lang: { type: 'string', multiple: true },
      'max-sets': { type: 'string' },
      'limit-usd': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'run-id': { type: 'string' },
    },
  })
  const course = values.course
  if (!course || !(course in COURSE_CODES))
    throw new Error('--course <es-ES|bg-BG|en-GB|en-US|ru-RU|pl-PL|cs-CZ> is required')
  const split = (list: string[] | undefined) =>
    (list ?? [])
      .flatMap((v) => v.split(','))
      .map((v) => v.trim())
      .filter(Boolean)
  const levels = split(values.level)
  for (const l of levels) if (!LEVELS.includes(l as Level)) throw new Error(`unknown level ${l}`)
  const topics = split(values.topic)
  if (topics.length === 0)
    throw new Error('--topic <id>[,<id>] is required (the plan files to read)')
  const stages = split(values.stage)
  for (const st of stages) if (!STAGES.includes(st as Stage)) throw new Error(`unknown stage ${st}`)
  const langs = split(values.lang)
  for (const l of langs) {
    if (!(l in INTERFACE_LANGS))
      throw new Error(
        `--lang takes ${Object.keys(INTERFACE_LANGS).join(', ')} (English is the pivot, always written)`,
      )
  }
  // The default: write and judge; translate too when languages are named.
  const chosenStages: Stage[] =
    stages.length > 0
      ? (stages as Stage[])
      : langs.length > 0
        ? ['phrases', 'judge', 'translate', 'judge-translate']
        : ['phrases', 'judge']
  if (
    (chosenStages.includes('translate') || chosenStages.includes('judge-translate')) &&
    langs.length === 0
  )
    throw new Error('translate and judge-translate need --lang')
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z')
  return {
    course: course as V2Language,
    levels: (levels.length > 0 ? levels : [...LEVELS]) as Level[],
    topics,
    sets: split(values.set),
    stages: chosenStages,
    langs: langs as InterfaceLang[],
    maxSets: values['max-sets'] ? Number(values['max-sets']) : Number.POSITIVE_INFINITY,
    limitUsd: values['limit-usd'] ? Number(values['limit-usd']) : 1,
    dryRun: values['dry-run'],
    runId: values['run-id'] ?? `${stamp}-${COURSE_CODES[course as V2Language]}`,
  }
}

function selectSlots(options: Options): Slot[] {
  const code = COURSE_CODES[options.course]
  const slots: Slot[] = []
  for (const level of options.levels) {
    for (const topic of options.topics) {
      const path = join(CONTENT_ROOT, 'plan', code, level, `${topic}.json`)
      if (!existsSync(path)) continue
      slots.push(...loadPlanFile(path).filter((s) => s.course === options.course))
    }
  }
  return slots.filter((s) => options.sets.length === 0 || options.sets.includes(s.setId))
}

function isDone(slot: Slot): boolean {
  return readShardSets(shardPaths(slot).sets).some((s) => s.id === slot.setId)
}

interface Spend {
  calls: number
  cached: number
  usd: number
  inputTokens: number
  outputTokens: number
}

async function ask<T>(
  model: StructuredTextModel | null,
  modelName: string,
  request: BuiltRequest,
  parse: (value: unknown) => T,
  spend: Spend,
  limitUsd: number,
): Promise<{ answer: T; provider: string }> {
  const cached = readCached(request.cacheKey)
  if (cached) {
    spend.cached += 1
    return { answer: parse(cached.value), provider: `${cached.provider} (cached)` }
  }
  if (!model) throw new Error('No FIREWORKS_API_KEY or OPENROUTER_API_KEY in the environment')
  if (spend.usd >= limitUsd) throw new Error(`budget of $${limitUsd} reached before the call`)
  logRequest(request.cacheKey, {
    system: request.system,
    messages: request.messages,
    schema: request.schema,
    temperature: request.temperature,
    seed: request.seed,
  })
  const result = await model.generate({
    system: request.system,
    messages: request.messages,
    schema: request.schema,
    temperature: request.temperature,
    seed: request.seed,
    parse,
  })
  spend.calls += 1
  spend.inputTokens += result.usage.inputTokens
  spend.outputTokens += result.usage.outputTokens
  spend.usd += costUsd(modelName, result.usage)
  writeCached({
    cacheKey: request.cacheKey,
    provider: result.provider,
    model: modelName,
    at: new Date().toISOString(),
    usage: result.usage,
    value: result.value,
  })
  return { answer: result.value, provider: result.provider }
}

interface SlotOutcome {
  setId: string
  status:
    | 'written'
    | 'judged'
    | 'translated'
    | 'judged-translation'
    | 'skipped'
    | 'dry-run'
    | 'needs-brief'
    | 'failed'
  lang?: InterfaceLang
  phrases?: number
  coverage?: number | undefined
  calls?: number
  judge?: string | undefined
  rejected?: { target: string; reason: string }[]
  error?: string
}

function toShardPhrase(code: string, slot: Slot, c: Checked): ShardPhrase {
  const words: ShardPhrase['words'] = {}
  for (const w of c.candidate.words)
    words[w.w.toLowerCase()] = { 'en-GB': w.gloss_en, 'en-US': w.gloss_en }
  return {
    id: phraseId(code, slot.setId, c.candidate.target),
    target: c.candidate.target,
    translations: { 'en-GB': c.candidate.en_GB.trim(), 'en-US': c.candidate.en_US.trim() },
    register: c.candidate.register,
    region: slot.course.slice(3),
    tags: c.candidate.functions.filter((f) => slot.brief.functions.includes(f)),
    image: c.icons,
    words,
    grammar: c.grammar,
    functions: c.candidate.functions.filter((f) => slot.brief.functions.includes(f)),
    uses: c.uses,
  }
}

function judgeInput(c: Checked): JudgeInput {
  return {
    target: c.candidate.target,
    english: c.candidate.en_GB.trim(),
    words: c.candidate.words.map((w) => ({ w: w.w, gloss: w.gloss_en })),
    grammar: c.grammar,
  }
}

function reviewRows(
  slot: Slot,
  modelName: string,
  inputs: readonly JudgeInput[],
  ids: readonly string[],
  verdicts: readonly Verdict[],
): ReviewRow[] {
  const date = new Date().toISOString().slice(0, 10)
  return verdicts.flatMap((v) => {
    const input = inputs[v.index]
    const phraseIdOf = ids[v.index]
    if (!input || phraseIdOf === undefined) return []
    return [
      {
        phraseId: phraseIdOf,
        lang: slot.course,
        contentHash: contentHashOf(input),
        reviewer: `judge:${modelName}`,
        date,
        verdict: v.outcome,
        fields: [...v.failures, ...v.minors],
        comment: v.note,
        fix: v.fix,
      },
    ]
  })
}

function printVerdicts(verdicts: readonly Verdict[], inputs: readonly JudgeInput[]): void {
  for (const v of verdicts) {
    if (v.outcome === 'ok') continue
    const why = [...v.failures, ...v.minors].join(', ')
    out(
      `    ${v.outcome}: «${inputs[v.index]?.target ?? ''}» — ${why}${v.fix ? ` → «${v.fix}»` : ''}`,
    )
  }
}

/** The judge on a set already in its shard: verdicts to `v2/reviews/`, the shard untouched. */
async function judgeWritten(
  slot: Slot,
  model: StructuredTextModel | null,
  modelName: string,
  options: Options,
  spend: Spend,
): Promise<SlotOutcome> {
  const paths = shardPaths(slot)
  const set = readShardSets(paths.sets).find((s) => s.id === slot.setId)
  if (!set) return { setId: slot.setId, status: 'skipped' }
  const byId = new Map(readShardPhrases(paths.phrases).map((p) => [p.id, p]))
  const phrases = set.phraseIds.flatMap((id) => {
    const p = byId.get(id)
    return p ? [p] : []
  })
  const inputs: JudgeInput[] = phrases.map((p) => ({
    target: p.target,
    english: p.translations['en-GB'],
    words: Object.entries(p.words).map(([w, g]) => ({ w, gloss: g['en-GB'] })),
    grammar: p.grammar,
  }))
  const request = buildJudgeRequest(slot, inputs, modelName)
  if (options.dryRun) {
    out(
      `  ${slot.setId}: would judge ${inputs.length} phrases, cache ${request.cacheKey.slice(0, 12)}`,
    )
    out(request.messages[0]?.content ?? '')
    return { setId: slot.setId, status: 'dry-run' }
  }
  const { answer, provider } = await ask(
    model,
    modelName,
    request,
    (v) => RawJudgeAnswer.parse(v),
    spend,
    options.limitUsd,
  )
  const verdicts = applyVerdicts(answer, inputs)
  const added = appendReviews(
    COURSE_CODES[slot.course],
    reviewRows(
      slot,
      modelName,
      inputs,
      phrases.map((p) => p.id),
      verdicts,
    ),
  )
  out(`  ${slot.setId} judge: ${summarize(verdicts)}; ${added} new row(s) in reviews (${provider})`)
  printVerdicts(verdicts, inputs)
  return {
    setId: slot.setId,
    status: 'judged',
    phrases: inputs.length,
    calls: 1,
    judge: summarize(verdicts),
  }
}

function translateReviewRows(
  lang: InterfaceLang,
  modelName: string,
  inputs: readonly JudgeTranslateInput[],
  ids: readonly string[],
  verdicts: readonly Verdict[],
): ReviewRow[] {
  const date = new Date().toISOString().slice(0, 10)
  return verdicts.flatMap((v) => {
    const input = inputs[v.index]
    const id = ids[v.index]
    if (!input || id === undefined) return []
    return [
      {
        phraseId: id,
        lang: INTERFACE_LANGS[lang],
        contentHash: translateContentHash(input),
        reviewer: `judge:${modelName}`,
        date,
        verdict: v.outcome,
        fields: [...v.failures, ...v.minors],
        comment: v.note,
        fix: v.fix,
      },
    ]
  })
}

function printTranslateVerdicts(
  verdicts: readonly Verdict[],
  inputs: readonly JudgeTranslateInput[],
): void {
  for (const v of verdicts) {
    if (v.outcome === 'ok') continue
    const why = [...v.failures, ...v.minors].join(', ')
    out(
      `    ${v.outcome}: «${inputs[v.index]?.translation ?? ''}» — ${why}${v.fix ? ` → «${v.fix}»` : ''}`,
    )
  }
}

/** What the translate judge sees: each phrase with its line and its glosses beside the English ones. */
function judgeTranslateInputs(
  inputs: readonly TranslateInput[],
  lines: readonly { translation: string; words: Record<string, string> }[],
): JudgeTranslateInput[] {
  return inputs.map((input, i) => ({
    target: input.target,
    english: input.english,
    translation: lines[i]?.translation ?? '',
    glosses: input.words.map((w) => ({
      w: w.w,
      english: w.gloss,
      gloss: lines[i]?.words[w.w.toLowerCase()] ?? '',
    })),
  }))
}

/** One judge call over a set's lines in one language; the verdicts in input order. */
async function judgeTranslation(
  slot: Slot,
  lang: InterfaceLang,
  inputs: readonly JudgeTranslateInput[],
  model: StructuredTextModel | null,
  modelName: string,
  options: Options,
  spend: Spend,
): Promise<{ verdicts: Verdict[]; provider: string }> {
  const { answer, provider } = await ask(
    model,
    modelName,
    buildJudgeTranslateRequest(slot, inputs, lang, modelName),
    (v) => RawJudgeTranslateAnswer.parse(v),
    spend,
    options.limitUsd,
  )
  return { verdicts: applyTranslateVerdicts(answer, inputs), provider }
}

function translateInputsOf(set: ShardSet, byId: Map<string, ShardPhrase>): TranslateInput[] {
  return set.phraseIds.flatMap((id) => {
    const p = byId.get(id)
    if (!p) return []
    return [
      {
        id: p.id,
        target: p.target,
        english: p.translations['en-GB'],
        words: Object.entries(p.words).map(([w, g]) => ({ w, gloss: g['en-GB'] })),
      },
    ]
  })
}

/** The translate judge on a language file already written: verdicts to `v2/reviews/`, the file untouched. */
async function judgeWrittenTranslation(
  slot: Slot,
  lang: InterfaceLang,
  model: StructuredTextModel | null,
  modelName: string,
  options: Options,
  spend: Spend,
): Promise<SlotOutcome> {
  const paths = shardPaths(slot)
  const set = readShardSets(paths.sets).find((s) => s.id === slot.setId)
  if (!set) return { setId: slot.setId, status: 'skipped', lang }
  const byId = new Map(readShardPhrases(paths.phrases).map((p) => [p.id, p]))
  const written = new Map(
    readLocaleShard(localeShardPath(slot, lang)).flatMap((l) =>
      l.kind === 'phrase' ? [[l.id, l] as const] : [],
    ),
  )
  const inputs = translateInputsOf(set, byId).filter((i) => written.has(i.id))
  const lines = inputs.map((i) => {
    const l = written.get(i.id)
    return { translation: l?.translation ?? '', words: l?.words ?? {} }
  })
  const judgeInputs = judgeTranslateInputs(inputs, lines)
  if (options.dryRun) {
    out(`  ${slot.setId} → ${lang}: would judge ${inputs.length} lines`)
    return { setId: slot.setId, status: 'dry-run', lang }
  }
  const { verdicts, provider } = await judgeTranslation(
    slot,
    lang,
    judgeInputs,
    model,
    modelName,
    options,
    spend,
  )
  const added = appendReviews(
    COURSE_CODES[slot.course],
    translateReviewRows(
      lang,
      modelName,
      judgeInputs,
      inputs.map((i) => i.id),
      verdicts,
    ),
  )
  out(
    `  ${slot.setId} → ${lang} judge: ${summarize(verdicts)}; ${added} new row(s) in reviews (${provider})`,
  )
  printTranslateVerdicts(verdicts, judgeInputs)
  return {
    setId: slot.setId,
    status: 'judged-translation',
    lang,
    phrases: inputs.length,
    calls: 1,
    judge: summarize(verdicts),
  }
}

/**
 * One set into one interface language: its own file, the shard untouched (ADR-0017). Lines the
 * checks and the judge accept are kept between rounds; only the rest go back, with their problems
 * named, so a repair cannot undo an earlier fix. The file is written only when every line is in.
 */
async function translateSet(
  slot: Slot,
  lang: InterfaceLang,
  model: StructuredTextModel | null,
  modelName: string,
  options: Options,
  spend: Spend,
): Promise<SlotOutcome> {
  const paths = shardPaths(slot)
  const set = readShardSets(paths.sets).find((s) => s.id === slot.setId)
  if (!set) return { setId: slot.setId, status: 'skipped', lang }
  const byId = new Map(readShardPhrases(paths.phrases).map((p) => [p.id, p]))
  const all = translateInputsOf(set, byId)
  const judging = options.stages.includes('judge-translate')
  const accepted = new Map<string, { translation: string; words: Record<string, string> }>()
  const problems = new Map<string, string>()
  const rows: ReviewRow[] = []
  let subtitle = ''
  let calls = 0
  let judgeTally = ''
  for (let round = 0; round < 3; round += 1) {
    const pending = all.filter((i) => !accepted.has(i.id))
    if (pending.length === 0) break
    const prior = pending.flatMap((i, n) => {
      const why = problems.get(i.id)
      return why ? [`phrase ${n + 1} «${i.target}»: ${why}`] : []
    })
    const request = buildTranslateRequest(slot, pending, lang, set.subtitle.en, modelName, prior)
    if (options.dryRun) {
      out(
        `  ${slot.setId} → ${lang}: would send ${describe(request).bytes} bytes, cache ${request.cacheKey.slice(0, 12)}`,
      )
      out(request.messages[0]?.content ?? '')
      return { setId: slot.setId, status: 'dry-run', lang }
    }
    const { answer, provider } = await ask(
      model,
      modelName,
      request,
      (v) => RawTranslateAnswer.parse(v),
      spend,
      options.limitUsd,
    )
    calls += 1
    const checked = checkTranslation(answer, pending, lang)
    if (round === 0) subtitle = checked.subtitle
    const aligned: { input: TranslateInput; line: (typeof checked.phrases)[number] }[] = []
    for (const [i, p] of checked.phrases.entries()) {
      const input = pending[i]
      if (!input) continue
      if (p.problems.length > 0) problems.set(input.id, p.problems.join('; '))
      else aligned.push({ input, line: p })
    }
    out(
      `  ${slot.setId} → ${lang} round ${round}: ${aligned.length}/${pending.length} aligned (${provider})`,
    )
    for (const [id, why] of problems) {
      if (pending.some((i) => i.id === id) && !aligned.some((a) => a.input.id === id))
        out(`    «${all.find((i) => i.id === id)?.target ?? id}»: ${why}`)
    }
    if (aligned.length === 0) continue
    if (!judging) {
      for (const a of aligned) accepted.set(a.input.id, a.line)
      continue
    }
    const judgeInputs = judgeTranslateInputs(
      aligned.map((a) => a.input),
      aligned.map((a) => a.line),
    )
    const judged = await judgeTranslation(slot, lang, judgeInputs, model, modelName, options, spend)
    calls += 1
    judgeTally = summarize(judged.verdicts)
    out(`  ${slot.setId} → ${lang} judge: ${judgeTally} (${judged.provider})`)
    printTranslateVerdicts(judged.verdicts, judgeInputs)
    const kept: Verdict[] = []
    for (const v of judged.verdicts) {
      const a = aligned[v.index]
      if (!a) continue
      if (v.outcome === 'reject') {
        problems.set(
          a.input.id,
          `the editor says: ${v.failures.join(', ')}${v.fix ? `; suggested «${v.fix}»` : ''}`,
        )
      } else {
        accepted.set(a.input.id, a.line)
        kept.push(v)
      }
    }
    rows.push(
      ...translateReviewRows(
        lang,
        modelName,
        judgeInputs,
        aligned.map((a) => a.input.id),
        kept,
      ),
    )
  }
  if (accepted.size < all.length) {
    const left = all.filter((i) => !accepted.has(i.id))
    out(`  ${slot.setId} → ${lang}: ${left.length} line(s) still not accepted; nothing written`)
    return {
      setId: slot.setId,
      status: 'failed',
      lang,
      calls,
      error: `${left.length} of ${all.length} lines not accepted after ${calls} call(s): ${left.map((i) => i.target).join(' | ')}`,
    }
  }
  const lines: LocaleLine[] = [
    { kind: 'set', id: slot.setId, subtitle },
    ...all.map((i) => {
      const a = accepted.get(i.id)
      return {
        kind: 'phrase' as const,
        id: i.id,
        translation: a?.translation ?? '',
        words: a?.words ?? {},
      }
    }),
  ]
  appendLocaleShard(slot, lang, lines)
  if (rows.length > 0) appendReviews(COURSE_CODES[slot.course], rows)
  return {
    setId: slot.setId,
    status: 'translated',
    lang,
    phrases: all.length,
    calls,
    judge: judgeTally || undefined,
  }
}

async function writeSlot(
  slot: Slot,
  context: AuthoringContext,
  model: StructuredTextModel | null,
  modelName: string,
  options: Options,
  spend: Spend,
): Promise<SlotOutcome> {
  const siblings = siblingsFor(slot, context)
  const earlier = readAttempts(slot.setId)
  // Nothing chosen in an earlier run survives (only accepted sets are written), so every place is open.
  let prior: PriorAttempt | undefined = earlier
    ? { ...earlier.last, needed: slot.count }
    : undefined
  let chosen: Checked[] = []
  let selection: Selection | null = null
  let title = ''
  let subtitle = ''
  let provider = ''
  let calls = 0
  let verdicts: Verdict[] = []
  const allRejected: { target: string; reason: string }[] = []
  const judging = options.stages.includes('judge')

  for (let round = 0; round <= MAX_REPAIRS; round += 1) {
    const request = buildPhrasesRequest(slot, context, modelName, prior)
    if (options.dryRun) {
      const size = describe(request)
      out(
        `  ${slot.setId}: would send ${size.bytes} bytes (≈${size.approxTokens} tokens), cache ${request.cacheKey.slice(0, 12)}`,
      )
      out(request.messages[0]?.content ?? '')
      return { setId: slot.setId, status: 'dry-run' }
    }
    const { answer, provider: who } = await ask(
      model,
      modelName,
      request,
      (v) => RawPhrasesAnswer.parse(v),
      spend,
      options.limitUsd,
    )
    calls += 1
    provider = who
    if (round === 0) {
      title = answer.title.trim()
      subtitle = answer.subtitle_en.trim()
    }
    const checked = answer.phrases.map((c, i) =>
      checkCandidate(slot, c, i + round * 100, context, siblings),
    )
    selection = select(slot, checked, slot.count, chosen)
    chosen = selection.chosen
    for (const r of selection.rejected) {
      if (!r.problems[0]?.startsWith('not needed'))
        allRejected.push({ target: r.candidate.target, reason: r.problems.join('; ') })
    }
    let complete = chosen.length >= slot.count && selection.coverage >= MIN_COVERAGE
    out(
      `  ${slot.setId} round ${round}: ${checked.length} candidates, ${checked.filter((c) => c.problems.length === 0).length} pass, ${chosen.length}/${slot.count} chosen, coverage ${(selection.coverage * 100).toFixed(0)}% (${who})`,
    )
    if (complete && judging) {
      // The judge sees the whole set, so it can see duplicates; its rejects go back as rejects.
      const inputs = chosen.map(judgeInput)
      const judged = await ask(
        model,
        modelName,
        buildJudgeRequest(slot, inputs, modelName),
        (v) => RawJudgeAnswer.parse(v),
        spend,
        options.limitUsd,
      )
      calls += 1
      verdicts = applyVerdicts(judged.answer, inputs)
      out(`  ${slot.setId} judge: ${summarize(verdicts)} (${judged.provider})`)
      printVerdicts(verdicts, inputs)
      const rejects = verdicts.filter((v) => v.outcome === 'reject')
      if (rejects.length > 0) {
        const dropped = new Set(rejects.map((v) => v.index))
        for (const v of rejects) {
          const c = chosen[v.index]
          if (c)
            allRejected.push({
              target: c.candidate.target,
              reason: `judge: ${v.failures.join(', ')}`,
            })
        }
        chosen = chosen.filter((_, i) => !dropped.has(i))
        selection = select(slot, [], slot.count, chosen)
        complete = false
      }
    }
    if (complete) break
    if (chosen.length >= slot.count) {
      // Full but short of must-use coverage: free a few places for the words still missing.
      chosen = makeRoom(chosen, 3)
      selection = select(slot, [], slot.count, chosen)
    }
    prior = {
      rejected: allRejected.slice(-15),
      missing: selection.missing,
      needed: Math.max(slot.count - chosen.length, selection.missing.length > 0 ? 3 : 0),
    }
  }

  if (!selection || chosen.length < slot.count || selection.coverage < MIN_COVERAGE) {
    writeAttempts({
      setId: slot.setId,
      attempts: (earlier?.attempts ?? 0) + 1,
      last: prior ?? {
        rejected: allRejected,
        missing: selection?.missing ?? [],
        needed: slot.count,
      },
    })
    return {
      setId: slot.setId,
      status: 'needs-brief',
      phrases: chosen.length,
      coverage: selection?.coverage,
      calls,
      rejected: allRejected,
    }
  }

  const code = COURSE_CODES[slot.course]
  const phrases = chosen.map((c) => toShardPhrase(code, slot, c))
  const set: ShardSet = {
    id: slot.setId,
    title: title || slot.situation,
    subtitle: { en: subtitle || (slot.brief.scene.split('.')[0] ?? slot.situation) },
    topicId: slot.topic,
    situation: slot.situation,
    level: slot.level,
    coverIcon: phrases[0]?.image[0] ?? 'local_cafe',
    targetLang: slot.course,
    phraseIds: phrases.map((p) => p.id),
    grammarFocus: slot.brief.grammarFocus.map((g) => g.id),
    provenance: {
      writer: 'deepseek',
      provider: provider.replace(' (cached)', ''),
      model: modelName,
      run: options.runId,
      promptVersion: buildPhrasesRequest(slot, context, modelName).promptVersion,
      briefHash: buildPhrasesRequest(slot, context, modelName).briefHash,
    },
  }
  appendShard(slot, set, phrases)
  if (verdicts.length > 0) {
    appendReviews(
      code,
      reviewRows(
        slot,
        modelName,
        chosen.map(judgeInput),
        phrases.map((p) => p.id),
        verdicts,
      ),
    )
  }
  clearAttempts(slot.setId)
  // Later slots in this run see this set as a sibling.
  for (const p of phrases) {
    context.phrases.push({
      id: p.id,
      target: p.target,
      english: p.translations['en-GB'],
      level: slot.level,
      setId: slot.setId,
      topicId: slot.topic,
    })
    context.textKeys.set(p.target.toLowerCase(), p.id)
  }
  return {
    setId: slot.setId,
    status: 'written',
    phrases: phrases.length,
    coverage: selection.coverage,
    calls,
    judge: verdicts.length > 0 ? summarize(verdicts) : undefined,
    rejected: allRejected,
  }
}

async function main(): Promise<void> {
  try {
    loadEnvFile(new URL('../../.env', import.meta.url))
  } catch {
    /* the environment may already be set */
  }
  const options = parse(process.argv.slice(2))
  const slots = selectSlots(options)
  if (slots.length === 0) {
    out(
      `No slots for ${options.course} ${options.levels.join(',')} ${options.topics.join(',')} under ${CONTENT_ROOT}/plan`,
    )
    return
  }
  const context = loadContext(options.course)
  const modelName = config.fireworksApiKey()
    ? config.fireworksModel()
    : config.openRouterTextModel()
  const model = options.dryRun
    ? null
    : textModel({
        timeoutMs: 180_000,
        primaryTimeoutMs: 120_000,
        maxTokens: 8_000,
        maxRequestBytes: 64_000,
        maxResponseBytes: 256_000,
        maxConcurrentRequests: 1,
      })
  const spend: Spend = { calls: 0, cached: 0, usd: 0, inputTokens: 0, outputTokens: 0 }
  const outcomes: SlotOutcome[] = []
  let taken = 0
  out(
    `Run ${options.runId}: ${slots.length} slot(s) selected, model ${modelName}, limit $${options.limitUsd}${options.dryRun ? ', dry run' : ''}`,
  )
  const writing = options.stages.includes('phrases')
  const judgeOnly = !writing && options.stages.includes('judge')
  const translating = options.stages.includes('translate')
  const judgeTranslationsOnly = !translating && options.stages.includes('judge-translate')
  for (const slot of slots) {
    if (taken >= options.maxSets) break
    try {
      let worked = false
      if (writing) {
        if (isDone(slot)) {
          out(`  ${slot.setId}: already written, skipped`)
        } else {
          worked = true
          outcomes.push(await writeSlot(slot, context, model, modelName, options, spend))
        }
      } else if (judgeOnly) {
        if (isDone(slot)) {
          worked = true
          outcomes.push(await judgeWritten(slot, model, modelName, options, spend))
        } else out(`  ${slot.setId}: not written yet, nothing to judge`)
      }
      if (translating && isDone(slot)) {
        for (const lang of options.langs) {
          if (isTranslated(slot, lang)) {
            out(`  ${slot.setId} → ${lang}: already translated, skipped`)
            continue
          }
          worked = true
          outcomes.push(await translateSet(slot, lang, model, modelName, options, spend))
        }
      } else if (translating) out(`  ${slot.setId}: not written yet, nothing to translate`)
      if (judgeTranslationsOnly && isDone(slot)) {
        for (const lang of options.langs) {
          if (!isTranslated(slot, lang)) {
            out(`  ${slot.setId} → ${lang}: not translated yet, nothing to judge`)
            continue
          }
          worked = true
          outcomes.push(await judgeWrittenTranslation(slot, lang, model, modelName, options, spend))
        }
      }
      if (worked) taken += 1
      else outcomes.push({ setId: slot.setId, status: 'skipped' })
    } catch (error) {
      const message =
        error instanceof ProviderFailure
          ? `provider: ${error.code}`
          : error instanceof Error
            ? error.message
            : String(error)
      out(`  ${slot.setId}: failed, ${message}`)
      outcomes.push({ setId: slot.setId, status: 'failed', error: message })
      if (message.startsWith('budget')) break
    }
  }
  const summary = {
    runId: options.runId,
    at: new Date().toISOString(),
    stages: options.stages,
    langs: options.langs,
    course: options.course,
    levels: options.levels,
    topics: options.topics,
    model: modelName,
    pricing: pricing.source,
    spend,
    outcomes,
  }
  // A rerun that found nothing to do leaves no trace: only a run that spent or wrote is recorded.
  const didSomething =
    spend.calls + spend.cached > 0 ||
    outcomes.some((o) =>
      ['written', 'judged', 'translated', 'judged-translation'].includes(o.status),
    )
  if (!options.dryRun && didSomething) {
    const dir = join(CONTENT_ROOT, 'runs')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${options.runId}.json`), `${JSON.stringify(summary, null, 2)}\n`)
    out(
      `Summary: ${spend.calls} call(s), ${spend.cached} cached, ${spend.inputTokens}+${spend.outputTokens} tokens, ≈$${spend.usd.toFixed(4)} (${pricing.source}); ${join('packages/content/v2/runs', `${options.runId}.json`)}`,
    )
  }
  out(
    `Written: ${outcomes.filter((o) => o.status === 'written').length}; judged: ${outcomes.filter((o) => o.status === 'judged').length}; translated: ${outcomes.filter((o) => o.status === 'translated').length}; needs-brief: ${outcomes.filter((o) => o.status === 'needs-brief').length}; failed: ${outcomes.filter((o) => o.status === 'failed').length}; repo ${REPO_ROOT}`,
  )
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
