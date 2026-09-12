/**
 * Plan 58 evidence matrix for plan 101/93 wave-path rows.
 *
 * Emulator and simulator passes are closest-available. They never set
 * closesPhysicalGate. A screenshot is not a pass.
 */

function prop(getpropText, key) {
  const match = new RegExp(
    `\\[${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]:\\s*\\[([^\\]]*)\\]`,
  ).exec(String(getpropText ?? ''))
  return match?.[1] ?? ''
}

export function inferEvidencePlatform(manifest) {
  if (manifest?.platform === 'ios' || manifest?.platform === 'android') return manifest.platform
  if (manifest?.deviceKind === 'simulator' || manifest?.packageName === 'app.loro.ios') return 'ios'
  return 'android'
}

export function classifyAndroidDevice(getpropText) {
  const characteristics = prop(getpropText, 'ro.build.characteristics')
  const qemu = prop(getpropText, 'ro.kernel.qemu')
  const model = prop(getpropText, 'ro.product.model')
  const release = prop(getpropText, 'ro.build.version.release')
  const emulator =
    characteristics.split(',').includes('emulator') ||
    qemu === '1' ||
    /sdk_gphone|emulator|android sdk/i.test(model)
  return {
    platform: 'android',
    deviceKind: emulator ? 'emulator' : model ? 'physical' : 'unknown',
    model: model || null,
    osVersion: release || null,
    acceptance: emulator
      ? 'closest-available-not-physical'
      : model
        ? 'physical-candidate'
        : 'unknown',
  }
}

export function classifyIosDevice(manifest = {}) {
  const simulator =
    manifest.deviceKind === 'simulator' || /simulator/i.test(String(manifest.deviceName ?? ''))
  return {
    platform: 'ios',
    deviceKind: simulator ? 'simulator' : manifest.deviceKind === 'device' ? 'physical' : 'unknown',
    model: manifest.deviceName ?? null,
    osVersion: manifest.runtime ?? null,
    acceptance: simulator ? 'closest-available-not-physical' : 'physical-candidate',
  }
}

export function buildWaveEvidenceMatrix(manifest, device) {
  const scenarios = (manifest.scenarios ?? []).map((row) => ({
    id: row.id,
    owner: row.owner ?? null,
    requirement: row.requirement ?? null,
    status: row.status,
    currentUrl: row.currentUrl ?? null,
    reason: row.reason ?? row.notes ?? null,
    closesPhysicalGate: row.status === 'passed' && device.acceptance === 'physical-candidate',
  }))
  return {
    schema: 'loro-wave-evidence-matrix/v1',
    collectedAt: manifest.collectedAt ?? null,
    platform: device.platform,
    deviceKind: device.deviceKind,
    acceptance: device.acceptance,
    serial: manifest.serial ?? null,
    model: device.model,
    osVersion: device.osVersion,
    packageName: manifest.packageName ?? null,
    artifactRevision: manifest.artifactRevision ?? manifest.artifact?.revision ?? null,
    artifact: manifest.artifact ?? null,
    targetLanguage: manifest.targetLanguage ?? null,
    scenarios,
    passedCount: scenarios.filter((row) => row.status === 'passed').length,
    physicalGateCount: scenarios.filter((row) => row.closesPhysicalGate).length,
    limits: [
      'Emulator or simulator passed rows are closest-available evidence. They do not close physical-device or VoiceOver gates.',
      'closesPhysicalGate is true only for a passed row on a physical-candidate device.',
      'A screenshot is not a pass. TalkBack `-at` rows on iOS stay unavailable; ordinary idb taps are not AT proof.',
    ],
  }
}

export function matrixFromEvidence({ manifest, getpropText = '' } = {}) {
  const platform = inferEvidencePlatform(manifest)
  const device =
    platform === 'ios' ? classifyIosDevice(manifest) : classifyAndroidDevice(getpropText)
  return buildWaveEvidenceMatrix(manifest, device)
}
