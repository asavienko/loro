import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  mkdtempSync,
  rmSync,
} from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { apkBuildEnvironment } from './apk-environment.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const upload = args.includes('--upload')
const publish = args.includes('--publish')
if (args.includes('--help')) {
  console.log(
    'Usage: pnpm apk:local [--upload] [--publish]\nBuilds the clean committed checkout. --upload creates a draft GitHub prerelease; --publish also publishes it.\nOptional EXPO_PUBLIC_API_URL must be an HTTPS URL ending in /v1. Requires Node 22, JDK 17, Android SDK/NDK, Rust with cargo-ndk and Android targets, and gh for uploads.',
  )
  process.exit(0)
}
if (args.some((arg) => !['--upload', '--publish'].includes(arg)) || (publish && !upload)) {
  throw new Error('Unknown option, or --publish without --upload. Use --help.')
}
if (process.env.GITHUB_ACTIONS)
  throw new Error('Run APK builds locally. GitHub Actions is disabled.')
if (process.versions.node.split('.')[0] !== '22') throw new Error('Use Node 22: nvm use 22')
const env = apkBuildEnvironment(process.env, join(homedir(), '.cargo', 'bin'))
const api = process.env.EXPO_PUBLIC_API_URL || ''
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
env.EXPO_PUBLIC_API_URL = api
for (const key of Object.keys(env)) {
  if (key.startsWith('EXPO_PUBLIC_') && key !== 'EXPO_PUBLIC_API_URL') delete env[key]
}
const run = (command, argv, cwd = root, capture = false) => {
  const result = spawnSync(command, argv, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  })
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} failed${result.error ? `: ${result.error.message}` : ` (exit ${result.status})`}`,
    )
  return capture ? result.stdout.trim() : ''
}
if (run('git', ['status', '--porcelain'], root, true))
  throw new Error('Commit or stash changes before building a traceable APK.')
const sha = run('git', ['rev-parse', 'HEAD'], root, true)
const short = sha.slice(0, 12)
run('java', ['-version'])
if (!env.ANDROID_HOME || !existsSync(join(env.ANDROID_HOME, 'platform-tools')))
  throw new Error('Set ANDROID_HOME to an installed Android SDK.')
run('cargo', ['ndk', '--version'])
const rustupTargetArgs = env.RUSTUP_TOOLCHAIN
  ? [`+${env.RUSTUP_TOOLCHAIN}`, 'target', 'list', '--installed']
  : ['target', 'list', '--installed']
const rustTargets = run('rustup', rustupTargetArgs, root, true).split('\n')
for (const target of ['aarch64-linux-android', 'x86_64-linux-android']) {
  if (!rustTargets.includes(target))
    throw new Error(
      `Install the Rust target: rustup ${env.RUSTUP_TOOLCHAIN ? `+${env.RUSTUP_TOOLCHAIN} ` : ''}target add ${target}`,
    )
}
let repo
if (upload) {
  repo = run(
    'gh',
    ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'],
    root,
    true,
  )
  const permissions = JSON.parse(
    run('gh', ['api', `repos/${repo}/actions/permissions`], root, true),
  )
  if (permissions.enabled) throw new Error('Disable GitHub Actions before uploading APK releases.')
  // The release must identify a commit already present on GitHub. Do not silently push branches.
  run('gh', ['api', `repos/${repo}/commits/${sha}`, '--jq', '.sha'], root, true)
}
const output = join(root, '.local-builds', 'apk', short)
mkdirSync(output, { recursive: true })
const scratch = mkdtempSync(join(tmpdir(), 'loro-apk-'))
const archive = join(scratch, 'source.tar')
const source = join(scratch, 'source')
mkdirSync(source)
try {
  run('git', ['archive', '--format=tar', `--output=${archive}`, sha])
  run('tar', ['-xf', archive, '-C', source])
  run('pnpm', ['install', '--frozen-lockfile'], source)
  run('pnpm', ['tokens:build'], source)
  const mobile = join(source, 'apps/mobile')
  run('pnpm', ['exec', 'expo', 'prebuild', '--platform', 'android', '--no-install'], mobile)
  run(
    './gradlew',
    [
      ':app:assembleRelease',
      '--no-daemon',
      '--build-cache',
      '--max-workers=2',
      '-PreactNativeArchitectures=arm64-v8a,x86_64',
    ],
    join(mobile, 'android'),
  )
  const built = join(mobile, 'android/app/build/outputs/apk/release/app-release.apk')
  if (!existsSync(built)) throw new Error('Gradle did not produce the expected standalone APK.')
  const apk = join(output, `loro-preview-${short}.apk`)
  copyFileSync(built, apk)
  const buildTools = join(env.ANDROID_HOME, 'build-tools', '36.0.0')
  run(join(buildTools, 'apksigner'), ['verify', '--verbose', apk])
  const badging = run(join(buildTools, 'aapt'), ['dump', 'badging', apk], root, true)
  if (
    !badging.includes("package: name='app.loro.android.preview'") ||
    badging.includes('application-debuggable')
  ) {
    throw new Error(
      'APK must have the preview application ID and a non-debuggable release manifest.',
    )
  }
  const entries = run('unzip', ['-Z1', apk], root, true).split('\n')
  if (!entries.includes('assets/index.android.bundle'))
    throw new Error('APK is missing its bundled JavaScript.')
  for (const abi of ['arm64-v8a', 'x86_64']) {
    if (!entries.includes(`lib/${abi}/libloro_core.so`))
      throw new Error(`APK is missing the Rust runtime for ${abi}.`)
    if (!entries.includes(`lib/${abi}/libop-sqlite.so`))
      throw new Error(`APK is missing the SQLite runtime for ${abi}.`)
  }
  const checksum = createHash('sha256').update(readFileSync(apk)).digest('hex')
  const checksumFile = `${apk}.sha256`
  writeFileSync(checksumFile, `${checksum}  loro-preview-${short}.apk\n`)
  const metadata = join(output, 'build.json')
  writeFileSync(
    metadata,
    JSON.stringify(
      {
        commit: sha,
        sha256: checksum,
        variant: 'release',
        signing: 'Expo development key',
        applicationId: 'app.loro.android.preview',
        architectures: ['arm64-v8a', 'x86_64'],
        apiUrl: api || null,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`APK built and signature verified: ${apk}`)
  if (upload) {
    const tag = `apk-${short}-${Date.now()}`
    const notes = join(output, 'release-notes.md')
    writeFileSync(
      notes,
      `Local testing APK from commit ${sha}.\n\nBundled JavaScript; no Metro or EAS required. Development signing key, separate preview application ID; not a store release.\n\nArchitectures: arm64-v8a and x86_64. API: ${api || 'not configured; sign-in unavailable'}.\n\nSHA-256: ${checksum}\n`,
    )
    run('gh', [
      'release',
      'create',
      tag,
      apk,
      checksumFile,
      metadata,
      '--repo',
      repo,
      '--target',
      sha,
      '--title',
      `Loro Android preview ${short}`,
      '--notes-file',
      notes,
      '--prerelease',
      '--latest=false',
      '--draft',
    ])
    // Download the actual uploaded asset and compare bytes before making it visible.
    const verify = join(scratch, 'verify')
    mkdirSync(verify)
    run('gh', [
      'release',
      'download',
      tag,
      '--repo',
      repo,
      '--pattern',
      `loro-preview-${short}.apk`,
      '--dir',
      verify,
    ])
    const remoteHash = createHash('sha256')
      .update(readFileSync(join(verify, `loro-preview-${short}.apk`)))
      .digest('hex')
    if (remoteHash !== checksum)
      throw new Error(`Upload verification failed; release ${tag} remains a draft.`)
    if (publish)
      run('gh', [
        'release',
        'edit',
        tag,
        '--repo',
        repo,
        '--draft=false',
        '--prerelease',
        '--latest=false',
      ])
    console.log(
      run(
        'gh',
        ['release', 'view', tag, '--repo', repo, '--json', 'url', '--jq', '.url'],
        root,
        true,
      ),
    )
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
