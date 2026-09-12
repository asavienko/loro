/**
 * Local iOS simulator build for plan 58 / 101 evidence.
 *
 * Produces a retained .app zip under .local-builds/ios/<commit>/. This is not
 * App Store signing, a physical iPhone build, or a wave-path pass. Linux hosts
 * fail closed. GitHub Actions stays disabled.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function requiredIosRustTargets(arch = process.arch) {
  return arch === 'arm64' ? ['aarch64-apple-ios-sim'] : ['x86_64-apple-ios']
}

export function iosLocalOutput(rootPath, sha) {
  const short = sha.slice(0, 12)
  return {
    short,
    directory: resolve(rootPath, '.local-builds', 'ios', short),
    zipName: `loro-simulator-${short}.zip`,
    bundleId: 'app.loro.ios',
  }
}

export function probeIosLocalHost({
  platform = process.platform,
  arch = process.arch,
  run = spawnSync,
} = {}) {
  if (platform !== 'darwin') {
    return {
      reason:
        'pnpm ios:local requires macOS and full Xcode. Linux APK builds and browser Playwright are not iOS proof.',
    }
  }
  const xcode = run('xcodebuild', ['-version'], { encoding: 'utf8' })
  if (xcode.error || xcode.status !== 0) {
    return {
      reason:
        'Full Xcode is required for ios:local. Select an installed Xcode with xcode-select and install an iOS simulator runtime.',
    }
  }
  const pod = run('pod', ['--version'], { encoding: 'utf8' })
  if (pod.error || pod.status !== 0) {
    return { reason: 'CocoaPods (pod) is required after Expo iOS prebuild.' }
  }
  const rustup = run('rustup', ['target', 'list', '--installed'], { encoding: 'utf8' })
  if (rustup.error || rustup.status !== 0) {
    return { reason: 'rustup is required so the iOS simulator Rust target can be checked.' }
  }
  const installed = (rustup.stdout || '').split('\n').map((line) => line.trim())
  const missing = requiredIosRustTargets(arch).filter((target) => !installed.includes(target))
  if (missing.length) {
    return {
      reason: `Install the Rust iOS simulator target: rustup target add ${missing.join(' ')}`,
    }
  }
  return { ok: true, xcode: (xcode.stdout || '').trim() }
}

export function verifyIosSimulatorZip(entries) {
  const names = (entries ?? []).map((entry) => String(entry).replace(/^\.\//, ''))
  if (!names.some((entry) => entry.endsWith('.app/Info.plist'))) {
    return { status: 'failed', notes: 'Archive is missing an .app Info.plist.' }
  }
  if (
    !names.some(
      (entry) => entry.endsWith('main.jsbundle') || entry.endsWith('index.ios.bundle'),
    )
  ) {
    return { status: 'failed', notes: 'Archive is missing its bundled JavaScript.' }
  }
  return { status: 'passed', notes: 'Simulator archive has an app plist and JS bundle.' }
}

function failedCommand(result, label) {
  if (result.error) return `${label} unavailable: ${result.error.code || result.error.message}`
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || `exit ${result.status}`).trim().split('\n')[0]
    return `${label} failed: ${detail}`
  }
  return null
}

function runOrThrow(run, command, argv, cwd, env) {
  const result = run(command, argv, { cwd, env, encoding: 'utf8' })
  const error = failedCommand(result, `${command} ${argv.join(' ')}`)
  if (error) throw new Error(error)
  return (result.stdout || '').trim()
}

export function findSimulatorApp(productsDir, readDir = readdirSync) {
  const apps = readDir(productsDir).filter((name) => name.endsWith('.app'))
  if (apps.length !== 1) {
    throw new Error('xcodebuild did not produce exactly one Release-iphonesimulator .app.')
  }
  return join(productsDir, apps[0])
}

export function iosBuildEnvironment(source, cargoBin = join(homedir(), '.cargo', 'bin')) {
  const env = {
    ...source,
    CI: '1',
    EXPO_NO_TELEMETRY: '1',
    EXPO_NO_DOTENV: '1',
    PATH: `${cargoBin}:${source.PATH || ''}`,
  }
  for (const key of Object.keys(env)) {
    if (key.startsWith('EXPO_PUBLIC_') && key !== 'EXPO_PUBLIC_API_URL') delete env[key]
  }
  return env
}

export function executeIosLocalBuild({
  rootPath = root,
  platform = process.platform,
  arch = process.arch,
  nodeMajor = process.versions.node.split('.')[0],
  env = process.env,
  run = spawnSync,
  exists = existsSync,
  install = false,
  serial,
} = {}) {
  if (env.GITHUB_ACTIONS) {
    throw new Error('Run iOS simulator builds locally. GitHub Actions is disabled.')
  }
  if (nodeMajor !== '22') throw new Error('Use Node 22: nvm use 22')
  const host = probeIosLocalHost({ platform, arch, run })
  if (host.reason) throw new Error(host.reason)
  const status = runOrThrow(run, 'git', ['status', '--porcelain'], rootPath, env)
  if (status) throw new Error('Commit or stash changes before building a traceable iOS artifact.')
  const sha = runOrThrow(run, 'git', ['rev-parse', 'HEAD'], rootPath, env)
  const planned = iosLocalOutput(rootPath, sha)
  const buildEnv = iosBuildEnvironment(env)
  const api = env.EXPO_PUBLIC_API_URL || ''
  if (api) {
    const url = new URL(api)
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !url.pathname.endsWith('/v1')
    ) {
      throw new Error(
        'EXPO_PUBLIC_API_URL must be HTTPS, without credentials/query/fragment, and end in /v1',
      )
    }
  }
  buildEnv.EXPO_PUBLIC_API_URL = api
  mkdirSync(planned.directory, { recursive: true })
  const scratch = mkdtempSync(join(tmpdir(), 'loro-ios-'))
  const archive = join(scratch, 'source.tar')
  const source = join(scratch, 'source')
  mkdirSync(source)
  try {
    runOrThrow(run, 'git', ['archive', '--format=tar', `--output=${archive}`, sha], rootPath, buildEnv)
    runOrThrow(run, 'tar', ['-xf', archive, '-C', source], rootPath, buildEnv)
    runOrThrow(run, 'pnpm', ['install', '--frozen-lockfile'], source, buildEnv)
    runOrThrow(run, 'pnpm', ['tokens:build'], source, buildEnv)
    const mobile = join(source, 'apps/mobile')
    runOrThrow(
      run,
      'pnpm',
      ['exec', 'expo', 'prebuild', '--platform', 'ios', '--no-install'],
      mobile,
      buildEnv,
    )
    const ios = join(mobile, 'ios')
    runOrThrow(run, 'pod', ['install'], ios, buildEnv)
    const workspace = exists(join(ios, 'Loro.xcworkspace'))
      ? join(ios, 'Loro.xcworkspace')
      : join(ios, 'Loro.xcodeproj')
    const workspaceArgs = workspace.endsWith('.xcworkspace')
      ? ['-workspace', workspace]
      : ['-project', workspace]
    const derived = join(ios, 'build')
    runOrThrow(
      run,
      'xcodebuild',
      [
        ...workspaceArgs,
        '-scheme',
        'Loro',
        '-configuration',
        'Release',
        '-sdk',
        'iphonesimulator',
        '-destination',
        'generic/platform=iOS Simulator',
        `-derivedDataPath=${derived}`,
        'CODE_SIGNING_ALLOWED=NO',
        'CODE_SIGNING_REQUIRED=NO',
      ],
      ios,
      buildEnv,
    )
    const products = join(derived, 'Build/Products/Release-iphonesimulator')
    const app = findSimulatorApp(products)
    const zipPath = join(planned.directory, planned.zipName)
    runOrThrow(run, 'ditto', ['-c', '-k', '--keepParent', app, zipPath], rootPath, buildEnv)
    const listing = runOrThrow(run, 'unzip', ['-Z1', zipPath], rootPath, buildEnv).split('\n')
    const verified = verifyIosSimulatorZip(listing)
    if (verified.status !== 'passed') throw new Error(verified.notes)
    const checksum = createHash('sha256').update(readFileSync(zipPath)).digest('hex')
    writeFileSync(`${zipPath}.sha256`, `${checksum}  ${planned.zipName}\n`)
    const metadata = {
      commit: sha,
      sha256: checksum,
      variant: 'release-iphonesimulator',
      signing: 'unsigned simulator; not production signing',
      bundleId: planned.bundleId,
      sdk: 'iphonesimulator',
      rustTargets: requiredIosRustTargets(arch),
      apiUrl: api || null,
      xcode: host.xcode.split('\n')[0],
    }
    writeFileSync(join(planned.directory, 'build.json'), `${JSON.stringify(metadata, null, 2)}\n`)
    if (install) {
      const udid = serial || 'booted'
      runOrThrow(run, 'xcrun', ['simctl', 'install', udid, app], rootPath, buildEnv)
    }
    return {
      ...metadata,
      artifact: relative(rootPath, zipPath),
      app,
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

function parseArguments(args) {
  const result = { install: false, serial: undefined, help: false }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--install') result.install = true
    else if (arg === '--serial') {
      const value = args[++index]
      if (!value || value.startsWith('--')) throw new Error('--serial requires a simulator UDID.')
      result.serial = value
    } else if (arg === '--help') result.help = true
    else throw new Error(`Unknown option: ${arg}`)
  }
  return result
}

function main() {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    console.log(
      'Usage: pnpm ios:local [--install] [--serial UDID]\nBuilds a clean committed iOS Simulator Release .app zip under .local-builds/ios/<commit>/.\nRequires macOS, full Xcode, CocoaPods, Node 22, and rustup target aarch64-apple-ios-sim (or x86_64-apple-ios).\nThis is not App Store signing or a physical iPhone build. --install copies the .app onto a booted simulator.',
    )
    return
  }
  const built = executeIosLocalBuild({
    install: options.install,
    serial: options.serial,
  })
  console.log(`iOS simulator artifact retained: ${built.artifact}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
