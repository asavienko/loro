import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  copyFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { posthogFromDotenv } from './apk-environment.mjs'
import {
  EXPORTS,
  USAGE,
  appStoreConnectAuth,
  buildNumber,
  exportOptionsPlist,
  ipaBuildEnvironment,
  parseIpaArgs,
  previewBundleId,
  publicUrls,
  teamId,
} from './ipa-environment.mjs'

// The iOS counterpart of scripts/apk-local.mjs (docs/process/local-ipa.md): builds HEAD in a
// temporary copy with Expo prebuild, CocoaPods and xcodebuild, checks what it made, and leaves it in
// .local-builds/ipa/<commit>/.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const options = parseIpaArgs(process.argv.slice(2))
if (options.help) {
  console.log(USAGE)
  process.exit(0)
}
if (process.env.GITHUB_ACTIONS)
  throw new Error('Run iOS builds locally. GitHub Actions is disabled.')
if (process.platform !== 'darwin') throw new Error('iOS builds need a Mac with full Xcode.')
if (process.versions.node.split('.')[0] !== '22') throw new Error('Use Node 22: nvm use 22')

const exported = options.simulator ? null : EXPORTS[options.export]
const forTesters = exported && options.export !== 'development'
const identity = exported?.identity ?? 'preview'
const bundleId = identity === 'store' ? 'app.loro.ios' : previewBundleId(process.env)
const team = exported ? teamId(options.team, process.env) : ''
const auth = appStoreConnectAuth(process.env)

const { api, web } = publicUrls(process.env)
// Without a server the app can't load a course, so a build meant for others must name one.
if (!api && forTesters)
  throw new Error(
    `EXPO_PUBLIC_API_URL is required for --export ${options.export}: without it the app looks for http://localhost:3000/v1 and never loads a course.`,
  )
if (!api)
  console.warn(
    'EXPO_PUBLIC_API_URL is not set: the app will look for http://localhost:3000/v1, which only a simulator on this Mac can reach. Set an HTTPS URL ending in /v1.',
  )

const run = (command, argv, { cwd = root, capture = false, env: runEnv } = {}) => {
  const result = spawnSync(command, argv, {
    cwd,
    env: runEnv,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} ${argv[0] ?? ''} failed${result.error ? `: ${result.error.message}` : ` (exit ${result.status})`}`,
    )
  return capture ? result.stdout.trim() : ''
}
if (run('git', ['status', '--porcelain'], { capture: true }))
  throw new Error('Commit or stash changes before building a traceable IPA.')
const sha = run('git', ['rev-parse', 'HEAD'], { capture: true })
const short = sha.slice(0, 12)
const build = buildNumber(
  process.env,
  run('git', ['rev-list', '--count', 'HEAD'], { capture: true }),
)

const env = ipaBuildEnvironment(process.env, join(homedir(), '.cargo', 'bin'), {
  identity,
  bundleId,
  build,
})
env.EXPO_PUBLIC_API_URL = api
env.EXPO_PUBLIC_WEB_URL = web
// PostHog's project key is public by design (ADR-0011); without it the build sends no analytics.
const mobileDotenv = join(root, 'apps/mobile/.env')
Object.assign(
  env,
  posthogFromDotenv(
    process.env,
    existsSync(mobileDotenv) ? readFileSync(mobileDotenv, 'utf8') : '',
  ),
)
if (!env.EXPO_PUBLIC_POSTHOG_KEY) {
  const message =
    'EXPO_PUBLIC_POSTHOG_KEY is not set (in the shell or apps/mobile/.env): the build will send no analytics, session replay or error reports.'
  if (forTesters) throw new Error(`${message} Set it before building for testers.`)
  console.warn(message)
}
const PUBLIC_KEYS = new Set([
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_WEB_URL',
  'EXPO_PUBLIC_POSTHOG_KEY',
  'EXPO_PUBLIC_POSTHOG_HOST',
])
for (const key of Object.keys(env)) {
  if (key.startsWith('EXPO_PUBLIC_') && !PUBLIC_KEYS.has(key)) delete env[key]
}
const sh = (command, argv, opts = {}) => run(command, argv, { ...opts, env })

sh('xcodebuild', ['-version'])
sh('pod', ['--version'])
const arch = process.arch === 'arm64' ? 'arm64' : 'x86_64'
const rustTarget = options.simulator
  ? arch === 'arm64'
    ? 'aarch64-apple-ios-sim'
    : 'x86_64-apple-ios'
  : 'aarch64-apple-ios'
if (
  !sh('rustup', ['target', 'list', '--installed'], { capture: true })
    .split('\n')
    .includes(rustTarget)
)
  throw new Error(`Install the Rust target: rustup target add ${rustTarget}`)

const kind = options.simulator ? 'simulator' : options.export
const output = join(root, '.local-builds', 'ipa', short)
mkdirSync(output, { recursive: true })
const scratch = mkdtempSync(join(tmpdir(), 'loro-ipa-'))
const archive = join(scratch, 'source.tar')
const source = join(scratch, 'source')
mkdirSync(source)

/** What every build must be: the expected identity, its JavaScript, and no microphone (ADR-0011). */
function verifyApp(app, { signed }) {
  const plist = join(app, 'Info.plist')
  const read = (key) =>
    spawnSync('plutil', ['-extract', key, 'raw', '-o', '-', plist], { encoding: 'utf8' })
  const id = read('CFBundleIdentifier')
  if (id.status !== 0 || id.stdout.trim() !== bundleId)
    throw new Error(`The app's bundle identifier is not ${bundleId}.`)
  if (read('CFBundleVersion').stdout.trim() !== build)
    throw new Error(`The app's build number is not ${build}.`)
  if (read('NSMicrophoneUsageDescription').status === 0)
    throw new Error('The app asks for the microphone; Loro records nothing (ADR-0011).')
  if (!existsSync(join(app, 'main.jsbundle')))
    throw new Error('The app is missing its bundled JavaScript.')
  // The Rust core is linked statically: the Swift bindings don't link without it, so a built app has it.
  if (signed) {
    sh('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app])
    if (!existsSync(join(app, 'embedded.mobileprovision')))
      throw new Error('The app has no provisioning profile.')
  }
}

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')

try {
  sh('git', ['archive', '--format=tar', `--output=${archive}`, sha])
  sh('tar', ['-xf', archive, '-C', source])
  sh('pnpm', ['install', '--frozen-lockfile'], { cwd: source })
  const mobile = join(source, 'apps/mobile')
  sh('pnpm', ['exec', 'expo', 'prebuild', '--platform', 'ios', '--no-install'], { cwd: mobile })
  const ios = join(mobile, 'ios')
  sh('pod', ['install'], { cwd: ios })
  const workspace = readdirSync(ios).find((name) => name.endsWith('.xcworkspace'))
  if (!workspace) throw new Error('Expo prebuild made no Xcode workspace.')
  const scheme = basename(workspace, '.xcworkspace')
  const common = [
    '-workspace',
    join(ios, workspace),
    '-scheme',
    scheme,
    '-configuration',
    'Release',
  ]

  let artifact
  if (options.simulator) {
    const derived = join(scratch, 'derived')
    sh('xcodebuild', [
      ...common,
      '-sdk',
      'iphonesimulator',
      '-destination',
      'generic/platform=iOS Simulator',
      '-derivedDataPath',
      derived,
      `ARCHS=${arch}`,
      'ONLY_ACTIVE_ARCH=NO',
      'CODE_SIGNING_ALLOWED=NO',
      'build',
    ])
    const app = join(derived, 'Build/Products/Release-iphonesimulator', `${scheme}.app`)
    verifyApp(app, { signed: false })
    artifact = join(output, `loro-preview-${short}-simulator.app.zip`)
    sh('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, artifact])
    if (options.install) sh('xcrun', ['simctl', 'install', 'booted', app])
  } else {
    const xcarchive = join(scratch, `${scheme}.xcarchive`)
    const provisioning = ['-allowProvisioningUpdates', ...auth]
    sh('xcodebuild', [
      ...common,
      '-destination',
      // A personal team signs only for a device Xcode has registered: name it, and Xcode registers it.
      options.device && exported.registerDevice ? `id=${options.device}` : 'generic/platform=iOS',
      '-archivePath',
      xcarchive,
      ...provisioning,
      ...(exported.registerDevice ? ['-allowProvisioningDeviceRegistration'] : []),
      `DEVELOPMENT_TEAM=${team}`,
      'CODE_SIGN_STYLE=Automatic',
      'archive',
    ])
    const exportTo = (upload) => {
      const plist = join(scratch, upload ? 'ExportUpload.plist' : 'ExportOptions.plist')
      writeFileSync(plist, exportOptionsPlist({ method: exported.method, team, upload }))
      const path = join(scratch, upload ? 'upload' : 'export')
      sh('xcodebuild', [
        '-exportArchive',
        '-archivePath',
        xcarchive,
        '-exportPath',
        path,
        '-exportOptionsPlist',
        plist,
        ...provisioning,
      ])
      return path
    }
    const exportPath = exportTo(false)
    const ipa = readdirSync(exportPath).find((name) => name.endsWith('.ipa'))
    if (!ipa) throw new Error('xcodebuild exported no IPA.')
    const unpacked = join(scratch, 'unpacked')
    sh('ditto', ['-x', '-k', join(exportPath, ipa), unpacked])
    const app = readdirSync(join(unpacked, 'Payload')).find((name) => name.endsWith('.app'))
    if (!app) throw new Error('The IPA has no app in Payload/.')
    verifyApp(join(unpacked, 'Payload', app), { signed: true })
    artifact = join(output, `loro-${identity}-${short}-${kind}.ipa`)
    copyFileSync(join(exportPath, ipa), artifact)
    // Only a build that passed the checks above is sent to App Store Connect.
    if (options.export === 'testflight') exportTo(true)
    if (options.install)
      sh('xcrun', [
        'devicectl',
        'device',
        'install',
        'app',
        '--device',
        options.device,
        join(unpacked, 'Payload', app),
      ])
  }

  const checksum = sha256(artifact)
  writeFileSync(`${artifact}.sha256`, `${checksum}  ${basename(artifact)}\n`)
  writeFileSync(
    join(output, `build-${kind}.json`),
    JSON.stringify(
      {
        commit: sha,
        sha256: checksum,
        file: basename(artifact),
        kind,
        exportMethod: exported?.method ?? null,
        team: team || null,
        bundleIdentifier: bundleId,
        buildNumber: build,
        apiUrl: api || null,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`iOS ${kind} build checked: ${artifact}`)
  if (options.export === 'testflight' && !options.simulator)
    console.log(
      'Uploaded to App Store Connect. It reaches TestFlight once Apple has processed it (minutes); external testers need Beta App Review once.',
    )
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
