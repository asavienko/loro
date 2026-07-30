/**
 * The contrast gate. Fails the build on a violation.
 *
 * Checks every foreground/background pairing the app actually uses, for ALL FOUR
 * accent themes — an accent that fails is adjusted before it ships, not after an audit.
 *
 * Two rules are absolute, because they're the ones the blueprint respects by
 * convention and nothing else enforced:
 *   • `accent` is never body text  (4.0:1 — that's what `accentInk` is for)
 *   • `muted2` is never below 14px semibold
 *
 * Run: pnpm --filter @loro/design-tokens check:contrast
 */

import { loadTokens } from './tokens.js'
import { createContrastReport } from './contrast.js'

function main(): void {
  const t = loadTokens()
  const report = createContrastReport(t)

  // ── Report ──
  console.log(
    `contrast: ${report.checked} pairings checked across ${report.accentThemes.length} accent themes`,
  )

  if (!report.passed) {
    console.error(`\n${report.violations.length} violation(s):\n`)
    for (const v of report.violations) {
      console.error(`  ${v.pair}`)
      console.error(`    got ${v.got}:1, need ${v.need}:1${v.note ? `  (${v.note})` : ''}`)
    }
    console.error('\nFix the token, or move the usage to a larger text size.')
    console.error('See docs/architecture/accessibility.md#contrast-audit\n')
    process.exit(1)
  }

  console.log('all pairings pass WCAG 2.2 AA')

  if (report.constraints.length > 0) {
    console.log(
      '\nconstraints the UI must honour (these tokens pass only at a declared size floor):',
    )
    for (const c of report.constraints) console.log(`  · ${c}`)
  }
}

main()
