/** F-03: top-level plan files, README rows, and “next is N” cannot drift. */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PLAN_FILE = /^(\d+)-.+\.md$/
const NEXT_IS = /next(?: new plan(?: number)?)? is\s+\*?\*?(\d+)/i
const HIGHEST_IS = /highest assigned ID is\s+\*?\*?(\d+)/i
const COLLISION_NOTE = /collision|collides/i

export function discoverTopLevelPlans(plansDirectory) {
  return readdirSync(plansDirectory)
    .filter((name) => PLAN_FILE.test(name))
    .sort()
    .map((name) => ({
      name,
      id: Number(name.match(PLAN_FILE)?.[1]),
    }))
}

export function hasRowForPlan(readme, fileName) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const row = new RegExp(
    `^\\|\\s*\\[[^\\]]+\\]\\((?:[^)]*/)?${escaped}\\)`,
    'm',
  )
  return row.test(readme)
}

export function documentedCollision(readme) {
  return COLLISION_NOTE.test(readme)
}

export function planIndexErrors({ plans, readme }) {
  const errors = []
  if (plans.length === 0) {
    errors.push('No top-level plans/NN-*.md files found')
    return errors
  }
  const highest = Math.max(...plans.map((plan) => plan.id))
  const expectedNext = highest + 1
  const nextMatch = readme.match(NEXT_IS)
  if (nextMatch === null) errors.push('README is missing a “next is N” / “next new plan is N” sentence')
  else if (Number(nextMatch[1]) !== expectedNext) {
    errors.push(`README “next is ${nextMatch[1]}” must be ${expectedNext} (highest ID ${highest} + 1)`)
  }
  const highestMatch = readme.match(HIGHEST_IS)
  if (highestMatch !== null && Number(highestMatch[1]) !== highest) {
    errors.push(`README highest assigned ID ${highestMatch[1]} does not match top-level max ${highest}`)
  }
  const byId = new Map()
  for (const plan of plans) {
    if (!hasRowForPlan(readme, plan.name)) {
      errors.push(`Top-level plan has no README row: ${plan.name}`)
    }
    const group = byId.get(plan.id) ?? []
    group.push(plan.name)
    byId.set(plan.id, group)
  }
  for (const [id, names] of byId) {
    if (names.length < 2) continue
    if (!documentedCollision(readme)) {
      errors.push(
        `Duplicate plan ID ${id} (${names.join(', ')}) needs a README collision note and a row for every file`,
      )
    }
    for (const name of names) {
      if (!hasRowForPlan(readme, name)) {
        errors.push(`Colliding plan ${name} has no README row`)
      }
    }
  }
  return errors
}

export function checkPlanIndex(root = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  const readme = readFileSync(join(root, 'plans/README.md'), 'utf8')
  return planIndexErrors({
    plans: discoverTopLevelPlans(join(root, 'plans')),
    readme,
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const errors = checkPlanIndex()
  if (errors.length) {
    console.error(errors.join('\n'))
    process.exitCode = 1
  } else console.log('Plan index verified: top-level files, README rows, and next-ID agree.')
}
