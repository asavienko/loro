import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  SKIP_MESSAGE,
  bindingDrift,
  checkUniffi,
  hostLibraryPath,
  normalizeBindingText,
} from './check-uniffi.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('skips when the host library is absent', () => {
  const empty = mkdtempSync(path.join(tmpdir(), 'loro-uniffi-empty-'))
  try {
    assert.equal(hostLibraryPath(empty), null)
    assert.deepEqual(checkUniffi(empty), { skipped: true, errors: [] })
    assert.match(SKIP_MESSAGE, /libloro_core/)
  } finally {
    rmSync(empty, { recursive: true, force: true })
  }
})

test('normalize matches build.sh trailing-whitespace strip', () => {
  assert.equal(
    normalizeBindingText('val size: Int  \nreturn result\t\n'),
    'val size: Int\nreturn result\n',
  )
})

test('bindingDrift fails when a committed file changed and when extras appear', () => {
  const generated = mkdtempSync(path.join(tmpdir(), 'loro-uniffi-gen-'))
  const committed = mkdtempSync(path.join(tmpdir(), 'loro-uniffi-committed-'))
  try {
    writeFileSync(path.join(generated, 'loro_core.swift'), 'fun a()  \n')
    writeFileSync(path.join(committed, 'loro_core.swift'), 'fun a()\n')
    assert.deepEqual(bindingDrift(generated, committed), [])

    writeFileSync(path.join(generated, 'loro_core.swift'), 'fun b()\n')
    assert.ok(
      bindingDrift(generated, committed).includes('UniFFI bindings drifted: loro_core.swift'),
    )

    mkdirSync(path.join(generated, 'uniffi'), { recursive: true })
    writeFileSync(path.join(generated, 'uniffi', 'extra.kt'), 'package x\n')
    assert.ok(
      bindingDrift(generated, committed).includes(
        'Generated UniFFI file is not committed: uniffi/extra.kt',
      ),
    )
  } finally {
    rmSync(generated, { recursive: true, force: true })
    rmSync(committed, { recursive: true, force: true })
  }
})

test('this checkout either skips or finds a host library under target/release', () => {
  const library = hostLibraryPath(root)
  if (library === null) assert.equal(library, null)
  else assert.match(library, /libloro_core\.(so|dylib)$/)
})
