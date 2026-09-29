import { StyleProp, Text, TextStyle } from 'react-native';
import { ICON_CODEPOINTS, IconName } from './iconCodepoints';
import { colors, ColorName, iconSize } from './theme';

export type { IconName } from './iconCodepoints';

/**
 * A Material Symbols icon from the bundled subset (the web prototype's list), drawn by codepoint.
 * Decorative: the control around it carries the accessible name.
 */
export function Icon({
  name,
  size = 'base',
  color = 'onSurface',
  fill = false,
  style,
}: {
  name: IconName;
  size?: keyof typeof iconSize | number;
  color?: ColorName;
  fill?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const px = typeof size === 'number' ? size : iconSize[size];
  return (
    <Text
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      aria-hidden
      allowFontScaling
      style={[{ fontFamily: fill ? 'MaterialSymbolsFill' : 'MaterialSymbols', fontSize: px, lineHeight: px, color: colors[color], includeFontPadding: false }, style]}
    >
      {String.fromCodePoint(ICON_CODEPOINTS[name])}
    </Text>
  );
}
