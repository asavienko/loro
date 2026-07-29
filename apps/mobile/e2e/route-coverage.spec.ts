import { readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { expect, test } from './fixtures'

const coveredRoutes = [
  '/',
  '/add',
  '/onboarding',
  '/phrase/[id]',
  '/practice/refrain',
  '/practice/stream',
  '/progress',
]

test('every implemented Expo route has an E2E owner', () => {
  expect(discoverRoutes(join(process.cwd(), 'app'))).toEqual(coveredRoutes)
})

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

function visit(directory: string, files: string[]): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) visit(path, files)
    else files.push(path)
  }
}
