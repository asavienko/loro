import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

test('binding cleanup removes whitespace without changing trailing type names', () => {
  const build = readFileSync(new URL('../packages/core-rs/build.sh', import.meta.url), 'utf8')
  const expression = build.match(/-exec perl -pi -e '([^']+)'/u)?.[1]
  assert.equal(expression, 's/[ \\t]+$//')

  const result = spawnSync('perl', ['-pe', expression], {
    input: 'val size: Int  \nreturn result\t\nlet bytes: UInt\n',
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, 'val size: Int\nreturn result\nlet bytes: UInt\n')
})
