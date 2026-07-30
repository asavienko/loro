/**
 * `TagChips` — "What's tricky about it?", the four tags as a wrapping grid of checkboxes.
 *
 * Multi-select, so the role is `checkbox` and every chip carries `selected`; the mark appended to
 * a chosen chip's text is the visible half of the same signal, since a selection must not be
 * carried by colour alone. The labels come from `tagMeta` (`src/ui/theme.ts`), which the E2E
 * suite matches on; the mark itself is copy, so it arrives as a prop.
 *
 * The set of tags is closed and its order is `tagMeta`'s — pronunciation, memory, usefulness,
 * words. Both call sites (the add sheet, phrase detail) render all four.
 */

import type { Tag } from '@loro/core'
import { Chip, Grid } from '../primitives'
import { tagMeta } from '../theme'

const ORDER = Object.keys(tagMeta) as Tag[]

export function TagChips({
  value,
  onToggle,
  selectedSuffix,
}: {
  value: readonly Tag[]
  /**
   * The inventory calls this `onChange`. It is a toggle here because that is what both call sites
   * need: phrase detail's store action is `toggleTag(id, tag)`, and handing back the whole array
   * would force it to diff two arrays to find which tag moved.
   */
  onToggle: (tag: Tag) => void
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
      {ORDER.map((t) => {
        const selected = value.includes(t)
        return (
          <Chip
            key={t}
            variant="tag"
            accessibilityRole="checkbox"
            accessibilityLabel={tagMeta[t].label}
            label={selected ? `${tagMeta[t].label}${selectedSuffix}` : tagMeta[t].label}
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
