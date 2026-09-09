/** P1-02/F-03: declared routes, screen files and learner-state owners must agree. */
import { readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export function discoverLearnerRoutes(appDirectory) {
  const routes = []
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name)
      if (entry.isDirectory()) visit(file)
      else if (/\.[jt]sx?$/.test(entry.name) && !/^_layout\.[jt]sx?$/.test(entry.name)) {
        const segments = relative(appDirectory, file)
          .replace(/\.[jt]sx?$/, '')
          .split(/[\\/]/)
          .filter((segment) => !/^\(.+\)$/.test(segment))
        if (segments.some((segment) => segment.startsWith('+')) || segments[0] === 'dev') continue
        if (segments.at(-1) === 'index') segments.pop()
        routes.push(`/${segments.join('/')}`)
      }
    }
  }
  visit(appDirectory)
  return routes.sort()
}

export function routeOwnershipErrors(surfaces, routes, states) {
  const errors = []
  function duplicates(values, description) {
    const seen = new Set()
    for (const value of values) {
      if (seen.has(value)) errors.push(`Duplicate ${description}: ${value}`)
      seen.add(value)
    }
  }
  duplicates(
    surfaces.map((surface) => surface.id),
    'surface id',
  )
  duplicates(
    surfaces.map((surface) => surface.path),
    'surface path',
  )
  duplicates(routes, 'screen route')
  duplicates(
    states.map((state) => state.name),
    'state name',
  )
  for (const surface of surfaces) {
    if (surface.availability === 'built' && !routes.includes(surface.path))
      errors.push(`Built surface has no screen: ${surface.path}`)
    if (surface.availability !== 'built' && routes.includes(surface.path))
      errors.push(`Unbuilt surface has a reachable screen: ${surface.path}`)
  }
  for (const route of routes) {
    if (!surfaces.some((surface) => surface.path === route))
      errors.push(`Screen has no declared surface: ${route}`)
    if (!states.some((state) => state.route === route))
      errors.push(`Screen has no learner-state owner: ${route}`)
  }
  for (const state of states) {
    if (!routes.includes(state.route))
      errors.push(`State has no screen: ${state.name} (${state.route})`)
    if (!state.spec?.trim()) errors.push(`State has no specification owner: ${state.name}`)
  }
  return errors
}

export function checkRoutes(root = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  // Load actual declarations, including generated state rows, without starting Expo or a browser.
  const mobile = join(root, 'apps/mobile')
  const require = createRequire(join(mobile, 'package.json'))
  const { require: requireTypeScript } = require('tsx/cjs/api')
  const { SURFACES } = requireTypeScript(join(mobile, 'src/lib/navigation.ts'), import.meta.url)
  const { STATES } = requireTypeScript(join(mobile, 'e2e/states.ts'), import.meta.url)
  return routeOwnershipErrors(SURFACES, discoverLearnerRoutes(join(mobile, 'app')), STATES)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const errors = checkRoutes()
  if (errors.length) {
    console.error(errors.join('\n'))
    process.exitCode = 1
  } else console.log('Route ownership verified: registry, screens and learner states agree.')
}
