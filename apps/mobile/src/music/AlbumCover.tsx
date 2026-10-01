// An album's cover (plan 106): its drawn SVG, or a plain tile with a record when it has none. A song
// shows its album's cover, or the learner's own cover of it.
import { View, ViewStyle } from 'react-native';
import { Icon } from '../ui/Icon';
import { ContentBadges } from '../ui/ContentBadges';
import { CoverRedraw, type CoverItem } from '../ui/CoverRedraw';
import { RemoteCover } from '../ui/RemoteCover';
import { colors } from '../ui/theme';

/**
 * `badges`: the song icon in its corner (plan 107), an album being songs. `redraw`: the album or song
 * it pictures, given a button in the corner that draws it a new cover (CoverRedraw).
 */
export function AlbumCover({ url, px, rounded = 12, style, badges = true, redraw }: { url: string | null; px: number; rounded?: number; style?: ViewStyle; badges?: boolean; redraw?: CoverItem }) {
  const plain = (
    <View
      accessible={false}
      style={[{ width: px, height: px, borderRadius: rounded, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Icon name="album" size={Math.round(px * 0.45)} color="primaryContainer" />
    </View>
  );
  const cover = url ? <RemoteCover url={url} px={px} rounded={rounded} style={style} fallback={plain} /> : plain;
  const badged = badges && px >= 40;
  if (!badged && !redraw) return cover;
  return (
    <View style={{ width: px, height: px }}>
      {cover}
      {badged && <ContentBadges phrases={false} songs px={px} />}
      {redraw && <CoverRedraw item={redraw} width={px} height={px} rounded={rounded} />}
    </View>
  );
}
