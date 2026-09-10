/**
 * `Field` — a labelled text input. The shape six call-site groups were hand-rolling.
 *
 * ── Why this is not a kit SearchField ──
 * The authored `SearchField.jsx` is a rounded search with a focus ring and a clear glyph.
 * Production needed that contract plus Account's bordered box, Import's multiline paste, and
 * the tagging sheet's borderless lines. One primitive with optional container border and
 * optional clear keeps Discover's accent `Card` as a wrapper instead of baking accent into
 * the input. Every string is a prop; this file does not import `copy`.
 *
 * The resolved chrome lives in `./controlStyle.ts` so a unit test can pin Account's 44 / 12 /
 * `line.strong` box. Call-site `style` overrides (Discover 46, sheet 38, Import 132) stay
 * local — those numbers have one home each.
 */

import { TextInput, type StyleProp, type TextInputProps, type TextStyle } from 'react-native'
import { ink } from '../theme'
import { IconButton } from './IconButton'
import { Row } from './layout'
import { fieldLook } from './controlStyle'

export function Field({
  accessibilityLabel,
  accessibilityHint,
  value,
  onChangeText,
  placeholder,
  placeholderTextColor = ink.muted2,
  bordered = false,
  invalid = false,
  multiline = false,
  editable = true,
  clearLabel,
  onClear,
  style,
  testID,
  lang,
  ...inputProps
}: {
  accessibilityLabel: string
  accessibilityHint?: string | undefined
  value: string
  onChangeText: (value: string) => void
  placeholder?: string | undefined
  placeholderTextColor?: string | undefined
  /** Account / Workbench chrome. Discover and the tagging sheet leave this off and wrap. */
  bordered?: boolean | undefined
  invalid?: boolean | undefined
  multiline?: boolean | undefined
  editable?: boolean | undefined
  /** Required when `onClear` is set — a glyph has no accessible name. */
  clearLabel?: string | undefined
  onClear?: (() => void) | undefined
  style?: StyleProp<TextStyle> | undefined
  testID?: string | undefined
  /** Web-only; `targetLanguageInputProps` sets this because RNW drops `accessibilityLanguage`. */
  lang?: string | undefined
} & Omit<
  TextInputProps,
  | 'accessibilityLabel'
  | 'accessibilityHint'
  | 'value'
  | 'onChangeText'
  | 'placeholder'
  | 'placeholderTextColor'
  | 'multiline'
  | 'editable'
  | 'style'
  | 'testID'
>) {
  const look = fieldLook(bordered, invalid)
  const showClear = onClear !== undefined && value.length > 0
  const input = (
    <TextInput
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      multiline={multiline}
      editable={editable}
      style={[look.input, multiline ? { textAlignVertical: 'top' } : null, style]}
      {...inputProps}
      {...(lang !== undefined ? { lang } : {})}
    />
  )

  if (!showClear) return input
  if (clearLabel === undefined) {
    throw new Error('Field clear control requires clearLabel')
  }
  return (
    <Row align="center">
      {input}
      <IconButton glyph="✕" label={clearLabel} onPress={onClear} />
    </Row>
  )
}
