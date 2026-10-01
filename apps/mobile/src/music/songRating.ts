// A song's rating (plan 107), as the player and the bar above the tabs both give it: Missed / Hard /
// Easy reviews every phrase of this learner's course that the song sings and that has no rating of
// its own waiting, with the same five-minute window and undo as a phrase's rating.
import type { Song } from '@shared/api/library';
import { easyCue, gentleCue } from '@shared/audio/cues';
import { findPhrase } from '@shared/state/catalog';
import { windowLeft } from '@shared/state/selectors';
import type { AppState, Grade, PendingRating } from '@shared/state/types';
import { useCopy, useStore } from '../state/store';
import { useToast } from '../ui/Toast';

export interface SongRating {
  /** The phrases of this learner's course the song sings. */
  phraseIds: string[];
  /** The ratings this song gave that can still be changed or undone. */
  given: PendingRating[];
  /** The phrases a rating would review: those not rated some other way (the loop, another song). */
  ratable: string[];
  /** How many phrases the rating reviewed, or would. */
  count: number;
}

export function songRating(state: AppState, song: Song, now: number): SongRating {
  const phraseIds = [...new Set(song.sections.flatMap((s) => s.lines).flatMap((l) => (l.phraseId ? [l.phraseId] : [])))].filter((id) => findPhrase(state.learner, id));
  const open = (p: PendingRating) => !p.undone && windowLeft(p, Math.max(now, p.at)) > 0;
  const given = state.pending.filter((p) => p.songId === song.id && open(p) && phraseIds.includes(p.phraseId));
  // Phrases rated some other way keep that rating: the song leaves them be.
  const ratedElsewhere = new Set(state.pending.filter((p) => p.songId !== song.id && open(p)).map((p) => p.phraseId));
  const ratable = phraseIds.filter((id) => !ratedElsewhere.has(id));
  return { phraseIds, given, ratable, count: given.length > 0 ? given.length : ratable.length };
}

/** Rates a song, with its cue, and says what the rating reviewed. */
export function useRateSong(): (song: Song, rating: SongRating, grade: Grade) => void {
  const c = useCopy();
  const { actions } = useStore();
  const { announce } = useToast();
  return (song, rating, grade) => {
    if (rating.ratable.length === 0 && rating.given.length === 0) return;
    actions.ratePhrases(song.id, rating.phraseIds, song.setId, grade);
    if (grade === 'easy') easyCue();
    else gentleCue();
    announce(c.music.songRated(c.common.grade[grade], rating.count));
  };
}
