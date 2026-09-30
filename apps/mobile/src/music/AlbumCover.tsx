// An album's cover (plan 106): its drawn SVG, or a plain tile with a record when it has none.
import { View, ViewStyle } from 'react-native';
import { Icon } from '../ui/Icon';
import { RemoteCover } from '../ui/RemoteCover';
import { colors } from '../ui/theme';

export function AlbumCover({ url, px, rounded = 12, style }: { url: string | null; px: number; rounded?: number; style?: ViewStyle }) {
  const plain = (
    <View
      accessible={false}
      style={[{ width: px, height: px, borderRadius: rounded, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Icon name="album" size={Math.round(px * 0.45)} color="primaryContainer" />
    </View>
  );
  return url ? <RemoteCover url={url} px={px} rounded={rounded} style={style} fallback={plain} /> : plain;
}
