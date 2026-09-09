import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export default async function setup(config) {
  const runDir = config.metadata.screenshotRunDir
  const directory = dirname(fileURLToPath(import.meta.url))
  const repository = resolve(directory, '../../..')

  mkdirSync(join(runDir, 'images'), { recursive: true })
  mkdirSync(join(runDir, 'diagnostics'), { recursive: true })

  try {
    execFileSync(process.execPath, ['scripts/check-routes.mjs'], { cwd: repository, stdio: 'pipe' })
    const states = JSON.parse(
      execFileSync(process.execPath, ['scripts/list-e2e-states.mjs'], {
        cwd: repository,
        encoding: 'utf8',
      }),
    )
    writeManifest(runDir, {
      version: 1,
      status: 'running',
      run: {
        startedAt: new Date().toISOString(),
        fixedTime: '2026-09-09T10:00:00 Europe/Madrid',
        revision: git(repository, ['rev-parse', 'HEAD']),
        dirty: git(repository, ['status', '--porcelain']).length > 0,
        viewport: { width: 390, height: 844 },
      },
      states: states.map((state) => ({
        name: state.name,
        route: state.route,
        spec: state.spec,
        image: `images/${filenameFor(state.name)}`,
        status: 'not-run',
      })),
    })
  } catch (error) {
    writeManifest(runDir, {
      version: 1,
      status: 'failed',
      run: { startedAt: new Date().toISOString() },
      states: [],
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function filenameFor(name) {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72)
  let hash = 2166136261
  for (const char of name) hash = Math.imul(hash ^ char.codePointAt(0), 16777619)
  return `${slug || 'state'}-${(hash >>> 0).toString(16).padStart(8, '0')}.png`
}

function writeManifest(runDir, manifest) {
  writeFileSync(join(runDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}
