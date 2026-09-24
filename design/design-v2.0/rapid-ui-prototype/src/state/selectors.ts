// Every learner-facing number comes from here, derived from AppState.
import { findPhrase, getSet, SETS } from '../content';
import { AppState, currentPhraseId, HistoryEntry, LearnerState, PlayerState } from './machine';
import { dueAt, isDue, isLearned, PhraseMemory, retrievability } from './memory';

export type PhraseStatus = 'new' | 'learning' | 'due' | 'learned';

export interface PhraseProgress {
  status: PhraseStatus;
  /** Recall probability now, 0..100; null until graded. */
  retention: number | null;
  dueAt: number | null;
  memory: PhraseMemory | undefined;
}

export function phraseProgress(learner: LearnerState, phraseId: string, now: number): PhraseProgress {
  const memory = learner.phrases[phraseId];
  if (!memory || memory.stabilityDays === null) {
    return { status: 'new', retention: null, dueAt: null, memory };
  }
  const r = retrievability(memory, now);
  return {
    status: isDue(memory, now) ? 'due' : isLearned(memory) ? 'learned' : 'learning',
    retention: r === null ? null : Math.round(r * 100),
    dueAt: dueAt(memory),
    memory,
  };
}

export function duePhraseIds(learner: LearnerState, now: number): string[] {
  return Object.entries(learner.phrases)
    .filter(([id, memory]) => findPhrase(id) && isDue(memory, now))
    .sort(([, a], [, b]) => (dueAt(a) ?? 0) - (dueAt(b) ?? 0))
    .map(([id]) => id);
}

/** The next moment something becomes due, and how many phrases fall due then (same minute). */
export function nextDue(learner: LearnerState, now: number): { at: number; count: number } | null {
  const upcoming = Object.entries(learner.phrases)
    .filter(([id]) => findPhrase(id))
    .map(([, memory]) => dueAt(memory))
    .filter((at): at is number => at !== null && at > now)
    .sort((a, b) => a - b);
  if (upcoming.length === 0) return null;
  const at = upcoming[0];
  return { at, count: upcoming.filter((t) => t - at < 60_000).length };
}

/**
 * Phrases counted as learned, in content order. The one rule for every
 * "learned" count and list: a learned phrase that is due again still counts
 * until a Hard rating un-learns it.
 */
export function learnedPhraseIds(learner: LearnerState, phraseIds: string[]): string[] {
  return phraseIds.filter((id) => {
    const memory = learner.phrases[id];
    return memory !== undefined && isLearned(memory);
  });
}

export interface LearnerStats {
  points: number;
  learned: number;
  due: number;
  started: number;
  /** Mean recall probability across graded phrases, 0..100; null if none graded. */
  averageRetention: number | null;
}

export function learnerStats(learner: LearnerState, now: number): LearnerStats {
  const memories = Object.entries(learner.phrases).filter(([id]) => findPhrase(id));
  const retentions = memories
    .map(([, m]) => retrievability(m, now))
    .filter((r): r is number => r !== null);
  return {
    points: learner.points,
    learned: learnedPhraseIds(learner, memories.map(([id]) => id)).length,
    due: memories.filter(([, m]) => isDue(m, now)).length,
    started: memories.length,
    averageRetention:
      retentions.length === 0 ? null : Math.round((retentions.reduce((a, b) => a + b, 0) / retentions.length) * 100),
  };
}

export interface SetProgress {
  total: number;
  started: number;
  learned: number;
  due: number;
}

export function setProgress(learner: LearnerState, setId: string, now: number): SetProgress {
  const ids = getSet(setId).phraseIds;
  const memories = ids.map((id) => learner.phrases[id]).filter((m): m is PhraseMemory => Boolean(m));
  return {
    total: ids.length,
    started: memories.length,
    learned: learnedPhraseIds(learner, ids).length,
    due: memories.filter((m) => isDue(m, now)).length,
  };
}

/** Sets most recently listened to, newest first. */
export function recentSetIds(learner: LearnerState, limit = 4): string[] {
  const seen: string[] = [];
  for (let i = learner.history.length - 1; i >= 0 && seen.length < limit; i--) {
    const phrase = findPhrase(learner.history[i].phraseId);
    if (phrase && !seen.includes(phrase.setId)) seen.push(phrase.setId);
  }
  return seen;
}

/**
 * The set Home offers to play: the most recent set that still has phrases to
 * learn, otherwise the set with the smallest share learned (content order breaks ties).
 */
export function suggestedSetId(learner: LearnerState, now: number): string | null {
  const share = (setId: string) => {
    const p = setProgress(learner, setId, now);
    return p.total === 0 ? 1 : p.learned / p.total;
  };
  const recent = recentSetIds(learner).find((id) => share(id) < 1);
  if (recent) return recent;
  let best: string | null = null;
  for (const set of SETS) if (best === null || share(set.id) < share(best)) best = set.id;
  return best;
}

export function upNextIds(player: PlayerState): string[] {
  return player.order.slice(player.index + 1);
}

/** Distinct phrases heard before the current one, newest first. */
export function previouslyPlayed(state: AppState, limit = 5): HistoryEntry[] {
  const current = currentPhraseId(state.player);
  const seen = new Set<string>();
  const out: HistoryEntry[] = [];
  for (let i = state.learner.history.length - 1; i >= 0 && out.length < limit; i--) {
    const entry = state.learner.history[i];
    if (entry.event !== 'heard' || entry.phraseId === current || seen.has(entry.phraseId)) continue;
    seen.add(entry.phraseId);
    out.push(entry);
  }
  return out;
}

/** Real listening time on the current phrase, including the running stretch. */
export function listenedMs(player: PlayerState, now: number): number {
  return player.elapsedMs + (player.playingSince === null ? 0 : now - player.playingSince);
}
