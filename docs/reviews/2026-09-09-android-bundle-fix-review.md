# Review: Android bundle-loading fix

**Date:** 2026-09-09

**Reviewed range:** `42f4d574dc1b..db23f4b` (eight commits; 26 changed files).

**Verdict:** Findings 10 and 11 are implemented in the current fix. The wrapper rejects project
overrides, and Development is declared directly in the generated native package and namespace.
Validation for this fix is recorded below; earlier evidence remains dated to its original review.

## Whole-branch review at db23f4b

GitHub reports no PR for `codex/F-03-android-bundle-bug-report`. This review covers the entire
branch diff against its merge base with refreshed `origin/main`, rather than only the latest fix.
Remote main is now `aafa61f8`; the merge base remains `42f4d574dc1b`. This is not validation of a
merged result with the newer main.

### 10. [P2] Reject positional project overrides before prebuild

**Status:** Resolved. Supported options are parsed explicitly; positional project paths and unknown
options fail before any native subprocess starts. Device and port values remain supported.

**Location:** `scripts/android-development.mjs:59`.

`pnpm --filter @loro/mobile android /path/to/another-checkout/apps/mobile` passes the validator.
Prebuild still synchronizes this wrapper's mobile directory, but Expo interprets the forwarded
positional argument as the project root for `run:android`. That second command can build/install a
different project's APK while still launching `app.loro.android.dev`. With another Loro checkout
containing an older generated native project, this can reopen the existing Development installation
instead of the newly built app, or fail because the requested activity is absent. A fixed subprocess
working directory does not constrain Expo's positional project argument.

**Evidence:** intercepted both wrapper subprocess calls without executing them, then ran the second
call's arguments through the installed Expo `resolveStringOrBooleanArgsAsync`. Supplying
`/tmp/loro-preview-checkout` kept prebuild's working directory at this checkout's `apps/mobile`, but
the parsed run project became `/tmp/loro-preview-checkout`. No alternate checkout was created and no
native command or APK installation occurred.

**Suggested fix:** explicitly validate supported launch arguments and reject positional project
overrides before any subprocess starts. Account for values belonging to `--device`/`-d`,
`--port`/`-p` and `--variant`, including equals forms. Keep both commands bound to the same mobile
directory. Test an absolute and relative trailing project path alongside valid option values;
rejected inputs must invoke zero subprocesses.

### 11. [P2] Preserve the Development identity when restarting Metro separately

**Status:** Resolved. Development config now sets `android.package` to `app.loro.android.dev`.
Prebuild generates that package and activity namespace directly, and the plugin removes its previous
owned suffix when migrating an existing project. Preview remains `app.loro.android.preview`.

**Location:** `apps/mobile/plugins/with-dev-client-identity.cjs:10`.

The new debug suffix changes the installed package to `app.loro.android.dev`, but the config and
Gradle base application ID remain `app.loro.android`. After stopping the wrapper's Metro process,
running `pnpm --filter @loro/mobile start --dev-client` and pressing `a` starts a fresh Expo
launcher without the wrapper's custom launch properties. Expo resolves the unsuffixed ID and reports
`No development build (app.loro.android) for this project is installed`, even when Development is
installed. Exporting `LORO_ANDROID_DEV_CLIENT=1` alone does not repair the package lookup.

The initial wrapper launch is unaffected: it passes a custom package and fully qualified activity.
Expo also caches those properties for subsequent `a` presses in that same launcher session. The
regression concerns a fresh Metro session, or an existing separately started Metro session reused by
the wrapper; it is not a failure of every `a` press.

**Evidence:** exercised the installed `AndroidAppIdResolver` with the real mobile config and both
Development flags set. It resolved `app.loro.android`. Then exercised Expo's fresh Android custom
runtime launcher with device access stubbed to represent only `app.loro.android.dev` installed: it
queried the unsuffixed package and emitted the error above. Native-project source inspection
confirms the same lookup behavior: Expo's `getApplicationIdAsync` reads `applicationId` from Gradle
without applying `applicationIdSuffix`. No real device state was changed by this probe.

**Suggested fix:** provide a Metro-only Development entry point that carries the package and full
activity into the launcher, or represent the Development package in config/generated native defaults
so Expo's ordinary resolver matches it. Preserve Preview's release identity and callback scheme.
Verify both the initial build/launch and a separate Metro restart with only Development installed;
also test reuse of a server started before the build command.

### Validation and coverage

- Inspected all changed source, tests, build scripts and documentation, including the original bug
  report and retained logcat evidence. Reviewed callback selection, exact API redirect validation,
  Preview build-environment sanitization, Gradle identity and owned manifest schemes.
- Fresh `pnpm check` completed with exit 0: all eleven Android configuration tests passed; Turbo
  reported 23/23 successful tasks, all from cache. This reuses valid source checks rather than
  claiming a fresh execution of every unit suite.
- Branch commitlint, scoped source formatting and `git diff --check origin/main...HEAD` passed.
- The two diagnostic probes above exercised the current wrapper and installed Expo implementation.
  Existing tests do not exercise positional project selection or a fresh Metro launch session.
- No full `pnpm ci:local`, merged-main build, APK rebuild, device launch or live provider sign-in
  was performed in this review. Earlier emulator evidence remains historical and does not close
  these newly identified paths. Those limits describe the original review; see the subsequent fix
  validation below.

### Fix validation for findings 10 and 11

- Android configuration tests cover positional-path rejection, valid device/port options, migration
  from the old suffix, and a fresh installed Expo launcher resolving Development through a native
  Gradle fixture. Device access is stubbed in that regression test.
- A real Development prebuild generated package and namespace `app.loro.android.dev`, with no
  additional suffix, a matching Kotlin MainActivity package and only the owned `loro-dev` scheme.
- The installed package name is unchanged from previous Development builds. Rebuild once to update
  the activity namespace; no uninstall or learner-data deletion is required.
- Intercepted wrapper execution confirms rejected absolute/relative project overrides start zero
  subprocesses, while valid device/port arguments retain the same mobile directory for both steps.
- `pnpm check` completed with exit 0 (13 Android configuration tests; 23/23 Turbo tasks successful).
- The real Android debug build succeeded and updated the existing installation on Pixel_8_API_36.
  After stopping that Metro process, a fresh
  `pnpm --filter @loro/mobile start --dev-client --port 8097` session reopened the force-stopped app
  using `a`. The foreground activity was `app.loro.android.dev/.MainActivity`; Today rendered with
  existing progress. No app data was cleared.
  [Fresh Metro launch screenshot](evidence/2026-09-09-android-script-load/fresh-metro-launch.png).
- Full local CI and live provider sign-in were not rerun for this fix.

## Review of commit 6ec714d and the complete branch

### 8. [P2] Prevent forwarded `--app-id` from overriding the Development launch target

**Status:** Resolved. The wrapper rejects every caller-supplied `--app-id` form before prebuild and
retains its single generated Development launch ID.

**Location:** `scripts/android-development.mjs:50`.

**Original behavior:** the validator permitted `--app-id app.loro.android.preview` and its equals
form. The wrapper appended these arguments after its own `--app-id app.loro.android.dev`, and Expo's
argument parser uses the last value. Consequently, the command builds and installs Development but
attempts to launch an activity in Preview. Launch can fail because that package or activity is
absent, or target an existing installation instead of the app just built. The fixed package argument
is therefore not enforced.

**Evidence:** passed both forms through `validateDevelopmentArguments`, then parsed the exact
combined argument order with the installed Expo CLI's `assertWithOptionsArgs`. Both returned
`app.loro.android.preview`. Expo's `resolveLaunchPropsAsync` uses that value as `customAppId` and as
the package component of `launchActivity`. No APK installation was needed for this reproduction.

**Possible solutions:**

1. **Implemented: reject caller-supplied `--app-id` before prebuild.** The existing argument
   validator rejects both `--app-id value` and `--app-id=value`, including empty or missing values.
   The command explains that it owns the Development package. Even the matching Development ID can
   be rejected as redundant, giving this option the same simple contract as `--binary`. Keep exactly
   one wrapper-generated `--app-id app.loro.android.dev` in the Expo invocation. This is the
   smallest change and makes an unsupported request visible instead of silently ignoring it.
2. **Alternative: accept only an explicit matching ID.** Parse every occurrence, reject missing,
   empty or conflicting values before prebuild, and strip accepted occurrences before forwarding
   arguments. This preserves callers that already pass `app.loro.android.dev`, but requires more
   parsing and duplicate-option tests. A later matching value must not conceal an earlier conflict.
3. **Broader alternative: allowlist supported launch options.** Parse supported device, port, cache,
   bundler and debug-variant options; reject identity overrides and positional project-root
   overrides, then construct the Expo arguments explicitly. This also prevents a caller from
   redirecting `run:android` to a different project than the one synchronized by prebuild. It is a
   larger CLI contract change and needs documentation plus compatibility checks against the
   installed Expo options.

Appending the fixed ID last would exploit the current parser's last-value rule, but silently discard
the user's request. Prefer explicit validation over relying on duplicate-option precedence.

**Verification:** the Android configuration suite covers separated, equals and missing `--app-id`
forms alongside valid debug arguments. Direct invocations with both Preview-ID forms exit before
prebuild, so no native project is synchronized.

### 9. [P2] Keep Expo dotenv loading from restoring the Preview flag

**Status:** Resolved. The Development subprocess environment now sets `LORO_LOCAL_APK='0'` and
`LORO_ANDROID_DEV_CLIENT='1'`, which keeps Expo dotenv loading from selecting Preview.

**Location:** `scripts/android-development.mjs:31–34`.

**Original behavior:** deleting `LORO_LOCAL_APK` from the child environment made it available for
Expo to populate from the mobile project's `.env` files. Both `expo prebuild` and `expo run:android`
call `@expo/env.load(projectRoot)` before reading configuration. If a local `.env` contains
`LORO_LOCAL_APK=1`, the ordinary Development command again selects Preview's base package, `loro`
scheme and `loro://account` callback. The debug suffix produces `app.loro.android.preview.dev`,
while the wrapper still launches `app.loro.android.dev`.

**Evidence:** created an isolated temporary `.env` containing only `LORO_LOCAL_APK=1`, started a
Node child with `developmentEnvironment(process.env)`, and invoked the installed Expo dotenv loader
followed by the real mobile config reader. The result was:

```json
{
  "previewFlag": "1",
  "developmentFlag": "1",
  "package": "app.loro.android.preview",
  "scheme": "loro",
  "callback": "loro://account"
}
```

The temporary fixture was removed. No workspace environment file or native project was changed. The
current environment unit test checks only the object before Expo loads dotenv, so it misses this
boundary.

**Possible solutions:**

1. **Implemented: explicitly set `LORO_LOCAL_APK='0'` in the Development subprocess environment.**
   Set it after spreading the inherited environment, alongside `LORO_ANDROID_DEV_CLIENT='1'`, and
   pass the same environment to prebuild and run. The config enables Preview only for the exact
   value `'1'`; an explicit process value also prevents ordinary Expo dotenv loading from filling
   the key. This keeps `.env` support for legitimate development settings and overrides an inherited
   Preview value without changing the standalone runner's Preview precedence. Update the existing
   unit test and documentation from “removes the flag” to “forces Development mode.”
2. **Alternative: load dotenv, then reject a conflicting Preview configuration.** Resolve the same
   dotenv files and mode Expo will use, detect `LORO_LOCAL_APK=1`, and fail before prebuild with a
   message identifying the conflicting setting. This makes configuration mistakes explicit, but
   requires users to remove the conflict and introduces responsibility for matching Expo's loader. A
   check made before dotenv loading would reproduce the current gap. Keep the validated values fixed
   in the child environment so subsequent loading cannot change the selected identity.
3. **Alternative with a larger tradeoff: disable dotenv for both subprocesses.** Set
   `EXPO_NO_DOTENV=1` and explicitly select the two build flags. This closes the demonstrated path,
   but would also stop loading development settings such as `EXPO_PUBLIC_API_URL` from local files.
   Use it only with an intentional, documented replacement for that configuration workflow; it is
   unnecessary for this narrow fix.

Do not reverse the global config precedence merely to fix the Development wrapper: the standalone
Preview runner must remain protected against an inherited Development flag.

**Verification:** a fresh Node subprocess loads a temporary `.env` containing `LORO_LOCAL_APK=1`
through the installed Expo loader, then reads the real mobile config. The explicit process value
survives; the config reports base package `app.loro.android`, scheme `loro-dev` and callback
`loro-dev://account`. A non-secret sentinel from the fixture also loads, showing that ordinary
dotenv settings remain available. The fixture is removed after the test.

### Verification for this review

- Reviewed all branch source changes, owning documentation and the relevant installed Expo parser,
  launch resolver and environment loader.
- Fresh `pnpm test:android-config`: eleven tests passed.
- Fresh focused mobile redirect and API redirect validation suites: two tests passed in each.
- Branch commitlint and `git diff --check origin/main...HEAD` passed.
- The two reproductions above exercise installed dependency behavior without installing APKs or
  starting Metro. No new emulator launch, provider sign-in or full local-CI run was performed.
- `pnpm check`, scoped formatting and `git diff --check` passed after the final source change.
  Device launch verification remains a separate acceptance check.

## Review of commit 67ed861 and the complete branch

### 6. [P2] Validate or reject custom APKs before forwarding `--binary`

**Status:** Resolved. The command rejects both `--binary path` and `--binary=path` before prebuild,
so it cannot install an arbitrary APK while targeting Loro Development.

**Location:** `scripts/android-development.mjs:35–39`.

`pnpm --filter @loro/mobile android --binary /path/to/loro-preview.apk` passes the new validator
because no non-debug `--variant` is present. The wrapper forwards the binary together with its fixed
`--app-id app.loro.android.dev`. Expo skips compilation when `--binary` is provided and installs
that APK, but uses the configured Development activity as the launch target. Supplying the
standalone Preview APK therefore installs Preview and opens the existing Development installation,
or fails to launch if Development is absent. The default debug variant does not constrain an
externally supplied APK.

The command rejects `--binary` before prebuild and directs standalone APK use to `pnpm apk:local`.

**Original evidence:** invoked `runAndroidDevelopment` with `spawnSync` intercepted in memory; the
recorded second command was
`pnpm exec expo run:android --app-id app.loro.android.dev --binary /tmp/loro-preview.apk`. Inspected
the installed Expo CLI's `runAndroidAsync`: it skips Gradle for `options.binary`, installs the
supplied path, and forwards `props.launchActivity` and `props.customAppId` to the launcher. No
actual APK was installed during this review. The regression test now covers both binary forms.

### 7. [P2] Clear or reject the Preview build flag in the development command

**Status:** Resolved. The command forces `LORO_LOCAL_APK=0` while setting
`LORO_ANDROID_DEV_CLIENT=1`, preserving Preview precedence only for the standalone runner.

**Location:** `scripts/android-development.mjs:36`.

With `LORO_LOCAL_APK=1` exported, running the ordinary Android command preserves that flag while
setting `LORO_ANDROID_DEV_CLIENT=1`. Preview deliberately takes precedence in `app.config.ts`: the
resulting base package is `app.loro.android.preview`, the scheme is `loro`, and the callback is
`loro://account`. The debug Gradle suffix then produces `app.loro.android.preview.dev`, while the
command still launches `app.loro.android.dev`. This either opens an older Development app or fails,
and the newly installed debug package also competes with Preview for `loro://` callbacks.

The command forces `LORO_LOCAL_APK=0` in its subprocess environment. Preview precedence remains
unchanged in the standalone runner, and the regression tests assert the exact development
environment and real Expo dotenv behavior.

**Original evidence:** intercepted the wrapper's subprocess calls with `LORO_LOCAL_APK=1`, then
evaluated Expo config under the captured build flags. Observed package `app.loro.android.preview`,
scheme `loro`, callback `loro://account`, and launch argument `app.loro.android.dev`. The `.dev`
suffix is verified in the branch's Gradle plugin. No native project was generated during this
review. The regression test now proves that the wrapper omits `LORO_LOCAL_APK`.

### Current verification

- `pnpm test:android-config` covers nine cases, including both binary forms and the sanitized
  subprocess environment.
- Intercepted command execution confirms `--variant release` starts zero subprocesses.
- Direct command checks confirm rejected release and binary inputs start no native subprocesses.
- Reviewed the full branch's config plugin, runtime callback selection, API redirect validation, APK
  environment, command scripts, tests and documentation. Earlier findings 1–5 remain resolved within
  their stated scope.
- Prior `pnpm check`, emulator and PostgreSQL results remain historical evidence. Full local CI has
  no recorded final success; live provider sign-in and a rebuilt emulator launch were not repeated
  for this review.
- This resolution implements findings 6 and 7 and updates their owning documentation.

## Follow-up review

### 5. [P2] Match the launch identity to the requested Android variant

**Status:** Resolved. The Android wrapper validates arguments before prebuild and rejects every
non-debug or incomplete `--variant` value. It directs standalone release use to `pnpm apk:local`,
which selects the separate Preview identity.

**Location:** `apps/mobile/package.json:9`.

`pnpm --filter @loro/mobile android --variant release` forwards the variant to Expo while the
wrapper still forces `LORO_ANDROID_DEV_CLIENT=1` and `--app-id app.loro.android.dev`. The plugin
adds `.dev` only to the debug build type (`with-dev-client-identity.cjs:7–12`), so the release APK
uses `app.loro.android`. Expo consequently installs the release package but targets Development when
opening the app. With Development installed, a tester can see that older app instead of the release
just built; without it, launch fails. The release also inherits `loro-dev` in its main manifest and
callback configuration, competing with Development for its links.

The implementation explicitly rejects non-debug variants before prebuild and directs standalone
users to `pnpm apk:local`. The Android command therefore cannot generate a release project with the
development scheme or launch package.

**Evidence:** the regression test covers `--variant release`, `--variant=release`, and a missing
variant value; direct invocation with `--variant release` exits before prebuild. A release build is
not needed because this command no longer permits a release variant.

### Verification during the follow-up review

- Reviewed all changed source, tests, build scripts and documentation against `origin/main`.
- `pnpm test:android-config`: seven tests pass, including release-variant rejection.
- Focused mobile callback tests: two pass; API redirect validation tests: two pass.
- Scoped plugin/build-environment formatting and branch commitlint pass.
- Earlier emulator installation/handler checks, `pnpm check`, and PostgreSQL validation are prior
  evidence, not fresh runs in this review. Full local CI still has no recorded final success; live
  provider sign-in and release-variant launch were not exercised here.
- This follow-up implements and records the resolution for finding 5.

## Earlier findings and resolutions

### 1. [P1] Keep OAuth callbacks consistent with the development scheme

**Status:** Resolved. `app.config.ts` publishes one native callback URI per build identity; the
runtime consumes it through an exact allowlist. The API accepts only `loro://account` and
`loro-dev://account` alongside exact HTTPS URLs, while deployment configuration still controls which
callbacks are enabled.

**Changed location:** `apps/mobile/app.config.ts:38–40`.

The Android command now selects `loro-dev` as the app scheme. A fresh native project therefore
registers `loro-dev://`, but `apps/mobile/src/auth/runtime.ts:19–22` still passes `loro://account`
to the sign-in client and `WebBrowser.openAuthSessionAsync`. When a tester signs in from a fresh
Development installation, the callback cannot return to that installation. If Preview is installed,
it can receive the callback instead; otherwise no Loro activity handles it. The pending state and
PKCE verifier belong to the initiating app, so opening another app does not complete the flow.

Changing only the client redirect is insufficient: `apps/api/src/auth/settings.ts:35–45` permits
HTTPS callbacks or exactly `loro://account`, and the auth service also enforces its configured
allowlist. Choose a consistent per-build callback contract, update the explicit server validation
and configuration where necessary, and verify that each installed app receives its own callback. Do
not broaden the server to accept arbitrary custom schemes.

**Evidence:** inspected the native auth runtime and server validation; exercised the installed Expo
manifest scheme plugin in memory. A fresh manifest receives only `loro-dev`.

### 2. [P2] Remove obsolete owned schemes when synchronizing an existing native project

**Status:** Resolved. The Android config plugin removes only the two Loro-owned schemes before
adding the active one. Its regression test preserves an unrelated scheme, and a rebuilt emulator
installation routes `loro://account` only to Preview and `loro-dev://account` only to Development.

**Changed location:** `apps/mobile/package.json:9`.

The new command uses incremental `expo prebuild --platform android --no-install`, but Expo's
installed `AndroidConfig.Scheme.setScheme` appends schemes and does not remove old ones. Running
this command on a project previously generated with `loro` leaves both `loro` and `loro-dev`
registered on Development. Preview callbacks and other `loro://` links still have two possible
handlers, despite the stated separation. It also masks finding 1 during testing on a reused project.

**Live evidence:** read-only
`adb ... cmd package query-activities --brief -a android.intent.action.VIEW -d loro://account`
returned both `app.loro.android.dev` and `app.loro.android.preview`. The equivalent
`loro-dev://account` query returned only Development. The retained generated manifest at
`/tmp/loro-android-generated-pst8em/android/app/src/main/AndroidManifest.xml:37–38` contains both
schemes. An in-memory transition from `loro` to `loro-dev` reproduces the retained registration.

Synchronize the schemes owned by this project explicitly, preserving unrelated intent filters. Test
both a fresh project and a transition from the previous config, including callback resolution.
Resolve this together with finding 1; removing the stale scheme alone exposes the auth failure.

### 3. [P2] Prevent the development flag from changing a standalone Preview build

**Status:** Resolved. Preview takes precedence in `app.config.ts`, and the local APK runner removes
an inherited development-client flag. The configuration-matrix and build-environment tests cover the
combined-flags case.

**Changed location:** `apps/mobile/app.config.ts:17–18,40`.

`LORO_ANDROID_DEV_CLIENT` wins the scheme decision even when `LORO_LOCAL_APK=1`.
`scripts/apk-local.mjs:33–40` inherits the caller's environment and forces the Preview flag, but
does not clear the new development flag. A caller with `LORO_ANDROID_DEV_CLIENT=1` exported can
therefore build `app.loro.android.preview` with `loro-dev://`. The existing APK checks validate
package, debug status, bundle and native libraries, so this callback-breaking artifact can pass.

**Reproduction:** evaluating Expo config with both flags set to `1` returned:

```json
{ "scheme": "loro-dev", "package": "app.loro.android.preview" }
```

Make the build modes mutually exclusive or give standalone mode explicit precedence, sanitize the
build environment, and add a configuration-matrix regression check. Normal Preview must retain its
intended callback scheme regardless of inherited development settings.

### 4. [P2] Correct the commit subjects before the local CI gate

**Status:** Resolved. The branch commits were rewritten with lowercase `(f-03)` subjects and are
validated with commitlint before this review is closed.

**Affected commits:** all three commits in the reviewed range.

`pnpm exec commitlint --from 42f4d57 --to HEAD` exits 1 because each subject ends in uppercase
`(F-03)`. The repository requires lowercase subjects. `pnpm check` does not run commitlint, while
`pnpm ci:local` does when `CI_BASE_REF` is provided. Use `(f-03)` in commit subjects and retain the
canonical uppercase requirement ID in documentation. No history was rewritten during this review.

## Scope and evidence limits

The implementation distinguishes a Metro-dependent debug app and corrects Expo's development launch
link. It does not embed JavaScript in debug builds: cold launch with Metro stopped can still produce
the original error. Preview already had a bundled build and worked before these changes. The
report's “fixed” status should describe that workflow scope, rather than imply debug startup now
works without Metro.

The earlier fix pass uninstalled `app.loro.android` after observing an on-device directory that
included databases. Failure to start during this session did not prove that installation had never
held learner data. No data backup is evidenced; the retained APK is not a data backup. Do not repeat
that cleanup assumption when applying the fix to another installation. This is an execution concern,
not a new code finding or a claim that the removed databases contained learner progress.

## Checks performed for this review and resolution

- Reviewed the complete branch diff, auth callback code, APK environment construction and the
  installed Expo scheme transformation.
- `pnpm test:android-config`: five tests pass, covering the configuration matrix, Gradle identity,
  stale-scheme replacement and APK environment sanitization.
- Focused mobile and API callback tests pass.
- A fresh Android prebuild has only `loro-dev` in its manifest. Reinstalling the debug app through
  `pnpm --filter @loro/mobile android` opened `app.loro.android.dev`; Android now resolves each
  callback scheme to exactly one installed Loro app.
- `pnpm check` and commitlint pass. The PostgreSQL-backed auth/sync validation also passes (173
  tests). A full local-CI run was started but did not yield a final completion result in this
  session, so its browser, image and benchmark stages are not claimed here. Live provider sign-in
  remains untested because its configured backend allowlist is an environment deployment concern.
