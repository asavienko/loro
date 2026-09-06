import { readFileSync, writeFileSync } from 'node:fs'
import { serializeOpenApi } from './openapi.js'
const checking = process.argv.includes('--check')
for (const kind of ['current', 'target'] as const) {
  const output = new URL(`../../../../docs/architecture/openapi.${kind}.json`, import.meta.url)
  const generated = serializeOpenApi(kind)
  if (checking) {
    if (readFileSync(output, 'utf8') !== generated)
      throw new Error(`${output.pathname} drifted: run pnpm contracts:generate`)
  } else writeFileSync(output, generated)
}
