/**
 * Boot and install a retained iOS simulator zip for plan 101/58 wave-path rows.
 *
 * Dump-only collection must keep using an already-booted simulator and an
 * already-installed app. `--execute-scenarios` may boot a Shutdown device and
 * `simctl install` a verified `loro-simulator-*.zip`. Never read the app data
 * container. This is not App Store signing or a physical iPhone run.
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { verifyIosSimulatorZip } from './ios-local.mjs'

export const defaultIosEvidenceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function toolFailed(result) {
  return Boolean(result?.error || result?.status !== 0)
}

function invoke(run, tool, args, message, timeout = 30_000) {
  const result = run(tool, args, { encoding: 'utf8', timeout })
  if (toolFailed(result)) throw new Error(message)
  return (result.stdout || '').trim()
}

export function availableIosSimulators(inventory) {
  return Object.entries(inventory?.devices ?? {}).flatMap(([runtime, entries]) =>
    (entries ?? [])
      .filter(
        (device) =>
          runtime.startsWith('com.apple.CoreSimulator.SimRuntime.iOS-') &&
          device.isAvailable === true,
      )
      .map((device) => ({ ...device, runtime })),
  )
}

export function pickSimulatorForScenarios(inventory, serial) {
  const devices = availableIosSimulators(inventory)
  if (serial) {
    const match = devices.find((device) => device.udid === serial)
    if (!match) {
      throw new Error(`Requested iOS simulator ${serial} is not available.`)
    }
    return match
  }
  const booted = devices.filter((device) => device.state === 'Booted')
  if (booted.length === 1) return booted[0]
  if (booted.length > 1) {
    throw new Error('Boot one available iOS simulator, or select one with --serial UDID.')
  }
  const shutdownPhones = devices.filter(
    (device) => device.state === 'Shutdown' && /iPhone/i.test(device.name),
  )
  if (shutdownPhones.length === 1) return shutdownPhones[0]
  if (shutdownPhones.length > 1) {
    throw new Error('Select one Shutdown iPhone simulator with --serial UDID.')
  }
  if (devices.length === 1) return devices[0]
  throw new Error('No available iOS simulator is registered on this Mac.')
}

export function resolveSimulatorZip(artifact, rootPath = defaultIosEvidenceRoot) {
  const file = typeof artifact === 'string' ? artifact : artifact?.file
  if (!file || !file.endsWith('.zip')) return null
  return resolve(rootPath, file)
}

export function appBundleFromZipListing(entries) {
  const names = (entries ?? []).map((entry) => String(entry).replace(/^\.\//, ''))
  const plist = names.find((entry) => entry.endsWith('.app/Info.plist'))
  if (!plist) return null
  return plist.slice(0, -'/Info.plist'.length)
}

export function ensureSimulatorBooted(run, device, timeout = 180_000) {
  if (device.state === 'Booted') return { ...device, state: 'Booted' }
  const booted = run('xcrun', ['simctl', 'boot', device.udid], {
    encoding: 'utf8',
    timeout: 60_000,
  })
  const already = /already booted/i.test(`${booted.stderr || ''}\n${booted.stdout || ''}`)
  if (toolFailed(booted) && !already) {
    throw new Error(`Could not boot iOS simulator ${device.udid}.`)
  }
  invoke(
    run,
    'xcrun',
    ['simctl', 'bootstatus', device.udid, '-b'],
    `iOS simulator ${device.udid} did not finish booting.`,
    timeout,
  )
  return { ...device, state: 'Booted' }
}

export function installSimulatorZip(run, { udid, zipPath, workRoot = tmpdir() }) {
  const listing = invoke(
    run,
    'unzip',
    ['-Z1', zipPath],
    'Could not list the iOS simulator zip.',
  ).split('\n')
  const verified = verifyIosSimulatorZip(listing)
  if (verified.status !== 'passed') throw new Error(verified.notes)
  const relativeApp = appBundleFromZipListing(listing)
  if (!relativeApp) {
    throw new Error('iOS simulator zip does not contain an .app Info.plist.')
  }
  mkdirSync(workRoot, { recursive: true })
  const extractRoot = mkdtempSync(join(workRoot, 'loro-ios-app-'))
  try {
    invoke(
      run,
      'unzip',
      ['-o', zipPath, '-d', extractRoot],
      'Could not extract the iOS simulator zip.',
    )
    invoke(
      run,
      'xcrun',
      ['simctl', 'install', udid, join(extractRoot, relativeApp)],
      `Could not install the iOS simulator app onto ${udid}.`,
      120_000,
    )
    return { bundleId: 'app.loro.ios', relativeApp }
  } finally {
    rmSync(extractRoot, { recursive: true, force: true })
  }
}

export function launchLearnerApp(run, { udid, packageName }) {
  invoke(
    run,
    'xcrun',
    ['simctl', 'launch', udid, packageName],
    `Could not launch ${packageName} on iOS simulator ${udid}.`,
    60_000,
  )
}

export function prepareIosEvidenceRuntime({
  run,
  inventory,
  serial,
  artifact,
  rootPath = defaultIosEvidenceRoot,
  workRoot = tmpdir(),
} = {}) {
  const selected = pickSimulatorForScenarios(inventory, serial)
  const device = ensureSimulatorBooted(run, selected)
  const zipPath = resolveSimulatorZip(artifact, rootPath)
  let installedFromArtifact = false
  if (zipPath) {
    installSimulatorZip(run, { udid: device.udid, zipPath, workRoot })
    installedFromArtifact = true
  }
  return { device, installedFromArtifact, zipPath }
}
