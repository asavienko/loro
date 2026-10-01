// The one player on the lock screen and at the top of the notification shade (P3-11): whichever of
// the phrase loop and the songs is in front, with play or pause, next, previous and the three grades
// (P3-31). It appears once something plays and stays, paused, until there is nothing to show.
//
// A press there is a tap in the app: play, pause, next and previous are the same actions, and a grade
// is the same RATE (a song's RATE_PHRASES) the player and the bar above the tabs dispatch, so its
// scheduling, window, undo and sync are theirs. A grade names the item it was shown on and is dropped
// if the player has moved on since. Interruptions (a call, another app's sound, headphones unplugged)
// arrive as pauses, and the end of a short one as play.
import { useEffect, useRef, useState } from 'react';
import { AppState as AppLifecycle } from 'react-native';
import { easyCue, gentleCue } from '@shared/audio/cues';
import { useLatest } from '@shared/lib/useLatest';
import { clock } from '@shared/state/clock';
import { currentPhraseId } from '@shared/state/selectors';
import { useMusic } from '../music/MusicPlayer';
import { songRating } from '../music/songRating';
import { useCopy, useNow, useStore } from '../state/store';
import { backgroundPlayback, hideNowPlaying, MediaCommand, NowPlaying, onMediaCommand, showNowPlaying } from './media';
import { phraseNowPlaying, phraseRatable, songNowPlaying } from './nowPlaying';

/** How far a song's place may drift from where the lock screen counts it before it is sent again. */
const DRIFT_MS = 1500;

export function useLockScreen(): void {
  const { state, actions } = useStore();
  const music = useMusic();
  const c = useCopy();
  // A grade's window closing changes what the grades show.
  const now = useNow(30_000);

  const song = music.front ? music.song : null;
  const rating = song ? songRating(state, song, now) : null;
  const nowPlaying: NowPlaying | null =
    song && rating
      ? songNowPlaying(
          {
            song,
            album: music.album,
            playing: music.playing,
            positionMs: music.position * 1000,
            durationMs: music.duration * 1000,
            index: music.index,
            count: music.queue.length,
            rating: { count: rating.count, given: rating.given[0]?.grade ?? null },
          },
          c,
        )
      : phraseNowPlaying(state, c, now);

  // Shown from the first play; gone once there is nothing to show.
  const [engaged, setEngaged] = useState(false);
  if (nowPlaying?.playing && !engaged) setEngaged(true);
  if (!nowPlaying && engaged) setEngaged(false);
  const shown = engaged ? nowPlaying : null;

  // Sent when what it shows changes (a song's place is counted on by the system while it plays),
  // after every press, so a play the app didn't take shows as it is, and on coming back to the app
  // (the system may have closed the player meanwhile: the app swiped away while paused).
  const [presses, setPresses] = useState(0);
  useEffect(() => {
    const subscription = AppLifecycle.addEventListener('change', (next) => {
      if (next === 'active') setPresses((n) => n + 1);
    });
    return () => subscription.remove();
  }, []);
  const key = shown ? JSON.stringify({ ...shown, positionMs: null }) : null;
  const latestShown = useLatest(shown);
  const sent = useRef<{ positionMs: number | null; playing: boolean; at: number } | null>(null);
  useEffect(() => {
    if (!backgroundPlayback) return;
    const item = latestShown.current;
    if (key === null || !item) {
      if (sent.current) hideNowPlaying();
      sent.current = null;
      return;
    }
    showNowPlaying(item);
    sent.current = { positionMs: item.positionMs, playing: item.playing, at: clock.now() };
  }, [key, presses, latestShown]);

  // A song's seek bar: sent again only when the song is somewhere the system wouldn't count it to.
  const positionMs = shown?.positionMs ?? null;
  useEffect(() => {
    const last = sent.current;
    const item = latestShown.current;
    if (!backgroundPlayback || !last || !item || positionMs === null || last.positionMs === null) return;
    const at = clock.now();
    const expected = last.positionMs + (last.playing ? at - last.at : 0);
    if (Math.abs(expected - positionMs) < DRIFT_MS) return;
    showNowPlaying(item);
    sent.current = { positionMs, playing: item.playing, at };
  }, [positionMs, latestShown]);

  const latest = useLatest({ state, actions, music, front: song !== null });
  useEffect(
    () =>
      onMediaCommand((command: MediaCommand) => {
        const { state: s, actions: a, music: m, front } = latest.current;
        switch (command.type) {
          case 'play':
            if (front) {
              if (!m.playing) m.toggle();
            } else if (s.player.status === 'paused') a.play();
            break;
          case 'pause':
            // Whatever sounds: an interruption pauses both.
            if (m.playing) m.toggle();
            if (s.player.status === 'playing') a.pause();
            break;
          case 'next':
            if (front) m.next();
            else a.next();
            break;
          case 'previous':
            if (front) m.previous();
            else a.prev();
            break;
          case 'seek':
            if (front) m.seek(command.positionMs / 1000);
            break;
          case 'rate': {
            if (front) {
              if (!m.song || m.song.id !== command.id) break;
              const r = songRating(s, m.song, clock.now());
              if (r.ratable.length === 0 && r.given.length === 0) break;
              a.ratePhrases(m.song.id, r.phraseIds, m.song.setId, command.grade);
            } else {
              if (currentPhraseId(s.player) !== command.id || !phraseRatable(s)) break;
              a.rate(command.grade);
            }
            if (command.grade === 'easy') easyCue();
            else gentleCue();
            break;
          }
        }
        setPresses((n) => n + 1);
      }),
    [latest],
  );
}

/** Mounted inside the music provider (app/_layout.tsx): the hook needs both players. */
export function LockScreen(): null {
  useLockScreen();
  return null;
}
