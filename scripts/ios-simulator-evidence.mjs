import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  defaultIosEvidenceRoot,
  launchLearnerApp,
  prepareIosEvidenceRuntime,
} from './ios-evidence-runtime.mjs'
import { executeIosWaveScenarios } from './ios-wave-scenarios.mjs'
import { unevaluatedWaveScenarios } from './wave-touch-scenarios.mjs'
import { matrixFromEvidence } from './wave-evidence-matrix.mjs'

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
  rootPath = defaultIosEvidenceRoot,
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
  let device
  let installedFromArtifact = false
  if (executeScenarios) {
    const prepared = prepareIosEvidenceRuntime({
      run,
      inventory,
      serial,
      artifact,
      rootPath,
    })
    device = prepared.device
    installedFromArtifact = prepared.installedFromArtifact
  } else {
    device = selectSimulator(inventory, serial)
  }
  // Resolve the installed app only. Never read its data container or account credentials.
  let appPath
  try {
    appPath = command('xcrun', ['simctl', 'get_app_container', device.udid, packageName, 'app'])
  } catch (error) {
    if (executeScenarios && installedFromArtifact) {
      throw new Error(
        'Installed the iOS simulator zip, but get_app_container could not see the app.',
      )
    }
    if (executeScenarios) {
      throw new Error(
        'iOS wave-path scenarios need the app installed, or --artifact pointing at a loro-simulator-*.zip.',
      )
    }
    throw error
  }
  if (!appPath.trim())
    throw new Error('The requested app is not installed on the selected simulator.')
  if (executeScenarios) launchLearnerApp(run, { udid: device.udid, packageName })
  mkdirSync(output, { recursive: true })
  if (readdirSync(output).length !== 0)
    throw new Error('Use an empty output directory for a fresh evidence bundle.')
  const screenshot = resolve(output, 'screen.png')
  command('xcrun', ['simctl', 'io', device.udid, 'screenshot', '--type=png', screenshot])
  const signature = readFileSync(screenshot).subarray(0, 8)
  if (!signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    throw new Error('Simulator screenshot did not produce a PNG artifact.')
  const scenarios = executeScenarios
    ? executeIosWaveScenarios({
        udid: device.udid,
        packageName,
        outputDir: resolve(output, 'wave-scenarios'),
        waitMs: 3000,
        run,
      })
    : unevaluatedWaveScenarios(
        'Simulator screenshot is not a Stream → Refrain or menu hard-filter run.',
      )
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
    checks: {
      device: 'captured',
      installedPackage: 'present',
      screenshot: 'captured',
      ...(executeScenarios
        ? {
            launched: 'attempted',
            installedFromArtifact: installedFromArtifact ? 'yes' : 'no',
          }
        : {}),
    },
    scenarios,
    limits: [
      'The declared artifact revision identifies the intended build; retain independent build metadata before accepting it.',
      'Dump-only collection captures the current simulator screen and does not boot, install, or launch. --execute-scenarios may boot a Shutdown simulator, install a verified loro-simulator-*.zip, and launch the app; scenario outcomes still require chrome plus the exact URL or gesture proof.',
      'This collection does not prove clean iOS compilation, minimum OS support, physical-device speech, permissions, persistence, lifecycle or interruption acceptance.',
      'iOS --execute-scenarios drives pointer and spine/sheet rows through simctl + idb and fail-closes without chrome/URL/gesture evidence. TalkBack `-at` rows stay unavailable even when VoiceOver looks enabled; ordinary idb taps are not AT proof. VoiceOver physical-device remains plan 58/93. A screenshot is not a pass.',
    ],
  }
  const matrix = matrixFromEvidence({ manifest })
  writeFileSync(resolve(output, 'xcode.txt'), xcode)
  writeFileSync(resolve(output, 'device.json'), `${JSON.stringify(device, null, 2)}\n`)
  writeFileSync(resolve(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  writeFileSync(resolve(output, 'matrix.json'), `${JSON.stringify(matrix, null, 2)}\n`)
  return manifest
}
