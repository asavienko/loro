/** F-02/F-03/LB-01: repository snapshots drive rendering; all writes commit before publication. */
import {
  LOCAL_USER_ID,
  TARGET_LOCALES,
  type Clock,
  type FieldWrite,
  type PhraseState,
  type RefrainDayRow,
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
import { readLocalValue, writeLocalValue } from './database'
import { deferPhraseDelete, flushPendingDeletes, undoPendingPhraseDelete } from './pendingDeletes'
import { resolveLearnerAliases } from './aliases'

export interface LearnerStorage {
  load(): AppData
  commit(previous: AppData, next: AppData): AppData
  erase(): AppData
  refrainDay(day: string, target: TargetLocale): RefrainDayRow | null
}

type Values = Record<string, string | number | boolean | null>

/** Shared camelCase wire field spelling, with structured values encoded for the existing outbox. */
export function phraseFields(phrase: PhraseState): Values {
  const { srs } = phrase
  const result: Values = {}
  for (const [key, value] of Object.entries(phrase)) {
    if (key === 'id' || key === 'srs' || value === undefined) continue
    result[key] = Array.isArray(value)
      ? JSON.stringify(value)
      : (value as string | number | boolean | null)
  }
  if (srs !== null) {
    Object.assign(result, {
      srsStability: srs.stability,
      srsDifficulty: srs.difficulty,
      srsDue: srs.due,
      srsLastReview: srs.lastReview,
      srsLapses: srs.lapses,
      srsState: srs.state,
    })
  }
  return result
}

function changedFields(previous: Values, next: Values): Values {
  return Object.fromEntries(Object.entries(next).filter(([key, value]) => previous[key] !== value))
}

function snapshotCourse(state: AppData): CourseState {
  return {
    onboarded: state.onboarded,
    phrases: state.phrases,
    selectedId: state.selectedId,
    streamCursor: state.streamCursor,
    refrainResume: state.refrainResume,
    refrainDay: state.refrainDay,
    refrainSet: state.refrainSet,
    refrainSubstituted: state.refrainSubstituted,
  }
}

function allCourses(state: AppData): Partial<Record<TargetLocale, CourseState>> {
  return { ...state.courses, [state.targetLocale]: snapshotCourse(state) }
}

function parseResume(serialized: string | null, localDay: string | null): RefrainResume {
  if (serialized === null) return EMPTY_REFRAIN_RESUME
  const value: unknown = JSON.parse(serialized)
  if (
    typeof value === 'object' &&
    value !== null &&
    'localDay' in value &&
    value.localDay !== localDay
  )
    return EMPTY_REFRAIN_RESUME
  if (
    typeof value !== 'object' ||
    value === null ||
    !('cursor' in value) ||
    typeof value.cursor !== 'number' ||
    !Number.isInteger(value.cursor) ||
    value.cursor < 0 ||
    !('done' in value) ||
    typeof value.done !== 'boolean' ||
    !('lastLatency' in value) ||
    (value.lastLatency !== null && typeof value.lastLatency !== 'number') ||
    !('history' in value) ||
    !Array.isArray(value.history) ||
    !value.history.every((sample: unknown) => sample === null || typeof sample === 'number') ||
    !('session' in value)
  )
    throw new Error('Invalid stored Refrain resume state')
  const session = value.session
  if (
    session !== null &&
    (typeof session !== 'object' ||
      !('sessionId' in session) ||
      typeof session.sessionId !== 'string' ||
      !('cursor' in session) ||
      typeof session.cursor !== 'number' ||
      !('plan' in session) ||
      typeof session.plan !== 'object' ||
      session.plan === null ||
      !('engineId' in session.plan) ||
      session.plan.engineId !== 'refrain' ||
      !('items' in session.plan) ||
      !Array.isArray(session.plan.items) ||
      !session.plan.items.every(
        (item: unknown) =>
          typeof item === 'object' &&
          item !== null &&
          'phraseId' in item &&
          typeof item.phraseId === 'string' &&
          'itemId' in item &&
          typeof item.itemId === 'string' &&
          'mode' in item &&
          typeof item.mode === 'string',
      ))
  )
    throw new Error('Invalid stored Refrain session')
  return value as RefrainResume
}

function settingsFields(state: AppData): Values {
  return {
    languagePair: JSON.stringify({
      nativeLanguage: state.nativeLanguage,
      targetLocale: state.targetLocale,
    }),
    goal: state.goal,
    level: state.level,
    dailyMinutes: state.dailyMinutes,
  }
}

export function createLearnerStorage(database: RuntimeDatabase, clock: Clock): LearnerStorage {
  const { driver, persistence, hlc } = database

  function append(
    entity: string,
    entityId: string,
    values: Values,
    op: 'upsert' | 'delete' = 'upsert',
    replaces?: { id: string; deleted_at: number },
  ): void {
    if (Object.keys(values).length === 0 && op !== 'delete') return
    const stamp = hlc()
    const fields: Record<string, FieldWrite> = Object.fromEntries(
      Object.entries(values).map(([field, v]) => [field, { v, hlc: stamp }]),
    )
    persistence.outbox.append({
      entity,
      entityId,
      op,
      fields,
      hlc: stamp,
      createdAt: clock.now(),
      ...(replaces ? { replaces } : {}),
    })
    if (entity === 'user_phrase' || entity === 'settings') {
      const key = entity === 'user_phrase' ? 'id' : 'user_id'
      const rowId = entity === 'settings' ? LOCAL_USER_ID : entityId
      const raw = driver.all(`SELECT field_hlc FROM ${entity} WHERE ${key} = ?`, [rowId])[0]?.[
        'field_hlc'
      ]
      const old: Record<string, string> =
        typeof raw === 'string' ? (JSON.parse(raw) as Record<string, string>) : {}
      const clocks = {
        ...old,
        ...Object.fromEntries(Object.keys(fields).map((field) => [field, stamp])),
      }
      driver.run(`UPDATE ${entity} SET field_hlc = ?, updated_hlc = ? WHERE ${key} = ?`, [
        JSON.stringify(clocks),
        stamp,
        rowId,
      ])
    }
  }

  function load(): AppData {
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
      const day =
        persistence.refrainDay.load(clock.localDay(), targetLocale) ??
        persistence.refrainDay.latest(targetLocale)
      courses[targetLocale] = {
        onboarded: saved?.onboarded ?? (targetLocale === 'es-ES' && (settings?.onboarded ?? false)),
        phrases: owned,
        selectedId: saved?.selectedId ?? null,
        streamCursor: saved?.streamCursor ?? 0,
        refrainResume: parseResume(saved?.refrainSession ?? null, day?.localDay ?? null),
        refrainSet: day?.setIds ?? [],
        refrainDay: day?.localDay ?? null,
        refrainSubstituted: day?.substituted ?? [],
      }
    }
    const active = courses[pair.targetLocale]
    if (!active) throw new Error('Missing active course')
    return {
      ...INITIAL_STATE,
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

  return {
    load,
    refrainDay: (day, target) => persistence.refrainDay.load(day, target),
    commit(previous, next) {
      next = resolveLearnerAliases(database, next)
      driver.transaction(() => {
        flushPendingDeletes(database, clock.now())
        const before = allCourses(previous)
        for (const [locale, course] of Object.entries(allCourses(next))) {
          const targetLocale = locale as TargetLocale
          const old = before[targetLocale]
          const oldPhrases = new Map(old?.phrases.map((phrase) => [phrase.id, phrase]) ?? [])
          const nextIds = new Set(course.phrases.map((phrase) => phrase.id))
          for (const row of course.phrases) {
            const prior = oldPhrases.get(row.id)
            if (row === prior) continue
            const normalized = { ...row, targetLocale }
            let replaces: { id: string; deleted_at: number } | undefined
            if (!prior) {
              const deleted = driver.all(
                'SELECT deleted_at FROM user_phrase WHERE id = ? AND user_id = ?',
                [row.id, LOCAL_USER_ID],
              )[0]?.['deleted_at']
              if (
                typeof deleted === 'number' &&
                !undoPendingPhraseDelete(database, row.id, clock.now())
              ) {
                throw new Error('The undo period has ended. Add this phrase again to restore it.')
              }
              if (row.phraseId !== null) {
                const removed = driver.all(
                  `SELECT id, deleted_at FROM (
                    SELECT id, deleted_at FROM user_phrase WHERE user_id = ? AND phrase_id = ? AND COALESCE(target_locale, ?) = ? AND id <> ? AND deleted_at IS NOT NULL
                    UNION ALL
                    SELECT id, deleted_at FROM sync_catalog_tombstones WHERE phrase_id = ? AND target_locale = ? AND id <> ?
                  ) ORDER BY deleted_at DESC LIMIT 1`,
                  [
                    LOCAL_USER_ID,
                    row.phraseId,
                    'es-ES',
                    targetLocale,
                    row.id,
                    row.phraseId,
                    targetLocale,
                    row.id,
                  ],
                )[0]
                if (
                  removed &&
                  typeof removed['id'] === 'string' &&
                  typeof removed['deleted_at'] === 'number'
                ) {
                  replaces = { id: removed['id'], deleted_at: removed['deleted_at'] }
                  // A fresh add is a deliberate replacement. Finalize its old deletion
                  // first so the server cannot alias the new UUID onto the hidden old row.
                  flushPendingDeletes(database, clock.now(), [replaces.id])
                }
              }
            }
            const nextFields = phraseFields(normalized)
            const changed = prior ? changedFields(phraseFields(prior), nextFields) : nextFields
            // Calendar-scoped counters and FSRS records are indivisible merge groups.
            if ('repsToday' in changed || 'repsTodayDay' in changed) {
              changed['repsToday'] = normalized.repsToday
              changed['repsTodayDay'] = normalized.repsTodayDay
            }
            if (Object.keys(changed).some((key) => key.startsWith('srs'))) {
              for (const [key, value] of Object.entries(nextFields))
                if (key.startsWith('srs')) changed[key] = value
            }
            persistence.phrases.upsert(normalized)
            append('user_phrase', row.id, changed, 'upsert', replaces)
          }
          for (const phrase of old?.phrases ?? []) {
            if (nextIds.has(phrase.id)) continue
            persistence.phrases.softDelete(phrase.id, clock.now())
            deferPhraseDelete(database, phrase.id, clock.now())
          }
          persistence.courses.save({
            targetLocale,
            onboarded: course.onboarded,
            selectedId: course.selectedId,
            streamCursor: course.streamCursor,
            refrainSession: JSON.stringify({
              ...course.refrainResume,
              localDay: course.refrainDay,
            }),
          })
          if (course.refrainDay !== null) {
            const existing = persistence.refrainDay.load(course.refrainDay, targetLocale)
            persistence.refrainDay.save({
              targetLocale,
              localDay: course.refrainDay,
              setIds: course.refrainSet,
              waves: existing?.waves ?? [],
              substituted: course.refrainSubstituted,
            })
            const nextDay: Values = {
              targetLocale,
              setIds: JSON.stringify(course.refrainSet),
              waves: JSON.stringify(existing?.waves ?? []),
            }
            const oldDay: Values = existing
              ? {
                  targetLocale,
                  setIds: JSON.stringify(existing.setIds),
                  waves: JSON.stringify(existing.waves),
                }
              : {}
            append(
              'refrain_day',
              `${targetLocale}:${course.refrainDay}`,
              changedFields(oldDay, nextDay),
            )
          }
        }
        const settings = persistence.settings.load()
        persistence.settings.save({
          onboarded: next.onboarded,
          languagePair: { nativeLanguage: next.nativeLanguage, targetLocale: next.targetLocale },
          goal: next.goal,
          level: next.level,
          dailyMinutes: next.dailyMinutes,
          waveTimes: settings?.waveTimes ?? ['08:00', '13:00', '19:00'],
        })
        append(
          'settings',
          'settings',
          settings === null
            ? settingsFields(next)
            : changedFields(settingsFields(previous), settingsFields(next)),
        )
        writeLocalValue(driver, 'language_chosen', String(next.languageChosen))
        for (const day of next.practiceDays) {
          if (previous.practiceDays.includes(day)) continue
          persistence.practiceDays.add(day)
          append('streak_day', day, { practised: true, minutes: 0 })
        }
      })
      return { ...load(), toast: next.toast }
    },
    erase() {
      driver.transaction(() => {
        persistence.wipe()
        writeLocalValue(driver, 'device_id', database.deviceId)
      })
      return load()
    },
  }
}
