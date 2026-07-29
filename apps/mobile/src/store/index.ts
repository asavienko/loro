/**
 * The app store.
 *
 * ONE shared phrase store, exactly as the blueprint does it (`Loro.dc.html:3575-3626`).
 * Rating a phrase in the stream updates the Progress histogram because both read the
 * same rows — no wiring between the screens.
 *
 * v1 keeps this in memory. SQLite + the outbox land with sync (ADR-0003/0012); the
 * repository shape below is the seam they slot into.
 *
 * Two rules this file holds:
 *   • The day comes from the injected `Clock`, never from a `Date` — one wrong line
 *     there reached every engine at once (see src/lib/clock.ts).
 *   • Practice outcomes are written ONLY through `applyDelta`, from a delta an engine
 *     produced. No action here computes a progress field.
 */

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import {
  DEFAULT_REP_TARGET,
  LadderRung,
  masteryBucket,
  RefrainEngine,
  StreamEngine,
  refrainSetSize,
  repsToday,
  selectRefrainSet,
  type CatalogPhraseId,
  type Clock,
  type Difficulty,
  type EngineContext,
  type LoroCoreFacade,
  type PhraseRepository,
  type PhraseState,
  type ProgressDelta,
  type Tag,
  type Theme,
  type UserPhraseId,
} from '@loro/core'
import { catalogPhraseId } from '@loro/core'
import { loadCatalog, type CatalogPhrase } from '@loro/content'
import { deviceClock } from '../lib/clock'
import { newId } from '../lib/ids'
import { addPracticeDay, applyDeltaToPhrase, INITIAL_STATE, type AppData } from './state'

export { INITIAL_STATE, dataOf, applyDeltaToPhrase, addPracticeDay } from './state'
export type { AppData, Toast } from './state'

const catalog = loadCatalog()
export const catalogById = new Map(catalog.phrases.map((p) => [p.id, p]))
export const catalogPhrases = catalog.phrases
export const packs = catalog.packs
export const scenarios = catalog.scenarios

// ─────────────────────────────────────────────────────────────────────────────

export interface PhraseView extends PhraseState {
  es: string
  en: string
  theme: string
  emoji: string
  catalog: CatalogPhrase | null
}

/**
 * A blank row.
 *
 * `id` is a generated UUIDv7 and `phraseId` is the catalog join key — two different
 * things, which is the whole point. They used to be the same string, so a learner's row
 * carried the content team's id: no learner-authored phrase could have an id at all, and
 * two devices adding `cafe1` produced one row with interleaved fields.
 */
function blankPhraseState(
  id: UserPhraseId,
  phraseId: CatalogPhraseId | null,
  source: PhraseState['source'],
  now: number,
): PhraseState {
  return {
    id,
    phraseId,
    source,
    difficulty: 'med',
    tags: [],
    loved: false,
    learned: false,
    note: null,
    plays: 0,
    reps: 0,
    addedAt: now,
    lastPracticedAt: null,
    graduatedAt: null,
    srs: null,
    repsToday: 0,
    repsTodayDay: null,
    automaticity: 0,
    lockInDays: 0,
    rung: LadderRung.Accumulated,
    stumbles: 0,
    cueLevel: 0,
    axPerception: 0,
    axRecall: 0,
    axProduction: 0,
  }
}

/** What the learner types (or imports, or photographs) when the phrase is their own. */
export interface OwnPhraseDraft {
  es: string
  en: string
  theme?: Theme
  emoji?: string
}

/**
 * A row for a phrase with no catalog entry: `phraseId` is null and the text lives on
 * the row itself. This is the seam Import (`P2-09`, `P2-10`) and Capture plug into.
 */
function newOwnPhrase(id: UserPhraseId, draft: OwnPhraseDraft, now: number): PhraseState {
  return {
    ...blankPhraseState(id, null, 'custom', now),
    ownEs: draft.es,
    ownEn: draft.en,
    // The same fallbacks `toView` uses, resolved once at write time so the stored row
    // is complete rather than depending on a render-time default.
    ownTheme: draft.theme ?? 'Mine',
    ownEmoji: draft.emoji ?? '✍️',
  }
}

export function toView(p: PhraseState): PhraseView {
  const cat = p.phraseId === null ? null : (catalogById.get(p.phraseId) ?? null)
  return {
    ...p,
    es: cat?.es ?? p.ownEs ?? '',
    en: cat?.en ?? p.ownEn ?? '',
    theme: cat?.theme ?? p.ownTheme ?? 'Mine',
    emoji: cat?.emoji ?? p.ownEmoji ?? '✍️',
    catalog: cat,
  }
}

// ─────────────────────────────────────────────────────────────────────────────

interface AppActions {
  completeOnboarding: (o: { goal: string; dailyMinutes: 5 | 10 | 20; packIds: string[] }) => void
  addPhrase: (
    catalogId: string,
    o?: { difficulty?: Difficulty; tags?: Tag[]; source?: PhraseState['source'] },
  ) => void
  /** Returns the new row id, because the caller has no other way to name the row. */
  addOwnPhrase: (draft: OwnPhraseDraft, o?: { difficulty?: Difficulty; tags?: Tag[] }) => string
  removePhrase: (id: string) => void
  setDifficulty: (id: string, d: Difficulty) => void
  toggleTag: (id: string, t: Tag) => void
  toggleLoved: (id: string) => void
  markLearned: (id: string, learned: boolean) => void
  setNote: (id: string, note: string) => void
  recordPlay: (id: string) => void
  /**
   * The ONLY write path for a practice outcome. A screen calls `engine.record(...)` and
   * hands the result here; nothing else writes a progress field.
   */
  applyDelta: (delta: ProgressDelta) => void
  select: (id: string | null) => void
  showToast: (message: string, undo?: () => void) => void
  clearToast: () => void
  /**
   * Make sure `refrainSet` is today's. Safe to call on every foreground and every entry
   * to a practice screen: it re-rolls only when the day changed, and otherwise backfills
   * a set that lost a member.
   */
  ensureRefrainSet: () => void
  reset: () => void
}

export type AppState = AppData & AppActions

/**
 * What the store needs from the platform.
 *
 * Injected so a test can drive a day rollover, and so the store's day logic is provable
 * rather than dependent on when the suite happens to run.
 */
export interface StoreDeps {
  clock: Clock
  newId: () => UserPhraseId
}

export function createAppStore(deps: StoreDeps): UseBoundStore<StoreApi<AppState>> {
  const { clock } = deps

  return create<AppState>((set, get) => ({
    ...INITIAL_STATE,

    completeOnboarding: ({ goal, dailyMinutes, packIds }) => {
      const now = clock.now()
      const chosen = new Set<string>()
      for (const packId of packIds) {
        const pack = packs.find((p) => p.id === packId)
        for (const pid of pack?.phrases ?? []) chosen.add(pid)
      }
      const seeded = [...chosen]
        .map((id) => catalogById.get(id))
        .filter((c): c is CatalogPhrase => c !== undefined)
        .map((c) => blankPhraseState(deps.newId(), catalogPhraseId(c.id), 'starter', now))

      set({
        onboarded: true,
        goal,
        dailyMinutes,
        phrases: seeded,
        refrainSet: [],
        refrainDay: null,
        refrainSubstituted: [],
      })
      get().ensureRefrainSet()
    },

    addPhrase: (catalogId, o = {}) => {
      const cat = catalogById.get(catalogId)
      if (cat === undefined) return
      // Adding the same phrase twice is a no-op (Loro.dc.html:3602). The guard compares
      // CATALOG ids: comparing row ids would never match, since every row id is fresh.
      if (get().phrases.some((p) => p.phraseId === catalogPhraseId(catalogId))) return

      const next = {
        ...blankPhraseState(
          deps.newId(),
          catalogPhraseId(cat.id),
          o.source ?? 'discover',
          clock.now(),
        ),
        difficulty: o.difficulty ?? 'med',
        tags: o.tags ?? [],
      }
      set((st) => ({ phrases: [...st.phrases, next] }))
      // Undo removes the row that was just created, by its row id. Passing the catalog
      // id here would have removed nothing.
      get().showToast('Added — here are more like it', () => {
        get().removePhrase(next.id)
      })
    },

    addOwnPhrase: (draft, o = {}) => {
      const next = {
        ...newOwnPhrase(deps.newId(), draft, clock.now()),
        difficulty: o.difficulty ?? 'med',
        tags: o.tags ?? [],
      }
      set((st) => ({ phrases: [...st.phrases, next] }))
      get().showToast('Added to your stream', () => {
        get().removePhrase(next.id)
      })
      return next.id
    },

    removePhrase: (id) => {
      set((st) => ({
        phrases: st.phrases.filter((p) => p.id !== id),
        selectedId: st.selectedId === id ? null : st.selectedId,
        refrainSet: st.refrainSet.filter((x) => x !== id),
        refrainSubstituted: st.refrainSubstituted.filter((x) => x !== id),
      }))
      // A day's set that loses a member must be refilled, not left short: "you always
      // see today" turns into "you see nothing today" once the last member is deleted.
      get().ensureRefrainSet()
    },

    setDifficulty: (id, d) => {
      set((st) => ({ phrases: st.phrases.map((p) => (p.id === id ? { ...p, difficulty: d } : p)) }))
      // The toast explains the CONSEQUENCE — that's what teaches the model.
      get().showToast(
        {
          hard: 'Difficult — repeats more, comes back sooner',
          easy: 'Easy — drifting to the back',
          med: 'Back to normal',
        }[d],
      )
    },

    toggleTag: (id, t) => {
      set((st) => ({
        phrases: st.phrases.map((p) =>
          p.id === id
            ? { ...p, tags: p.tags.includes(t) ? p.tags.filter((x) => x !== t) : [...p.tags, t] }
            : p,
        ),
      }))
    },

    toggleLoved: (id) => {
      const wasLoved = get().phrases.find((p) => p.id === id)?.loved ?? false
      set((st) => ({
        phrases: st.phrases.map((p) => (p.id === id ? { ...p, loved: !p.loved } : p)),
      }))
      get().showToast(wasLoved ? 'Removed from Loved' : '♥ Loved — surfacing more often')
    },

    markLearned: (id, learned) => {
      set((st) => ({ phrases: st.phrases.map((p) => (p.id === id ? { ...p, learned } : p)) }))
      get().showToast(learned ? '✓ Learned — removed from the stream' : 'Back into your stream')
    },

    setNote: (id, note) => {
      set((st) => ({ phrases: st.phrases.map((p) => (p.id === id ? { ...p, note } : p)) }))
    },

    recordPlay: (id) => {
      // A play is an observation, not a computed score, so it goes through the same
      // single write path as everything else.
      get().applyDelta({
        phraseId: id as UserPhraseId,
        plays: 1,
        lastPracticedAt: clock.now(),
      })
    },

    applyDelta: (delta) => {
      const day = clock.localDay()
      // A rep is what makes a day count towards the streak — a play in the stream is
      // listening, not production. Keyed on the STREAK day, so a 01:30 session extends
      // the evening it continues rather than starting a new day.
      const practised = (delta.reps ?? 0) > 0 ? clock.streakDay() : null

      set((st) => ({
        phrases: st.phrases.map((p) =>
          p.id === delta.phraseId ? applyDeltaToPhrase(p, delta, day) : p,
        ),
        practiceDays:
          practised === null ? st.practiceDays : addPracticeDay(st.practiceDays, practised),
      }))
    },

    select: (id) => {
      set({ selectedId: id })
    },
    showToast: (message, undo) => {
      set({ toast: undo ? { message, undo } : { message } })
    },
    clearToast: () => {
      set({ toast: null })
    },

    ensureRefrainSet: () => {
      const day = clock.localDay()
      const st = get()
      const size = refrainSetSize(st.dailyMinutes)

      // A new day (or the first ever): choose today's set once, then freeze it.
      if (st.refrainDay !== day) {
        set({
          refrainSet: [...selectRefrainSet(st.phrases, size)],
          refrainDay: day,
          refrainSubstituted: [],
        })
        return
      }

      // Same day, so the set is FROZEN — it may only be topped up. The old guard was
      // `refrainDay === day && refrainSet.length > 0`, which fell through on an emptied
      // set and re-rolled the whole day, including phrases already practised. Backfill
      // instead: existing members keep their place.
      if (st.refrainSet.length >= size) return

      const inSet = new Set(st.refrainSet)
      const candidates = st.phrases.filter(
        // Not already in today's set, and not something the learner already finished
        // today — substituting in a phrase that is already at 6/6 offers no work.
        (p) => !inSet.has(p.id) && repsToday(p, day) < DEFAULT_REP_TARGET,
      )
      const fill = selectRefrainSet(candidates, size - st.refrainSet.length)
      if (fill.length === 0) return

      set({
        refrainSet: [...st.refrainSet, ...fill],
        refrainSubstituted: [...st.refrainSubstituted, ...fill],
      })
    },

    // Spreads the one declaration of a fresh app, so a field added to AppData is
    // cleared here for free. The enumerated version left `dailyMinutes` and
    // `streakDays` behind — the previous learner's settings, on a shared device.
    reset: () => {
      set({ ...INITIAL_STATE })
    },
  }))
}

export const useApp = createAppStore({ clock: deviceClock, newId })

// ─── selectors ───────────────────────────────────────────────────────────────

export const useViews = (): PhraseView[] => useApp((s) => s.phrases).map(toView)

export function useMastery(): { key: string; count: number }[] {
  const phrases = useApp((s) => s.phrases)
  const counts = { new: 0, learning: 0, strong: 0, mastered: 0 }
  for (const p of phrases) counts[masteryBucket(p)]++
  return Object.entries(counts).map(([key, count]) => ({ key, count }))
}

// ─── engines ─────────────────────────────────────────────────────────────────

const core: LoroCoreFacade = {
  repeatTarget: (d) => (d === 'hard' ? 4 : d === 'easy' ? 2 : 3),
  streamRank: (p, now) => {
    let r = p.plays
    r += p.difficulty === 'hard' ? -6 : p.difficulty === 'easy' ? 4 : 0
    if (p.loved) r -= 3
    if (p.srs !== null && p.srs.due <= now) r -= 4
    return r
  },
  clozeMask: () => [1],
  fsrsReview: (_s, grade, at) => {
    const days = grade === 1 ? 0.007 : grade === 2 ? 1 : grade === 3 ? 3 : 5
    return { stability: days, difficulty: 5, due: at + days * 86_400_000 }
  },
  matchTokens: (heard, target, revealed) => {
    const norm = (x: string): string =>
      x
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9ñ]/g, '')
    const h = heard.map(norm).filter(Boolean)
    const t = target.map(norm)
    let cursor = 0
    let matched = revealed
    for (let k = revealed; k < t.length; k++) {
      const idx = h.indexOf(t[k] ?? '', cursor)
      if (idx < 0) break
      cursor = idx + 1
      matched = k + 1
    }
    const next = Math.max(matched, revealed)
    return {
      revealed: next,
      justIndex: next > revealed ? next - 1 : -1,
      complete: next >= t.length,
    }
  },
}

export function engineContext(): EngineContext {
  const phrases = useApp.getState().phrases
  const repo: PhraseRepository = {
    all: () => Promise.resolve(phrases),
    byId: (id) => Promise.resolve(phrases.find((p) => p.id === id) ?? null),
    active: () => Promise.resolve(phrases.filter((p) => !p.learned)),
    due: (at) => Promise.resolve(phrases.filter((p) => p.srs !== null && p.srs.due <= at)),
  }
  return {
    phrases: repo,
    clock: deviceClock,
    core,
    settings: {
      dailyMinutes: useApp.getState().dailyMinutes,
      waveTimes: ['08:00', '13:00', '19:00'],
      repTarget: DEFAULT_REP_TARGET,
    },
    trip: null,
    flags: { bool: (_k, d) => d, number: (_k, d) => d },
    seed: 42,
  }
}

export const streamEngine = new StreamEngine()
export const refrainEngine = new RefrainEngine()
