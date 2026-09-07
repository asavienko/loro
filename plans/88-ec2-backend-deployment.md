# EC2 backend deployment

- **Requirement IDs:** M0 delivery leftovers (plan 73)
- **Status:** ✅ Restricted development deployment implemented and verified on EC2; manual rollback
  rehearsed on 2026-09-07. Production auth/persistence remain with plans 66–68.
- **Depends on:** Existing API image; plans 66–68 before public multi-user exposure.

## Scope

Provision a restricted Amazon Linux EC2 development host and deploy the existing API with a WASM
build, strict SSH transport, loopback binding, readiness gates, serialized cutover and rollback. See
[runbook](../docs/process/ec2-deployment.md). Production data/auth and wider plan 73 remain open.

## Validation

Shell syntax, ShellCheck, cfn-lint and `pnpm check` passed. `pnpm test:deploy` covers successful
replacement, candidate rejection without stopping the service, and rollback after cutover failure;
it runs in the repository gate and CI. Image build and live deployment/rollback evidence are
separate. AWS template validation was attempted but rejected with `InvalidClientTokenId`; no
resources were created.

Fresh `build:wasm` and linux/amd64 Docker image build passed. The resulting image booted locally
with the deployment's read-only filesystem and capability/resource restrictions; readiness returned
HTTP 200 with `content: ok` and `merge: ok`. This proves local container startup, not EC2 cutover.

## Live verification — 2026-09-07

Stack `loro-api-dev` in `eu-central-1` created instance `i-0ce58e049c8fe0f7b`. The refreshed `loro`
SSO profile resolved the earlier credential failure. The SSH host fingerprint was compared with
authenticated EC2 console output before trusting it. The deployment script built and transferred
`loro-api:67741e690fce-20260907131530`; the container reported healthy, with readiness returning
HTTP 200 and `content: ok`, `merge: ok`, including through a local SSH tunnel. Redeployment under a
second tag and manual rollback to the original tag both passed readiness (same image bytes; a
mechanical cutover rehearsal, not application-version compatibility testing). Automatic failure
rollback remains covered by the deployment test harness, not live fault injection.
