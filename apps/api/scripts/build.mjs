#!/usr/bin/env node
/**
 * Production bundle. Distroless Node 22.22 refuses to strip TypeScript under
 * node_modules after `pnpm deploy`. Host smoke still resolves workspace packages
 * to `packages/*` (outside node_modules). Bundle `@loro/core` and `@loro/content`
 * so the image never loads `.ts` from node_modules. Keep npm deps and
 * `@loro/core-rs` external.
 */
import * as esbuild from 'esbuild'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const require = createRequire(join(root, 'package.json'))

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ['src/main.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'external',
  outfile: 'dist/main.js',
  sourcemap: true,
  plugins: [
    {
      name: 'bundle-workspace-typescript',
      setup(build) {
        build.onResolve({ filter: /^@loro\/(core|content)(\/|$)/ }, (args) => ({
          path: require.resolve(args.path, { paths: [args.resolveDir] }),
        }))
      },
    },
  ],
})

const js = readFileSync(join(root, 'dist/main.js'), 'utf8')
if (/from\s+["']@loro\/(core|content)(\/[^"']*)?["']/.test(js)) {
  throw new Error('workspace TypeScript must be bundled into dist/main.js')
}
