# Android emulator: Loro cannot load its JavaScript bundle

- **Bug ID:** ANDROID-2026-09-09-01
- **Status:** Fixed in the current source — the standalone Preview build remains the correct
  no-Metro path, while the debug build now has its own launcher, package and launch scheme.
- **Impact:** Blocks entry to every learner screen on the reported emulator installation.
  Distribution-wide impact and data loss are not established.
- **Requirement / owner:** F-03 (offline practice); Android build and device acceptance in
  [plan 58](../../plans/58-native-workspace-and-device-ci.md).
- **Investigated source:** `42f4d574dc1b` (this checkout). The installed APK's source commit and
  exact build command are unknown; do not attribute the binary to this commit without build
  evidence.

## Reported behavior

Opening Loro in the Android emulator displays React Native's red error screen instead of the app:

```text
Unable to load script.

Make sure you're running Metro or that your bundle
'index.android.bundle' is packaged correctly for release.
```

The visible stack starts at `loadJSBundleFromAssets` (`ReactInstance.kt`), followed by
`access$loadJSBundleFromAssets` (`ReactInstance.kt:85`), `loadScriptFromAssets`
(`ReactInstance.kt:314`), `loadScript` (`JSBundleLoader.kt:33`) and `loadJSBundle`
(`ReactInstance.kt:293`). The screen offers Dismiss and Reload.

Evidence: user screenshot named `Screenshot 2026-09-09 at 14.17.11.png`, retained unchanged below.
Its Metro/USB instructions are generic diagnostic text, not proof of the underlying cause.

![Reported Android script-loading error](evidence/2026-09-09-android-script-load/reported-error.png)

## Live observations on 2026-09-09

Read-only checks initially returned:

```text
$ adb devices -l
emulator-5554 device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:9

$ adb shell dumpsys activity activities | rg 'mResumedActivity|topResumedActivity'
topResumedActivity=ActivityRecord{13105396 u0 app.loro.android/.MainActivity t18}

$ adb shell pm list packages | rg loro
package:app.loro.android.preview
package:app.loro.android
```

`adb reverse --list` returned no mappings. `lsof -nP -iTCP:8081 -sTCP:LISTEN` returned no listener.
These checks establish the state at inspection time, not necessarily at screenshot time. They do not
rule out a differently configured remote Metro server.

After a brief disconnect, the user reopened the emulator and investigation continued:

| Property                           | Affected Loro            | Loro Preview comparison               |
| ---------------------------------- | ------------------------ | ------------------------------------- |
| Package                            | `app.loro.android`       | `app.loro.android.preview`            |
| Version / code                     | `0.1.0` / `1`            | `0.1.0` / `1`                         |
| Manifest                           | `DEBUGGABLE`             | Non-debuggable                        |
| Last update (device output)        | `2026-09-07 16:23:47`    | `2026-09-08 15:11:58`                 |
| APK size                           | 58,065,669 bytes         | 45,533,373 bytes                      |
| `assets/index.android.bundle`      | Absent                   | Present, 2,477,900 bytes uncompressed |
| Launch with no host Metro listener | Red script-loading error | Onboarding renders                    |

The emulator is `Pixel_8_API_36`, Android 16 / API 36, `sdk_gphone64_arm64`. Each installed package
reported one `base.apk`; both were pulled and inspected as ZIP archives.

APK SHA-256 values:

```text
Loro:         dbc8fc91e3264841b6c8e11ac72b145d4e1a271a515eafdd439be8ea81f53842
Loro Preview: 046201e53620f89b78b5895a88852a82854e7f0fa8a4cb1190890bf015617fdf
```

On the affected package, `am force-stop` followed by `am start -W` reproduced the exact error.
`am start` returned `Status: timeout`, `LaunchState: UNKNOWN (-1)`, `WaitTime: 10522`; process
`3529` logged the asset-loading exception at device time `09-09 14:22:01.547`. The
[retained logcat excerpt](evidence/2026-09-09-android-script-load/cold-launch-logcat.txt) contains
only the affected process's React Native error lines.

![Independently reproduced error](evidence/2026-09-09-android-script-load/cold-launch.png)

Preview returned `Status: ok`, `LaunchState: COLD`, `TotalTime: 759` and rendered onboarding. This
proves startup without the host Metro server, not full offline practice, current-source acceptance
or server connectivity. Networking was not disabled for this comparison.

![Preview startup comparison](evidence/2026-09-09-android-script-load/preview-launch.png)

No app data was cleared, APK replaced or Metro configuration changed during diagnosis. After the fix
was verified, the obsolete `app.loro.android` installation was uninstalled from this emulator. Its
on-device directory measured 9,284 KiB immediately before removal; no claim is made about the
meaning of individual cached or database files. Preview and the new development app remain
installed.

## Expected behavior and diagnosis

A standalone testing APK must cold-launch without Metro, including offline. A development APK
requires a reachable Metro server if its variant omits bundled JavaScript.
[React Native's Gradle plugin documentation](https://reactnative.dev/docs/react-native-gradle-plugin)
confirms that variants listed in `debuggableVariants` skip JavaScript bundling and require Metro.

**Confirmed failure layer:** React Native could not load JavaScript; startup did not reach the
learner UI. The asset-loading stack points to bundle loading, not an Account/API readiness error.

**Immediate cause confirmed:** the affected debuggable binary has no embedded JavaScript bundle, and
its runtime attempts asset loading and fails while no host Metro server is listening on 8081. It
cannot function as a standalone installation in this state. The installed Preview has its bundle and
starts successfully.

**Root cause:** a Metro-dependent debug installation used the same `app.loro.android` package,
“Loro” launcher label and `loro://` scheme as the app intended for standalone use. With Metro
stopped, it could only fail at JavaScript loading. The shared scheme also made Android offer several
Loro installations when Expo launched the development link.

Relevant source at the investigated commit:

- [`apps/mobile/package.json`](../../apps/mobile/package.json): `android` invokes
  `expo run:android`; `start` invokes `expo start`.
- [`apps/mobile/app.config.ts`](../../apps/mobile/app.config.ts): `LORO_LOCAL_APK=1` selects the
  separate Loro Preview name and package.
- [`scripts/apk-local.mjs`](../../scripts/apk-local.mjs): assembles `:app:assembleRelease`, rejects
  a debuggable manifest or wrong package, and requires `assets/index.android.bundle`. This checks
  packaging; it does not establish that the affected APK passed those checks or can boot.

## Reproduction

Precondition: keep the affected APK identified above installed on this emulator, with no Metro
server listening on the host's port 8081 and no ADB reverse mappings. Exact original build/install
commands remain unknown.

```bash
adb -s emulator-5554 shell am force-stop app.loro.android
adb -s emulator-5554 shell am start -W -n app.loro.android/.MainActivity
```

Actual: the red script-loading screen appears; app-scoped logcat records
`java.lang.RuntimeException: Unable to load script` in `loadJSBundleFromAssets`.

## Resolution and verification

The current source now makes the build mode visible and routable:

- Development configuration declares `app.loro.android.dev` directly and labels its launcher **Loro
  Development**. The plugin reconciles the earlier suffix-based generated project so a fresh Metro
  launcher can discover the installed package without a custom app-ID override.
- `pnpm --filter @loro/mobile android` synchronizes native configuration before compiling, then runs
  with `LORO_ANDROID_DEV_CLIENT=1`. That setting gives only this development build the `loro-dev://`
  scheme.
- The bundled `app.loro.android.preview` / **Loro Preview** build retains `loro://` and is the
  standalone path.

On the same Pixel_8_API_36 emulator, the supported developer command built and installed
`app.loro.android.dev`, opened `loro-dev://expo-development-client/?url=…`, started Metro and
reached the learner UI. The foreground activity was
`app.loro.android.dev/app.loro.android.MainActivity`; React Native logged `Running "main"`; no
`Unable to load script` message appeared. The Android resolver did not appear.

The debug variant requires the command's Metro process to remain running. Preview was launched again
after verification with Metro stopped and is left in the foreground.

The subsequent launch-identity fix was rebuilt and installed without clearing app data. A separate
Metro restart (`pnpm --filter @loro/mobile start --dev-client --port 8097`) then reopened
`app.loro.android.dev/.MainActivity` with the `a` shortcut and rendered Today with existing
progress. This supersedes the earlier activity namespace above; the installed package ID remains the
same. See the
[fresh Metro launch evidence](evidence/2026-09-09-android-script-load/fresh-metro-launch.png).

## Standalone use

For standalone testing, open the installed **Loro Preview** application. This exact command was
verified to reach onboarding without starting Metro:

```bash
adb -s emulator-5554 shell am start -W -n app.loro.android.preview/.MainActivity
```

The existing [local APK runbook](../process/local-apk.md) remains the standalone workflow. It
requires the bundle/manifest checks and a separate emulator cold-launch smoke; full offline practice
and persistence acceptance remain separate gates.
