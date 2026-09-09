/**
 * MERGE CLASSES — every syncable field declares one here.
 *
 * `fieldPolicy.test.ts` fails if any field in a syncable entity is missing from this
 * map. That turns "added a field without thinking about sync" from a subtle
 * data-loss bug into a build failure.
 *
 * See docs/architecture/sync-protocol.md#per-field-lww
 *
 * Phrase and settings merge classes are authored with SQL names in `syncableColumns.ts`.
 */

import { SETTINGS_MERGE_POLICY, USER_PHRASE_MERGE_POLICY } from './syncableColumns.js'

export type MergeClass =
  /** Highest HLC wins. For learner-set scalars. */
  | 'lww'
  /**
   * max(local, remote). For MONOTONIC counters.
   * LWW would let a device with a later clock but a lower count LOWER the value —
   * e.g. device A at reps:20 offline, device B reaching reps:18 with a later HLC.
   */
  | 'max'
  /**
   * Merged AS A GROUP, taking whichever side has the later `srsLastReview`.
   * Equal review times use the review anchor HLC. Policy provenance travels with
   * the state: mixing stability, due or algorithm from different devices would
   * produce a scheduling state no algorithm ever computed.
   */
  | 'latest-review'
  /** No merge; union by primary key. */
  | 'append-only'
  /** A delete wins over a concurrent edit at any HLC. */
  | 'tombstone'

/**
 * Merge-policy entity names. Includes trip / trip_drop / trip_phrase for planned
 * merge (plan 69 / Q-07). The wire envelope's `SyncEntity` in `api/sync.ts` does not
 * list those — do not collapse the two types or add trip entities to the wire here.
 */
export type SyncEntity =
  | 'user_phrase'
  | 'trip'
  | 'trip_drop'
  | 'trip_phrase'
  | 'settings'
  | 'refrain_day'
  | 'streak_day'
  | 'review_log'
  | 'latency_sample'
  | 'take'
  | 'session'
  | 'attempt'

type FieldMap = Readonly<Record<string, MergeClass>>

export const FIELD_POLICY: Readonly<Record<SyncEntity, FieldMap>> = {
  // Phrase merge classes are authored next to SQL names in `syncableColumns.ts`.
  user_phrase: USER_PHRASE_MERGE_POLICY,

  trip: {
    city: 'lww',
    country: 'lww',
    langVariant: 'lww',
    arrivalDate: 'lww',
    returnDate: 'lww',
    tripType: 'lww',
    targetCount: 'lww',
    state: 'lww',
    createdAt: 'lww',
    completedAt: 'lww',
    deletedAt: 'tombstone',
  },

  trip_drop: {
    dayIndex: 'lww',
    packId: 'lww',
    unlocksOn: 'lww',
    state: 'lww',
    addedAt: 'lww',
  },

  trip_phrase: {
    source: 'lww',
    usedAbroadCount: 'max',
    firstUsedAbroadAt: 'lww',
  },

  settings: SETTINGS_MERGE_POLICY,

  refrain_day: {
    targetLocale: 'lww',
    setIds: 'lww',
    waves: 'lww',
  },

  streak_day: {
    practised: 'lww',
    minutes: 'max',
  },

  // Append-only logs: no field-level merge, union by primary key.
  review_log: { '*': 'append-only' },
  latency_sample: { '*': 'append-only' },
  take: { '*': 'append-only' },
  session: { '*': 'append-only' },
  attempt: { '*': 'append-only' },
}

export function mergeClassFor(entity: SyncEntity, field: string): MergeClass | undefined {
  const map = FIELD_POLICY[entity]
  return map[field] ?? map['*']
}

/**
 * Whether an arbitrary entity name is one this policy governs.
 *
 * Derived from `FIELD_POLICY` rather than re-listed, so a new syncable entity is
 * registered by adding its row above and nothing else. A hand-written list would let an
 * entity exist in the union, exist in the policy, and still be treated as unknown by
 * whoever forgot to extend the list — and "unknown entity" silently means "no merge
 * class", which is the data-loss bug this file exists to prevent.
 */
export function isSyncEntity(entity: string): entity is SyncEntity {
  return Object.hasOwn(FIELD_POLICY, entity)
}

/**
 * The merge class for an entity name that has not been narrowed yet — `undefined` when
 * the entity is not syncable at all. The pairing of `isSyncEntity` with `mergeClassFor`
 * is needed at every boundary where entity names arrive as plain strings (the outbox
 * stores them as text), so it lives here once.
 */
export function mergeClassOf(entity: string, field: string): MergeClass | undefined {
  return isSyncEntity(entity) ? mergeClassFor(entity, field) : undefined
}
