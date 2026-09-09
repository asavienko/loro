# Review: Android bundle-loading fix

**Date:** 2026-09-09

**Reviewed range:** `42f4d574dc1b..b2a19cba8381aee2fd3a19335fdc0fcf666d3837`

**Verdict:** Resolved. The Android command now accepts only its Metro-dependent debug variant, and
the Preview APK workflow owns standalone release builds.

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
