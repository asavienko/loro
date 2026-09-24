import {
  decodeCheckpoint,
  loadListenQueue,
  loadReviewCheckpoint,
  LOCAL_USER_ID,
  TARGET_LOCALES,
  validateReviewResume,
  type Clock,
  type ReviewCheckpoint,
  type TargetLocale,
} from '@loro/core'
import {
  EMPTY_REFRAIN_RESUME,
  INITIAL_STATE,
  type AppData,
  type CourseState,
  type RefrainResume,
} from '../store/state'
import type { RuntimeDatabase } from './database'
import { contentSignature, phraseOrder } from './practiceRecords'
import { decodeDevicePreferences } from '../lib/devicePreferences'
import { decodeImportDraft, decodeImportDrafts, importDraftKey } from '../lib/importDraft'
import { readLocalValue } from './database'

export function snapshotCourse(state: AppData): CourseState {
  return {
    onboarded: state.onboarded,
    phrases: state.phrases,
    selectedId: state.selectedId,
    streamCursor: state.streamCursor,
    refrainResume: state.refrainResume,
    reviewCheckpoint: state.reviewCheckpoint,
    listenQueue: state.listenQueue,
    refrainDay: state.refrainDay,
    refrainWaves: state.refrainWaves,
    waveListens: state.waveListens,
    refrainSet: state.refrainSet,
    refrainSubstituted: state.refrainSubstituted,
  }
}

export function allCourses(state: AppData): Partial<Record<TargetLocale, CourseState>> {
  return { ...state.courses, [state.targetLocale]: snapshotCourse(state) }
}

export function parseResume(
  serialized: string | null,
  day: string,
  targetLocale: TargetLocale,
  streamCursor: number,
  course: CourseState,
  native: AppData['nativeLanguage'],
): RefrainResume {
  if (serialized === null) return EMPTY_REFRAIN_RESUME
  try {
    const raw: unknown = JSON.parse(serialized)
    if (typeof raw !== 'object' || raw === null) return EMPTY_REFRAIN_RESUME
    const value = raw as Record<string, unknown>
    const checkpoint = decodeCheckpoint(
      JSON.stringify({
        version: value['version'] ?? 1,
        targetLocale,
        localDay: value['localDay'] ?? day,
        revision: 0,
        streamCursor,
        ...(typeof value['contentSignature'] === 'string'
          ? { contentSignature: value['contentSignature'] }
          : {}),
        refrainResume: {
          session: value['session'],
          ...(value['wave'] === undefined ? {} : { wave: value['wave'] }),
          cursor: value['cursor'],
          done: value['done'],
          lastLatency: value['lastLatency'],
          history: value['history'],
        },
      }),
    )
    if (checkpoint?.localDay !== day) return EMPTY_REFRAIN_RESUME
    const ids = new Set(course.phrases.map((phrase) => phrase.id))
    if (checkpoint.refrainResume.session?.plan.items.some((item) => !ids.has(item.phraseId)))
      return EMPTY_REFRAIN_RESUME
    if (
      checkpoint.contentSignature !== undefined &&
      checkpoint.contentSignature !==
        contentSignature(
          { ...course, refrainResume: checkpoint.refrainResume },
          targetLocale,
          native,
        )
    )
      return EMPTY_REFRAIN_RESUME
    return checkpoint.refrainResume
  } catch {
    // A broken local resume cannot make the learner's valid phrase rows inaccessible.
    return EMPTY_REFRAIN_RESUME
  }
}

export function loadLearnerData(database: RuntimeDatabase, clock: Clock): AppData {
  const { driver, persistence } = database
  const settings = persistence.settings.load()
  const pair = settings?.languagePair ?? {
    nativeLanguage: INITIAL_STATE.nativeLanguage,
    targetLocale: INITIAL_STATE.targetLocale,
  }
  const phrases = persistence.phrases.all()
  const courses: Partial<Record<TargetLocale, CourseState>> = {}
  for (const targetLocale of TARGET_LOCALES) {
    const saved = persistence.courses.load(targetLocale)
    const owned = phrases.filter((phrase) => (phrase.targetLocale ?? 'es-ES') === targetLocale)
    const order = phraseOrder(readLocalValue(driver, `phrase-order:${targetLocale}`))
    const position = (id: string) => {
      const index = order.indexOf(id)
      return index < 0 ? order.length : index
    }
    owned.sort((left, right) => position(left.id) - position(right.id))
    const ids = new Set(owned.map((phrase) => phrase.id as string))
    const day =
      persistence.refrainDay.load(clock.localDay(), targetLocale) ??
      persistence.refrainDay.latest(targetLocale)
    courses[targetLocale] = {
      onboarded: saved?.onboarded ?? (targetLocale === 'es-ES' && (settings?.onboarded ?? false)),
      phrases: owned,
      selectedId: saved?.selectedId && ids.has(saved.selectedId) ? saved.selectedId : null,
      streamCursor: saved?.streamCursor ?? 0,
      refrainResume: EMPTY_REFRAIN_RESUME,
      refrainSet: day?.setIds.filter((id) => ids.has(id)) ?? [],
      refrainDay: day?.localDay ?? null,
      refrainWaves: day?.waves ?? [],
      waveListens: { ...(day?.listenCounts ?? {}) },
      refrainSubstituted: day?.substituted.filter((id) => ids.has(id)) ?? [],
      reviewCheckpoint: hydrateReviewCheckpoint(
        driver,
        targetLocale,
        clock.localDay(),
        clock.now(),
        owned,
      ),
      listenQueue: hydrateListenQueue(driver, targetLocale, owned),
    }
    const course = courses[targetLocale]
    course.refrainResume = parseResume(
      saved?.refrainSession ?? null,
      clock.localDay(),
      targetLocale,
      course.streamCursor,
      course,
      pair.nativeLanguage,
    )
  }
  const active = courses[pair.targetLocale]
  if (!active) throw new Error('Missing active course')
  const importDrafts = decodeImportDrafts(readLocalValue(driver, 'import-drafts'))
  const legacyDraft = decodeImportDraft(readLocalValue(driver, 'import-draft'))
  const recoveredDrafts =
    Object.keys(importDrafts).length > 0 || legacyDraft === null
      ? importDrafts
      : { [importDraftKey(legacyDraft)]: legacyDraft }
  return {
    ...INITIAL_STATE,
    devicePreferences: decodeDevicePreferences(readLocalValue(driver, 'device_preferences')),
    importDraft: recoveredDrafts[`${pair.nativeLanguage}:${pair.targetLocale}`] ?? legacyDraft,
    importDrafts: recoveredDrafts,
    ...active,
    ...pair,
    courses: Object.fromEntries(
      Object.entries(courses).filter(([targetLocale]) => targetLocale !== pair.targetLocale),
    ),
    languageChosen:
      readLocalValue(driver, 'language_chosen') === null
        ? settings?.languagePair !== undefined
        : readLocalValue(driver, 'language_chosen') === 'true',
    goal: settings?.goal ?? null,
    level: settings?.level ?? null,
    dailyMinutes: settings?.dailyMinutes ?? INITIAL_STATE.dailyMinutes,
    practiceDays: persistence.practiceDays.all(),
  }
}

function hydrateListenQueue(
  driver: RuntimeDatabase['driver'],
  targetLocale: TargetLocale,
  phrases: CourseState['phrases'],
): readonly string[] | null {
  const stored = loadListenQueue(driver, LOCAL_USER_ID, targetLocale)
  if (stored === null) return null
  const owned = new Set<string>(phrases.map((phrase) => phrase.id))
  const kept = stored.phraseIds.filter((id) => owned.has(id))
  return kept.length === 0 ? null : kept
}

function hydrateReviewCheckpoint(
  driver: RuntimeDatabase['driver'],
  targetLocale: TargetLocale,
  localDay: string,
  at: number,
  phrases: CourseState['phrases'],
): ReviewCheckpoint | null {
  const decision = validateReviewResume(loadReviewCheckpoint(driver, LOCAL_USER_ID, targetLocale), {
    targetLocale,
    localDay,
    at,
    phrases,
  })
  return decision.ok ? decision.checkpoint : null
}
