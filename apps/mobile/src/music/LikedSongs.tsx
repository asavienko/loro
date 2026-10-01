// Every learner's "Liked songs" album (plan 107): the songs they hearted in the player, most recently
// liked first, in Library's albums like any other and played as one in the one player. It is built
// from their likes, so it is there signed in or not; the songs are the server's, fetched to be shown,
// and one that has gone (removed, or made private) is left out.
import { useEffect, useState } from 'react';
import { unreachable } from '@shared/api/client';
import { fetchSong, type Song } from '@shared/api/library';
import { Album, findSet } from '@shared/content';
import type { Copy } from '@shared/copy';
import { LIKED_ID, likedSongIds } from '@shared/state/selectors';
import { useStore } from '../state/store';

/** Songs fetched once, kept for when the next fetch can't reach the server. */
const seen = new Map<string, Song>();

export interface LikedSongList {
  /** The course's liked songs that can play, most recently liked first; null until they are fetched. */
  songs: Song[] | null;
  /** Some couldn't be reached (offline, and never fetched before): the list may be short. */
  partial: boolean;
  /** Fetched for the likes as they are now (a song just liked may still be on its way). */
  settled: boolean;
}

export function useLikedSongs(): LikedSongList {
  const { state } = useStore();
  const ids = likedSongIds(state.learner);
  const key = ids.join(',');
  const [fetched, setFetched] = useState<{ key: string; songs: Song[]; partial: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    const wanted = key ? key.split(',') : [];
    void Promise.all(
      wanted.map((id) =>
        fetchSong(id).then(
          (song) => {
            seen.set(id, song);
            return { song, missed: false };
          },
          // Offline: the copy from before, or not known. Gone: nothing.
          (error: unknown) => (unreachable(error) ? { song: seen.get(id) ?? null, missed: !seen.has(id) } : { song: null, missed: false }),
        ),
      ),
    ).then((found) => {
      if (!live) return;
      setFetched({ key, songs: found.map((f) => f.song).filter((s): s is Song => s !== null && s.status === 'ready'), partial: found.some((f) => f.missed) });
    });
    return () => {
      live = false;
    };
  }, [key]);

  if (fetched === null) return { songs: null, partial: false, settled: false };
  const songs = fetched.songs;
  const target = state.learner.profile.targetLang;
  // This course's songs (a song whose set this device doesn't know is kept rather than guessed away).
  // Only what is liked now, in the order liked: an unliked song leaves before the next fetch returns.
  const shown = ids
    .map((id) => songs.find((s) => s.id === id))
    .filter((s): s is Song => {
      if (!s) return false;
      const set = findSet(s.setId);
      return !set || set.targetLang === target;
    });
  return { songs: shown, partial: fetched.partial, settled: fetched.key === key };
}

/** The album the liked songs make: the learner's own, private, and played like any other. */
export function likedAlbum(c: Copy, targetLang: Album['targetLang'], list: LikedSongList): Album {
  const songs = list.songs ?? [];
  const lengths = songs.map((s) => s.durationMs);
  return {
    id: LIKED_ID,
    title: c.music.likedSongs,
    description: null,
    coverUrl: null,
    targetLang,
    owner: 'me',
    author: null,
    visibility: 'private',
    shareCode: null,
    saved: false,
    songCount: songs.length,
    // A count that may be short isn't shown.
    counting: list.songs === null || list.partial || !list.settled,
    // Unknown while any song's length is, as for every album.
    durationMs: lengths.every((ms): ms is number => typeof ms === 'number') ? lengths.reduce((a, b) => a + b, 0) : null,
    createdAt: 0,
    updatedAt: 0,
  };
}
