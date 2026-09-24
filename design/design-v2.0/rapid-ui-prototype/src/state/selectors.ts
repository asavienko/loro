// Every learner-facing number comes from here, derived from AppState. Nothing
// is estimated: a value that hasn't been measured is null and not shown.
import { Phrase, PhraseSet } from '../content';
import { DAY, startOfLocalDay, startOfLocalWeek } from './clock';
import { coursePhrases, courseSets, findPhrase, findSetView, keyOf, SetView } from './catalog';
import {
  derive,
  dueAt,
  emptyMemory,
  isDue,
  isLearned,
  POINTS,
  RATING_WINDOW_MS,
  recallNow,
  reviewed,
  typicalMs,
} from './memory';
import { fullPlayMs, REVIEW_SESSION_SIZE } from './timing';
import type {
  AppState,
  Grade,
  LearnerState,
  LogEntry,
  PendingRating,
  PhraseMemory,
  PlayerState,
  Prefs,
} from './types';

export function currentPhraseId(player: PlayerState): string | null {
  return player.order[player.index] ?? null;
}

export function memoryOf(learner: LearnerState, phraseId: string): PhraseMemory {
  return derive(learner.log).memories.get(keyOf(learner, phraseId)) ?? emptyMemory();
}

export function points(learner: LearnerState): number {
  return derive(learner.log).points;
}

// ---------- ratings ----------

export function pendingFor(state: AppState, phraseId: string): PendingRating | undefined {
  const key = keyOf(state.learner, phraseId);
  return state.pending.find((p) => p.key === key);
}

/** Milliseconds left to change or undo a pending rating. */
export function windowLeft(pending: PendingRating, now: number): number {
  return Math.max(0, pending.at + RATING_WINDOW_MS - now);
}

/** When the phrase will be due after `grade` given now: the preview on the rating buttons. */
export function previewDue(learner: LearnerState, phraseId: string, grade: Grade, at: number): number {
  return reviewed(memoryOf(learner, phraseId), grade, at).due;
}

// ---------- phrase status ----------

export type PhraseStatus = 'new' | 'learning' | 'due' | 'learned';

export interface PhraseProgress {
  status: PhraseStatus;
  /** Predicted recall now, 0..100; null until rated. */
  recall: number | null;
  dueAt: number | null;
  memory: PhraseMemory;
}

export function phraseProgress(learner: LearnerState, phraseId: string, now: number): PhraseProgress {
  const memory = memoryOf(learner, phraseId);
  const r = recallNow(memory, now);
  const status: PhraseStatus =
    memory.fsrs === null || memory.fsrs.last_review === null
      ? 'new'
      : isDue(memory, now)
        ? 'due'
        : isLearned(memory)
          ? 'learned'
          : 'learning';
  return { status, recall: r === null ? null : Math.round(r * 100), dueAt: dueAt(memory), memory };
}

/** Phrases worth playing now: not learned, or learned and due again. */
export function playableIds(learner: LearnerState, phraseIds: string[], now: number): string[] {
  return phraseIds.filter((id) => {
    const memory = memoryOf(learner, id);
    return !isLearned(memory) || isDue(memory, now);
  });
}

export function duePhraseIds(learner: LearnerState, now: number): string[] {
  return coursePhrases(learner)
    .map((p) => ({ id: p.id, memory: memoryOf(learner, p.id) }))
    .filter(({ memory }) => isDue(memory, now))
    .sort((a, b) => (dueAt(a.memory) ?? 0) - (dueAt(b.memory) ?? 0))
    .map(({ id }) => id);
}

/** Home's review queue: the most overdue phrases, capped so a session stays short. */
export function reviewQueue(learner: LearnerState, now: number): string[] {
  return duePhraseIds(learner, now).slice(0, REVIEW_SESSION_SIZE);
}

/** The next moment something becomes due, and how many phrases fall due that minute. */
export function nextDue(learner: LearnerState, now: number): { at: number; count: number } | null {
  const upcoming = coursePhrases(learner)
    .map((p) => dueAt(memoryOf(learner, p.id)))
    .filter((at): at is number => at !== null && at > now)
    .sort((a, b) => a - b);
  if (upcoming.length === 0) return null;
  const at = upcoming[0];
  return { at, count: upcoming.filter((t) => t - at < 60_000).length };
}

/** The one rule for every "learned" count and list, in the order given. */
export function learnedIds(learner: LearnerState, phraseIds: string[]): string[] {
  return phraseIds.filter((id) => isLearned(memoryOf(learner, id)));
}

export function idsWithStatus(learner: LearnerState, status: PhraseStatus, now: number): string[] {
  return coursePhrases(learner)
    .filter((p) => phraseProgress(learner, p.id, now).status === status)
    .map((p) => p.id);
}

/** Rated Missed in the last week, newest first. */
export function recentlyMissedIds(learner: LearnerState, now: number): string[] {
  return coursePhrases(learner)
    .map((p) => ({ id: p.id, memory: memoryOf(learner, p.id) }))
    .filter(({ memory }) => memory.lastGrade === 'missed' && now - (memory.lastGradeAt ?? 0) < 7 * DAY)
    .sort((a, b) => (b.memory.lastGradeAt ?? 0) - (a.memory.lastGradeAt ?? 0))
    .map(({ id }) => id);
}

export interface LearnerStats {
  learned: number;
  /** Phrases heard or rated at least once. */
  started: number;
  due: number;
  /** Mean predicted recall over rated phrases, 0..100; null if none rated. */
  averageRecall: number | null;
  rated: number;
}

export function learnerStats(learner: LearnerState, now: number): LearnerStats {
  const memories = coursePhrases(learner).map((p) => memoryOf(learner, p.id));
  const recalls = memories.map((m) => recallNow(m, now)).filter((r): r is number => r !== null);
  return {
    learned: memories.filter(isLearned).length,
    started: memories.filter((m) => m.heardCount > 0 || m.fsrs !== null).length,
    due: memories.filter((m) => isDue(m, now)).length,
    averageRecall: recalls.length === 0 ? null : Math.round((recalls.reduce((a, b) => a + b, 0) / recalls.length) * 100),
    rated: recalls.length,
  };
}

// ---------- sets ----------

export type SetStatus = 'new' | 'in-progress' | 'learned';

export interface SetProgress {
  total: number;
  started: number;
  learned: number;
  due: number;
  status: SetStatus;
}

export function setProgress(learner: LearnerState, phraseIds: string[], now: number): SetProgress {
  const memories = phraseIds.map((id) => memoryOf(learner, id));
  const started = memories.filter((m) => m.heardCount > 0 || m.fsrs !== null).length;
  const learned = memories.filter(isLearned).length;
  return {
    total: phraseIds.length,
    started,
    learned,
    due: memories.filter((m) => isDue(m, now)).length,
    status: learned === phraseIds.length && phraseIds.length > 0 ? 'learned' : started > 0 ? 'in-progress' : 'new',
  };
}

export function contentSetProgress(learner: LearnerState, set: PhraseSet, now: number): SetProgress {
  return setProgress(learner, set.phraseIds, now);
}

/** Sets most recently listened to, newest first. */
export function recentSetIds(learner: LearnerState, limit = 4): string[] {
  const seen: string[] = [];
  for (let i = learner.log.length - 1; i >= 0 && seen.length < limit; i--) {
    const entry = learner.log[i];
    if (entry.kind !== 'heard' || !entry.setId || seen.includes(entry.setId)) continue;
    const view = findSetView(learner, entry.setId);
    if (view && view.targetLang === learner.profile.targetLang) seen.push(entry.setId);
  }
  return seen;
}

/**
 * The set Home offers to continue: the most recent set with phrases left to
 * learn, otherwise the course set with the smallest share learned.
 */
export function suggestedSetId(learner: LearnerState, now: number): string | null {
  const share = (id: string) => {
    const view = findSetView(learner, id);
    if (!view || view.phraseIds.length === 0) return 1;
    return setProgress(learner, view.phraseIds, now).learned / view.phraseIds.length;
  };
  const recent = recentSetIds(learner).find((id) => share(id) < 1);
  if (recent) return recent;
  let best: string | null = null;
  for (const set of courseSets(learner)) if (best === null || share(set.id) < share(best)) best = set.id;
  return best;
}

/** Course sets never listened to. */
export function notStartedSets(learner: LearnerState, now: number): PhraseSet[] {
  return courseSets(learner).filter((s) => setProgress(learner, s.phraseIds, now).started === 0);
}

/**
 * Continue mode: what to play when the queue runs out. The next course set
 * (after the one playing) with phrases left to play; failing that, due reviews.
 */
export function continuation(
  learner: LearnerState,
  player: PlayerState,
  now: number,
): { phraseIds: string[]; setId: string | null } | null {
  const sets = courseSets(learner);
  const at = sets.findIndex((s) => s.id === player.setId);
  for (let step = 1; step <= sets.length; step++) {
    const set = sets[(Math.max(at, -1) + step + sets.length) % sets.length];
    if (set.id === player.setId) continue;
    const ids = playableIds(learner, set.phraseIds, now);
    if (ids.length > 0) return { phraseIds: ids, setId: set.id };
  }
  const due = reviewQueue(learner, now).filter((id) => id !== currentPhraseId(player));
  return due.length > 0 ? { phraseIds: due, setId: null } : null;
}

// ---------- the player ----------

/** Auto repetitions: three while a phrase is new or shaky, one once it is under review. */
export function repeatsFor(state: AppState, phraseId: string): 1 | 3 {
  if (state.prefs.repeats !== 'auto') return state.prefs.repeats;
  const memory = memoryOf(state.learner, phraseId);
  const pending = pendingFor(state, phraseId);
  const lastGrade = pending?.grade ?? memory.lastGrade;
  if (!memory.fsrs || memory.fsrs.state !== 'review') return 3;
  return lastGrade === 'missed' || lastGrade === 'hard' ? 3 : 1;
}

export function upNextIds(player: PlayerState): string[] {
  return player.order.slice(player.index + 1);
}

/** Distinct phrases heard on this device before the current one, newest first. */
export function previouslyPlayed(state: AppState, limit = 5): Extract<LogEntry, { kind: 'heard' }>[] {
  const current = currentPhraseId(state.player);
  const seen = new Set<string>();
  const out: Extract<LogEntry, { kind: 'heard' }>[] = [];
  for (let i = state.learner.log.length - 1; i >= 0 && out.length < limit; i--) {
    const entry = state.learner.log[i];
    if (entry.kind !== 'heard' || entry.device !== state.device.id) continue;
    if (entry.phraseId === current || seen.has(entry.phraseId) || !findPhrase(state.learner, entry.phraseId)) continue;
    seen.add(entry.phraseId);
    out.push(entry);
  }
  return out;
}

/** Real listening time on the current phrase, including the running stretch. */
export function listenedMs(player: PlayerState, now: number): number {
  return player.elapsedMs + (player.playingSince === null ? 0 : now - player.playingSince);
}

export function measuredTargetMs(learner: LearnerState, phraseId: string): number | null {
  return typicalMs(memoryOf(learner, phraseId).targetSamples);
}

/** The full play of the phrase at 1.0× with its repetitions; null until measured. */
export function phraseFullPlayMs(state: AppState, phrase: Phrase, repeats: number): number | null {
  const memory = memoryOf(state.learner, phrase.id);
  return fullPlayMs(typicalMs(memory.nativeSamples), typicalMs(memory.targetSamples), phrase.target, repeats);
}

/** A set's full play at 1.0×, only once every phrase in it has been measured. */
export function setDurationMs(state: AppState, view: SetView): number | null {
  let total = 0;
  for (const id of view.phraseIds) {
    const phrase = findPhrase(state.learner, id);
    if (!phrase) return null;
    const ms = phraseFullPlayMs(state, phrase, repeatsFor(state, id));
    if (ms === null) return null;
    total += ms;
  }
  return total;
}

/** Total play time of a list, only when all of it is measured (the review card). */
export function listDurationMs(state: AppState, phraseIds: string[]): number | null {
  let total = 0;
  for (const id of phraseIds) {
    const phrase = findPhrase(state.learner, id);
    const ms = phrase ? phraseFullPlayMs(state, phrase, repeatsFor(state, id)) : null;
    if (ms === null) return null;
    total += ms;
  }
  return total;
}

// ---------- summaries ----------

export interface SessionSummary {
  startedAt: number;
  phrasesPlayed: number;
  repetitions: number;
  ratings: Record<Grade, number>;
  /** Ratings still inside their five-minute window; they count when it closes. */
  pendingRatings: number;
  points: number;
  passes: number;
  nextDue: { at: number; count: number } | null;
}

export function sessionSummary(state: AppState, now: number): SessionSummary | null {
  const session = state.player.session;
  if (!session) return null;
  const { log } = state.learner;
  const derived = derive(log);
  const mine = log.filter((e) => e.at >= session.startedAt && e.device === state.device.id);
  const heard = mine.filter((e): e is Extract<LogEntry, { kind: 'heard' }> => e.kind === 'heard');
  const ratings: Record<Grade, number> = { missed: 0, hard: 0, easy: 0 };
  for (const e of mine) if (e.kind === 'rated') ratings[e.grade]++;
  const pending = state.pending.filter((p) => p.at >= session.startedAt);
  for (const p of pending) ratings[p.grade]++;
  let earned = mine.reduce((sum, e) => sum + (derived.awards.get(e.id) ?? 0), 0);
  for (const at of derived.learnedBonuses.values()) if (at >= session.startedAt) earned += POINTS.learned;
  return {
    startedAt: session.startedAt,
    phrasesPlayed: new Set(heard.map((e) => e.phraseId)).size,
    repetitions: heard.length,
    ratings,
    pendingRatings: pending.length,
    points: earned,
    passes: session.passes,
    nextDue: nextDue(state.learner, now),
  };
}

/** Today, from the log: distinct phrases heard and ratings given. Never a streak. */
export function todayCounts(state: AppState, now: number): { heard: number; rated: number } {
  const start = startOfLocalDay(now);
  const heard = new Set<string>();
  let rated = state.pending.filter((p) => p.at >= start).length;
  for (let i = state.learner.log.length - 1; i >= 0; i--) {
    const e = state.learner.log[i];
    if (e.at < start) break;
    if (e.kind === 'heard') heard.add(e.phraseId);
    if (e.kind === 'rated') rated++;
  }
  return { heard: heard.size, rated };
}

export interface PlayedSet {
  setId: string | null;
  from: number;
  to: number;
  phrases: number;
  points: number;
}

const HISTORY_GAP_MS = 30 * 60_000;

/** History as the sets that were played: runs of listening to one set, newest first. */
export function playedSets(learner: LearnerState, limit = 30): PlayedSet[] {
  const derived = derive(learner.log);
  const runs: (PlayedSet & { ids: Set<string> })[] = [];
  for (const e of learner.log) {
    if (e.kind === 'carryover') continue;
    const last = runs[runs.length - 1];
    const award = derived.awards.get(e.id) ?? 0;
    if (last && last.setId === e.setId && e.at - last.to < HISTORY_GAP_MS) {
      last.to = e.at;
      last.points += award;
      if (e.kind === 'heard') last.ids.add(e.phraseId);
      continue;
    }
    if (e.kind !== 'heard') {
      if (last) last.points += award;
      continue;
    }
    runs.push({ setId: e.setId, from: e.at, to: e.at, phrases: 0, points: award, ids: new Set([e.phraseId]) });
  }
  return runs
    .reverse()
    .slice(0, limit)
    .map(({ ids, ...run }) => ({ ...run, phrases: ids.size }));
}

export interface RecallBucket {
  /** Lower bound in percent; the top bucket is 90–100. */
  from: number;
  to: number;
  count: number;
}

/** How many rated phrases sit at each level of predicted recall. */
export function recallBuckets(learner: LearnerState, now: number): RecallBucket[] {
  const edges = [90, 80, 70, 60, 50, 0];
  const buckets = edges.map((from, i) => ({ from, to: i === 0 ? 100 : edges[i - 1], count: 0 }));
  for (const p of coursePhrases(learner)) {
    const r = recallNow(memoryOf(learner, p.id), now);
    if (r === null) continue;
    const pct = r * 100;
    const bucket = buckets.find((b) => pct >= b.from) ?? buckets[buckets.length - 1];
    bucket.count++;
  }
  return buckets;
}

/** Phrases that became learned in each of the last `weeks` weeks (Monday start), oldest first. */
export function learnedPerWeek(learner: LearnerState, now: number, weeks = 8): { weekStart: number; count: number }[] {
  const thisWeek = startOfLocalWeek(now);
  const out = Array.from({ length: weeks }, (_, i) => ({ weekStart: startOfLocalWeek(thisWeek - (weeks - 1 - i) * 7 * DAY), count: 0 }));
  const course = new Set(coursePhrases(learner).map((p) => keyOf(learner, p.id)));
  for (const [key, at] of derive(learner.log).learnedBonuses) {
    if (!course.has(key)) continue;
    const week = startOfLocalWeek(at);
    const slot = out.find((w) => w.weekStart === week);
    if (slot) slot.count++;
  }
  return out;
}

// ---------- likes ----------

export function isLiked(learner: LearnerState, kind: 'phrase' | 'set', id: string): boolean {
  return learner.likes[`${kind}:${id}`]?.liked ?? false;
}

/** Liked phrases of the course, most recently liked first. */
export function likedPhraseIds(learner: LearnerState): string[] {
  return likedIds(learner, 'phrase').filter((id) => findPhrase(learner, id)?.targetLang === learner.profile.targetLang);
}

export function likedSetIds(learner: LearnerState): string[] {
  return likedIds(learner, 'set').filter((id) => findSetView(learner, id)?.targetLang === learner.profile.targetLang);
}

function likedIds(learner: LearnerState, kind: 'phrase' | 'set'): string[] {
  const prefix = `${kind}:`;
  return Object.entries(learner.likes)
    .filter(([k, like]) => k.startsWith(prefix) && like.liked)
    .sort(([, a], [, b]) => b.at - a.at)
    .map(([k]) => k.slice(prefix.length));
}

export function sortFor(prefs: Prefs, setId: string) {
  return prefs.sortBySet[setId] ?? 'set';
}
