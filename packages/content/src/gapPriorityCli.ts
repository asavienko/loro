/**
 *   pnpm --filter @loro/content gap-priority
 *   pnpm --filter @loro/content gap-priority -- --emit-drafts
 *
 * Prints a generate-queue report. Never writes the catalog.
 */
import { fileURLToPath } from 'node:url'
import { gapPriority } from './gapPriority.js'
import { loadCatalogFromDisk } from './fs.js'

function main(): void {
  const emitDrafts = process.argv.includes('--emit-drafts')
  const report = gapPriority(loadCatalogFromDisk(), { emitDrafts })
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
