// Songs play here (plans 106, 107): an album's songs as a queue through expo-audio, with where the
// song is so the lyrics can follow it. The phrase loop has its own engine, but the learner sees one
// player: `front` says which of the two was started last, and the mini player and the full player
// show that one. Only one sounds at a time: a song pauses the phrase loop, and the loop pauses it.
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl, unreachable } from '@shared/api/client';
import { fetchSong, type Song } from '@shared/api/library';
import { useLatest } from '@shared/lib/useLatest';
import { clock } from '@shared/state/clock';
import type { Album } from '@shared/content';
import { useCopy, useStore } from '../state/store';
import { useToast } from '../ui/Toast';

interface MusicValue {
  album: Album | null;
  queue: Song[];
  index: number;
  song: Song | null;
  playing: boolean;
  /** The song, not the phrase loop, is what the player shows: it was started last. */
  front: boolean;
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
  /** Keeps an eye on a song being made: when it's ready (or failed) the learner hears of it anywhere. */
  watch: (song: Song, album: Album) => void;
}

/** How often a song being made is asked after, and for how long at most. */
const WATCH_MS = 5000;
const WATCH_FOR_MS = 12 * 60_000;

const MusicContext = createContext<MusicValue | null>(null);

/**
 * A song's URL is signed and expires (and a server restart may change its key), so each play asks
 * for the song again. Songs stream: with no connection there is nothing to play ('offline').
 */
async function playableUrl(song: Song): Promise<string | 'offline' | null> {
  try {
    const fresh = await fetchSong(song.id);
    return fresh.audioUrl ? apiUrl(fresh.audioUrl) : null;
  } catch (error) {
    return unreachable(error) ? 'offline' : null;
  }
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const { state, actions } = useStore();
  const c = useCopy();
  const { toast } = useToast();
  const [album, setAlbum] = useState<Album | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [index, setIndex] = useState(0);
  const wantsPlay = useRef(false);
  const [songInFront, setSongInFront] = useState(false);
  const [watched, setWatched] = useState<{ song: Song; album: Album; since: number }[]>([]);
  // Songs whose ask is on its way, or already told of: each is told of once.
  const asking = useRef(new Set<string>());
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
      if (mine !== loads.current) return;
      if (uri === null || uri === 'offline') {
        // Nothing to play: say why. Whatever was playing (or nothing) stays as it was.
        toast(uri === 'offline' ? c.music.needsConnection : c.music.cantPlay);
        return;
      }
      // The queue changes only once the song can play, so a failed tap leaves the current one alone.
      setAlbum(from);
      setQueue(songs);
      setIndex(at);
      player.replace({ uri });
      wantsPlay.current = true;
      player.play();
      setSongInFront(true);
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
    [player, toast, c],
  );

  const playAlbum = useCallback(
    (next: Album, songs: Song[], startIndex = 0) => {
      const ready = songs.filter((s) => s.status === 'ready' && s.audioUrl);
      const start = Math.max(0, ready.findIndex((s) => s.id === songs[startIndex]?.id));
      if (ready.length === 0) return;
      // One player sounds at a time.
      if (state.player.status === 'playing') actions.pause();
      void load(next, ready, start);
    },
    [actions, load, state.player.status],
  );

  // Songs being made, asked after until each is ready or failed.
  const playLatest = useLatest(playAlbum);
  useEffect(() => {
    if (watched.length === 0) return;
    const forget = (id: string) => setWatched((list) => list.filter((w) => w.song.id !== id));
    const timer = setInterval(() => {
      for (const { song, album: of, since } of watched) {
        if (asking.current.has(song.id)) continue;
        // A song that takes this long was lost (the album will say so); stop asking.
        if (clock.now() - since > WATCH_FOR_MS) {
          forget(song.id);
          continue;
        }
        asking.current.add(song.id);
        fetchSong(song.id).then(
          (now) => {
            if (now.status === 'rendering') return void asking.current.delete(song.id);
            forget(song.id);
            if (now.status === 'ready')
              toast(c.music.songReady(now.title), { tone: 'success', action: { label: c.music.play, run: () => playLatest.current(of, [now], 0) } });
            else toast(c.music.songFailed(now.title));
          },
          (error: unknown) => {
            // Offline: ask again later. Gone (removed, signed out) or refused: stop asking.
            if (unreachable(error)) asking.current.delete(song.id);
            else forget(song.id);
          },
        );
      }
    }, WATCH_MS);
    return () => clearInterval(timer);
  }, [watched, toast, c, playLatest]);

  const step = useCallback(
    (by: number) => {
      const at = index + by;
      if (at < 0 || at >= queue.length) return;
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
    // Whichever just started is in front (set after this render, as a start from a tap is).
    const phrasesStarted = state.player.status === 'playing' && was.phrases !== 'playing';
    const songStarted = status.playing && !was.song;
    if (phrasesStarted || songStarted) void Promise.resolve().then(() => setSongInFront(!phrasesStarted));
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
      front: songInFront && queue[index] !== undefined,
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
          setSongInFront(true);
        }
      },
      next: () => step(1),
      previous: () => (status.currentTime > 3 ? void player.seekTo(0) : step(-1)),
      seek: (seconds) => void player.seekTo(Math.max(0, seconds)),
      watch: (song, of) => {
        // A retried song is told of again.
        asking.current.delete(song.id);
        setWatched((list) => (list.some((w) => w.song.id === song.id) ? list : [...list, { song, album: of, since: clock.now() }]));
      },
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
        setSongInFront(false);
      },
    }),
    [songInFront, album, queue, index, status.playing, status.currentTime, status.duration, status.isBuffering, playAlbum, step, player, actions, state.player.status],
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
