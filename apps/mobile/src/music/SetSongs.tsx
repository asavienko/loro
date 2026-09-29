// The songs sung from a set (plan 106), on its page: the way from a set's phrases to hearing them
// in a song, in Music's night colours. A song plays at once; the album opens from its cover.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { fetchSetSongs, type Song } from '@shared/api/library';
import type { Album } from '@shared/content';
import { useNav } from '@shared/nav/NavContext';
import { useCopy } from '../state/store';
import { Icon } from '../ui/Icon';
import { Txt } from '../ui/Txt';
import { colors, radius, TARGET } from '../ui/theme';
import { AlbumCover } from './AlbumCover';
import { clockTime, useMusic } from './MusicPlayer';

export function SetSongs({ setId }: { setId: string }) {
  const c = useCopy();
  const nav = useNav();
  const music = useMusic();
  const [found, setFound] = useState<{ songs: Song[]; albums: Album[] } | null>(null);

  useEffect(() => {
    let live = true;
    fetchSetSongs(setId).then(
      (reply) => live && setFound(reply),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [setId]);

  return (
    <View style={styles.panel}>
      <Txt variant="heading" face="serif" weight={600} color="onNight" accessibilityRole="header">
        {c.music.setSongs}
      </Txt>
      {found?.songs.map((song) => {
        const album = found.albums.find((a) => a.id === song.albumId);
        if (!album) return null;
        const playing = music.song?.id === song.id && music.playing;
        return (
          <View key={song.id} style={styles.row}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${c.music.album}: ${album.title}`} onPress={() => nav.openAlbum(album.id)}>
              <AlbumCover url={album.coverUrl} px={44} rounded={8} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={playing ? c.common.pause : c.music.playSong(song.title)}
              onPress={() => (playing ? music.toggle() : music.playAlbum(album, [song], 0))}
              style={({ pressed }) => [styles.main, pressed && styles.pressed]}
            >
              <View style={styles.text}>
                <Txt variant="row" weight={600} color="onNight" numberOfLines={1}>
                  {song.title}
                </Txt>
                <Txt variant="label" color="onNightVariant" numberOfLines={1}>
                  {[album.owner === 'loro' ? c.music.loro : album.title, c.music.style[song.styleId], song.durationMs ? clockTime(song.durationMs / 1000) : null].filter(Boolean).join(' · ')}
                </Txt>
              </View>
              <Icon name={playing ? 'pause' : 'play_arrow'} fill color="nightAccent" />
            </Pressable>
          </View>
        );
      })}
      <Pressable accessibilityRole="button" onPress={() => nav.makeSong({ setId })} style={({ pressed }) => [styles.make, pressed && styles.pressed]}>
        <Icon name="music_note" color="nightAccent" />
        <Txt variant="body" weight={600} color="onNight">
          {c.music.makeSong}
        </Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.night, borderRadius: radius['2xl'], padding: 16, gap: 8, marginHorizontal: 16, marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: TARGET + 8, borderRadius: radius.xl },
  text: { flex: 1, gap: 1 },
  pressed: { opacity: 0.8 },
  make: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: TARGET, alignSelf: 'flex-start' },
});
