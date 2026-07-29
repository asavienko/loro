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
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
// pnpm's isolated layout means a package can only be reached through its own links.
config.resolver.disableHierarchicalLookup = true

const defaultResolveRequest = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest

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
