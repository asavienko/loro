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
 * The resolved chrome lives in `./controlStyle.ts` so a unit test can pin Account's parchment
 * well and the Newsreader/DM Sans split. `invalid` and `editable` use both
 * `accessibilityState` and `aria-*` because RNW drops the nested form. Call-site `style`
 * overrides (Discover 46, sheet 38, Import 132) stay local — those numbers have one home each.
 */

import { useState } from 'react'
import {
  Platform,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from 'react-native'
import { ink } from '../theme'
import { IconButton } from './IconButton'
import { Row } from './layout'
import { fieldA11y, fieldFace, fieldLook } from './controlStyle'

export function Field({
  accessibilityLabel,
  accessibilityHint,
  value,
  onChangeText,
  placeholder,
  placeholderTextColor = ink.muted2,
  bordered = false,
  literary = false,
  invalid = false,
  multiline = false,
  editable = true,
  clearLabel,
  clearGlyph,
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
  /** Newsreader once the learner is composing target-language text. */
  literary?: boolean | undefined
  invalid?: boolean | undefined
  multiline?: boolean | undefined
  editable?: boolean | undefined
  /** Required when `onClear` is set — a glyph has no accessible name. */
  clearLabel?: string | undefined
  /** Required when `onClear` is set. Pass owned copy; this file does not import `copy`. */
  clearGlyph?: string | undefined
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
  | 'accessibilityState'
>) {
  if (onClear !== undefined) {
    if (clearLabel === undefined || clearGlyph === undefined) {
      throw new Error('Field clear control requires clearLabel and clearGlyph')
    }
  }
  const [focused, setFocused] = useState(false)
  const look = fieldLook(bordered, invalid, focused)
  const a11y = fieldA11y(invalid, editable)
  const input = (
    <TextInput
      {...inputProps}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      multiline={multiline}
      editable={editable}
      accessibilityState={a11y.accessibilityState}
      aria-disabled={a11y['aria-disabled']}
      aria-invalid={a11y['aria-invalid']}
      onFocus={(event) => {
        setFocused(true)
        inputProps.onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        inputProps.onBlur?.(event)
      }}
      style={[
        look.input,
        fieldFace(literary, value.length > 0),
        multiline ? { textAlignVertical: 'top' } : null,
        Platform.OS === 'web'
          ? ({ outlineWidth: 0, outlineColor: 'transparent' } satisfies TextStyle)
          : null,
        style,
      ]}
      {...(lang !== undefined ? { lang } : {})}
    />
  )

  if (onClear === undefined || clearLabel === undefined || clearGlyph === undefined) return input
  if (value.length === 0) return input
  return (
    <Row align="center">
      {input}
      <IconButton glyph={clearGlyph} label={clearLabel} onPress={onClear} />
    </Row>
  )
}
