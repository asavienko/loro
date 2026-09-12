/**
 * Browse pack progress from owned-vs-catalog counts — never a fabricated share.
 *
 * `remaining` is how many catalog phrases in the theme the learner does not own.
 * `total` is how many catalog phrases the theme has. Owned is the difference; the
 * percent is that ratio, rounded. A theme with nothing left is complete even when
 * the catalog is empty (0 of 0), so the tile can still say it is finished.
 */
export function themePackProgress(
  remaining: number,
  total: number,
): {
  remaining: number
  total: number
  owned: number
  percent: number
  complete: boolean
} {
  const safeTotal = Math.max(0, total)
  const safeRemaining = Math.min(Math.max(0, remaining), safeTotal)
  const owned = safeTotal - safeRemaining
  const percent = safeTotal === 0 ? 100 : Math.round((owned / safeTotal) * 100)
  return {
    remaining: safeRemaining,
    total: safeTotal,
    owned,
    percent,
    complete: safeRemaining === 0,
  }
}
