import { loadLearningCatalog } from '@loro/content'
import {
  FIELD_POLICY,
  supportsPair,
  TARGET_LOCALES,
  type Clock,
  type FieldWrite,
  type Persistence,
  type PhraseState,
  type NativeLanguage,
  type SyncEntity,
  type TargetLocale,
} from '@loro/core'
import { INITIAL_STATE, EMPTY_REFRAIN_RESUME, type AppData, type CourseState } from '../store/state'
import type { StorePersistence } from '../store/types'
import { newId as defaultNewId } from '../lib/ids'
import { structuralEqual as same } from '../lib/structuralEqual'

const courseOf = (s: AppData): CourseState => ({
  phrases: s.phrases,
  onboarded: s.onboarded,
  selectedId: s.selectedId,
  streamCursor: s.streamCursor,
  refrainResume: s.refrainResume,
  refrainSet: s.refrainSet,
  refrainDay: s.refrainDay,
  refrainSubstituted: s.refrainSubstituted,
})
function coursesOf(s: AppData): Partial<Record<TargetLocale, CourseState>> {
  return { ...s.courses, [s.targetLocale]: courseOf(s) }
}
/** Only the session's unique phrases, including own text; never the whole catalog. */
function contentSignature(
  course: CourseState,
  locale: TargetLocale,
  native: NativeLanguage,
): string {
  const catalog = new Map(
    supportsPair(native, locale)
      ? loadLearningCatalog(locale, native).phrases.map((p) => [p.id, p.targetText])
      : [],
  )
  const ids = [
    ...new Set(course.refrainResume.session?.plan.items.map((item) => item.phraseId) ?? []),
  ].sort()
  return JSON.stringify(
    ids.map((id) => {
      const phrase = course.phrases.find((p) => p.id === id)
      // Explicit eligible indices are currently unavailable in bundled content.
      return [
        id,
        phrase?.phraseId ?? null,
        phrase?.phraseId ? (catalog.get(phrase.phraseId) ?? null) : (phrase?.ownEs ?? null),
        [],
      ]
    }),
  )
}

function phraseFields(p: PhraseState): Record<string, unknown> {
  const { srs, ...fields } = p
  return {
    ...fields,
    targetLocale: p.targetLocale ?? 'es-ES',
    ...(srs
      ? {
          srsAlgorithm: srs.algorithm ?? null,
          srsStability: srs.stability,
          srsDifficulty: srs.difficulty,
          srsDue: srs.due,
          srsLastReview: srs.lastReview,
          srsLapses: srs.lapses,
          srsState: srs.state,
        }
      : {}),
  }
}

/** Ordering is optional local UI metadata, never a reason to hide otherwise valid rows. */
function phraseOrder(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? '[]')
    return Array.isArray(value) && value.every((id): id is string => typeof id === 'string')
      ? value
      : []
  } catch {
    return []
  }
}
function jsonField(value: unknown): FieldWrite['v'] {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map(jsonField)
  if (typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonField(item)]))
  throw new Error('Invalid sync field value')
}

/** The tables are authoritative; this adapter never stores an application-state blob. */
export function createRuntimePersistence(
  persistence: Persistence,
  { clock, newId = defaultNewId }: { clock: Clock; newId?: () => string },
): StorePersistence {
  function enqueue(
    entity: SyncEntity,
    entityId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    op: 'upsert' | 'delete' = 'upsert',
  ): void {
    const changed = Object.keys(after).filter(
      (key) =>
        after[key] !== undefined && key in FIELD_POLICY[entity] && !same(before[key], after[key]),
    )
    if (changed.some((key) => FIELD_POLICY[entity][key] === 'latest-review')) {
      for (const key of Object.keys(after)) {
        if (FIELD_POLICY[entity][key] === 'latest-review' && !changed.includes(key))
          changed.push(key)
      }
    }
    if (
      entity === 'user_phrase' &&
      changed.some((key) => key === 'repsToday' || key === 'repsTodayDay')
    ) {
      for (const key of ['repsToday', 'repsTodayDay']) if (!changed.includes(key)) changed.push(key)
    }
    if (!changed.length) return
    const hlc = persistence.nextHlc()
    const fields: Record<string, FieldWrite> = {}
    for (const key of changed) {
      const value = after[key] ?? null
      fields[key] = { v: jsonField(value), hlc }
    }
    persistence.outbox.append({ entity, entityId, op, fields, hlc, createdAt: clock.now() })
  }
  function load(): AppData | null {
    const settings = persistence.settings.load()
    if (!settings) return null
    const nativeLanguage = settings.languagePair?.nativeLanguage ?? 'en'
    const phrases = persistence.phrases.all()
    const courses: Partial<Record<TargetLocale, CourseState>> = {}
    for (const locale of TARGET_LOCALES) {
      const row = persistence.courses.load(locale)
      const ordered = phraseOrder(persistence.metadata.get(`phrase-order:${locale}`))
      const members = phrases.filter((p) => (p.targetLocale ?? 'es-ES') === locale)
      members.sort((a, b) => {
        const ai = ordered.indexOf(a.id),
          bi = ordered.indexOf(b.id)
        return (ai < 0 ? ordered.length : ai) - (bi < 0 ? ordered.length : bi)
      })
      if (!row && !members.length) continue
      const day = persistence.refrainDay.latest(locale)
      const checkpoint = persistence.checkpoints.load(locale)
      const memberIds = new Set(members.map((p) => p.id))
      const catalogIds = new Set(
        supportsPair(nativeLanguage, locale)
          ? loadLearningCatalog(locale, nativeLanguage).phrases.map((p) => p.id)
          : [],
      )
      const resumable =
        checkpoint?.localDay === clock.localDay() &&
        (checkpoint.refrainResume.session?.plan.items.every((item) => {
          const phrase = members.find((p) => p.id === item.phraseId)
          return (
            phrase !== undefined && (phrase.phraseId === null || catalogIds.has(phrase.phraseId))
          )
        }) ??
          true)
      courses[locale] = {
        phrases: members,
        onboarded: row?.onboarded ?? settings.onboarded,
        selectedId:
          row?.selectedId && memberIds.has(row.selectedId as PhraseState['id'])
            ? row.selectedId
            : null,
        streamCursor: checkpoint?.streamCursor ?? row?.streamCursor ?? 0,
        refrainResume: resumable ? checkpoint.refrainResume : EMPTY_REFRAIN_RESUME,
        refrainSet: day?.setIds.filter((id) => memberIds.has(id as PhraseState['id'])) ?? [],
        refrainDay: day?.localDay ?? null,
        refrainSubstituted:
          day?.substituted.filter((id) => memberIds.has(id as PhraseState['id'])) ?? [],
      }
      const course = courses[locale]
      if (
        course.refrainResume.session !== null &&
        checkpoint?.contentSignature !== contentSignature(course, locale, nativeLanguage)
      ) {
        courses[locale] = { ...course, refrainResume: EMPTY_REFRAIN_RESUME }
      }
    }
    const pair = settings.languagePair ?? {
      nativeLanguage: 'en' as const,
      targetLocale: 'es-ES' as const,
    }
    const active = courses[pair.targetLocale] ?? courseOf(INITIAL_STATE)
    return {
      ...INITIAL_STATE,
      ...pair,
      ...active,
      courses,
      languageChosen:
        (persistence.metadata.get('language-chosen') ?? String(settings.onboarded)) === 'true',
      goal: settings.goal,
      level: settings.level,
      dailyMinutes: settings.dailyMinutes ?? 10,
      practiceDays: persistence.practiceDays.all(),
      toast: null,
    }
  }
  return {
    load,
    hasCatalog: (id, target) => persistence.phrases.hasCatalog(id, target),
    hasAttempt: (context) => persistence.attempts.has(context.targetLocale, context.attemptId),
    commit(before, after, attempt) {
      return persistence.transaction(() => {
        if (attempt) {
          if (persistence.attempts.has(attempt.targetLocale, attempt.attemptId))
            return load() ?? before
          if (
            attempt.expectedPhrase &&
            !same(attempt.expectedPhrase, persistence.phrases.byId(attempt.expectedPhrase.id))
          ) {
            throw new Error('Practice phrase has changed')
          }
          const checkpoint = persistence.checkpoints.load(attempt.targetLocale)
          if (
            attempt.sessionId &&
            (checkpoint?.localDay !== attempt.localDay ||
              checkpoint.refrainResume.session?.sessionId !== attempt.sessionId ||
              checkpoint.refrainResume.cursor !== attempt.expectedCursor)
          )
            throw new Error('Stale practice checkpoint')
          persistence.attempts.record(attempt.targetLocale, attempt.attemptId)
        }
        const previous = coursesOf(before),
          next = coursesOf(after)
        const oldPhrases = Object.entries(previous).flatMap(([locale, c]) =>
          c.phrases.map((p) => ({
            ...p,
            targetLocale: p.targetLocale ?? (locale as TargetLocale),
          })),
        )
        const newPhrases = Object.entries(next).flatMap(([locale, c]) =>
          c.phrases.map((p) => ({
            ...p,
            targetLocale: p.targetLocale ?? (locale as TargetLocale),
          })),
        )
        if (attempt?.review && attempt.phraseId) {
          const phrase = newPhrases.find(
            (p) => p.id === attempt.phraseId && p.targetLocale === attempt.targetLocale,
          )
          if (!phrase?.srs) throw new Error('Review requires a resulting scheduler state')
          const event = {
            attemptId: attempt.attemptId,
            targetLocale: attempt.targetLocale,
            phraseId: attempt.phraseId,
            reviewedAt: attempt.review.at,
            rating: attempt.review.grade,
            algorithm: attempt.review.algorithm,
            state: phrase.srs,
          }
          persistence.reviews.append(event)
          const hlc = persistence.nextHlc()
          const wireEvent = {
            phraseId: event.phraseId,
            at: event.reviewedAt,
            grade: ({ 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' } as const)[event.rating],
            stability: event.state.stability,
            difficulty: event.state.difficulty,
            due: event.state.due,
            algorithm: event.algorithm,
          }
          const fields = Object.fromEntries(
            Object.entries(wireEvent).map(([key, value]) => [key, { v: value, hlc }]),
          )
          const reviewKey = `review-id:${attempt.targetLocale}:${attempt.attemptId}`
          const reviewId = persistence.metadata.get(reviewKey) ?? newId()
          persistence.metadata.set(reviewKey, reviewId)
          persistence.outbox.append({
            entity: 'review_log',
            entityId: reviewId,
            op: 'upsert',
            fields,
            hlc,
            createdAt: clock.now(),
          })
        }
        const ids = new Set(newPhrases.map((p) => p.id))
        for (const p of oldPhrases)
          if (!ids.has(p.id)) {
            persistence.phrases.softDelete(p.id, clock.now())
            enqueue('user_phrase', p.id, {}, { deletedAt: clock.now() }, 'delete')
          }
        for (const p of newPhrases) {
          const old = oldPhrases.find((row) => row.id === p.id)
          if (same(old, p)) continue
          if (!old) persistence.phrases.restore(p.id)
          persistence.phrases.upsert(p)
          enqueue('user_phrase', p.id, old ? phraseFields(old) : {}, phraseFields(p))
        }
        for (const locale of TARGET_LOCALES) {
          const course = next[locale]
          if (!course) continue
          persistence.courses.save({
            targetLocale: locale,
            onboarded: course.onboarded,
            selectedId: course.selectedId,
            streamCursor: course.streamCursor,
            refrainSession: null,
          })
          const checkpoint = persistence.checkpoints.load(locale)
          if (
            checkpoint?.streamCursor !== course.streamCursor ||
            !same(checkpoint.refrainResume, course.refrainResume)
          ) {
            const signature =
              checkpoint?.refrainResume.session?.sessionId ===
              course.refrainResume.session?.sessionId
                ? checkpoint?.contentSignature
                : contentSignature(course, locale, after.nativeLanguage)
            persistence.checkpoints.save({
              version: 1,
              ...(signature === undefined ? {} : { contentSignature: signature }),
              targetLocale: locale,
              localDay: course.refrainDay ?? clock.localDay(),
              revision: (checkpoint?.revision ?? 0) + 1,
              streamCursor: course.streamCursor,
              refrainResume: course.refrainResume,
            })
          }
          persistence.metadata.set(
            `phrase-order:${locale}`,
            JSON.stringify(course.phrases.map((p) => p.id)),
          )
          if (course.refrainDay) {
            const old = persistence.refrainDay.load(course.refrainDay, locale)
            const row = {
              targetLocale: locale,
              localDay: course.refrainDay,
              setIds: course.refrainSet,
              substituted: course.refrainSubstituted,
              waves: old?.waves ?? [],
            }
            if (!same(old, row)) {
              persistence.refrainDay.save(row)
              enqueue('refrain_day', `${locale}:${course.refrainDay}`, old ? { ...old } : {}, {
                ...row,
              })
            }
          }
        }
        const settings = {
          onboarded: after.onboarded,
          goal: after.goal,
          level: after.level,
          dailyMinutes: after.dailyMinutes,
          waveTimes: persistence.settings.load()?.waveTimes ?? [],
          languagePair: { nativeLanguage: after.nativeLanguage, targetLocale: after.targetLocale },
        }
        const oldSettings = persistence.settings.load()
        persistence.settings.save(settings)
        enqueue('settings', 'settings', oldSettings ? { ...oldSettings } : {}, {
          ...settings,
          ...(settings.waveTimes.length === 3 ? {} : { waveTimes: undefined }),
        })
        persistence.metadata.set('language-chosen', String(after.languageChosen))
        for (const day of after.practiceDays)
          if (!before.practiceDays.includes(day)) {
            persistence.practiceDays.add(day)
            enqueue('streak_day', day, {}, { practised: true })
          }
        if (after.practiceDays[0]) persistence.practiceDays.pruneBefore(after.practiceDays[0])
        return { ...(load() ?? after), toast: after.toast }
      })
    },
    reset() {
      persistence.wipe()
      return { ...INITIAL_STATE }
    },
  }
}
