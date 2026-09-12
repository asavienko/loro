/**
 * One-shot Mac iOS wave-path evidence for plans 58 / 101 / 93.
 *
 * Builds the retained simulator zip when this commit does not already have
 * one, then runs --execute-scenarios (boot / install / launch / simctl+idb).
 * Linux and missing Xcode fail closed. This is not App Store signing, a
 * physical iPhone run, or VoiceOver proof.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { executeIosLocalBuild, iosLocalOutput, probeIosLocalHost } from './ios-local.mjs'
import { artifactIdentity, evidenceOutput } from './native-device-evidence.mjs'
import { collectIosEvidence } from './ios-simulator-evidence.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function retainedIosSimulatorZip(rootPath, sha) {
  const planned = iosLocalOutput(rootPath, sha)
  const zipPath = resolve(planned.directory, planned.zipName)
  return {
    ...planned,
    zipPath,
    relativeZip: relative(rootPath, zipPath),
  }
}

export function parseIosEvidenceArguments(args) {
  const result = { skipBuild: false, serial: undefined, output: undefined, help: false }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--skip-build') result.skipBuild = true
    else if (arg === '--serial') {
      const value = args[++index]
      if (!value || value.startsWith('--')) throw new Error('--serial requires a simulator UDID.')
      result.serial = value
    } else if (arg === '--output') {
      const value = args[++index]
      if (!value || value.startsWith('--')) throw new Error('--output requires a directory.')
      result.output = value
    } else if (arg === '--help') result.help = true
    else throw new Error(`Unknown option: ${arg}`)
  }
  return result
}

function readHead(run, rootPath) {
  const result = run('git', ['rev-parse', 'HEAD'], { cwd: rootPath, encoding: 'utf8' })
  if (result.error || result.status !== 0) {
    throw new Error('Could not read HEAD. ios:evidence needs a Git checkout.')
  }
  const sha = (result.stdout || '').trim()
  if (!/^[a-f0-9]{7,64}$/i.test(sha)) throw new Error('HEAD is not a Git revision.')
  return sha
}

export function executeIosEvidence({
  rootPath = root,
  platform = process.platform,
  arch = process.arch,
  skipBuild = false,
  serial,
  output,
  run = spawnSync,
  exists = existsSync,
  build = executeIosLocalBuild,
  collect = collectIosEvidence,
} = {}) {
  const host = probeIosLocalHost({ platform, arch, run })
  if (host.reason) throw new Error(host.reason)
  const sha = readHead(run, rootPath)
  let retained = retainedIosSimulatorZip(rootPath, sha)
  if (!exists(retained.zipPath)) {
    if (skipBuild) {
      throw new Error(
        `No retained ${retained.zipName}. Run pnpm ios:local first, or omit --skip-build.`,
      )
    }
    build({
      rootPath,
      platform,
      arch,
      run,
      install: false,
      serial,
    })
    retained = retainedIosSimulatorZip(rootPath, sha)
    if (!exists(retained.zipPath)) {
      throw new Error('ios:local finished without a loro-simulator-*.zip.')
    }
  }
  const artifact = artifactIdentity(rootPath, sha, retained.zipPath)
  const destination = evidenceOutput(
    rootPath,
    output || join(rootPath, '.local-builds', 'native-evidence', `wave-101-ios-${retained.short}`),
  )
  return collect({
    serial,
    packageName: retained.bundleId,
    output: destination,
    artifactRevision: sha,
    artifact,
    executeScenarios: true,
    rootPath,
    run,
  })
}

function main() {
  const options = parseIosEvidenceArguments(process.argv.slice(2))
  if (options.help) {
    console.log(
      'Usage: pnpm ios:evidence [--skip-build] [--serial UDID] [--output PATH]\nBuilds a retained iOS simulator zip when this commit does not already have one, then drives plan 101/93 wave-path rows through simctl + idb.\nRequires macOS, full Xcode, CocoaPods, Node 22, rustup iOS simulator target, and idb.\nLinux APK builds and browser Playwright are not iOS proof. TalkBack `-at` rows stay unavailable; VoiceOver physical-device remains plan 58/93.',
    )
    return
  }
  const manifest = executeIosEvidence(options)
  console.log(`iOS wave-path evidence captured for ${manifest.packageName}: ${manifest.serial}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
