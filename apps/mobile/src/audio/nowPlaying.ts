// What the lock screen and the notification shade show of the one player (P3-11), from the state
// alone so it can be tested. It says what the bar above the tabs says: a phrase keeps its target
// hidden until it has been heard (the recall rule), shows the step of the loop, and offers the three
// grades whenever the app would; a song shows its album and offers them when it sings this course's
// phrases.
import { apiUrl } from '@shared/api/client';
import type { Song } from '@shared/api/library';
import type { Album } from '@shared/content';
import type { Copy } from '@shared/copy';
import { findPhrase, findSetView, promptOf } from '@shared/state/catalog';
import { playsOnce } from '@shared/state/machine';
import { currentPhraseId, pendingFor, previewDue, sessionSummary, windowLeft } from '@shared/state/selectors';
import type { AppState, Grade } from '@shared/state/types';
import { backIn, endTitle, isTargetRevealed, phaseInstruction, queueTitle } from '@shared/ui/phase';
import type { NowPlaying, NowPlayingGrade } from './media';

/** In the app's order (src/ui/grades.ts). */
export const GRADE_ORDER: readonly Grade[] = ['missed', 'hard', 'easy'];

/** A cover the system can draw itself: a picture, not the drawn SVG covers. */
export function rasterCover(url: string | null | undefined): string | null {
  return url && /\.(png|jpe?g|webp)(\?|$)/i.test(url) ? apiUrl(url) : null;
}

/** Whether the phrase loop's current phrase can be rated: as in the app, until its queue has ended. */
export function phraseRatable(state: AppState): boolean {
  return currentPhraseId(state.player) !== null && !(state.player.ended && playsOnce(state.player));
}

/** The phrase loop on the lock screen, or null when no phrase is loaded. */
export function phraseNowPlaying(state: AppState, c: Copy, now: number): NowPlaying | null {
  const player = state.player;
  const phrase = findPhrase(state.learner, currentPhraseId(player));
  if (!phrase) return null;
  const playing = player.status === 'playing';
  const ended = player.ended && playsOnce(player);
  const prompt = promptOf(phrase, state.learner.profile.nativeLang);
  const revealed = isTargetRevealed(player);
  const summary = ended ? sessionSummary(state, now) : null;
  const status = player.audioError
    ? player.audioError.reason === 'no-clip'
      ? c.player.noClip
      : c.player.silent
    : ended
      ? endTitle(c, player.source, summary ? summary.ratings.missed + summary.ratings.hard + summary.ratings.easy : 0)
      : !playing
        ? c.player.paused
        : phaseInstruction(c, player.phase, prompt.lang, phrase.targetLang);

  let grades: NowPlayingGrade[] | null = null;
  if (phraseRatable(state)) {
    const pending = pendingFor(state, phrase.id);
    const given = pending && windowLeft(pending, Math.max(now, pending.at)) > 0 ? pending : undefined;
    // The grade given says when it brings the phrase back, as the app's rated line does.
    const givenDetail = given && c.player.rated(c.common.grade[given.grade], backIn(c, previewDue(state.learner, phrase.id, given.grade, given.at, given.day), Math.max(now, given.at)));
    grades = GRADE_ORDER.map((grade) => {
      const selected = given?.grade === grade;
      return { grade, label: c.common.grade[grade], detail: selected && givenDetail ? givenDetail : c.common.grade[grade], selected };
    });
  }

  const set = findSetView(state.learner, phrase.setId);
  return {
    id: phrase.id,
    // Before the target has been heard: the prompt, and what to do now. After: both texts.
    title: revealed ? phrase.target : prompt.text,
    artist: revealed && !ended && !player.audioError ? prompt.text : status,
    album: queueTitle(c, player, findSetView(state.learner, player.setId)),
    artworkUrl: rasterCover(set?.content?.coverUrl),
    playing,
    canNext: !ended && (player.index < player.order.length - 1 || !playsOnce(player)),
    canPrevious: player.index > 0,
    positionMs: null,
    durationMs: null,
    grades,
    nextLabel: c.player.next,
    channelName: c.player.dialog,
    hasSilences: true,
  };
}

/** A song's rating as the lock screen offers it (src/music/songRating.ts works it out). */
export interface SongRatingView {
  /** How many phrases a rating reviewed, or would: none, and the song has nothing to rate. */
  count: number;
  /** The grade the song was given while it can still be changed. */
  given: Grade | null;
}

export interface SongPlaying {
  song: Song;
  album: Album | null;
  playing: boolean;
  positionMs: number;
  durationMs: number;
  index: number;
  count: number;
  rating: SongRatingView;
}

/** A song on the lock screen. */
export function songNowPlaying({ song, album, playing, positionMs, durationMs, index, count, rating }: SongPlaying, c: Copy): NowPlaying {
  return {
    id: song.id,
    title: song.title,
    artist: album?.owner === 'loro' ? 'Loro' : (album?.author ?? c.music.songKind),
    album: album?.title ?? '',
    artworkUrl: rasterCover(album?.coverUrl),
    playing,
    canNext: index + 1 < count,
    canPrevious: index > 0,
    positionMs: durationMs > 0 ? Math.round(positionMs) : null,
    durationMs: durationMs > 0 ? Math.round(durationMs) : null,
    grades:
      rating.count > 0
        ? GRADE_ORDER.map((grade) => {
            const selected = rating.given === grade;
            return { grade, label: c.common.grade[grade], detail: selected ? c.music.songRated(c.common.grade[grade], rating.count) : c.common.grade[grade], selected };
          })
        : null,
    nextLabel: c.music.next,
    channelName: c.player.dialog,
    hasSilences: false,
  };
}
