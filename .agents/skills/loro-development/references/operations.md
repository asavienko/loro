# Local runtime, APK and services

Use existing runbooks and scripts, verifying their presence first. Do not keep live IPs, resource
IDs, key values, test counts, APK hashes or account status in this skill.

## Local development

For fast web feedback, use the mobile package's Expo command from `apps/mobile` and an isolated
port; start the API only when the task needs it. For the documented container workflow, read
`docs/process/local-development.md` and use `pnpm local:up`. It builds a source snapshot: after code
changes rebuild before claiming the container exercises the change. Verify both the UI and
`/v1/health/ready`, including the Rust merge check. HTTP 200 from a generic route is insufficient.

`AI_PROVIDER=stub` allows local work without buying provider access. Inspect current auth/data
configuration before assuming every API mode is database-free. Optional Compose infrastructure does
not itself wire persistence into the application. Avoid overlapping the legacy and root Compose
stacks' ports; ordinary shutdown retains data volumes.

For cross-device access, distinguish server bind address, network/tailnet reachability, allowed
origin and actual bundle loading. A reachable HTML shell can still leave the app loading forever.
Inspect browser console and bundle requests. Do not assume a URL tested on the development machine
proves phone connectivity.

## Environment and providers

Locate examples with `rg --files --hidden -g '*.env.example' -g '.env.example'` rather than assuming
one exists at the root. Use `docs/process/environments.md` for each variable's owner. Real plaintext
environment files and age identities stay untracked; only encrypted `secrets/*.enc.env` is
versioned. The `.env.example` exception contains placeholders/non-secret defaults.

Use the existing `pnpm env:edit`, `env:encrypt`, and `env:decrypt` workflow. Decryption replaces the
local API environment, so encrypt intended local edits first. Verify round trips without printing
values. Avoid plain `docker compose config` output when it expands secrets; use `--quiet`. Keep
secret values out of logs, chat, APKs and this skill. Preserve Gitleaks hooks.

ElevenLabs supersedes historical TTS-provider alternatives; see Q-15 in
`docs/decisions/open-questions.md`, plan 61 and the provider-integration plan. Provider choice,
configured voice IDs, reviewed language quality, asset rights and delivered reference audio are
different milestones. `CONTENT_LANG` tooling/default-content work is separate from a learner's
native UI language and course target. Verify the latest plan before changing either.

## APK builds

Read `docs/process/local-apk.md`. `pnpm apk:local` builds a committed source snapshot with bundled
JavaScript; it does not use ignored local environment files or automatically push source.
`EXPO_PUBLIC_API_URL` is public build configuration, includes `/v1`, and must not contain secrets.
Use the current documented HTTPS endpoint, not an old chat's address.

Keep preview identity/signing and production identity separate. Verify source commit, embedded
bundle, signature and checksum. Custom native modules need generated bindings and Rust libraries
inside the build snapshot, not merely in the developer checkout. Use Expo-compatible dependency
versions; a newer Worklets release previously broke the Android build.

`pnpm apk:github` builds/uploads/verifies a draft prerelease; `--publish` publishes it. Invoke
upload/publish only within the current task's authorization. No GitHub Actions or EAS dispatch is
needed. Browser tests, JS export, native compilation, emulator smoke and physical-device tests
provide progressively different evidence; do not substitute one for another.

## EC2 and public access

Read `docs/process/ec2-deployment.md`, `docs/process/public-api.md` and
`docs/runbooks/backend-testing.md` for the relevant operation. Use the named AWS profile, refresh
SSO only as needed, and verify STS identity before AWS work. The SSO start URL is a plain URL; the
Identity Center region can differ from the EC2 region. Discover current stack outputs and verify
host identity before SSH.

Use the repository candidate-image readiness/cutover/rollback workflow. Test the exact production
image: missing runtime `zod` once escaped host checks and was caught before replacing the service.
Do not bypass this check. A branch merge does not update the running image.

The first deployment was SSH-only. Later work added a narrowly allowed public HTTPS catalog gateway.
Inspect the current allowlist: catalog/readiness success does not establish authenticated sync,
sign-in or AI access. Keep backend health, provider availability, persisted user data and phone
online/offline/reconnect behavior as separate verified results.
