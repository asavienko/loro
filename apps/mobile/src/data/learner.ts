/** F-02/F-03/LB-01: repository snapshots drive rendering; all writes commit before publication. */
import {
  LOCAL_USER_ID,
  encodeCheckpoint,
  type Clock,
  type FieldWrite,
  type RefrainDayRow,
  type TargetLocale,
} from '@loro/core'
import type { AppData } from '../store/state'
import type { RuntimeDatabase } from './database'
import type { PracticeCommitContext } from '../store/types'
import { contentSignature, validatePractice, writePracticeReview } from './practiceRecords'
import { decodeDevicePreferences } from '../lib/devicePreferences'
import { deleteLocalValue, writeLocalValue } from './database'
import { deferPhraseDelete, flushPendingDeletes, undoPendingPhraseDelete } from './pendingDeletes'
import { resolveLearnerAliases } from './aliases'
import {
  changedFields,
  phraseFields,
  settingsFields,
  type LearnerFieldValues,
} from './learnerFields'
import { allCourses, loadLearnerData } from './learnerLoad'

export { phraseFields } from './learnerFields'

export interface LearnerStorage {
  load(): AppData
  commit(previous: AppData, next: AppData, attempt?: PracticeCommitContext): AppData
  hasAttempt(context: PracticeCommitContext): boolean
  hasCatalog(id: string, target: TargetLocale): boolean
  erase(): AppData
  refrainDay(day: string, target: TargetLocale): RefrainDayRow | null
}

export function createLearnerStorage(database: RuntimeDatabase, clock: Clock): LearnerStorage {
  const { driver, persistence, hlc } = database

  function append(
    entity: string,
    entityId: string,
    values: LearnerFieldValues,
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
    return loadLearnerData(database, clock)
  }

  return {
    load,
    refrainDay: (day, target) => persistence.refrainDay.load(day, target),
    hasCatalog: (id, target) =>
      driver.all(
        `SELECT id FROM user_phrase WHERE user_id = ? AND phrase_id = ? AND COALESCE(target_locale,'es-ES') = ?
       UNION ALL SELECT id FROM sync_catalog_tombstones WHERE phrase_id = ? AND target_locale = ? LIMIT 1`,
        [LOCAL_USER_ID, id, target, id, target],
      ).length > 0,
    hasAttempt: (context) =>
      driver.all(
        'SELECT attempt_id FROM committed_attempt WHERE user_id = ? AND target_locale = ? AND attempt_id = ?',
        [LOCAL_USER_ID, context.targetLocale ?? load().targetLocale, context.attemptId ?? ''],
      ).length > 0,
    commit(previous, next, attempt) {
      next = resolveLearnerAliases(database, next)
      driver.transaction(() => {
        if (!validatePractice(database, attempt, previous)) return
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
            refrainSession: (() => {
              const priorResume = persistence.courses.load(targetLocale)?.refrainSession
              let signature: string | undefined
              if (
                priorResume &&
                old?.refrainResume.session?.sessionId === course.refrainResume.session?.sessionId
              ) {
                try {
                  signature = (JSON.parse(priorResume) as { contentSignature?: string })
                    .contentSignature
                } catch {
                  /* replaced below */
                }
              }
              signature ??= contentSignature(course, targetLocale, next.nativeLanguage)
              encodeCheckpoint({
                version: 1,
                targetLocale,
                revision: 0,
                localDay: course.refrainDay ?? clock.localDay(),
                streamCursor: course.streamCursor,
                contentSignature: signature,
                refrainResume: course.refrainResume,
              })
              return JSON.stringify({
                ...course.refrainResume,
                version: 1,
                localDay: course.refrainDay ?? clock.localDay(),
                contentSignature: signature,
              })
            })(),
          })
          writeLocalValue(
            driver,
            `phrase-order:${targetLocale}`,
            JSON.stringify(course.phrases.map((phrase) => phrase.id)),
          )
          if (course.refrainDay !== null) {
            const existing = persistence.refrainDay.load(course.refrainDay, targetLocale)
            persistence.refrainDay.save({
              targetLocale,
              localDay: course.refrainDay,
              setIds: course.refrainSet,
              waves: course.refrainWaves,
              substituted: course.refrainSubstituted,
              listenCounts: course.waveListens,
            })
            const nextDay: LearnerFieldValues = {
              targetLocale,
              setIds: JSON.stringify(course.refrainSet),
              waves: JSON.stringify(course.refrainWaves),
            }
            const oldDay: LearnerFieldValues = existing
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
        writePracticeReview(database, attempt, next, clock)
        const settings = persistence.settings.load()
        const changedSettings = changedFields(settingsFields(previous), settingsFields(next))
        // A local import checkpoint must not manufacture a settings sync operation. Settings are
        // initialized by the first settings change, then retained on each later settings write.
        if (Object.keys(changedSettings).length > 0) {
          persistence.settings.save({
            onboarded: next.onboarded,
            languagePair: { nativeLanguage: next.nativeLanguage, targetLocale: next.targetLocale },
            goal: next.goal,
            level: next.level,
            dailyMinutes: next.dailyMinutes,
            waveTimes: settings?.waveTimes ?? ['08:00', '13:00', '19:00'],
          })
          append('settings', 'settings', settings === null ? settingsFields(next) : changedSettings)
        }
        writeLocalValue(
          driver,
          'device_preferences',
          JSON.stringify(decodeDevicePreferences(JSON.stringify(next.devicePreferences))),
        )
        writeLocalValue(driver, 'import-drafts', JSON.stringify(next.importDrafts))
        // One release wrote this single-pair key. Delete only after the map has committed so
        // an interrupted migration can still recover the learner's draft on the next launch.
        deleteLocalValue(driver, 'import-draft')
        writeLocalValue(driver, 'language_chosen', String(next.languageChosen))
        for (const day of next.practiceDays) {
          if (previous.practiceDays.includes(day)) continue
          persistence.practiceDays.add(day)
          append('streak_day', day, { practised: true, minutes: 0 })
        }
        if (next.practiceDays[0]) persistence.practiceDays.pruneBefore(next.practiceDays[0])
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
