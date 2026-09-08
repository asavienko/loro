/**
 * The coverage contract: no route, and no STATE, escapes the suite.
 *
 * This file used to check one thing — that every route file in `app/` appeared in a
 * hand-kept list. That caught a new screen landing untested, and it could not catch the
 * thing that actually happened: `add` was "covered" while its tagging sheet, which holds
 * three radios and a submit, had never been rendered by any spec. A route is a file. The
 * unit of behaviour is a state.
 *
 * So the manifest is now `e2e/states.ts`, and this asserts three properties of it:
 *
 *   1. Every route on disk has at least one state. A new screen still cannot land silently.
 *   2. Every state's route exists on disk, so a deleted screen cannot leave a stale entry
 *      that quietly stops being exercised.
 *   3. Every state names the `functional-spec.md` section it comes from — which makes a
 *      state with no home in the spec visible as exactly that, rather than as one more row.
 *
 * The manifest is consumed by `accessibility.spec.ts` and `text-scale.spec.ts`, so a state
 * added here is audited by both without touching either.
 *
 * See plans/51-extended-e2e-strategy.md §6.
 */

import { readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { expect, test } from './fixtures'
import { STATES } from './states'

test('every implemented Expo route has at least one state in the manifest', () => {
  const onDisk = discoverLearnerRoutes(join(process.cwd(), 'app'))
  const declared = [...new Set(STATES.map((s) => s.route))].sort()

  expect(
    onDisk.filter((route) => !declared.includes(route)),
    'routes with no state',
  ).toEqual([])
  expect(
    declared.filter((route) => !onDisk.includes(route)),
    'states for absent routes',
  ).toEqual([])
})

test('developer routes are outside the learner-state coverage contract', () => {
  const appDirectory = join(process.cwd(), 'app')

  expect(discoverRoutes(appDirectory)).toContain('/dev/tokens')
  expect(discoverLearnerRoutes(appDirectory)).not.toContain('/dev/tokens')
  expect(isLearnerRoute('/dev')).toBe(false)
  expect(isLearnerRoute('/dev/tokens')).toBe(false)
  expect(isLearnerRoute('/device')).toBe(true)
})

test('every state names the spec section it comes from, and is named once', () => {
  expect(
    STATES.filter((s) => s.spec.trim().length === 0).map((s) => s.name),
    'states with no functional-spec section',
  ).toEqual([])

  const seen = new Set<string>()
  const duplicates = STATES.map((s) => s.name).filter((name) => {
    const repeated = seen.has(name)
    seen.add(name)
    return repeated
  })
  expect(duplicates, 'state names must be unique — they become test titles').toEqual([])
})

function discoverLearnerRoutes(appDirectory: string): string[] {
  return discoverRoutes(appDirectory).filter(isLearnerRoute)
}

function discoverRoutes(appDirectory: string): string[] {
  const files: string[] = []
  visit(appDirectory, files)

  return files
    .filter((file) => file.endsWith('.tsx') && !file.endsWith(`${sep}_layout.tsx`))
    .map((file) => {
      const route = relative(appDirectory, file)
        .split(sep)
        .join('/')
        .replace(/\.tsx$/, '')
        .replace(/(^|\/)index$/, '')
      return route.length === 0 ? '/' : `/${route}`
    })
    .sort()
}

function isLearnerRoute(route: string): boolean {
  return route !== '/dev' && !route.startsWith('/dev/') && !route.startsWith('/+')
}

function visit(directory: string, files: string[]): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) visit(path, files)
    else files.push(path)
  }
}
