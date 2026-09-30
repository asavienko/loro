// The songs sung from a set that this reader may hear, with their albums (plan 106; plan 107 lists
// them on the set's page beside its phrases).
import { useEffect, useState } from 'react';
import { fetchSetSongs, type Song } from '@shared/api/library';
import type { Album } from '@shared/content';

export function useSetSongs(setId: string | null): { songs: Song[]; albums: Album[] } {
  const [found, setFound] = useState<{ id: string; songs: Song[]; albums: Album[] } | null>(null);
  useEffect(() => {
    if (!setId) return;
    let live = true;
    fetchSetSongs(setId).then(
      (reply) => live && setFound({ id: setId, ...reply }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [setId]);
  // Another set's answer never shows here.
  return found && found.id === setId ? found : { songs: [], albums: [] };
}
