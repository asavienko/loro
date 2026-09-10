import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { hasListRowCluster, isTextInputExempt, reuseErrors } from './check-reuse.mjs'

test('the working tree has no raw TextInput leftovers or 48/13/hairline clusters', () => {
  assert.deepEqual(reuseErrors(), [])
})

test('Field and test fixtures stay exempt; production files do not', () => {
  assert.equal(isTextInputExempt('src/ui/primitives/Field.tsx'), true)
  assert.equal(isTextInputExempt('src/lib/copyOwnership.test.ts'), true)
  assert.equal(isTextInputExempt('src/dev-tools/Workbench.test.ts'), true)
  assert.equal(isTextInputExempt('app/account.tsx'), false)
  assert.equal(isTextInputExempt('src/dev-tools/Workbench.tsx'), false)
})

test('cluster matcher needs 48 and 13 and hairline together', () => {
  assert.equal(
    hasListRowCluster(`
      const ROW_PADDING = 13
      const row = { minHeight: MIN_TAP, paddingVertical: ROW_PADDING, borderBottomWidth: border.hairline }
    `),
    false,
  )
  assert.equal(
    hasListRowCluster(`
      const ROW_PADDING = 13
      const MIN_ROW_HEIGHT = 48
      const row = { minHeight: MIN_ROW_HEIGHT, paddingVertical: ROW_PADDING, borderBottomWidth: border.hairline }
    `),
    true,
  )
  assert.equal(
    hasListRowCluster(`
      const row = { minHeight: 48, paddingVertical: 13, borderBottomWidth: border.hairline }
    `),
    true,
  )
})

test('a planted raw TextInput and leftover cluster fail; NavigationMenu-shaped 13 is ignored', () => {
  const root = mkdtempSync(join(tmpdir(), 'loro-reuse-'))
  try {
    const app = join(root, 'apps/mobile/app')
    const src = join(root, 'apps/mobile/src/ui/components')
    mkdirSync(app, { recursive: true })
    mkdirSync(src, { recursive: true })
    writeFileSync(
      join(app, 'account.tsx'),
      "import { TextInput } from 'react-native'\nexport const x = TextInput\n",
    )
    writeFileSync(
      join(app, 'settings.tsx'),
      'const row = { minHeight: 48, paddingVertical: 13, borderBottomWidth: border.hairline }\n',
    )
    writeFileSync(
      join(app, 'listen-export.tsx'),
      'const ROW_PADDING = 13\nconst row = { minHeight: MIN_TAP, paddingVertical: ROW_PADDING, borderBottomWidth: border.hairline }\n',
    )
    writeFileSync(
      join(src, 'NavigationMenu.tsx'),
      'const ROW_PADDING = 13\nconst row = { paddingVertical: ROW_PADDING, borderBottomWidth: border.hairline }\n',
    )
    const errors = reuseErrors(root)
    assert.ok(errors.some((error) => error.includes('Raw TextInput: app/account.tsx')), errors.join('\n'))
    assert.ok(
      errors.some((error) => error.includes('Leftover 48/13/hairline list-row cluster: app/settings.tsx')),
      errors.join('\n'),
    )
    assert.ok(!errors.some((error) => error.includes('listen-export')), errors.join('\n'))
    assert.ok(!errors.some((error) => error.includes('NavigationMenu')), errors.join('\n'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
