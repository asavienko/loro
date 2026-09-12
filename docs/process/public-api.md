# Standalone Android API access

Requirement F-03; implementation tracked in
[plan 92](../../plans/archive/2026-09-08/92-android-ec2-readiness.md). The gateway defaults to
read-only development access. The optional account profile forwards Google/Apple/email
authentication and guarded sync only after a durable API is deployed. Readiness checks both
PostgreSQL and WASM; it does not prove a live provider sign-in.

## Deployed topology

Android → API Gateway HTTPS → VPC-attached Lambda → EC2 nginx on port 8080 → loopback API on 3000.
The public endpoint uses an AWS-owned certificate and hostname; no domain registration is needed.
Lambda has security-group egress only to the proxy. EC2 permits that gateway security group and
retains its restricted SSH rule; neither API port is open to the public internet. No NAT gateway or
load balancer is provisioned. API Gateway and Lambda are metered services.

In the default read-only profile, the gateway and nginx independently allow only GET requests to
`/v1/health`, `/v1/health/ready`, `/v1/content/v2/manifest`, `/v1/content/v2/diff`,
`/v1/content/v2/pack`, and `/v1/auth/providers`. Locale/version/pack query parameters are forwarded.
Caller cookies and authorization are not. Sync, AI, sign-in mutations and all other paths remain
unavailable through this endpoint. The gateway is limited to 10 requests/second with a burst of 20;
responses are not cached.

## Account profile (F-01/F-04)

**Enabled on the development gateway on 2026-09-08.** Google is configured in testing mode for the
owner account. Apple remains unavailable. Email uses the host-local `inbox:local` delivery file on
the development API; a public mail sender is still unconfigured. Durable readiness, Google
authorization start, cancellation callback redirect and rejection of anonymous account/sync access
passed through HTTPS. The in-app browser blocked navigation to the AWS hostname
(`ERR_BLOCKED_BY_CLIENT`), so a complete live Google consent-to-device session is still unverified.

`AccountAccess=enabled` opts into exact auth, `/me` and POST sync routes. The Lambda forwards
bounded request bodies, bearer/device/idempotency headers and API CORS decisions. OAuth callback
redirects are returned to the browser, never followed by Lambda. Cookies, caller forwarding headers
and arbitrary upstream URLs are excluded. AI remains unavailable. The API still uses transport-peer
rate limits; all gateway users share the proxy's auth rate bucket in this development deployment.

Use `scripts/deploy-ec2-proxy.sh HOST accounts` to install the corresponding exact-method nginx
profile. `readonly` restores the original profile. Leave the CloudFormation parameter disabled until
private readiness, provider discovery, database recovery and auth tests pass. Set `AccountAccess`
back to `disabled` to withdraw account access without deleting data.

## Deploy

Use the current outputs from `loro-api-dev` in `eu-central-1` with AWS profile `loro`. Authenticate
and verify STS first. The existing [EC2 release process](ec2-deployment.md) deploys the API. Then:

```bash
bash scripts/deploy-ec2-proxy.sh EC2_PUBLIC_DNS
aws cloudformation deploy --profile loro --region eu-central-1 \
  --stack-name loro-api-gateway --template-file infra/ec2/https.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides VpcId=VPC_ID SubnetId=SUBNET_ID \
  PrivateIp=EC2_PRIVATE_IP OriginSecurityGroup=EC2_SECURITY_GROUP
aws cloudformation describe-stacks --profile loro --region eu-central-1 \
  --stack-name loro-api-gateway --query 'Stacks[0].Outputs'
```

The proxy image is digest-pinned, runs without Linux capabilities as a non-root user, and validates
configuration under those restrictions before deployment. The gateway handler is tested directly
from the CloudFormation inline source by `pnpm test:deploy`. Updating an instance's private IP
requires updating this stack. Do not delete the base EC2 stack while this gateway uses its group.

## Verify and build

For the enabled account profile, run:

```bash
node scripts/check-account-api.mjs https://AWS_GATEWAY_HOST/v1
```

This checks the public account boundary without signing in a person or logging OAuth material. It
does not replace the final device consent/session test. The older read-only probe below applies only
when `AccountAccess=disabled`.

Read `ApiUrl` from the completed gateway stack. Check `/health/ready`, multilingual content with
explicit `native` and `target` queries, and `/auth/providers`. Verify `/sync/pull`, `/ai/scene` and
POST `/health/ready` are denied before building. The repeatable probe checks all seven language
pairs:

```bash
node scripts/check-public-api.mjs https://AWS_GATEWAY_HOST/v1
```

Build the APK:

```bash
EXPO_PUBLIC_API_URL=https://AWS_GATEWAY_HOST/v1 pnpm apk:local
```

The URL is baked into the standalone APK; a server change cannot alter an already-installed APK.
Open Account and use Check connection. A connected message requires a valid successful readiness
response; sign-in availability is checked separately. Failure never prevents local practice.

For monitoring, inspect the `loro-api` and `loro-public-proxy` containers, gateway CloudFormation
outputs and the Lambda log group (seven-day retention). Roll back API images through the existing
release script; the gateway remains unchanged. Remove the gateway stack to withdraw public access,
then remove the proxy container if no longer needed. This does not delete the base API instance.

[AWS Lambda VPC access](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html) and
[API Gateway HTTP APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api.html)
describe the managed connection mechanisms used here.
