import { Children, ReactNode } from 'react';
import { StyleProp, Text, TextProps, TextStyle } from 'react-native';
import { useUiLocale } from './locale';
import { Face, fontFamily, Weight } from './fonts';
import { colors, ColorName, type, TypeRole } from './theme';

/** Plain text of the children, to tell which script they are in. */
function textOf(children: ReactNode): string {
  return Children.toArray(children)
    .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
    .join('');
}

export interface TxtProps extends Omit<TextProps, 'style'> {
  variant?: TypeRole;
  /** Serif for content and headings, sans for the interface. */
  face?: Face;
  weight?: Weight;
  /** The language being learned is always serif italic. */
  italic?: boolean;
  color?: ColorName;
  /** The text's language (BCP 47): its script picks the face, and screen readers pronounce it right. */
  lang?: string;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
}

/**
 * Text in one of the prototype's type roles. It scales with the system text size. Cyrillic (the
 * UI in Bulgarian or Russian, or a Bulgarian phrase) takes Literata and Manrope.
 */
export function Txt({ variant = 'body', face = 'sans', weight = 400, italic = false, color = 'onSurface', lang, align, style, children, ...rest }: TxtProps) {
  const uiLocale = useUiLocale();
  const text = textOf(children);
  // Text without letters (a number, a symbol) follows the interface's script.
  const family = fontFamily(face, weight, italic, text || null, lang ?? (/\p{L}/u.test(text) ? undefined : uiLocale));
  return (
    <Text
      {...rest}
      // react-native-web passes lang through to the DOM; native screen readers read the language from it where supported.
      {...(lang ? ({ lang } as object) : {})}
      style={[type[variant], { fontFamily: family, color: colors[color], textAlign: align }, style]}
    >
      {children}
    </Text>
  );
}
