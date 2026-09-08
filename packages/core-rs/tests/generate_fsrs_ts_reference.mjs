/**
 * Generate memory-state vectors by executing the pinned official ts-fsrs source.
 *
 * From the repository root, after `nvm use 22` and `pnpm install`:
 *   node packages/core-rs/tests/generate_fsrs_ts_reference.mjs /tmp/fsrs-6-reference.json
 * Omit the output path to write JSON to stdout. Requires Git and network access.
 *
 * Only TypeScript syntax is compiled away; the generator contains no FSRS maths.
 * These vectors exercise upstream next_state with default parameters and short-term
 * updates enabled. They do not specify Loro's stability representation, scheduling
 * policy, confidence mapping, or persisted-field migration.
 *
 * Upstream is MIT licensed, Copyright (c) 2026 Open Spaced Repetition:
 * https://github.com/open-spaced-repetition/ts-fsrs/blob/c8ca282edc3fe1cdfa1c24912437938b63a25cb3/LICENSE
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const source = 'open-spaced-repetition/ts-fsrs'
const revision = 'c8ca282edc3fe1cdfa1c24912437938b63a25cb3'
const destination = process.argv[2]
if (process.argv.length > 3) throw new Error('Expected at most one output file path')

const temporary = mkdtempSync(join(tmpdir(), 'loro-fsrs-reference-'))
const checkout = join(temporary, 'upstream')
const compiled = join(temporary, 'compiled')

function git(...args) {
  return execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim()
}

function compileDirectory(directory, outputDirectory) {
  mkdirSync(outputDirectory, { recursive: true })
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const input = join(directory, entry.name)
    if (entry.isDirectory()) {
      compileDirectory(input, join(outputDirectory, entry.name))
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      const result = ts.transpileModule(readFileSync(input, 'utf8'), {
        fileName: input,
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
        reportDiagnostics: true,
      })
      const errors = result.diagnostics?.filter(
        (item) => item.category === ts.DiagnosticCategory.Error,
      )
      assert.equal(errors?.length ?? 0, 0, `Unable to compile ${input}`)
      writeFileSync(join(outputDirectory, entry.name.replace(/\.ts$/, '.js')), result.outputText)
    }
  }
}

try {
  mkdirSync(checkout)
  git('init', '--quiet')
  git('fetch', '--quiet', '--depth', '1', `https://github.com/${source}.git`, revision)
  git('checkout', '--quiet', '--detach', 'FETCH_HEAD')
  assert.equal(git('rev-parse', 'HEAD'), revision, 'Upstream revision must match the pin')

  const upstreamPackage = join(checkout, 'packages', 'fsrs')
  const manifest = JSON.parse(readFileSync(join(upstreamPackage, 'package.json'), 'utf8'))
  compileDirectory(join(upstreamPackage, 'src'), join(compiled, 'src'))
  // constant.ts imports the upstream version; CommonJS permits its extensionless
  // imports to resolve without changing any algorithm source or requiring a build.
  writeFileSync(join(compiled, 'package.json'), JSON.stringify({ ...manifest, type: 'commonjs' }))
  const require = createRequire(join(compiled, 'load.cjs'))
  const { FSRSAlgorithm } = require(join(compiled, 'src', 'algorithm.js'))
  const algorithm = new FSRSAlgorithm({ enable_fuzz: false, enable_short_term: true })

  const vectors = []
  for (const grade of [1, 2, 3, 4]) {
    vectors.push({
      name: `initial-${grade}`,
      prior: null,
      elapsed: 0,
      grade,
      next: algorithm.next_state(null, 0, grade),
    })
    for (const elapsed of [0, 1, 30, 3650]) {
      const prior = { difficulty: 5, stability: 10 }
      vectors.push({
        name: `review-${elapsed}-${grade}`,
        prior,
        elapsed,
        grade,
        next: algorithm.next_state(prior, elapsed, grade),
      })
    }
  }

  const output = `${JSON.stringify({ source, revision, vectors }, null, 2)}\n`
  if (destination) {
    mkdirSync(dirname(destination), { recursive: true })
    writeFileSync(destination, output)
    process.stderr.write(`Wrote ${vectors.length} upstream reference vectors to ${destination}\n`)
  } else {
    process.stdout.write(output)
  }
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
