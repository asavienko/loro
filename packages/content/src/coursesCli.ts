/**
 * `pnpm --filter @loro/content build:courses` (plan 112): compiles the course writer's shards into
 * `v2/courses.compiled.json`, the file the API seeds them from. Run it after `author:run`; the
 * content tests fail while the two differ. Says what it published and what it held, and why.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { compileCourses } from './courses.js'
import { contentRoot } from './fs.js'
import { V2_NATIVES } from './v2.js'

const root = join(contentRoot, 'v2')
const compiled = compileCourses(root, V2_NATIVES)
writeFileSync(join(root, 'courses.compiled.json'), `${JSON.stringify(compiled, null, 2)}\n`)

const out = (line: string) => process.stdout.write(`${line}\n`)
const perCourse = new Map<string, number>()
for (const set of compiled.sets)
  perCourse.set(set.targetLang, (perCourse.get(set.targetLang) ?? 0) + 1)
out(
  `v2/courses.compiled.json ${compiled.version}: ${compiled.sets.length} sets, ${compiled.phrases.length} phrases`,
)
for (const [course, count] of perCourse) out(`  ${course}: ${count} sets published`)
for (const held of compiled.held) out(`  held ${held.id}: ${held.reason}`)
