/**
 * MERGE CLASSES — every syncable field declares one here.
 *
 * `fieldPolicy.test.ts` fails if any field in a syncable entity is missing from this
 * map. That turns "added a field without thinking about sync" from a subtle
 * data-loss bug into a build failure.
 *
 * See docs/architecture/sync-protocol.md#per-field-lww
 */

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
  user_phrase: {
    targetLocale: 'lww',
    ownMeaningLanguage: 'lww',
    // identity — set once, never merged
    phraseId: 'lww',
    // The learner's own text, for rows with no catalog entry (`phraseId: null`).
    // LWW because these are learner-set scalars and an edit on either device should
    // win by clock; there is no counter or schedule to merge as a group.
    ownEs: 'lww',
    ownEn: 'lww',
    ownTheme: 'lww',
    ownEmoji: 'lww',
    source: 'lww',

    // the learner's signals
    difficulty: 'lww',
    tags: 'lww',
    loved: 'lww',
    learned: 'lww',
    note: 'lww',

    // monotonic counters — MUST be max, not lww
    plays: 'max',
    reps: 'max',
    addedAt: 'lww',
    lastPracticedAt: 'max',
    graduatedAt: 'lww',

    // FSRS — merged as a unit
    srsStability: 'latest-review',
    srsDifficulty: 'latest-review',
    srsDue: 'latest-review',
    srsLastReview: 'latest-review',
    srsLapses: 'latest-review',
    srsState: 'latest-review',
    srsAlgorithm: 'latest-review',

    // Loop B — repsToday is day-scoped, so LWW on the pair is correct
    repsToday: 'lww',
    repsTodayDay: 'lww',
    automaticity: 'lww',
    lockInDays: 'max',

    // Loop C — rung is monotonic by design ("you only climb or hold")
    rung: 'max',
    stumbles: 'lww',

    // prosody — cueLevel never decreases; axes only rise
    cueLevel: 'max',
    axPerception: 'max',
    axRecall: 'max',
    axProduction: 'max',

    deletedAt: 'tombstone',
  },

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

  settings: {
    // Native/target selection merges atomically to avoid unsupported hybrid pairs.
    languagePair: 'lww',
    goal: 'lww',
    level: 'lww',
    dailyMinutes: 'lww',
    activeEngine: 'lww',
    engineExplicit: 'lww',
    waveTimes: 'lww',
    reminderTime: 'lww',
    notifications: 'lww',
    accent: 'lww',
    theme: 'lww',
    analyticsOptOut: 'lww',
    cloudAsrConsent: 'lww',
    voiceCloneConsent: 'lww',
  },

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
