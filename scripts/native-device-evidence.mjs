import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectIosEvidence } from './ios-simulator-evidence.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
export const defaultPackage = 'app.loro.android.preview'

export function parseArguments(args) {
  const result = {
    platform: 'android',
    packageName: undefined,
    serial: undefined,
    output: undefined,
  }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--serial' || arg === '--package' || arg === '--output' || arg === '--platform') {
      const value = args[++index]
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value.`)
      if (arg === '--platform') result.platform = value
      if (arg === '--serial') result.serial = value
      if (arg === '--package') result.packageName = value
      if (arg === '--output') result.output = value
    } else if (arg === '--help') result.help = true
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
  return result
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

export function collectEvidence({ adb = 'adb', serial, packageName, output }) {
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
  const manifest = {
    collectedAt: new Date().toISOString(),
    serial: selected,
    packageName,
    checks: {
      device: 'captured',
      installedPackage: 'captured',
      permissions: 'captured',
      logs: 'captured',
      screenshot: 'captured',
    },
    limits: [
      'This collector records evidence only; it does not grant permissions or claim speech, lifecycle, interruption, or iOS acceptance.',
      'Review the artifacts on a supported physical device before closing the native acceptance gates.',
    ],
  }
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
  writeFileSync(resolve(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

function main() {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    console.log(
      'Usage: pnpm native:evidence [--platform android|ios] [--serial DEVICE] [--package PACKAGE] [--output PATH]',
    )
    console.log(
      'Captures read-only Android device or booted iOS simulator evidence under .local-builds/native-evidence/.',
    )
    return
  }
  const output = evidenceOutput(root, options.output)
  const collector = options.platform === 'ios' ? collectIosEvidence : collectEvidence
  const manifest = collector({ ...options, output })
  console.log(`Native evidence captured for ${manifest.packageName}: ${output}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
