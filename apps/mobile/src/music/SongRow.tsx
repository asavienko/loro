// A song in a list beside phrases (plan 107): the phrase row's shape, its music note before the second
// line where a phrase has its phrase icon. A tap plays it in the one player (or pauses it).
import { Pressable, StyleSheet, View } from 'react-native';
import type { Song } from '@shared/api/library';
import type { Album } from '@shared/content';
import { useCopy } from '../state/store';
import { Icon } from '../ui/Icon';
import { Txt } from '../ui/Txt';
import { colors, radius, TARGET } from '../ui/theme';
import { clockTime, useMusic } from './MusicPlayer';

export function SongRow({ song, album, leading }: { song: Song; album: Album; leading?: string }) {
  const c = useCopy();
  const music = useMusic();
  const current = music.song?.id === song.id;
  const playing = current && music.playing;
  const detail = [c.music.songKind, album.owner === 'loro' ? c.music.loro : album.title, c.music.style[song.styleId], song.durationMs ? clockTime(song.durationMs / 1000) : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={[styles.row, current && styles.current]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? c.common.pause : c.music.playSong(song.title)}
        accessibilityState={{ selected: current }}
        onPress={() => (current ? music.toggle() : music.playAlbum(album, [song], 0))}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        {leading !== undefined && (
          <View style={styles.leading}>
            {playing ? <Icon name="volume_up" size="sm" color="primaryContainer" /> : <Txt variant="label" weight={700} color="secondary">{leading}</Txt>}
          </View>
        )}
        <View style={styles.text}>
          <Txt variant="row" weight={current ? 600 : 500} color={current ? 'primaryContainer' : 'onSurface'} numberOfLines={1}>
            {song.title}
          </Txt>
          <View style={styles.second}>
            <Icon name="music_note" size={14} color="primaryContainer" />
            <Txt variant="label" color="secondary" numberOfLines={1} style={styles.flex}>
              {detail}
            </Txt>
          </View>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={playing ? c.common.pause : c.music.playSong(song.title)} onPress={() => (current ? music.toggle() : music.playAlbum(album, [song], 0))} style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
        <Icon name={playing ? 'pause' : 'play_arrow'} fill color="primaryContainer" />
      </Pressable>
    </View>
  );
}

// The phrase row's measures (src/ui/PhraseRow.tsx), so both read as one list.
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius['2xl'] },
  current: { backgroundColor: 'rgba(255,219,207,0.4)' },
  main: { flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 8, paddingVertical: 8, borderRadius: radius['2xl'] },
  pressed: { backgroundColor: colors.surfaceContainer },
  leading: { width: 24, alignItems: 'center' },
  text: { flex: 1, minWidth: 0 },
  second: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flex: { flex: 1, minWidth: 0 },
  more: { width: TARGET, height: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
