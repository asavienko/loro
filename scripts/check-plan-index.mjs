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

/** Archived `NN-*.md` files still occupy their IDs — numbers are never reused. */
export function discoverArchivedIds(plansDirectory) {
  const ids = new Set()
  const archiveRoot = join(plansDirectory, 'archive')
  const stack = [archiveRoot]
  while (stack.length > 0) {
    const current = stack.pop()
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) stack.push(path)
      else if (entry.isFile() && PLAN_FILE.test(entry.name)) {
        ids.add(Number(entry.name.match(PLAN_FILE)?.[1]))
      }
    }
  }
  return [...ids].sort((left, right) => left - right)
}

export function discoverAssignedIds(plansDirectory) {
  const ids = new Set([
    ...discoverTopLevelPlans(plansDirectory).map((plan) => plan.id),
    ...discoverArchivedIds(plansDirectory),
  ])
  return [...ids].sort((left, right) => left - right)
}

export function hasRowForPlan(readme, fileName) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const row = new RegExp(`^\\|\\s*\\[[^\\]]+\\]\\((?:[^)]*/)?${escaped}\\)`, 'm')
  return row.test(readme)
}

export function documentedCollision(readme, id) {
  if (id === undefined) return COLLISION_NOTE.test(readme)
  const idPattern = new RegExp(`\\b${id}s?\\b`)
  const lines = readme.split('\n')
  return lines.some((line, index) => {
    if (!COLLISION_NOTE.test(line)) return false
    const window = lines.slice(index, index + 3).join('\n')
    return idPattern.test(window)
  })
}

export function planIndexErrors({
  plans,
  readme,
  assignedIds = plans.map((plan) => plan.id),
  archivedIds = [],
}) {
  const errors = []
  if (plans.length === 0) {
    errors.push('No top-level plans/NN-*.md files found')
    return errors
  }
  const highest = Math.max(...assignedIds, ...plans.map((plan) => plan.id))
  const expectedNext = highest + 1
  const nextMatch = readme.match(NEXT_IS)
  if (nextMatch === null)
    errors.push('README is missing a “next is N” / “next new plan is N” sentence')
  else if (Number(nextMatch[1]) !== expectedNext) {
    errors.push(
      `README “next is ${nextMatch[1]}” must be ${expectedNext} (highest ID ${highest} + 1)`,
    )
  }
  const highestMatch = readme.match(HIGHEST_IS)
  if (highestMatch !== null && Number(highestMatch[1]) !== highest) {
    errors.push(
      `README highest assigned ID ${highestMatch[1]} does not match assigned max ${highest}`,
    )
  }
  const archived = new Set(archivedIds)
  const byId = new Map()
  for (const plan of plans) {
    if (!hasRowForPlan(readme, plan.name)) {
      errors.push(`Top-level plan has no README row: ${plan.name}`)
    }
    if (archived.has(plan.id) && !documentedCollision(readme, plan.id)) {
      errors.push(
        `Top-level plan ${plan.name} reuses archived ID ${plan.id} — numbers are never reused`,
      )
    }
    const group = byId.get(plan.id) ?? []
    group.push(plan.name)
    byId.set(plan.id, group)
  }
  for (const [id, names] of byId) {
    if (names.length < 2) continue
    if (!documentedCollision(readme, id)) {
      errors.push(
        `Duplicate plan ID ${id} (${names.join(', ')}) needs a README collision note naming ${id} and a row for every file`,
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
  const plansDirectory = join(root, 'plans')
  const readme = readFileSync(join(root, 'plans/README.md'), 'utf8')
  return planIndexErrors({
    plans: discoverTopLevelPlans(plansDirectory),
    assignedIds: discoverAssignedIds(plansDirectory),
    archivedIds: discoverArchivedIds(plansDirectory),
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
