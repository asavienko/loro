/**
 * The app store.
 *
 * ONE shared phrase store, exactly as the blueprint does it (`Loro.dc.html:3575-3626`).
 * Rating a phrase in the stream updates the Progress histogram because both read the
 * same rows — no wiring between the screens.
 *
 * v1 keeps this in memory. SQLite + the outbox land with sync (ADR-0003/0012); the
 * repository shape below is the seam they slot into.
 */

import { create } from 'zustand'
import {
  LadderRung,
  masteryBucket,
  RefrainEngine,
  StreamEngine,
  selectRefrainSet,
  automaticity,
  DEFAULT_REP_TARGET,
  refrainSetSize,
  type Difficulty,
  type PhraseState,
  type Tag,
  type EngineContext,
  type PhraseRepository,
  type LoroCoreFacade,
  type Clock,
} from '@loro/core'
import { loadCatalog, type CatalogPhrase } from '@loro/content'
import { userPhraseId, catalogPhraseId } from '@loro/core'

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

function newPhraseState(
  cat: CatalogPhrase,
  source: PhraseState['source'],
  now: number,
): PhraseState {
  return {
    id: userPhraseId(cat.id),
    phraseId: catalogPhraseId(cat.id),
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

export interface Toast {
  message: string
  undo?: () => void
}

interface AppState {
  onboarded: boolean
  goal: string | null
  dailyMinutes: 5 | 10 | 20
  phrases: PhraseState[]
  toast: Toast | null
  selectedId: string | null
  streakDays: number

  // Refrain day state — chosen once, FROZEN. "You always see today."
  refrainSet: string[]
  refrainDay: string | null

  completeOnboarding: (o: { goal: string; dailyMinutes: 5 | 10 | 20; packIds: string[] }) => void
  addPhrase: (
    catalogId: string,
    o?: { difficulty?: Difficulty; tags?: Tag[]; source?: PhraseState['source'] },
  ) => void
  removePhrase: (id: string) => void
  setDifficulty: (id: string, d: Difficulty) => void
  toggleTag: (id: string, t: Tag) => void
  toggleLoved: (id: string) => void
  markLearned: (id: string, learned: boolean) => void
  setNote: (id: string, note: string) => void
  recordPlay: (id: string) => void
  recordRep: (id: string, o: { success: boolean; latencyMs: number | null }) => void
  select: (id: string | null) => void
  showToast: (message: string, undo?: () => void) => void
  clearToast: () => void
  ensureRefrainSet: () => void
  reset: () => void
}

const LOCAL_DAY = (): string => new Date().toISOString().slice(0, 10)

export const useApp = create<AppState>((set, get) => ({
  onboarded: false,
  goal: null,
  dailyMinutes: 10,
  phrases: [],
  toast: null,
  selectedId: null,
  streakDays: 1,
  refrainSet: [],
  refrainDay: null,

  completeOnboarding: ({ goal, dailyMinutes, packIds }) => {
    const now = Date.now()
    const chosen = new Set<string>()
    for (const packId of packIds) {
      const pack = packs.find((p) => p.id === packId)
      for (const pid of pack?.phrases ?? []) chosen.add(pid)
    }
    const seeded = [...chosen]
      .map((id) => catalogById.get(id))
      .filter((c): c is CatalogPhrase => c !== undefined)
      .map((c) => newPhraseState(c, 'starter', now))

    set({ onboarded: true, goal, dailyMinutes, phrases: seeded, refrainSet: [], refrainDay: null })
    get().ensureRefrainSet()
  },

  addPhrase: (catalogId, o = {}) => {
    const cat = catalogById.get(catalogId)
    if (cat === undefined) return
    // The blueprint guards on id — adding twice is a no-op (Loro.dc.html:3602).
    if (get().phrases.some((p) => p.id === catalogId)) return

    const next = {
      ...newPhraseState(cat, o.source ?? 'discover', Date.now()),
      difficulty: o.difficulty ?? 'med',
      tags: o.tags ?? [],
    }
    set((st) => ({ phrases: [...st.phrases, next] }))
    get().showToast('Added — here are more like it', () => {
      get().removePhrase(catalogId)
    })
  },

  removePhrase: (id) => {
    set((st) => ({
      phrases: st.phrases.filter((p) => p.id !== id),
      selectedId: st.selectedId === id ? null : st.selectedId,
      refrainSet: st.refrainSet.filter((x) => x !== id),
    }))
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
    const now = get().phrases.find((p) => p.id === id)?.loved ?? false
    set((st) => ({ phrases: st.phrases.map((p) => (p.id === id ? { ...p, loved: !p.loved } : p)) }))
    get().showToast(now ? 'Removed from Loved' : '♥ Loved — surfacing more often')
  },

  markLearned: (id, learned) => {
    set((st) => ({ phrases: st.phrases.map((p) => (p.id === id ? { ...p, learned } : p)) }))
    get().showToast(learned ? '✓ Learned — removed from the stream' : 'Back into your stream')
  },

  setNote: (id, note) => {
    set((st) => ({ phrases: st.phrases.map((p) => (p.id === id ? { ...p, note } : p)) }))
  },

  recordPlay: (id) => {
    set((st) => ({
      phrases: st.phrases.map((p) =>
        p.id === id ? { ...p, plays: p.plays + 1, lastPracticedAt: Date.now() } : p,
      ),
    }))
  },

  recordRep: (id, { success, latencyMs }) => {
    const day = LOCAL_DAY()
    set((st) => ({
      phrases: st.phrases.map((p) => {
        if (p.id !== id) return p
        // A stale counter must not inflate automaticity.
        const todayReps = (p.repsTodayDay === day ? p.repsToday : 0) + (success ? 1 : 0)
        return {
          ...p,
          reps: p.reps + (success ? 1 : 0),
          repsToday: todayReps,
          repsTodayDay: day,
          automaticity: automaticity(todayReps, DEFAULT_REP_TARGET),
          lastPracticedAt: Date.now(),
          stumbles: success ? p.stumbles : p.stumbles + 1,
          // latencyMs is MEASURED or null. Never estimated.
          axProduction: Math.min(99, p.axProduction + (success ? 2 : 0)),
        }
      }),
    }))
    void latencyMs
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
    const day = LOCAL_DAY()
    const st = get()
    if (st.refrainDay === day && st.refrainSet.length > 0) return
    const size = refrainSetSize(st.dailyMinutes)
    set({ refrainSet: [...selectRefrainSet(st.phrases, size)], refrainDay: day })
  },

  reset: () => {
    set({
      onboarded: false,
      goal: null,
      phrases: [],
      refrainSet: [],
      refrainDay: null,
      selectedId: null,
      toast: null,
    })
  },
}))

// ─── selectors ───────────────────────────────────────────────────────────────

export const useViews = (): PhraseView[] => useApp((s) => s.phrases).map(toView)

export function useMastery(): { key: string; count: number }[] {
  const phrases = useApp((s) => s.phrases)
  const counts = { new: 0, learning: 0, strong: 0, mastered: 0 }
  for (const p of phrases) counts[masteryBucket(p)]++
  return Object.entries(counts).map(([key, count]) => ({ key, count }))
}

// ─── engines ─────────────────────────────────────────────────────────────────

const clock: Clock = { now: () => Date.now(), localDay: LOCAL_DAY }

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
    clock,
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
