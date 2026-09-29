// An album in a shelf (plan 106): cover, title, and who made it or how many songs it has.
import { Pressable, StyleSheet, View } from 'react-native';
import type { Album } from '@shared/content';
import { useCopy } from '../state/store';
import { Txt } from '../ui/Txt';
import { AlbumCover } from './AlbumCover';

export function AlbumCard({ album, width, onOpen }: { album: Album; width: number; onOpen: () => void }) {
  const c = useCopy();
  const byline = album.owner === 'loro' ? c.music.loro : album.owner === 'me' ? c.share.yours : album.author ? c.share.by(album.author) : c.share.byLearner;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${album.title}, ${c.music.songs(album.songCount)}, ${byline}`}
      onPress={onOpen}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
    >
      <AlbumCover url={album.coverUrl} px={width} rounded={12} />
      <View style={styles.text}>
        <Txt variant="body" weight={700} color="onNight" numberOfLines={1}>
          {album.title}
        </Txt>
        <Txt variant="label" color="onNightVariant" numberOfLines={1}>
          {`${c.music.songs(album.songCount)} · ${byline}`}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  text: { paddingTop: 8, gap: 2 },
});
