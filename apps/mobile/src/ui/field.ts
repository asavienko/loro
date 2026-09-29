// A text field (the web prototype's src/ui/field.ts): white with an `outline` edge (4.3:1, so the
// box is findable: WCAG 1.4.11 asks 3:1) and 16 px text, which keeps iOS from zooming in. A caller
// may add width, a side padding for an icon or the target-language face; nothing else.
import { TextStyle } from 'react-native';
import { colors, radius, type } from './theme';

export const field: TextStyle = {
  ...type.field,
  fontFamily: 'sans-400',
  minHeight: 48,
  paddingHorizontal: 16,
  borderRadius: radius['2xl'],
  backgroundColor: colors.surfaceContainerLowest,
  borderWidth: 1,
  borderColor: colors.outline,
  color: colors.onSurface,
};

/** A field's placeholder text. */
export const placeholderColor = colors.secondary;
