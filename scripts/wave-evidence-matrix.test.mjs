import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  classifyAndroidDevice,
  classifyIosDevice,
  matrixFromEvidence,
} from './wave-evidence-matrix.mjs'

const EMULATOR_PROP = `
[ro.build.characteristics]: [emulator]
[ro.kernel.qemu]: [1]
[ro.product.model]: [sdk_gphone64_x86_64]
[ro.build.version.release]: [16]
`

const PIXEL_PROP = `
[ro.build.characteristics]: [nosdcard]
[ro.kernel.qemu]: [0]
[ro.product.model]: [Pixel 6]
[ro.build.version.release]: [15]
`

const passedRows = [
  {
    id: 'stream-to-phrase-refrain',
    owner: '101',
    requirement: 'LB-03',
    status: 'passed',
    currentUrl: '/practice/refrain?phrase=es-001',
    reason: 'opened phrase focus',
  },
  {
    id: 'menu-hard-refrain',
    owner: '101',
    requirement: 'LB-08',
    status: 'passed',
    currentUrl: '/practice/refrain?filter=hard',
  },
]

test('classifies qemu / sdk_gphone getprop as emulator, not physical', () => {
  const device = classifyAndroidDevice(EMULATOR_PROP)
  assert.equal(device.deviceKind, 'emulator')
  assert.equal(device.acceptance, 'closest-available-not-physical')
  assert.equal(device.model, 'sdk_gphone64_x86_64')
  assert.equal(device.osVersion, '16')
})

test('classifies a Pixel getprop as a physical candidate', () => {
  const device = classifyAndroidDevice(PIXEL_PROP)
  assert.equal(device.deviceKind, 'physical')
  assert.equal(device.acceptance, 'physical-candidate')
  assert.equal(device.model, 'Pixel 6')
})

test('emulator passed rows never close the physical-device gate', () => {
  const matrix = matrixFromEvidence({
    manifest: {
      collectedAt: '2026-09-12T15:36:06.534Z',
      serial: 'emulator-5554',
      packageName: 'app.loro.android.preview',
      artifactRevision: 'b0b4e3b77746',
      artifact: { sha256: 'abc', bytes: 1 },
      scenarios: passedRows,
    },
    getpropText: EMULATOR_PROP,
  })
  assert.equal(matrix.schema, 'loro-wave-evidence-matrix/v1')
  assert.equal(matrix.deviceKind, 'emulator')
  assert.equal(matrix.passedCount, 2)
  assert.equal(matrix.physicalGateCount, 0)
  assert.ok(matrix.scenarios.every((row) => row.closesPhysicalGate === false))
})

test('physical passed rows can close the gate; unavailable rows cannot', () => {
  const matrix = matrixFromEvidence({
    manifest: {
      platform: 'android',
      serial: 'R5CT1234',
      packageName: 'app.loro.android.preview',
      scenarios: [
        ...passedRows,
        {
          id: 'stream-to-phrase-refrain-at',
          owner: '101',
          requirement: 'LB-03',
          status: 'unavailable',
          reason: 'TalkBack missing',
        },
      ],
    },
    getpropText: PIXEL_PROP,
  })
  assert.equal(matrix.deviceKind, 'physical')
  assert.equal(matrix.passedCount, 2)
  assert.equal(matrix.physicalGateCount, 2)
  assert.equal(matrix.scenarios[0].closesPhysicalGate, true)
  assert.equal(matrix.scenarios[2].closesPhysicalGate, false)
})

test('iOS simulator passed rows never close the physical-device gate', () => {
  const device = classifyIosDevice({
    deviceKind: 'simulator',
    deviceName: 'iPhone 16',
    runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-18-0',
  })
  assert.equal(device.acceptance, 'closest-available-not-physical')
  const matrix = matrixFromEvidence({
    manifest: {
      platform: 'ios',
      deviceKind: 'simulator',
      deviceName: 'iPhone 16',
      packageName: 'app.loro.ios',
      scenarios: passedRows,
    },
  })
  assert.equal(matrix.deviceKind, 'simulator')
  assert.equal(matrix.physicalGateCount, 0)
})
