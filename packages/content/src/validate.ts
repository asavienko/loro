/**
 * Content validation CLI.
 *
 *   pnpm content:validate
 *   pnpm --filter @loro/content validate --only packs
 *   pnpm --filter @loro/content validate --allow-warn
 *
 * Errors fail the build. Warnings are reported and tolerated — they mark work the
 * content pipeline hasn't done yet (audio not rendered, packs not filled), which is
 * expected while the catalog is being authored.
 */

import { ALL_CHECKS, runChecksForCatalog, type Issue } from './checks.js'
import { loadCatalogFromDisk } from './fs.js'

function parseArgs(argv: string[]): { only: string[]; strict: boolean } {
  const onlyIdx = argv.indexOf('--only')
  const requested = onlyIdx >= 0 ? argv[onlyIdx + 1] : undefined
  const only = requested === undefined ? Object.keys(ALL_CHECKS) : requested.split(',')
  return { only, strict: argv.includes('--strict') }
}

function main(): void {
  const { only, strict } = parseArgs(process.argv.slice(2))
  const catalog = loadCatalogFromDisk()

  let issues: Issue[]
  try {
    issues = runChecksForCatalog(catalog, only)
  } catch (e) {
    console.error(`content: ${(e as Error).message}`)
    console.error(`available checks: ${Object.keys(ALL_CHECKS).join(', ')}`)
    process.exit(2)
    return
  }

  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warn')

  console.log(
    `content: ${catalog.phrases.length} phrases · ${catalog.scenarios.length} scenarios · ` +
      `${catalog.packs.length} packs · ${Object.keys(catalog.drops).length} drop schedules · ` +
      `${catalog.graph.edges.length} graph edges ` +
      `(catalog v${catalog.catalogVersion}, ${only.length} checks)`,
  )

  const report = (list: Issue[], label: string): void => {
    if (list.length === 0) return
    console.log(`\n${label} (${list.length}):`)
    const byCheck = new Map<string, Issue[]>()
    for (const i of list) byCheck.set(i.check, [...(byCheck.get(i.check) ?? []), i])
    for (const [check, group] of [...byCheck].sort()) {
      console.log(`  ${check}:`)
      for (const i of group.slice(0, 12)) {
        console.log(`    ${i.id !== undefined ? `${i.id}: ` : ''}${i.message}`)
      }
      if (group.length > 12) console.log(`    … and ${group.length - 12} more`)
    }
  }

  report(errors, 'errors')
  report(warnings, 'warnings')

  if (errors.length > 0) {
    console.error(`\nFAILED — ${errors.length} error(s).`)
    process.exit(1)
  }
  if (strict && warnings.length > 0) {
    console.error(`\nFAILED — ${warnings.length} warning(s) with --strict`)
    process.exit(1)
  }
  console.log(
    warnings.length > 0
      ? `\nok — ${warnings.length} warning(s), all expected while the catalog is being authored`
      : '\nok',
  )
}

main()
