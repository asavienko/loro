/* global require, module, __dirname */
/* eslint-disable @typescript-eslint/no-require-imports */
// Metro config for the monorepo.
//
// Two things Metro needs that the defaults don't give us:
//
//  1. WORKSPACE ROOTS — packages/* live outside apps/mobile, so Metro has to watch
//     the repo root and resolve from the root node_modules that pnpm links into.
//
//  2. NodeNext '.js' SPECIFIERS — packages/core is authored for `moduleResolution:
//     nodenext`, so its relative imports carry a `.js` extension that points at a
//     `.ts` file. Node and tsc understand that; Metro doesn't. The resolver below
//     strips the extension for OUR packages only, leaving real .js deps untouched.

const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
// Native and Rust build products are large, rapidly changing trees, never JS inputs.
// Keeping them out also prevents native compilation from triggering learner-page reloads.
const escapePath = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const existingBlocks = config.resolver.blockList ?? []
config.resolver.blockList = [
  ...(Array.isArray(existingBlocks) ? existingBlocks : [existingBlocks]),
  new RegExp(`^${escapePath(path.join(workspaceRoot, 'packages/core-rs/target'))}[/\\\\]`),
  new RegExp(`^${escapePath(projectRoot)}[/\\\\](?:android|ios)[/\\\\]`),
  new RegExp(`^${escapePath(projectRoot)}[/\\\\]modules[/\\\\][^/\\\\]+[/\\\\]build[/\\\\]`),
  /[\\/](?:\.storybook)[\\/]/,
  /\.(?:test|spec|stories)\.[cm]?[jt]sx?$/,
]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
// pnpm's isolated layout means a package can only be reached through its own links.
config.resolver.disableHierarchicalLookup = true

const defaultResolveRequest = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest

  // Learner Metro must not follow Storybook/Vitest into Vite's Node runner.
  if (
    moduleName === 'vite' ||
    moduleName === 'vitest' ||
    moduleName.startsWith('vite/') ||
    moduleName.startsWith('vitest/') ||
    moduleName.startsWith('@storybook/')
  )
    return { type: 'empty' }

  // sql.js embeds an offline asm.js SQLite build. Its Node-only branches are never
  // evaluated in the browser; do not ask Metro to bundle native Node builtins there.
  if (
    platform === 'web' &&
    (context.originModulePath ?? '').includes(`${path.sep}sql.js${path.sep}`) &&
    (moduleName === 'node:fs' || moduleName === 'node:crypto')
  )
    return { type: 'empty' }

  // Relative '.js' specifier from inside a workspace package -> try the extensionless
  // form first, so Metro picks up the .ts/.tsx source.
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    const origin = context.originModulePath ?? ''
    if (origin.includes(`${path.sep}packages${path.sep}`)) {
      try {
        return resolve(context, moduleName.slice(0, -3), platform)
      } catch {
        // Fall through — it really was a .js file.
      }
    }
  }

  return resolve(context, moduleName, platform)
}

module.exports = config
