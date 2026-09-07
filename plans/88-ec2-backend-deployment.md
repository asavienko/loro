# EC2 backend deployment

- **Requirement IDs:** M0 delivery leftovers (plan 73)
- **Status:** 🟡 Infrastructure and deployment scripts implemented; live provisioning and rollback
  rehearsal await AWS region, network and SSH key inputs.
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
