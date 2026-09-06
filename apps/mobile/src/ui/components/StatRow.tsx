/**
 * `StatRow` — a row of `StatTile`s. Always in threes today (Today and Progress), and the gap
 * is 9: one pixel tighter than a `space` step, which is what the blueprint draws.
 *
 * Each tile groups its number with its label into one accessible node — see `StatTile`.
 */

import { Row, StatTile } from '../primitives'
import { statRow } from '../theme'

export interface Stat {
  value: string
  label: string
}

export function StatRow({ stats }: { stats: readonly Stat[] }) {
  return (
    <Row gap={statRow.gap} align="stretch" wrap>
      {stats.map((stat) => (
        <StatTile key={stat.label} value={stat.value} label={stat.label} />
      ))}
    </Row>
  )
}
