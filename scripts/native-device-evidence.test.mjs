import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultPackage, evidenceOutput, parseArguments } from './native-device-evidence.mjs'

test('uses the preview package and accepts bounded device options', () => {
  assert.deepEqual(parseArguments([]), {
    packageName: defaultPackage,
    serial: undefined,
    output: undefined,
  })
  assert.deepEqual(parseArguments(['--serial', 'R5CT1234', '--package', 'app.loro.android']), {
    packageName: 'app.loro.android',
    serial: 'R5CT1234',
    output: undefined,
  })
})

test('rejects unsafe adb values and output outside local artifacts', () => {
  assert.throws(() => parseArguments(['--serial', 'device;rm']), /unsupported characters/)
  assert.throws(() => parseArguments(['--package', 'not-a-package']), /application identifier/)
  assert.throws(() => evidenceOutput('/repo', '/tmp/evidence'), /must remain inside/)
})

test('keeps requested evidence nested below the ignored artifact directory', () => {
  assert.equal(
    evidenceOutput('/repo', '/repo/.local-builds/native-evidence/device-run'),
    '/repo/.local-builds/native-evidence/device-run',
  )
})
