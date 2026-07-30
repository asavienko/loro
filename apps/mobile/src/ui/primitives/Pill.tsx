/**
 * `Pill` — a small label on a tinted background, optionally with a leading emoji. Static: a pill
 * you can tap is a `Chip`.
 *
 * ── Why it has five sizes ──
 * `practice/stream.tsx` used to define a SECOND, incompatible `Pill` beside this one (diagnosed in
 * plans/48 §3a, executed in plans/52), and two more screens hand-rolled the rounded capsule form.
 * The seven call sites are one shape at five sets of metrics, so the metrics are a table
 * (`src/ui/tokens/control.ts`) and `size` picks a row. The difference that mattered most was
 * `alignSelf`: `flex-start` lets a pill in a column hug its own text and breaks the vertical
 * centring of a pill inside a row, which is precisely why the copy existed.
 *
 * ── tone vs color/background ──
 * `tone` covers the three pairings that repeat. The semantic ones do not repeat — each difficulty,
 * success and danger pill passes its own pair out of `difficultyMeta` / `semantic` — so `color` and
 * `background` stay available and win over `tone`.
 */

import { View } from 'react-native'
import { accent, ink, onDark, pillSize, surface } from '../theme'
import { Text } from './Text'

export type PillSize = keyof typeof pillSize
export type PillTone = keyof typeof TONE

const TONE = {
  neutral: { color: ink.muted, background: surface.sunken },
  accent: { color: accent.accentInk, background: accent.wash },
  /** On a `DarkCard`, where the ink ramp inverts. */
  onDark: { color: onDark.secondary, background: onDark.surface },
} as const

export function Pill({
  label,
  emoji,
  color,
  background,
  tone = 'neutral',
  size = 'md',
}: {
  label: string
  /**
   * Rendered before the label. Deliberately gets NO colour: an emoji is its own colour glyph, and
   * every call site leaves it at the default ink.
   */
  emoji?: string | undefined
  /** Overrides `tone`'s text colour — the semantic pills pass their own. */
  color?: string | undefined
  /** Overrides `tone`'s background. */
  background?: string | undefined
  tone?: PillTone | undefined
  size?: PillSize | undefined
}) {
  const m = pillSize[size]
  const t = TONE[tone]

  return (
    <View
      style={{
        paddingHorizontal: m.paddingHorizontal,
        paddingVertical: m.paddingVertical,
        borderRadius: m.borderRadius,
        alignSelf: m.alignSelf,
        backgroundColor: background ?? t.background,
        // The row is applied ONLY when there is something to lay out beside the label. A
        // label-only pill keeps the plain column box it has always had: switching it to a row
        // changes which axis the label hugs, and that only shows up at 310% text, where it is
        // hardest to notice and most likely to matter.
        ...(emoji === undefined
          ? null
          : { flexDirection: 'row' as const, alignItems: 'center' as const, gap: m.gap }),
      }}
    >
      {emoji !== undefined && <Text variant={m.emoji}>{emoji}</Text>}
      <Text variant={m.text} color={color ?? t.color}>
        {label}
      </Text>
    </View>
  )
}
