// The pure half of scripts/ipa-local.mjs: its options, environment and export settings, testable
// without a Mac.

// How an archive leaves the Mac. The method names are Xcode 15.3+'s (Expo SDK 54 needs Xcode 16).
export const EXPORTS = {
  // Signed for the devices in the team's development profile; a free Apple ID's personal team
  // can make it, and its build stops opening after 7 days.
  development: { method: 'debugging', identity: 'preview', registerDevice: true },
  // Ad hoc: any device registered in a paid team (up to 100 iPhones a year), for the profile's year.
  'ad-hoc': { method: 'release-testing', identity: 'preview', registerDevice: false },
  // Uploaded to App Store Connect for TestFlight testers: not listed in the App Store.
  testflight: { method: 'app-store-connect', identity: 'store', registerDevice: false },
}

export const USAGE = `Usage: pnpm ipa:local [--export development|ad-hoc|testflight] [--team TEAMID] [--install --device ID]
       pnpm ipa:local --simulator [--install]
Builds the clean committed checkout on a Mac with full Xcode, CocoaPods and Rust's iOS targets.
  --export      development (default; a free Apple ID works, 7 days), ad-hoc (registered devices,
                paid team) or testflight (uploads to App Store Connect; ipa:testflight)
  --team        the Apple team ID (else APPLE_TEAM_ID); not needed with --simulator
  --simulator   an unsigned build for the iOS Simulator; no Apple account
  --install     install the build: on the booted simulator, or on --device (xcrun devicectl list devices)
EXPO_PUBLIC_API_URL (required for ad-hoc and testflight) must be an HTTPS URL ending in /v1.
APP_STORE_CONNECT_API_KEY_PATH, _KEY_ID and _ISSUER_ID sign in without an account in Xcode.`

export function parseIpaArgs(argv) {
  const options = { export: 'development', simulator: false, install: false, device: '', team: '' }
  let exportGiven = false
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const value = () => {
      const next = argv[++index]
      if (!next || next.startsWith('--')) throw new Error(`${arg} needs a value. Use --help.`)
      return next
    }
    if (arg === '--help') return { help: true }
    else if (arg === '--simulator') options.simulator = true
    else if (arg === '--install') options.install = true
    else if (arg === '--export') {
      options.export = value()
      exportGiven = true
    } else if (arg === '--team') options.team = value()
    else if (arg === '--device') options.device = value()
    else throw new Error(`Unknown option ${arg}. Use --help.`)
  }
  if (!Object.hasOwn(EXPORTS, options.export))
    throw new Error(`--export must be one of: ${Object.keys(EXPORTS).join(', ')}`)
  if (options.simulator && (exportGiven || options.team || options.device))
    throw new Error('--simulator builds unsigned: it takes no --export, --team or --device.')
  if (options.device && !options.install) throw new Error('--device is used with --install.')
  if (options.install && options.export === 'testflight')
    throw new Error('A TestFlight build installs through the TestFlight app, not --install.')
  if (options.install && !options.simulator && !options.device)
    throw new Error('--install on a phone needs --device ID (xcrun devicectl list devices).')
  return options
}

/** The Apple team that signs a device build: the option, else APPLE_TEAM_ID. */
export function teamId(option, source) {
  const team = option || source.APPLE_TEAM_ID || ''
  if (!team)
    throw new Error(
      'Name the Apple team: --team TEAMID or APPLE_TEAM_ID (Xcode › Settings › Accounts, or developer.apple.com › Membership).',
    )
  if (!/^[A-Z0-9]{10}$/.test(team))
    throw new Error('An Apple team ID is 10 capital letters or digits.')
  return team
}

/** The identifier a preview build installs under; a personal team may need one of its own. */
export function previewBundleId(source) {
  const id = source.LORO_IOS_BUNDLE_ID || 'app.loro.ios.preview'
  if (!/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(id))
    throw new Error('LORO_IOS_BUNDLE_ID must be a reverse-DNS identifier such as com.example.loro.')
  return id
}

/** CFBundleVersion: LORO_IOS_BUILD_NUMBER, else the commit count, which grows with main. */
export function buildNumber(source, commitCount) {
  const number = source.LORO_IOS_BUILD_NUMBER || String(commitCount)
  if (!/^[1-9]\d{0,8}(\.\d{1,4}){0,2}$/.test(number))
    throw new Error(
      'LORO_IOS_BUILD_NUMBER must be up to three dot-separated integers, such as 412.',
    )
  return number
}

export function ipaBuildEnvironment(source, cargoBin, { identity, bundleId, build }) {
  const env = {
    ...source,
    CI: '1',
    EXPO_NO_TELEMETRY: '1',
    EXPO_NO_DOTENV: '1',
    LORO_IOS_BUILD_NUMBER: build,
    CARGO_BUILD_JOBS: source.CARGO_BUILD_JOBS || '4',
    PATH: `${cargoBin}:${source.PATH || ''}`,
  }
  delete env.LORO_LOCAL_APK
  delete env.LORO_ANDROID_DEV_CLIENT
  delete env.LORO_LOCAL_IPA
  delete env.LORO_IOS_BUNDLE_ID
  if (identity === 'preview') {
    env.LORO_LOCAL_IPA = '1'
    env.LORO_IOS_BUNDLE_ID = bundleId
  }
  return env
}

/** The API and web origins a build is pointed at, checked as the APK runner checks them. */
export function publicUrls(source) {
  const check = (name, value, mustEndInV1) => {
    if (!value) return ''
    const url = new URL(value)
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (mustEndInV1 && !url.pathname.endsWith('/v1'))
    )
      throw new Error(
        `${name} must be HTTPS, without credentials/query/fragment${mustEndInV1 ? ', and end in /v1' : ''}`,
      )
    return value
  }
  return {
    api: check('EXPO_PUBLIC_API_URL', source.EXPO_PUBLIC_API_URL || '', true),
    web: check('EXPO_PUBLIC_WEB_URL', source.EXPO_PUBLIC_WEB_URL || '', false),
  }
}

/** xcodebuild's App Store Connect API key arguments, when all three are set. */
export function appStoreConnectAuth(source) {
  const keys = [
    ['APP_STORE_CONNECT_API_KEY_PATH', '-authenticationKeyPath'],
    ['APP_STORE_CONNECT_API_KEY_ID', '-authenticationKeyID'],
    ['APP_STORE_CONNECT_API_ISSUER_ID', '-authenticationKeyIssuerID'],
  ]
  const set = keys.filter(([name]) => source[name])
  if (set.length === 0) return []
  if (set.length !== keys.length)
    throw new Error(`Set all of ${keys.map(([name]) => name).join(', ')}, or none.`)
  return keys.flatMap(([name, flag]) => [flag, source[name]])
}

/** ExportOptions.plist for xcodebuild -exportArchive; automatic signing with the team's profiles. */
export function exportOptionsPlist({ method, team, upload }) {
  const entries = [
    ['method', method],
    ['teamID', team],
    ['signingStyle', 'automatic'],
    ['destination', upload ? 'upload' : 'export'],
    ['thinning', '&lt;none&gt;'],
  ]
  const body = entries.map(([key, value]) => `\t<key>${key}</key>\n\t<string>${value}</string>`)
  // The runner sets the build number; Xcode must not change it on upload.
  if (method === 'app-store-connect')
    body.push('\t<key>manageAppVersionAndBuildNumber</key>\n\t<false/>')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${body.join('\n')}
</dict>
</plist>
`
}
