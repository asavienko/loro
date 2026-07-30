/**
 * `TagChips` — "What's tricky about it?", the four tags as a wrapping grid of checkboxes.
 *
 * Multi-select, so the role is `checkbox` and every chip carries `selected`; the mark appended to
 * a chosen chip's text is the visible half of the same signal, since a selection must not be
 * carried by colour alone. Labels and the mark are presentation copy supplied by the route.
 *
 * The set of tags and its order are domain structure supplied by the route.
 */

import type { Tag } from '@loro/core'
import { Chip, Grid } from '../primitives'

export function TagChips({
  value,
  onToggle,
  selectedSuffix,
  order,
  labels,
}: {
  value: readonly Tag[]
  /**
   * The inventory calls this `onChange`. It is a toggle here because that is what both call sites
   * need: phrase detail's store action is `toggleTag(id, tag)`, and handing back the whole array
   * would force it to diff two arrays to find which tag moved.
   */
  onToggle: (tag: Tag) => void
  order: readonly Tag[]
  labels: Readonly<Record<Tag, string>>
  /**
   * Appended to a CHOSEN chip's visible text — `copy.common.selectedSuffix`, which is `' ✓'`
   * with its leading space. Required rather than defaulted, because a component that quietly
   * renders no mark when the caller forgets is a component that drops a WCAG signal silently.
   * It never reaches the accessible name: that is `aria-checked`'s job.
   */
  selectedSuffix: string
}) {
  return (
    <Grid>
      {order.map((t) => {
        const selected = value.includes(t)
        return (
          <Chip
            key={t}
            variant="tag"
            accessibilityRole="checkbox"
            accessibilityLabel={labels[t]}
            label={selected ? `${labels[t]}${selectedSuffix}` : labels[t]}
            selected={selected}
            onPress={() => {
              onToggle(t)
            }}
          />
        )
      })}
    </Grid>
  )
}
