import {
  LOCAL_USER_ID,
  supportsPair,
  type Clock,
  type NativeLanguage,
  type TargetLocale,
} from '@loro/core'
import { loadLearningCatalog } from '@loro/content'
import { newId } from '../lib/ids'
import { structuralEqual } from '../lib/structuralEqual'
import type { AppData, CourseState } from '../store/state'
import type { PracticeCommitContext } from '../store/types'
import { readLocalValue, writeLocalValue, type RuntimeDatabase } from './database'

/** Stable across canonical server aliases; a changed displayed phrase invalidates its plan. */
export function contentSignature(
  course: CourseState,
  target: TargetLocale,
  native: NativeLanguage,
): string {
  const catalog = new Map(
    supportsPair(native, target)
      ? loadLearningCatalog(target, native).phrases.map((phrase) => [phrase.id, phrase.targetText])
      : [],
  )
  const ids = new Set(course.refrainResume.session?.plan.items.map((item) => item.phraseId) ?? [])
  return JSON.stringify(
    course.phrases
      .filter((phrase) => ids.has(phrase.id))
      .map((phrase) => [
        phrase.phraseId ?? phrase.id,
        phrase.phraseId === null ? (phrase.ownEs ?? null) : (catalog.get(phrase.phraseId) ?? null),
      ])
      .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
  )
}

export function phraseOrder(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? '[]')
    return Array.isArray(value) && value.every((id): id is string => typeof id === 'string')
      ? value
      : []
  } catch {
    return []
  }
}

/** Called inside the same SQL transaction as the rows, cursor, journal and outbox. */
export function validatePractice(
  database: RuntimeDatabase,
  context: PracticeCommitContext | undefined,
  previous: AppData,
): boolean {
  if (!context?.attemptId) return true
  const target = context.targetLocale ?? previous.targetLocale
  const { driver, persistence } = database
  if (
    driver.all(
      'SELECT attempt_id FROM committed_attempt WHERE user_id=? AND target_locale=? AND attempt_id=?',
      [LOCAL_USER_ID, target, context.attemptId],
    ).length > 0
  )
    return false
  if (context.expectedPhrase) {
    const stored = persistence.phrases.byId(context.expectedPhrase.id)
    if (!structuralEqual({ ...context.expectedPhrase, targetLocale: target }, stored))
      throw new Error('Practice phrase has changed')
  }
  if (context.sessionId) {
    const raw = persistence.courses.load(target)?.refrainSession
    const resume: unknown = raw === undefined || raw === null ? null : JSON.parse(raw)
    if (
      typeof resume !== 'object' ||
      resume === null ||
      !('localDay' in resume) ||
      resume.localDay !== context.localDay ||
      !('cursor' in resume) ||
      resume.cursor !== context.expectedCursor ||
      !('session' in resume) ||
      typeof resume.session !== 'object' ||
      resume.session === null ||
      !('sessionId' in resume.session) ||
      resume.session.sessionId !== context.sessionId
    )
      throw new Error('Stale practice checkpoint')
  }
  driver.run('INSERT INTO committed_attempt(user_id,target_locale,attempt_id) VALUES(?,?,?)', [
    LOCAL_USER_ID,
    target,
    context.attemptId,
  ])
  return true
}

export function writePracticeReview(
  database: RuntimeDatabase,
  context: PracticeCommitContext | undefined,
  state: AppData,
  clock: Clock,
): void {
  if (!context?.attemptId || !context.review || !context.phraseId) return
  const target = context.targetLocale ?? state.targetLocale
  const phrases = target === state.targetLocale ? state.phrases : state.courses[target]?.phrases
  const phrase = phrases?.find((item) => item.id === context.phraseId)
  if (!phrase?.srs) throw new Error('Review requires resulting scheduler state')
  const { srs } = phrase
  const { at, grade, algorithm } = context.review
  database.driver.run(
    `INSERT INTO review_event(user_id,target_locale,attempt_id,phrase_id,
    reviewed_at,rating,algorithm,stability,difficulty,due,last_review,lapses,state)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      LOCAL_USER_ID,
      target,
      context.attemptId,
      phrase.id,
      at,
      grade,
      algorithm,
      srs.stability,
      srs.difficulty,
      srs.due,
      srs.lastReview,
      srs.lapses,
      srs.state,
    ],
  )
  const stamp = database.hlc()
  const reviewKey = `review-id:${target}:${context.attemptId}`
  const reviewId = readLocalValue(database.driver, reviewKey) ?? newId()
  writeLocalValue(database.driver, reviewKey, reviewId)
  const event = {
    phraseId: phrase.id,
    targetLocale: target,
    at,
    grade: ({ 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' } as const)[grade],
    stability: srs.stability,
    difficulty: srs.difficulty,
    due: srs.due,
    algorithm,
    lastReview: srs.lastReview,
    lapses: srs.lapses,
    state: srs.state,
  }
  database.persistence.outbox.append({
    entity: 'review_log',
    entityId: reviewId,
    op: 'upsert',
    fields: Object.fromEntries(Object.entries(event).map(([key, v]) => [key, { v, hlc: stamp }])),
    hlc: stamp,
    createdAt: clock.now(),
  })
}
