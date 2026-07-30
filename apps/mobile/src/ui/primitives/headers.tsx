/**
 * The two headers: a section's label with its hint, and a card's title with its meta value.
 *
 * Both are "a line of text with a second, quieter one" — which sounds too thin to be a component
 * until you count them: six screens hand-rolled one of the two, and every copy re-decided the gap,
 * the alignment and which step of the type scale the quiet half sits on.
 */

import { cardHeader, ink, sectionHeader } from '../theme'
import { Row } from './layout'
import { SectionLabel, Text } from './Text'

/**
 * A section label with a hint beside it — "What's tricky · tap to toggle".
 *
 * Baseline-aligned, not centred: the two sit at different type sizes, and a shared baseline is what
 * makes them read as one line rather than two stacked things.
 */
export function SectionHeader({
  label,
  hint,
  variant = 'label',
}: {
  label: string
  hint?: string | undefined
  /**
   * `label` is the uppercase `SectionLabel`. `caption` is the sentence-case form the add sheet uses
   * for the same header, where an uppercase label would compete with the sheet's own title.
   */
  variant?: 'label' | 'caption' | undefined
}) {
  return (
    <Row gap={sectionHeader.gap} align="baseline">
      {variant === 'caption' ? (
        <Text variant="caption" color={ink.ink}>
          {label}
        </Text>
      ) : (
        <SectionLabel>{label}</SectionLabel>
      )}
      {hint !== undefined && (
        <Text variant="captionSm" color={ink.muted}>
          {hint}
        </Text>
      )}
    </Row>
  )
}

/**
 * A card's header: the title, and a meta value pushed to the far edge.
 *
 * Baseline-aligned for the same reason as `SectionHeader`, and it owns the gap down to the card's
 * body so that two cards on different screens cannot drift apart by a few pixels.
 */
export function CardHeader({
  title,
  meta,
  metaVariant = 'labelSm',
}: {
  title: string
  meta: string
  /**
   * `labelSm` is the uppercase tracked form (Today's set count); `captionSm` is the sentence-case
   * one (Progress's "N total"). The two screens differ here and both are deliberate.
   */
  metaVariant?: 'labelSm' | 'captionSm' | undefined
}) {
  return (
    <Row justify="space-between" align="baseline" style={{ marginBottom: cardHeader.marginBottom }}>
      <Text variant="caption" color={ink.ink}>
        {title}
      </Text>
      <Text variant={metaVariant} color={ink.muted}>
        {meta}
      </Text>
    </Row>
  )
}
