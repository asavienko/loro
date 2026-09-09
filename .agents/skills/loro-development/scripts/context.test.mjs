import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const source = join(dirname(fileURLToPath(import.meta.url)), 'context.mjs')
const relativeScript = '.agents/skills/loro-development/scripts/context.mjs'
const git = (root, ...args) =>
  execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trimEnd()

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'loro-context-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  function write(path, text) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  write(relativeScript, readFileSync(source))
  write(
    'package.json',
    JSON.stringify({ name: 'loro', packageManager: 'pnpm@9.12.0', scripts: { check: 'true' } }),
  )
  write('plans/archive/2026-09-09/98-complete.md', 'Archived')
  write('plans/99-next.md', 'Active')
  write('.gitignore', '.env\nnode_modules/\n')
  write('.env', 'CONTEXT_TEST_SECRET=do-not-print-this-value\n')
  mkdirSync(join(root, 'apps/mobile'), { recursive: true })
  git(root, 'init', '--quiet', '--initial-branch=main')
  git(root, 'add', '.')
  git(
    root,
    '-c',
    'user.name=Context Test',
    '-c',
    'user.email=context@example.invalid',
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '--quiet',
    '-m',
    'fixture',
  )
  return { root, write, script: join(root, relativeScript) }
}

function run(script, args = [], cwd = dirname(script)) {
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' })
}

test('compact/full modes are read-only and work from nested or unrelated checkouts', (t) => {
  const f = fixture(t)
  const other = fixture(t)
  git(f.root, 'update-ref', 'refs/remotes/origin/main', 'HEAD')
  const status = git(f.root, 'status', '--porcelain=v1')
  const index = readFileSync(join(f.root, '.git/index'))
  const compact = run(f.script, [], f.root)
  const full = run(f.script, ['--full'])
  assert.equal(compact.status, 0)
  assert.equal(full.status, 0)
  assert.equal(run(f.script, [], join(f.root, 'apps/mobile')).stdout, compact.stdout)
  assert.equal(run(f.script, [], other.root).stdout, compact.stdout)
  assert.ok(compact.stdout.length < full.stdout.length / 2)
  assert.ok(full.stdout.includes('Highest tracked plan ID, including archive: 99'))
  assert.ok(full.stdout.includes('Cached origin/main:'))
  assert.ok(!full.stdout.includes('do-not-print-this-value'))
  assert.equal(git(f.root, 'status', '--porcelain=v1'), status)
  assert.deepEqual(readFileSync(join(f.root, '.git/index')), index)
})

test('filename lookup includes archive paths, stays bounded and composes with full mode', (t) => {
  const f = fixture(t)
  for (let i = 0; i < 20; i++) f.write(`apps/mobile/needle-${i}.ts`, '')
  f.write('design/needle.html', '')
  git(f.root, 'add', '.')
  const result = run(f.script, ['needle'])
  assert.equal(result.status, 0)
  assert.ok(result.stdout.includes('filename matches for "needle": 20'))
  assert.ok(!result.stdout.includes('design/needle.html'))
  assert.equal(
    result.stdout.split('\n').filter((line) => /^  apps\/mobile\/needle-/.test(line)).length,
    16,
  )
  assert.ok(result.stdout.includes('more status entries'))
  assert.ok(
    run(f.script, ['--full', '98-']).stdout.includes('plans/archive/2026-09-09/98-complete.md'),
  )
  assert.equal(run(f.script, ['98-', '--full']).stdout, run(f.script, ['--full', '98-']).stdout)
})

test('full mode lists sibling worktrees and extra plan ids without mutating them', (t) => {
  const f = fixture(t)
  git(f.root, 'update-ref', 'refs/remotes/origin/main', 'HEAD')
  const other = join(f.root, '..', `loro-context-wt-${process.pid}`)
  t.after(() => {
    try {
      git(f.root, 'worktree', 'remove', '--force', other)
    } catch {
      rmSync(other, { recursive: true, force: true })
    }
  })
  git(f.root, 'worktree', 'add', '--quiet', '--detach', other)
  mkdirSync(join(other, 'plans'), { recursive: true })
  writeFileSync(join(other, 'plans/99-other.md'), 'Same-ID collision\n')
  writeFileSync(join(other, 'plans/100-extra.md'), 'Concurrent allocation\n')
  const compact = run(f.script, [])
  const full = run(f.script, ['--full'])
  const status = git(other, 'status', '--porcelain=v1')
  assert.equal(compact.status, 0)
  assert.equal(full.status, 0)
  assert.doesNotMatch(compact.stdout, /Git worktrees:/)
  assert.match(full.stdout, /Git worktrees: 2 including this checkout/)
  assert.match(full.stdout, /Sibling checkouts/)
  assert.match(full.stdout, /99 .*plans\/99-other\.md untracked/)
  assert.match(full.stdout, /100 .*plans\/100-extra\.md untracked/)
  assert.equal(git(other, 'status', '--porcelain=v1'), status)
})

test('detached checkout without cached remote or dependencies is reported without setup', (t) => {
  const f = fixture(t)
  git(f.root, 'checkout', '--quiet', '--detach')
  const result = run(f.script)
  assert.equal(result.status, 0)
  assert.ok(result.stdout.includes('(detached)'))
  assert.ok(result.stdout.includes('Cached origin/main: unavailable'))
  assert.ok(result.stdout.includes('pnpm install --frozen-lockfile'))
})

test('invalid options fail and help needs no repository', (t) => {
  const f = fixture(t)
  for (const args of [['--unknown'], ['one', 'two'], ['--full', '--full'], ['--help', 'one']]) {
    const result = run(f.script, args)
    assert.equal(result.status, 2)
    assert.equal(result.stdout, '')
  }
  const standalone = join(f.root, 'standalone.mjs')
  cpSync(f.script, standalone)
  rmSync(join(f.root, '.git'), { recursive: true })
  assert.equal(run(standalone, ['--help']).status, 0)
  assert.equal(run(standalone).status, 1)
})

test('a different project is rejected before displaying repository context', (t) => {
  const f = fixture(t)
  f.write('package.json', '{"name":"another-project"}')
  const result = run(f.script)
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
})
