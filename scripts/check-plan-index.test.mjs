import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  checkPlanIndex,
  discoverAssignedIds,
  discoverTopLevelPlans,
  hasRowForPlan,
  planIndexErrors,
} from './check-plan-index.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readme = readFileSync(join(root, 'plans/README.md'), 'utf8')

test('the working tree index matches top-level plans and next is highest assigned+1', () => {
  assert.deepEqual(checkPlanIndex(root), [])
  const topLevel = discoverTopLevelPlans(join(root, 'plans')).map((plan) => plan.id)
  const assigned = discoverAssignedIds(join(root, 'plans'))
  assert.ok(topLevel.includes(99), 'plan 99 listen companion must stay top-level')
  assert.ok(assigned.includes(100), 'plan 100 hygiene still occupies ID 100 after archive')
  assert.equal(Math.max(...assigned) + 1, 101)
})

test('two 96 rows still pass when the collision is documented', () => {
  assert.equal(hasRowForPlan(readme, '96-phrase-music-generation.md'), true)
  assert.equal(hasRowForPlan(readme, '96-account-sign-in-screens.md'), true)
  assert.match(readme, /collision/i)
})

test('removing a remaining top-level row from a copy of README fails', () => {
  const stripped = readme.replace(/\| \[99\]\(99-batch-phrase-audio-export\.md\).*\n/, '')
  const errors = planIndexErrors({
    plans: discoverTopLevelPlans(join(root, 'plans')),
    assignedIds: discoverAssignedIds(join(root, 'plans')),
    readme: stripped,
  })
  assert.ok(
    errors.some((error) => error.includes('Top-level plan has no README row: 99-batch-phrase-audio-export.md')),
    errors.join('\n'),
  )
})

test('“next is 101” is required while 100 is the highest assigned ID', () => {
  const lagged = readme.replace('next new plan is **101**', 'next new plan is **100**')
  const errors = planIndexErrors({
    plans: discoverTopLevelPlans(join(root, 'plans')),
    assignedIds: discoverAssignedIds(join(root, 'plans')),
    readme: lagged,
  })
  assert.ok(errors.some((error) => error.includes('next is 100')), errors.join('\n'))
})

test('duplicate top-level IDs fail without a collision note and pass with one', () => {
  const directory = mkdtempSync(join(tmpdir(), 'loro-plans-'))
  try {
    writeFileSync(join(directory, '96-one.md'), '# one\n')
    writeFileSync(join(directory, '96-two.md'), '# two\n')
    const plans = discoverTopLevelPlans(directory)
    const bare = planIndexErrors({
      plans,
      readme: 'The highest assigned ID is **96** and the next new plan is **97**.\n',
    })
    assert.ok(bare.some((error) => error.includes('Duplicate plan ID 96')), bare.join('\n'))
    const documented = planIndexErrors({
      plans,
      readme: `Number collision (unresolved): two 96s.
The highest assigned ID is **96** and the next new plan is **97**.
| [96](96-one.md) | one |
| [96](96-two.md) | two |
`,
    })
    assert.deepEqual(documented, [])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
