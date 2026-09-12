import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectIosEvidence } from './ios-simulator-evidence.mjs'
import { executeWaveScenarios } from './native-wave-scenarios.mjs'
import { unevaluatedWaveScenarios, WAVE_TOUCH_SCENARIOS } from './wave-touch-scenarios.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
export const defaultPackage = 'app.loro.android.preview'

export function parseArguments(args) {
  const result = {
    platform: 'android',
    packageName: undefined,
    serial: undefined,
    output: undefined,
    artifactRevision: undefined,
    artifact: undefined,
    executeScenarios: false,
  }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (
      arg === '--serial' ||
      arg === '--package' ||
      arg === '--output' ||
      arg === '--platform' ||
      arg === '--artifact-revision' ||
      arg === '--artifact'
    ) {
      const value = args[++index]
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value.`)
      if (arg === '--platform') result.platform = value
      if (arg === '--serial') result.serial = value
      if (arg === '--package') result.packageName = value
      if (arg === '--output') result.output = value
      if (arg === '--artifact-revision') result.artifactRevision = value
      if (arg === '--artifact') result.artifact = value
    } else if (arg === '--help') result.help = true
    else if (arg === '--list-scenarios') result.listScenarios = true
    else if (arg === '--execute-scenarios') result.executeScenarios = true
    else throw new Error(`Unknown option: ${arg}`)
  }
  if (!['android', 'ios'].includes(result.platform))
    throw new Error('Platform must be android or ios.')
  result.packageName ??= result.platform === 'ios' ? 'app.loro.ios' : defaultPackage
  if (
    !result.help &&
    (!/^[A-Za-z0-9._-]+$/.test(result.packageName) || !result.packageName.includes('.'))
  )
    throw new Error('Package must be a valid application identifier.')
  if (result.serial && !/^[A-Za-z0-9._:-]+$/.test(result.serial))
    throw new Error('Device serial contains unsupported characters.')
  if (result.artifactRevision && !/^[a-f0-9]{7,64}$/i.test(result.artifactRevision))
    throw new Error('Artifact revision must be a 7-64 character Git revision.')
  return result
}

function isWithin(base, candidate) {
  const path = relative(base, candidate)
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..')
}

/**
 * Bind an evidence bundle to immutable bytes as well as a Git object. This establishes the
 * retained-build side of the correlation; it cannot prove that those bytes are installed.
 */
export function artifactIdentity(rootPath, artifactRevision, artifact) {
  if (!artifact) throw new Error('Pass --artifact with the retained build file.')
  const artifactPath = resolve(rootPath, artifact)
  const localBuilds = resolve(rootPath, '.local-builds')
  if (!isWithin(localBuilds, artifactPath))
    throw new Error('Artifact must remain inside .local-builds.')
  let stats
  try {
    stats = statSync(artifactPath)
  } catch {
    throw new Error('Artifact file does not exist.')
  }
  if (!stats.isFile()) throw new Error('Artifact must be a regular file.')
  return {
    revision: artifactRevision,
    file: relative(rootPath, artifactPath),
    sha256: createHash('sha256').update(readFileSync(artifactPath)).digest('hex'),
    bytes: stats.size,
  }
}

export function evidenceOutput(rootPath, requested) {
  const base = resolve(rootPath, '.local-builds', 'native-evidence')
  const output = resolve(requested || resolve(base, new Date().toISOString().replaceAll(':', '-')))
  if (
    output !== base &&
    !relative(base, output).startsWith(`..${sep}`) &&
    relative(base, output) !== '..'
  )
    return output
  if (output === base) return output
  throw new Error('Evidence output must remain inside .local-builds/native-evidence.')
}

function resolveRevision(revision) {
  const result = spawnSync('git', ['rev-parse', '--verify', `${revision}^{commit}`], {
    cwd: root,
    encoding: 'utf8',
  })
  if (result.error || result.status !== 0)
    throw new Error('Artifact revision must resolve to a commit in this checkout.')
  return result.stdout.trim()
}

function command(adb, serial, argv, capture = true) {
  const result = spawnSync(adb, serial ? ['-s', serial, ...argv] : argv, {
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  })
  if (result.error || result.status !== 0) {
    const detail = result.stderr?.trim() || result.error?.message || `exit ${result.status}`
    throw new Error(`adb ${argv.join(' ')} failed: ${detail}`)
  }
  return result.stdout
}

export function collectEvidence({
  adb = 'adb',
  serial,
  packageName,
  output,
  artifactRevision,
  artifact,
  executeScenarios = false,
}) {
  mkdirSync(output, { recursive: true })
  const devices = command(adb, undefined, ['devices', '-l'])
  const selected =
    serial ||
    devices
      .split('\n')
      .slice(1)
      .map((line) => line.trim().split(/\s+/))
      .find((parts) => parts[0] && parts[1] === 'device')?.[0]
  if (!selected) throw new Error('Connect one authorized Android device or pass --serial.')
  const shell = (...argv) => command(adb, selected, ['shell', ...argv])
  writeFileSync(resolve(output, 'device.txt'), shell('getprop'))
  writeFileSync(resolve(output, 'package.txt'), shell('dumpsys', 'package', packageName))
  writeFileSync(resolve(output, 'permissions.txt'), shell('pm', 'list', 'permissions', '-g', '-d'))
  writeFileSync(
    resolve(output, 'logcat.txt'),
    command(adb, selected, ['logcat', '-d', '-v', 'threadtime']),
  )
  const screenshot = spawnSync(adb, ['-s', selected, 'exec-out', 'screencap', '-p'], {
    encoding: null,
  })
  if (screenshot.error || screenshot.status !== 0 || !screenshot.stdout?.length)
    throw new Error('adb exec-out screencap failed.')
  writeFileSync(resolve(output, 'screen.png'), screenshot.stdout)
  const scenarios = executeScenarios
    ? executeWaveScenarios({
        adb,
        serial: selected,
        packageName,
        outputDir: resolve(output, 'wave-scenarios'),
      })
    : unevaluatedWaveScenarios(
        'Collector records the current screen only; it does not launch or drive Stream → Refrain or menu hard-filter. Pass --execute-scenarios on a connected device.',
      )
  const manifest = {
    collectedAt: new Date().toISOString(),
    serial: selected,
    packageName,
    artifactRevision: artifactRevision ?? null,
    artifact: artifact ?? null,
    checks: {
      device: 'captured',
      installedPackage: 'captured',
      permissions: 'captured',
      logs: 'captured',
      screenshot: 'captured',
    },
    scenarios,
    limits: [
      'This collector records evidence only; it does not verify the installed bytes or claim speech, lifecycle, interruption, or iOS acceptance.',
      'Review the artifacts on a supported physical device before closing the native acceptance gates.',
      'Plan 101 wave-path rows stay unavailable until --execute-scenarios drives those entries and records their exact URLs. A screenshot is not a pass.',
    ],
  }
  writeFileSync(resolve(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

function main() {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    console.log(
      'Usage: pnpm native:evidence --artifact-revision GIT_REVISION --artifact .local-builds/RETAINED_BUILD [--platform android|ios] [--serial DEVICE] [--package PACKAGE] [--output PATH] [--execute-scenarios]',
    )
    console.log(
      'Captures read-only Android device or booted iOS simulator evidence under .local-builds/native-evidence/.',
    )
    console.log('List plan 101/93 wave-path rows without collecting: --list-scenarios')
    console.log(
      'Drive those rows through adb + uiautomator (fail-closed; never pass without URL/chrome evidence): --execute-scenarios',
    )
    console.log(
      'iOS --execute-scenarios stays unavailable (uiautomator is Android-only); it does not abort collection.',
    )
    return
  }
  if (options.listScenarios) {
    console.log(JSON.stringify(WAVE_TOUCH_SCENARIOS, null, 2))
    return
  }
  if (!options.artifactRevision)
    throw new Error(
      'Pass --artifact-revision with the retained Git revision of the installed build.',
    )
  const revision = resolveRevision(options.artifactRevision)
  const artifact = artifactIdentity(root, revision, options.artifact)
  const output = evidenceOutput(root, options.output)
  const collector = options.platform === 'ios' ? collectIosEvidence : collectEvidence
  const manifest = collector({ ...options, artifactRevision: revision, artifact, output })
  console.log(`Native evidence captured for ${manifest.packageName}: ${output}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
