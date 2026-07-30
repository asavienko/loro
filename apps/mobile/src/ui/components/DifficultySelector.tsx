/**
 * `DifficultySelector` — "How hard is it for you?", in the three shapes the app renders it.
 *
 * ── Why a layout AND a density ──
 * The add sheet and phrase detail draw CARDS; the stream draws a segmented track. And the two
 * card sites differ by one pixel of vertical padding (12 in the sheet, 11 on detail). That
 * pixel is preserved as `density="tight"` rather than averaged away: unifying it would move every
 * row below the selector on one of the two screens, and `e2e/text-scale.spec.ts` checks that
 * nothing clips at 200% and 310% text.
 *
 * Labels are presentation copy supplied by the route; this leaf owns only layout and colours.
 */

import { DIFFICULTIES, type Difficulty } from '@loro/core'
import { Pressable, Row, Segmented, Text } from '../primitives'
import { border, difficultyCard, difficultyMeta, ink, line, radius, surface } from '../theme'

export function DifficultySelector({
  value,
  onChange,
  labels,
  layout = 'cards',
  density = 'default',
}: {
  value: Difficulty
  onChange: (value: Difficulty) => void
  labels: Readonly<Record<Difficulty, string>>
  /** The inventory's two layouts: `cards` (the add sheet, phrase detail) or `segmented` (stream). */
  layout?: 'cards' | 'segmented' | undefined
  /**
   * `tight` is phrase detail's cards — one pixel shorter than the add sheet's. Ignored by
   * `segmented`. It is a second prop rather than a third `layout` value because the layout and how
   * dense it is are two different questions, and the inventory fixes `layout`'s two names.
   */
  density?: keyof typeof difficultyCard | undefined
}) {
  if (layout === 'segmented') {
    return (
      <Segmented
        variant="track"
        accessibilityRole="radio"
        value={value}
        onChange={onChange}
        options={DIFFICULTIES.map((d) => ({
          value: d,
          label: labels[d],
          selectedColor: difficultyMeta[d].color,
        }))}
      />
    )
  }

  const m = difficultyCard[density]

  return (
    <Row gap={m.gap}>
      {DIFFICULTIES.map((d) => {
        const meta = difficultyMeta[d]
        const active = value === d
        return (
          <Pressable
            key={d}
            feedback="row"
            accessibilityRole="radio"
            accessibilityLabel={labels[d]}
            selected={active}
            onPress={() => {
              onChange(d)
            }}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: m.paddingVertical,
              borderRadius: radius.lg,
              backgroundColor: active ? meta.bg : surface.card,
              borderWidth: active ? border.selected : border.hairline,
              borderColor: active ? meta.border : line.strong,
            }}
          >
            <Text variant="labelSm" color={active ? meta.color : ink.ink3}>
              {labels[d]}
            </Text>
          </Pressable>
        )
      })}
    </Row>
  )
}
