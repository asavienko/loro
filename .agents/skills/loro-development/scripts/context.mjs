#!/usr/bin/env node
// Read-only local context. No network, package installation or environment-value reads.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
if (args.length > 1) {
  process.stderr.write('Usage: node context.mjs [filename-keyword]\n')
  process.exit(2)
}
if (args[0] === '--help') {
  process.stdout.write(
    'Usage: node context.mjs [filename-keyword]\nReads the skill checkout, from any working directory. No mutations or network calls.\n',
  )
  process.exit(0)
}

const skillDir = dirname(fileURLToPath(import.meta.url))
function git(cwd, ...gitArgs) {
  return execFileSync('git', ['-C', cwd, ...gitArgs], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  }).trimEnd()
}

try {
  const root = git(skillDir, 'rev-parse', '--show-toplevel')
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  if (pkg.name !== 'loro') throw new Error('This helper requires a Loro checkout.')
  const say = (value = '') => process.stdout.write(`${value}\n`)
  say(`Repository: ${root}`)
  say(
    `HEAD: ${git(root, 'rev-parse', '--short=12', 'HEAD')} (${git(root, 'branch', '--show-current') || 'detached'})`,
  )
  say(
    `Node: ${process.versions.node}${process.versions.node.split('.')[0] === '22' ? '' : ' — use Node 22 before pnpm'}`,
  )
  say(`Package manager: ${pkg.packageManager}`)
  say(
    `Dependencies: ${existsSync(join(root, 'node_modules/.modules.yaml')) ? 'installed directory present; versions not verified' : 'install required: pnpm install --frozen-lockfile'}`,
  )

  try {
    const base = git(root, 'rev-parse', '--short=12', 'origin/main')
    const [behind, ahead] = git(
      root,
      'rev-list',
      '--left-right',
      '--count',
      'origin/main...HEAD',
    ).split(/\s+/)
    say(
      `Cached origin/main: ${base}; behind ${behind}, ahead ${ahead}. Fetch separately for live remote state.`,
    )
  } catch {
    say('Cached origin/main: unavailable. Inspect remotes when integration is needed.')
  }

  const status = git(root, 'status', '--short')
  const changes = status ? status.split('\n') : []
  say(`Worktree: ${changes.length ? 'changes present' : 'clean'}`)
  changes.slice(0, 16).forEach((line) => say(`  ${line}`))
  if (changes.length > 16)
    say(`  ... ${changes.length - 16} more status entries; inspect git status`)

  say('\nAvailable package scripts:')
  const wanted = [
    'check',
    'ci:local',
    'ci:local:native',
    'ci:local:audit',
    'test:e2e',
    'test:e2e:workbench',
    'test:e2e:bundle',
    'core-rs:build',
    'tokens:build',
    'contracts:generate',
    'local:up',
    'apk:local',
    'apk:github',
  ]
  say(`  ${wanted.filter((name) => pkg.scripts?.[name]).join(', ')}`)
  const missing = wanted.filter((name) => !pkg.scripts?.[name])
  if (missing.length) say(`  Missing in this checkout: ${missing.join(', ')}`)
  say('  Read scripts before running them; availability is not authorization or validation.')

  const files = git(root, 'ls-files').split('\n')
  const plans = files.filter((file) => /^plans\/(?:.*\/)?\d+-[^/]+\.md$/.test(file))
  const highest = Math.max(0, ...plans.map((file) => Number(file.match(/\/(\d+)-[^/]+\.md$/)[1])))
  say(
    `\nHighest tracked plan ID, including archive: ${highest || 'none'} (not a reservation; check untracked/concurrent plans).`,
  )
  say('Runtime source directories (presence does not prove wiring or device acceptance):')
  for (const path of [
    'apps/mobile/src/data',
    'apps/mobile/modules',
    'apps/mobile/ios',
    'apps/mobile/android',
    'apps/api/src/auth',
    'apps/api/src/sync',
  ]) {
    say(`  ${path}: ${existsSync(join(root, path)) ? 'present' : 'absent'}`)
  }
  say(
    `Generated WASM: ${existsSync(join(root, 'packages/core-rs/pkg/loro_core_bg.wasm')) ? 'present; drift not checked' : 'absent'}`,
  )

  for (const path of ['apps/mobile/expo-env.d.ts', 'apps/mobile/.expo/types/router.d.ts']) {
    say(
      `Expo generated declaration: ${path}: ${existsSync(join(root, path)) ? 'present' : 'absent; see validation reference before mobile typecheck'}`,
    )
  }

  if (args[0]) {
    const keyword = args[0].toLowerCase()
    const matches = files.filter(
      (file) => !file.startsWith('design/') && file.toLowerCase().includes(keyword),
    )
    say(`\nTracked filename matches for ${JSON.stringify(args[0])}: ${matches.length}`)
    matches.slice(0, 16).forEach((file) => say(`  ${file}`))
    if (matches.length > 16) say('  ... narrow the keyword or use rg in the owning directory')
  }
} catch (error) {
  process.stderr.write(`Loro context failed: ${error.message.split('\n')[0]}\n`)
  process.exitCode = 1
}
