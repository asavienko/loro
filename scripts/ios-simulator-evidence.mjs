import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { unevaluatedWaveScenarios } from './wave-touch-scenarios.mjs'

export function selectSimulator(inventory, serial) {
  const devices = Object.entries(inventory.devices ?? {}).flatMap(([runtime, entries]) =>
    entries.map((device) => ({ ...device, runtime })),
  )
  const eligible = devices.filter(
    (device) =>
      device.runtime.startsWith('com.apple.CoreSimulator.SimRuntime.iOS-') &&
      device.isAvailable === true &&
      device.state === 'Booted',
  )
  if (serial) {
    const device = eligible.find((candidate) => candidate.udid === serial)
    if (!device) throw new Error('The selected iOS simulator must be available and booted.')
    return device
  }
  if (eligible.length !== 1)
    throw new Error('Boot one available iOS simulator, or select one with --serial UDID.')
  return eligible[0]
}

export function collectIosEvidence({
  serial,
  packageName,
  output,
  artifactRevision,
  artifact,
  executeScenarios = false,
  run = spawnSync,
}) {
  const command = (tool, args) => {
    const result = run(tool, args, { encoding: 'utf8', timeout: 30_000 })
    if (result.error || result.status !== 0)
      throw new Error(
        `${tool} ${args.join(' ')} failed. Full Xcode, an installed simulator runtime and the installed app are required.`,
      )
    return result.stdout
  }
  const xcode = command('xcodebuild', ['-version'])
  const inventory = JSON.parse(command('xcrun', ['simctl', 'list', 'devices', '--json']))
  const device = selectSimulator(inventory, serial)
  // Resolve the installed app only. Never read its data container or account credentials.
  const appPath = command('xcrun', ['simctl', 'get_app_container', device.udid, packageName, 'app'])
  if (!appPath.trim())
    throw new Error('The requested app is not installed on the selected simulator.')
  mkdirSync(output, { recursive: true })
  if (readdirSync(output).length !== 0)
    throw new Error('Use an empty output directory for a fresh evidence bundle.')
  const screenshot = resolve(output, 'screen.png')
  command('xcrun', ['simctl', 'io', device.udid, 'screenshot', '--type=png', screenshot])
  const signature = readFileSync(screenshot).subarray(0, 8)
  if (!signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    throw new Error('Simulator screenshot did not produce a PNG artifact.')
  const manifest = {
    collectedAt: new Date().toISOString(),
    platform: 'ios',
    deviceKind: 'simulator',
    serial: device.udid,
    packageName,
    runtime: device.runtime,
    deviceName: device.name,
    artifactRevision: artifactRevision ?? null,
    artifact: artifact ?? null,
    checks: { device: 'captured', installedPackage: 'present', screenshot: 'captured' },
    scenarios: unevaluatedWaveScenarios(
      executeScenarios
        ? 'iOS --execute-scenarios cannot drive adb/uiautomator. Wave-path rows stay unavailable; physical-device/AT remains plan 58/93.'
        : 'Simulator screenshot is not a Stream → Refrain or menu hard-filter run.',
    ),
    limits: [
      'The declared artifact revision identifies the intended build; retain independent build metadata before accepting it.',
      'The screenshot captures the current simulator screen; app launch and scenario outcomes are not asserted.',
      'This read-only collection does not prove clean iOS compilation, minimum OS support, physical-device speech, permissions, persistence, lifecycle or interruption acceptance.',
      'Plan 101 wave-path rows stay unavailable until a physical iPhone run drives those entries. The adb/uiautomator runner is Android-only. iOS --execute-scenarios records unavailable, never passed.',
    ],
  }
  writeFileSync(resolve(output, 'xcode.txt'), xcode)
  writeFileSync(resolve(output, 'device.json'), `${JSON.stringify(device, null, 2)}\n`)
  writeFileSync(resolve(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}
