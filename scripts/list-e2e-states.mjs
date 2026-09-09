import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repository = resolve(join(fileURLToPath(import.meta.url), '..', '..'))
const mobile = join(repository, 'apps/mobile')
const require = createRequire(join(mobile, 'package.json'))
const { require: requireTypeScript } = require('tsx/cjs/api')
const { STATES } = requireTypeScript(
  join(mobile, 'e2e/states.ts'),
  pathToFileURL(resolve(repository, 'scripts/check-routes.mjs')).href,
)

process.stdout.write(
  `${JSON.stringify(STATES.map(({ name, route, spec }) => ({ name, route, spec })))}\n`,
)
