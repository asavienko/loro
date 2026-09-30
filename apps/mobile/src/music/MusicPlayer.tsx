// Songs play here (plan 106), apart from the phrase player: an album's songs as a queue through
// expo-audio, with where the song is so the lyrics can follow it. Only one of the two players sounds
// at a time: a song pauses the phrase loop, and the phrase loop starting pauses the song.
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl } from '@shared/api/client';
import { fetchSong, type Song } from '@shared/api/library';
import { useLatest } from '@shared/lib/useLatest';
import type { Album } from '@shared/content';
import { useStore } from '../state/store';

interface MusicValue {
  album: Album | null;
  queue: Song[];
  index: number;
  song: Song | null;
  playing: boolean;
  /** Seconds into the song, and its length once known. */
  position: number;
  duration: number;
  buffering: boolean;
  /** Plays an album's ready songs from `startIndex`. */
  playAlbum: (album: Album, songs: Song[], startIndex?: number) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  stop: () => void;
}

const MusicContext = createContext<MusicValue | null>(null);

/**
 * A song's URL is signed and expires (and a server restart may change its key), so each play asks
 * for the song again; the one it came with serves only when the server can't be reached.
 */
async function playableUrl(song: Song): Promise<string | null> {
  const fresh = await fetchSong(song.id).catch(() => null);
  const url = fresh?.audioUrl ?? song.audioUrl;
  return url ? apiUrl(url) : null;
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const { state, actions } = useStore();
  const [album, setAlbum] = useState<Album | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [index, setIndex] = useState(0);
  const wantsPlay = useRef(false);
  // Each load (and stop) takes a number; a load whose song URL comes back after a newer one started
  // (or after the music stopped) plays nothing.
  const loads = useRef(0);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => {});
  }, []);

  const load = useCallback(
    async (from: Album | null, songs: Song[], at: number) => {
      const song = songs[at];
      if (!song) return;
      const mine = ++loads.current;
      const uri = await playableUrl(song);
      if (!uri || mine !== loads.current) return;
      player.replace({ uri });
      wantsPlay.current = true;
      player.play();
      // The lock screen and notification shade show the song and control it (a no-op on the web).
      try {
        player.setActiveForLockScreen(true, {
          title: song.title,
          albumTitle: from?.title,
          artist: from?.owner === 'loro' ? 'Loro' : (from?.author ?? undefined),
        });
      } catch {
        // Controls are a nicety; the song plays without them.
      }
    },
    [player],
  );

  const playAlbum = useCallback(
    (next: Album, songs: Song[], startIndex = 0) => {
      const ready = songs.filter((s) => s.status === 'ready' && s.audioUrl);
      const start = Math.max(0, ready.findIndex((s) => s.id === songs[startIndex]?.id));
      if (ready.length === 0) return;
      // One player sounds at a time.
      if (state.player.status === 'playing') actions.pause();
      setAlbum(next);
      setQueue(ready);
      setIndex(start);
      void load(next, ready, start);
    },
    [actions, load, state.player.status],
  );

  const step = useCallback(
    (by: number) => {
      const at = index + by;
      if (at < 0 || at >= queue.length) return;
      setIndex(at);
      void load(album, queue, at);
    },
    [album, index, queue, load],
  );

  // A finished song moves on to the next, and the album ends after its last.
  const stepRef = useLatest(step);
  const atEnd = useLatest(index + 1 >= queue.length);
  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (update) => {
      if (!update.didJustFinish) return;
      if (!atEnd.current) stepRef.current(1);
      else {
        wantsPlay.current = false;
        void player.seekTo(0);
      }
    });
    return () => subscription.remove();
  }, [player, stepRef, atEnd]);

  // One sounds at a time. The phrase loop starting pauses the song; the song starting while the loop
  // plays (from the lock screen or the notification) pauses the loop.
  const before = useRef({ phrases: state.player.status, song: status.playing });
  useEffect(() => {
    const was = before.current;
    before.current = { phrases: state.player.status, song: status.playing };
    if (state.player.status !== 'playing' || !status.playing) return;
    if (was.phrases !== 'playing') {
      wantsPlay.current = false;
      player.pause();
    } else actions.pause();
  }, [state.player.status, status.playing, player, actions]);

  const value = useMemo<MusicValue>(
    () => ({
      album,
      queue,
      index,
      song: queue[index] ?? null,
      playing: status.playing,
      position: status.currentTime,
      duration: status.duration || (queue[index]?.durationMs ?? 0) / 1000,
      buffering: status.isBuffering,
      playAlbum,
      toggle: () => {
        if (!queue[index]) return;
        if (status.playing) {
          wantsPlay.current = false;
          player.pause();
        } else {
          if (state.player.status === 'playing') actions.pause();
          wantsPlay.current = true;
          player.play();
        }
      },
      next: () => step(1),
      previous: () => (status.currentTime > 3 ? void player.seekTo(0) : step(-1)),
      seek: (seconds) => void player.seekTo(Math.max(0, seconds)),
      stop: () => {
        loads.current++;
        wantsPlay.current = false;
        player.pause();
        try {
          player.clearLockScreenControls();
        } catch {
          // Nothing was shown.
        }
        setQueue([]);
        setAlbum(null);
        setIndex(0);
      },
    }),
    [album, queue, index, status.playing, status.currentTime, status.duration, status.isBuffering, playAlbum, step, player, actions, state.player.status],
  );

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}

export function useMusic(): MusicValue {
  const value = useContext(MusicContext);
  if (!value) throw new Error('useMusic must be used inside MusicProvider');
  return value;
}

/** m:ss for a song's length or position. */
export function clockTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
