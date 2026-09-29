import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  checkPlanIndex,
  discoverArchivedIds,
  discoverAssignedIds,
  discoverTopLevelPlans,
  documentedCollision,
  hasRowForPlan,
  planIndexErrors,
} from './check-plan-index.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readme = readFileSync(join(root, 'plans/README.md'), 'utf8')
const nextId = Number(readme.match(/next new plan is \*\*(\d+)\*\*/)?.[1])

test('the working tree index matches top-level plans and next is highest assigned+1', () => {
  assert.deepEqual(checkPlanIndex(root), [])
  const topLevel = discoverTopLevelPlans(join(root, 'plans')).map((plan) => plan.id)
  const assigned = discoverAssignedIds(join(root, 'plans'))
  assert.ok(topLevel.includes(99), 'plan 99 listen companion must stay top-level')
  assert.ok(assigned.includes(100), 'plan 100 hygiene still occupies ID 100 after archive')
  assert.equal(Math.max(...assigned) + 1, nextId)
})

test('two 96 rows still pass when the collision is documented', () => {
  assert.equal(hasRowForPlan(readme, '96-phrase-music-generation.md'), true)
  assert.equal(hasRowForPlan(readme, '96-account-sign-in-screens.md'), true)
  assert.equal(documentedCollision(readme, 96), true)
  assert.equal(hasRowForPlan(readme, '100-ui-design-system.md'), true)
  assert.equal(documentedCollision(readme, 100), true)
})

test('removing a remaining top-level row from a copy of README fails', () => {
  const stripped = readme.replace(/\| \[99\]\(99-batch-phrase-audio-export\.md\).*\n/, '')
  const errors = planIndexErrors({
    plans: discoverTopLevelPlans(join(root, 'plans')),
    assignedIds: discoverAssignedIds(join(root, 'plans')),
    readme: stripped,
  })
  assert.ok(
    errors.some((error) =>
      error.includes('Top-level plan has no README row: 99-batch-phrase-audio-export.md'),
    ),
    errors.join('\n'),
  )
})

test('“next is N” is required while N-1 is the highest assigned ID', () => {
  const lagged = readme.replace(
    `next new plan is **${nextId}**`,
    `next new plan is **${nextId - 1}**`,
  )
  const errors = planIndexErrors({
    plans: discoverTopLevelPlans(join(root, 'plans')),
    assignedIds: discoverAssignedIds(join(root, 'plans')),
    readme: lagged,
  })
  assert.ok(
    errors.some((error) => error.includes(`next is ${nextId - 1}`)),
    errors.join('\n'),
  )
})

test('reusing an archived ID as a new top-level file fails unless that ID is named in a collision note', () => {
  const assigned = discoverAssignedIds(join(root, 'plans'))
  const archived = discoverArchivedIds(join(root, 'plans'))
  assert.ok(archived.includes(100), 'plan 100 must remain archived for this reuse pin')
  // 100 already has a documented collision (hygiene archive vs UI kit). Use a
  // synthetic unused archived ID so this pin still fails without a note.
  const reused = planIndexErrors({
    plans: [...discoverTopLevelPlans(join(root, 'plans')), { name: '50-oops.md', id: 50 }],
    assignedIds: assigned,
    archivedIds: [...archived, 50],
    readme: `${readme}\n| [50](50-oops.md) | oops |\n`,
  })
  assert.ok(
    reused.some((error) => error.includes('reuses archived ID 50')),
    reused.join('\n'),
  )
  const named = planIndexErrors({
    plans: [{ name: '100-oops.md', id: 100 }],
    assignedIds: [100],
    archivedIds: [100],
    readme: `Number collision (unresolved): two 100s.
The highest assigned ID is **100** and the next new plan is **101**.
| [100](100-oops.md) | oops |
`,
  })
  assert.deepEqual(named, [])
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
    assert.ok(
      bare.some((error) => error.includes('Duplicate plan ID 96')),
      bare.join('\n'),
    )
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
