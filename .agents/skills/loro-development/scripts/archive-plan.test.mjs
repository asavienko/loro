import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  archivalDate,
  parseArgs,
  resolveMoves,
  rewriteContent,
  rewriteRepository,
} from './archive-plan.mjs'

const source = join(dirname(fileURLToPath(import.meta.url)), 'archive-plan.mjs')

test('parseArgs and date', () => {
  assert.deepEqual(parseArgs(['--date', '2026-09-09', '--unfinished', '66', '67']), {
    date: '2026-09-09',
    dryRun: false,
    unfinished: true,
    help: false,
    targets: ['66', '67'],
  })
  assert.equal(archivalDate(new Date('2026-09-09T12:00:00')), '2026-09-09')
})

test('resolveMoves maps active ids and rejects archive collisions', () => {
  const files = ['plans/66-backend.md', 'plans/README.md', 'plans/archive/2026-09-09/53-audit.md']
  const moves = resolveMoves(files, ['66'], '2026-09-09')
  assert.equal(
    [...moves][0].join(' -> '),
    'plans/66-backend.md -> plans/archive/2026-09-09/66-backend.md',
  )
  assert.throws(() => resolveMoves(files, ['53'], '2026-09-09'))
  assert.throws(() =>
    resolveMoves(['plans/archive/2026-09-09/66-backend.md'], ['66'], '2026-09-09'),
  )
})

test('rewriteContent rebases outbound, inbound and root paths', () => {
  const moves = new Map([
    ['plans/66-backend.md', 'plans/archive/2026-09-09/66-backend.md'],
    ['plans/67-accounts.md', 'plans/archive/2026-09-09/67-accounts.md'],
  ])
  const moved = rewriteContent({
    content:
      'See [docs](../docs/a.md#x), [peer](67-accounts.md), [done](archive/2026-09-08/89.md), [stay](69-trips.md) and [dir](../output/v2/).\n',
    oldPath: 'plans/66-backend.md',
    newPath: 'plans/archive/2026-09-09/66-backend.md',
    moves,
    unfinished: true,
    date: '2026-09-09',
  })
  assert.match(moved, /\]\(\.\.\/\.\.\/\.\.\/docs\/a\.md#x\)/)
  assert.match(moved, /\]\(67-accounts\.md\)/)
  assert.match(moved, /\]\(\.\.\/2026-09-08\/89\.md\)/)
  assert.match(moved, /\]\(\.\.\/\.\.\/69-trips\.md\)/)
  assert.match(moved, /\]\(\.\.\/\.\.\/\.\.\/output\/v2\/\)/)
  assert.match(moved, /\*\*Archive disposition \(2026-09-09\):\*\*/)

  const inbound = rewriteContent({
    content: 'Owner: [66](../../plans/66-backend.md) and `plans/66-backend.md`.\n',
    oldPath: 'docs/reviews/note.md',
    newPath: 'docs/reviews/note.md',
    moves,
  })
  assert.match(inbound, /\]\(\.\.\/\.\.\/plans\/archive\/2026-09-09\/66-backend\.md\)/)
  assert.match(inbound, /`plans\/archive\/2026-09-09\/66-backend\.md`/)
  assert.doesNotMatch(inbound, /Archive disposition/)
})

test('rewriteRepository writes new paths and leaves unrelated files', () => {
  const moves = new Map([['plans/66-backend.md', 'plans/archive/2026-09-09/66-backend.md']])
  const files = ['plans/66-backend.md', 'plans/README.md', 'docs/a.md']
  const contents = new Map([
    ['plans/66-backend.md', '# 66\n\n[Doc](../docs/a.md)\n\n## Outcome\n'],
    ['plans/README.md', '| [66](66-backend.md) | remaining |\n'],
    ['docs/a.md', 'unchanged\n'],
  ])
  const out = rewriteRepository(files, contents, moves, {
    unfinished: true,
    date: '2026-09-09',
  })
  assert.equal(out.has('plans/66-backend.md'), false)
  assert.ok(out.get('plans/archive/2026-09-09/66-backend.md').includes('../../../docs/a.md'))
  assert.equal(
    out.get('plans/README.md'),
    '| [66](archive/2026-09-09/66-backend.md) | remaining |\n',
  )
  assert.equal(out.has('docs/a.md'), false)
})

test('CLI dry-run and live git mv', () => {
  const root = mkdtempSync(join(tmpdir(), 'loro-archive-'))
  try {
    const script = join(root, '.agents/skills/loro-development/scripts/archive-plan.mjs')
    mkdirSync(dirname(script), { recursive: true })
    writeFileSync(script, readFileSync(source))
    mkdirSync(join(root, 'plans'))
    writeFileSync(join(root, 'plans/66-backend.md'), '# 66\n\n[Doc](../docs/x.md)\n\n## Outcome\n')
    writeFileSync(join(root, 'plans/README.md'), '[66](66-backend.md)\n')
    mkdirSync(join(root, 'docs'), { recursive: true })
    writeFileSync(join(root, 'docs/x.md'), 'doc\n')
    const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' })
    git('init', '--quiet', '--initial-branch=main')
    git('add', '.')
    execFileSync('git', [
      '-C',
      root,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.invalid',
      '-c',
      'core.hooksPath=/dev/null',
      'commit',
      '--quiet',
      '-m',
      'fixture',
    ])
    const dry = spawnSync(process.execPath, [script, '--date', '2026-09-09', '--dry-run', '66'], {
      encoding: 'utf8',
    })
    assert.equal(dry.status, 0)
    assert.match(dry.stdout, /plans\/66-backend.md -> plans\/archive\/2026-09-09\/66-backend.md/)
    const live = spawnSync(
      process.execPath,
      [script, '--date', '2026-09-09', '--unfinished', '66'],
      {
        encoding: 'utf8',
      },
    )
    assert.equal(live.status, 0, live.stderr)
    assert.equal(git('ls-files', 'plans/66-backend.md'), '')
    const archived = readFileSync(join(root, 'plans/archive/2026-09-09/66-backend.md'), 'utf8')
    assert.match(archived, /\]\(\.\.\/\.\.\/\.\.\/docs\/x\.md\)/)
    assert.match(archived, /Archive disposition/)
    assert.equal(
      readFileSync(join(root, 'plans/README.md'), 'utf8'),
      '[66](archive/2026-09-09/66-backend.md)\n',
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
