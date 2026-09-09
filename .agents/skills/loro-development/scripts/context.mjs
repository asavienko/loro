#!/usr/bin/env node
// Read-only local context. No network, package installation or environment-value reads.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const usage = 'Usage: node context.mjs [--full] [filename-keyword]\n'
const full = args.includes('--full')
const keywords = args.filter((arg) => !arg.startsWith('--'))
if (args.length === 1 && args[0] === '--help') {
  process.stdout.write(
    `${usage}Compact checkout summary by default; --full adds setup, worktrees and plan inventory.\nReads the skill checkout, from any working directory. No mutations or network calls.\n`,
  )
  process.exit(0)
}
if (
  keywords.length > 1 ||
  args.filter((arg) => arg === '--full').length > 1 ||
  args.some((arg) => arg.startsWith('--') && arg !== '--full')
) {
  process.stderr.write(usage)
  process.exit(2)
}

const skillDir = dirname(fileURLToPath(import.meta.url))
function git(cwd, ...gitArgs) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' }
  delete env.GIT_DIR
  delete env.GIT_WORK_TREE
  delete env.GIT_INDEX_FILE
  return execFileSync('git', ['-C', cwd, ...gitArgs], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  }).trimEnd()
}

function parseWorktrees(raw) {
  const trees = []
  let current = {}
  for (const line of `${raw}\n`.split('\n')) {
    if (line.startsWith('worktree ')) current = { path: line.slice(9) }
    else if (line.startsWith('HEAD ')) current.head = line.slice(5, 17)
    else if (line.startsWith('branch '))
      current.branch = line.slice(7).replace(/^refs\/heads\//, '')
    else if (line === '' && current.path) {
      trees.push(current)
      current = {}
    }
  }
  return trees
}

function worktreeLabel(path, root) {
  if (path === root) return 'this'
  return `${basename(dirname(path))}/${basename(path)}`
}

function planFiles(cwd) {
  try {
    const tracked = git(cwd, 'ls-files', '--', 'plans').split('\n').filter(Boolean)
    const others = git(cwd, 'ls-files', '--others', '--exclude-standard', '--', 'plans')
      .split('\n')
      .filter(Boolean)
    return [
      ...tracked.map((file) => ({ file, untracked: false })),
      ...others.map((file) => ({ file, untracked: true })),
    ]
  } catch {
    return []
  }
}

function planId(file) {
  const match = file.match(/(?:^|\/)(\d+)-[^/]+\.md$/)
  return match ? Number(match[1]) : 0
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
    `Node: ${process.versions.node}; ${pkg.packageManager}${process.versions.node.split('.')[0] === '22' ? '' : ' — use Node 22 before pnpm'}`,
  )
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
  const limit = full ? 16 : 6
  changes.slice(0, limit).forEach((line) => say(`  ${line}`))
  if (changes.length > limit)
    say(`  ... ${changes.length - limit} more status entries; inspect git status`)

  let trees = []
  try {
    trees = parseWorktrees(git(root, 'worktree', 'list', '--porcelain'))
  } catch {
    trees = []
  }
  const files = full || keywords.length ? git(root, 'ls-files').split('\n') : []
  if (full) {
    if (trees.length) say(`Git worktrees: ${trees.length} including this checkout`)
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

    const plans = files.filter((file) => /^plans\/(?:.*\/)?\d+-[^/]+\.md$/.test(file))
    const highest = Math.max(0, ...plans.map((file) => Number(file.match(/\/(\d+)-[^/]+\.md$/)[1])))
    say(
      `\nHighest tracked plan ID, including archive: ${highest || 'none'} (not a reservation; check untracked/concurrent plans).`,
    )
    if (trees.length) {
      const listLimit = 12
      say('Sibling checkouts (presence is not unique unmerged work):')
      const ordered = [
        ...trees.filter((tree) => tree.path === root),
        ...trees.filter((tree) => tree.path !== root),
      ]
      ordered.slice(0, listLimit).forEach((tree) => {
        const branch = tree.branch || 'detached'
        say(`  ${branch} ${tree.head || '?'} ${worktreeLabel(tree.path, root)}`)
      })
      if (ordered.length > listLimit)
        say(`  ... ${ordered.length - listLimit} more; git worktree list`)
    }
    const extras = []
    const seen = new Set()
    for (const tree of trees) {
      if (tree.path === root) continue
      for (const entry of planFiles(tree.path)) {
        const id = planId(entry.file)
        if (!id || id < highest) continue
        const key = `${id}\0${tree.branch || 'detached'}\0${entry.file}`
        if (seen.has(key)) continue
        seen.add(key)
        extras.push(
          `${id} ${tree.branch || 'detached'} ${entry.file}${entry.untracked ? ' untracked' : ''}`,
        )
      }
    }
    for (const entry of planFiles(root)) {
      if (!entry.untracked) continue
      const id = planId(entry.file)
      if (!id) continue
      extras.push(`${id} this-checkout ${entry.file} untracked`)
    }
    if (extras.length) {
      say('Plan IDs from other worktrees or untracked files (not a reservation):')
      extras.slice(0, 8).forEach((line) => say(`  ${line}`))
      if (extras.length > 8) say(`  ... ${extras.length - 8} more; inspect git worktree list`)
    }
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
  }

  if (keywords.length) {
    const keyword = keywords[0].toLowerCase()
    const matches = files.filter(
      (file) => !file.startsWith('design/') && file.toLowerCase().includes(keyword),
    )
    say(`\nTracked filename matches for ${JSON.stringify(keywords[0])}: ${matches.length}`)
    matches.slice(0, 16).forEach((file) => say(`  ${file}`))
    if (matches.length > 16) say('  ... narrow the keyword or use rg in the owning directory')
  }
  if (!full) say('More: --full for setup/plans/worktrees; [filename-keyword] for tracked paths.')
} catch (error) {
  process.stderr.write(`Loro context failed: ${error.message.split('\n')[0]}\n`)
  process.exitCode = 1
}
