// An album in a shelf (plan 106): cover, title, and who made it or how many songs it has.
import { StyleSheet, View } from 'react-native';
import type { Album } from '@shared/content';
import { LIKED_ID } from '@shared/state/selectors';
import { useCopy } from '../state/store';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';
import { AlbumCover } from './AlbumCover';

export function AlbumCard({ album, width, onOpen }: { album: Album; width: number; onOpen: () => void }) {
  const c = useCopy();
  const by = album.owner === 'loro' ? c.music.loro : album.owner === 'me' ? c.share.yours : album.author ? c.share.by(album.author) : c.share.byLearner;
  const byline = album.savedBy ? `${by} · ${c.community.savedBy(album.savedBy)}` : by;
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={album.counting ? `${album.title}, ${byline}` : `${album.title}, ${c.music.songs(album.songCount)}, ${byline}`}
      onPress={onOpen}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
    >
      <AlbumCover url={album.coverUrl} px={width} rounded={12} liked={album.id === LIKED_ID} />
      <View style={styles.text}>
        <Txt variant="body" weight={700} color="onSurface" numberOfLines={1}>
          {album.title}
        </Txt>
        <Txt variant="label" color="secondary" numberOfLines={1}>
          {album.counting ? byline : `${c.music.songs(album.songCount)} · ${byline}`}
        </Txt>
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  text: { paddingTop: 8, gap: 2 },
});
