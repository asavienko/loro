// What a cover holds (plan 107): the phrase icon, the song icon, or both, in its top left corner (a
// card's play button has the bottom right). A set is phrases (and songs, when some are sung from
// it); an album is songs.
import { StyleSheet, View } from 'react-native';
import { Icon } from './Icon';
import { colors, radius } from './theme';

export const PHRASE_ICON = 'forum' as const;
export const SONG_ICON = 'music_note' as const;

export function ContentBadges({ phrases, songs, px }: { phrases: boolean; songs: boolean; px: number }) {
  if (!phrases && !songs) return null;
  // Readable on a thumbnail, never a cover's worth of chrome.
  const size = Math.max(16, Math.min(28, Math.round(px * 0.2)));
  const glyph = Math.round(size * 0.62);
  const inset = Math.max(3, Math.round(px * 0.04));
  return (
    <View pointerEvents="none" accessible={false} style={[styles.row, { left: inset, top: inset, gap: Math.round(size * 0.18) }]}>
      {phrases && (
        <View style={[styles.badge, { width: size, height: size }]}>
          <Icon name={PHRASE_ICON} size={glyph} color="onSurface" />
        </View>
      )}
      {songs && (
        <View style={[styles.badge, { width: size, height: size }]}>
          <Icon name={SONG_ICON} size={glyph} color="primaryContainer" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', flexDirection: 'row' },
  badge: { borderRadius: radius.full, backgroundColor: colors.surfaceContainerLowest, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.hairline },
});
