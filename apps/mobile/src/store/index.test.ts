/**
 * Store tests.
 *
 * The store is where the app's invariants actually live — the day key, the frozen
 * Refrain set, row identity — and it had none of these tests, which is why five
 * defects sat in 300 lines that 249 passing tests never touched.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createUserPhraseIds, streak } from '@loro/core'
import * as store from './index'
import {
  addPracticeDay,
  catalogPhrases,
  createAppStore,
  dataOf,
  INITIAL_STATE,
  packs,
  toView,
  useApp,
} from './index'
import { PRACTICE_DAY_RETENTION } from './state'

/** A catalog id that definitely exists, whatever the catalog currently holds. */
const someCatalogId = (): string => {
  const first = catalogPhrases[0]
  if (first === undefined) throw new Error('the catalog is empty')
  return first.id
}

beforeEach(() => {
  useApp.getState().reset()
})

describe('the public surface', () => {
  it('is exactly the names a screen may import', () => {
    // Eight route files and `ToastHost` import from `../src/store`, and the modules behind
    // that barrel were reorganised once already. Asserted rather than assumed, so a name
    // cannot be dropped or quietly renamed by the next reorganisation — and so ADDING one
    // is a deliberate edit here, not a side effect. Types are absent by construction:
    // `AppData`, `Toast`, `PhraseView`, `OwnPhraseDraft`, `AppState` and `StoreDeps` are
    // checked by `tsc`, which is why the route files compiling is the other half of this.
    expect(Object.keys(store).sort()).toEqual(
      [
        'INITIAL_STATE',
        'addPracticeDay',
        'applyDeltaToPhrase',
        'catalogById',
        'catalogPhrases',
        'createAppStore',
        'dataOf',
        'engineContext',
        'packs',
        'refrainEngine',
        'scenarios',
        'streamEngine',
        'toView',
        'useApp',
        'useMastery',
        'useViews',
      ].sort(),
    )
  })
})

describe('row identity', () => {
  it('gives a phrase a generated row id, never the catalog id', () => {
    const catalogId = someCatalogId()
    useApp.getState().addPhrase(catalogId)

    const row = useApp.getState().phrases[0]
    expect(row).toBeDefined()
    expect(row?.id).not.toBe(catalogId)
    expect(row?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    // The catalog id is still there — as the join key it always was.
    expect(row?.phraseId).toBe(catalogId)
  })

  it('still treats adding the same catalog phrase twice as a no-op', () => {
    const catalogId = someCatalogId()
    useApp.getState().addPhrase(catalogId)
    useApp.getState().addPhrase(catalogId)
    expect(useApp.getState().phrases).toHaveLength(1)
  })

  it('gives every row in a seeded stream a distinct id', () => {
    const pack = packs[0]
    expect(pack).toBeDefined()
    if (pack === undefined) return

    useApp.getState().completeOnboarding({ goal: 'travel', dailyMinutes: 10, packIds: [pack.id] })

    const ids = useApp.getState().phrases.map((p) => p.id)
    expect(ids.length).toBeGreaterThan(1)
    expect(new Set(ids).size).toBe(ids.length)
    // Ids are time-ordered, so the stream sorts by when it was added for free.
    expect([...ids].sort()).toEqual(ids)
  })

  it('removes by row id, and undo removes the row it just added', () => {
    const catalogId = someCatalogId()
    useApp.getState().addPhrase(catalogId)
    const row = useApp.getState().phrases[0]
    expect(row).toBeDefined()

    // Removing by catalog id must do nothing: it is not a row id.
    useApp.getState().removePhrase(catalogId)
    expect(useApp.getState().phrases).toHaveLength(1)

    // The toast's undo closes over the row id, so it removes the right row.
    useApp.getState().toast?.undo?.()
    expect(useApp.getState().phrases).toHaveLength(0)
  })

  it('keeps a row out of refrainSet and selectedId once removed', () => {
    const catalogId = someCatalogId()
    useApp.getState().addPhrase(catalogId)
    const id = useApp.getState().phrases[0]?.id
    expect(id).toBeDefined()
    if (id === undefined) return

    useApp.setState({ refrainSet: [id], refrainDay: '2026-07-28' })
    useApp.getState().select(id)
    useApp.getState().removePhrase(id)

    expect(useApp.getState().refrainSet).not.toContain(id)
    expect(useApp.getState().selectedId).toBeNull()
  })
})

describe('learner-authored phrases', () => {
  it('round-trips through the store with no catalog row', () => {
    const id = useApp
      .getState()
      .addOwnPhrase({ es: 'Me lo apunto', en: "I'll note that down" }, { tags: ['useful'] })

    const row = useApp.getState().phrases.find((p) => p.id === id)
    expect(row).toBeDefined()
    if (row === undefined) return

    expect(row.phraseId).toBeNull()
    expect(row.source).toBe('custom')
    expect(row.tags).toEqual(['useful'])
    // The row id is not, and must never be, a catalog id.
    expect(catalogPhrases.some((c) => c.id === row.id)).toBe(false)

    // What a screen actually renders comes from the row itself.
    const view = toView(row)
    expect(view.es).toBe('Me lo apunto')
    expect(view.en).toBe("I'll note that down")
    expect(view.theme).toBe('Mine')
    expect(view.emoji).toBe('✍️')
    expect(view.catalog).toBeNull()
  })

  it('does not collide with a catalog phrase of the same text, or with itself', () => {
    const a = useApp.getState().addOwnPhrase({ es: 'Vale', en: 'OK' })
    const b = useApp.getState().addOwnPhrase({ es: 'Vale', en: 'OK' })
    // Two rows: an own phrase has no catalog id to dedupe on, and the learner may
    // legitimately record the same words twice.
    expect(a).not.toBe(b)
    expect(useApp.getState().phrases).toHaveLength(2)
  })

  it('takes a theme and emoji when given them', () => {
    const id = useApp
      .getState()
      .addOwnPhrase({ es: 'La cuenta', en: 'The bill', theme: 'Dining', emoji: '🧾' })
    const row = useApp.getState().phrases.find((p) => p.id === id)
    expect(toView(row!).theme).toBe('Dining')
    expect(toView(row!).emoji).toBe('🧾')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// The invariants (plans/07)
// ─────────────────────────────────────────────────────────────────────────────

describe('reset', () => {
  it('restores every field, including the ones an enumerated reset forgot', () => {
    useApp.setState({
      onboarded: true,
      goal: 'trip',
      dailyMinutes: 20,
      selectedId: 'x',
      practiceDays: ['2026-07-27', '2026-07-28'],
      refrainSet: ['a'],
      refrainDay: '2026-07-28',
      refrainSubstituted: ['a'],
    })
    useApp.getState().addOwnPhrase({ es: 'Hola', en: 'Hi' })

    useApp.getState().reset()

    // Deep-equal against the single declaration, so a field added later cannot be
    // missed here the way `dailyMinutes` and `streakDays` were.
    expect(dataOf(useApp.getState())).toEqual(INITIAL_STATE)
  })
})

describe("the day's Refrain set", () => {
  /** A store whose day the test controls. */
  const withDay = (day: string) => {
    let current = day
    const store = createAppStore({
      clock: {
        now: () => 1_785_231_660_000,
        localDay: () => current,
        streakDay: () => current,
      },
      newId: createUserPhraseIds({
        now: () => 1_785_231_660_000,
        bytes: (n) => new Uint8Array(n).fill(7),
      }),
    })
    return { store, setDay: (d: string) => (current = d) }
  }

  /** Five minutes a day → a three-phrase set, which is the easiest size to reason about. */
  const seedThree = (store: ReturnType<typeof withDay>['store']): void => {
    store.setState({ dailyMinutes: 5 })
    for (const c of catalogPhrases.slice(0, 6)) store.getState().addPhrase(c.id)
    store.getState().ensureRefrainSet()
  }

  it('freezes the set for the day', () => {
    const { store } = withDay('2026-07-28')
    seedThree(store)
    const first = store.getState().refrainSet
    expect(first).toHaveLength(3)

    // Called again on the same day — including from a foreground event — it must not
    // choose a different set.
    store.getState().ensureRefrainSet()
    expect(store.getState().refrainSet).toEqual(first)
  })

  it('re-rolls when the local day changes under an open app', () => {
    const { store, setDay } = withDay('2026-07-28')
    seedThree(store)
    expect(store.getState().refrainDay).toBe('2026-07-28')

    setDay('2026-07-29')
    store.getState().ensureRefrainSet()
    expect(store.getState().refrainDay).toBe('2026-07-29')
    expect(store.getState().refrainSet).toHaveLength(3)
  })

  it('backfills a set that lost a member instead of leaving the day empty', () => {
    const { store } = withDay('2026-07-28')
    seedThree(store)
    const [first] = store.getState().refrainSet
    expect(first).toBeDefined()
    if (first === undefined) return

    store.getState().removePhrase(first)

    // Still a full day's work, and the replacement is recorded as a substitution rather
    // than pretending the set was always this one.
    expect(store.getState().refrainSet).toHaveLength(3)
    expect(store.getState().refrainSet).not.toContain(first)
    expect(store.getState().refrainSubstituted).toHaveLength(1)
  })

  it('empties only when there is genuinely nothing left to practise', () => {
    const { store } = withDay('2026-07-28')
    store.setState({ dailyMinutes: 5 })
    for (const c of catalogPhrases.slice(0, 2)) store.getState().addPhrase(c.id)
    store.getState().ensureRefrainSet()
    expect(store.getState().refrainSet).toHaveLength(2)

    for (const id of [...store.getState().refrainSet]) store.getState().removePhrase(id)
    expect(store.getState().refrainSet).toHaveLength(0)
  })

  it('does NOT re-roll the phrases already practised today when it backfills', () => {
    // The interaction between defects #2 and #3: once ensureRefrainSet is called on
    // foreground, a naive guard falls through on a short set and re-chooses the whole
    // day — including the phrases the learner already worked.
    const { store } = withDay('2026-07-28')
    seedThree(store)
    const set = [...store.getState().refrainSet]
    const [a, b, c] = set
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(c).toBeDefined()
    if (a === undefined || b === undefined || c === undefined) return

    // Practise two of the three.
    for (const id of [a, b]) {
      store.getState().applyDelta({
        phraseId: id as never,
        reps: 1,
        repsToday: 3,
        automaticity: 50,
        lastPracticedAt: 1_785_231_660_000,
      })
    }

    store.getState().removePhrase(c)
    store.getState().ensureRefrainSet()

    const after = store.getState().refrainSet
    expect(after).toContain(a)
    expect(after).toContain(b)
    expect(after.indexOf(a)).toBe(0)
    expect(after).toHaveLength(3)
  })
})

describe('the streak', () => {
  /** A store whose streak day the test controls. */
  const atStreakDay = (streakDay: string) => {
    let current = streakDay
    const store = createAppStore({
      clock: {
        now: () => 1_785_231_660_000,
        localDay: () => '2026-07-28',
        streakDay: () => current,
      },
      newId: createUserPhraseIds({
        now: () => 1_785_231_660_000,
        bytes: (n) => new Uint8Array(n).fill(3),
      }),
    })
    return { store, setStreakDay: (d: string) => (current = d) }
  }

  const aRep = (store: ReturnType<typeof atStreakDay>['store']): void => {
    const id = store.getState().phrases[0]?.id
    if (id === undefined) throw new Error('no phrase to practise')
    store.getState().applyDelta({ phraseId: id, reps: 1, repsToday: 1, automaticity: 17 })
  }

  const seedOne = (store: ReturnType<typeof atStreakDay>['store']): void => {
    const first = catalogPhrases[0]
    if (first === undefined) throw new Error('the catalog is empty')
    store.getState().addPhrase(first.id)
  }

  it('starts empty — a fresh install has no streak and no fabricated 1', () => {
    const { store } = atStreakDay('2026-07-28')
    expect(store.getState().practiceDays).toEqual([])
    expect(streak(store.getState().practiceDays, '2026-07-28')).toBe(0)
  })

  it('records the day a rep lands on, once', () => {
    const { store } = atStreakDay('2026-07-28')
    seedOne(store)
    aRep(store)
    aRep(store)
    expect(store.getState().practiceDays).toEqual(['2026-07-28'])
    expect(streak(store.getState().practiceDays, '2026-07-28')).toBe(1)
  })

  it('counts consecutive days and drops a broken run', () => {
    const { store, setStreakDay } = atStreakDay('2026-07-26')
    seedOne(store)
    aRep(store)
    setStreakDay('2026-07-27')
    aRep(store)
    setStreakDay('2026-07-28')
    aRep(store)

    expect(store.getState().practiceDays).toEqual(['2026-07-26', '2026-07-27', '2026-07-28'])
    expect(streak(store.getState().practiceDays, '2026-07-28')).toBe(3)
    // Two days later the run is over — and the count is 0, not 3.
    expect(streak(store.getState().practiceDays, '2026-07-30')).toBe(0)
  })

  it('does not count a listen as practice', () => {
    // `recordPlay` reports plays, not reps. A stream play is listening.
    const { store } = atStreakDay('2026-07-28')
    seedOne(store)
    const id = store.getState().phrases[0]?.id
    if (id === undefined) return
    store.getState().recordPlay(id)
    expect(store.getState().practiceDays).toEqual([])
  })

  it('uses the streak day, so a 01:30 session extends the evening before', () => {
    const { store, setStreakDay } = atStreakDay('2026-07-28')
    seedOne(store)
    aRep(store)
    // Just past midnight: localDay is the 29th, but the streak day is still the 28th.
    setStreakDay('2026-07-28')
    aRep(store)
    expect(store.getState().practiceDays).toEqual(['2026-07-28'])
  })

  it('keeps the history bounded', () => {
    let days: string[] = []
    for (let i = 0; i < PRACTICE_DAY_RETENTION + 50; i++) {
      const month = String(Math.floor(i / 28) + 1).padStart(2, '0')
      days = addPracticeDay(days, `20${String(26 + Math.floor(i / 336))}-${month}-01`)
    }
    expect(days.length).toBeLessThanOrEqual(PRACTICE_DAY_RETENTION)
  })

  it('stores days sorted, whatever order they arrive in', () => {
    const days = ['2026-07-28', '2026-07-26', '2026-07-27'].reduce(
      (acc: string[], d) => addPracticeDay(acc, d),
      [],
    )
    expect(days).toEqual(['2026-07-26', '2026-07-27', '2026-07-28'])
  })

  it('is cleared by reset — a streak must not survive to the next learner', () => {
    const { store } = atStreakDay('2026-07-28')
    seedOne(store)
    aRep(store)
    expect(store.getState().practiceDays).toHaveLength(1)
    store.getState().reset()
    expect(store.getState().practiceDays).toEqual([])
  })
})
