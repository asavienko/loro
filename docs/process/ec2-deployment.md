# EC2 development host

The API runs on one restricted Amazon Linux 2023 EC2 instance (`infra/ec2/template.yaml`): a
t3.small with an encrypted 30 GiB disk, IMDSv2, Docker, and SSH from one IPv4 address. The API binds
to host loopback; admin access is an SSH tunnel. This is a development host, not production.

## Current instance

- AWS profile `loro` (SSO), region `eu-central-1`, stack `loro-api-dev`, instance
  `i-0ce58e049c8fe0f7b`, key pair `loro-ec2-dev` (private key at `~/.ssh/loro-ec2-dev`).
- The public DNS can change after stop/start; read the stack outputs before connecting. If your IP
  changes, re-run `scripts/provision-ec2.sh` with the new `ADMIN_CIDR` (add `NO_EXECUTE=1` to see
  the change set first). The script keeps the image the instance runs: a different one would replace
  the instance, its disk and the database on it.
- Merging to `main` does not redeploy; the running image is whatever was last deployed.

## Provision

Needs AWS credentials with CloudFormation/EC2 access, an existing VPC with a public subnet, and a
key pair.

```bash
export AWS_REGION=eu-central-1 VPC_ID=vpc-… SUBNET_ID=subnet-… KEY_NAME=… ADMIN_CIDR=YOUR_IP/32
./scripts/provision-ec2.sh
```

Verify the host key through the AWS console, add it to `known_hosts` (deploys use strict host-key
checking) and set `IdentityFile` in `~/.ssh/config`.

## Database

`scripts/ec2-database.sh` creates a persistent `loro-postgres` volume on a private `loro-backend`
Docker network (no host port) with a non-superuser `loro` owner; it never resets an existing
database. Runtime config comes from `secrets/ec2-api.enc.env` and `secrets/ec2-postgres.enc.env`,
decrypted locally, copied over SSH to root-owned mode-600 files (`/opt/loro/runtime/api.env`,
`/opt/loro/database/postgres.env`), then removed locally. Streaming it leaves no local copy:

```bash
sops decrypt --input-type dotenv --output-type dotenv secrets/ec2-api.enc.env |
  ssh ec2-user@HOST 'sudo install -D -m 600 -o root -g root /dev/stdin /opt/loro/runtime/api.env'
```

## Deploy

Node 22, installed dependencies, cargo on PATH and Docker with amd64 builds:

```bash
pnpm check
bash scripts/deploy-ec2.sh HOST /opt/loro/runtime/api.env loro-backend
ssh -N -L 127.0.0.1:13000:127.0.0.1:3000 ec2-user@HOST
curl --fail http://127.0.0.1:13000/v1/health/ready
```

The script builds WASM and the linux/amd64 image locally (working-tree changes included) and checks
it against a throwaway PostgreSQL (`scripts/ci-api-image.sh`), streams it over SSH, takes a
PostgreSQL dump, starts a candidate, swaps it in and re-checks; a failed check restores the previous
container. The candidate and the new container must pass readiness **and** serve
`GET /v1/library/pack?target=es-ES`: the first library request seeds Loro's content into the
database, so a seed that fails stops the release before cutover. Cutover has brief downtime. The
previous container is kept as `loro-api-previous` (restored to readiness only, since an older image
may predate the library); roll back by redeploying its image tag with the same runtime file and
network (without them the container has no database and fails readiness):

```bash
ssh ec2-user@HOST 'sudo bash -s -- loro-api:PREVIOUS_TAG /opt/loro/runtime/api.env loro-backend' \
  < scripts/ec2-release.sh
ssh ec2-user@HOST 'sudo docker logs --tail 100 loro-api'
```

Migrations must stay backward compatible: rollback never restores an older database over new writes.

## Runtime settings

`/opt/loro/runtime/api.env` (from `secrets/ec2-api.enc.env`; change it there, install it as above,
then redeploy, since containers read it when they start) holds the API's configuration. The release
adds `NODE_ENV=production`, `AI_PROVIDER=stub` (the older `/v1/ai` routes only; the library's
writers follow `FIREWORKS_API_KEY` and `OPENROUTER_API_KEY`) and `TRUST_PROXY=1`. What the library
uses ([environments.md](environments.md), `apps/api/.env.example` for every default):

- `DATABASE_URL`, `AUTH_*`: already set by the durable account release; email codes use
  `AUTH_MAGIC_DELIVERY_URL=inbox:local` (below).
- `LIBRARY_URL_SECRET`: set it (32+ random characters). Song audio URLs are signed with it; unset,
  each process signs with its own random secret and every redeploy invalidates them.
- `TTS_PROVIDER=elevenlabs`, `TTS_API_KEY`, `TTS_MODEL` (`eleven_multilingual_v2` in
  `.env.example`), `TTS_OUTPUT_FORMAT` (default `mp3_44100_128`): the server's voices speak phrases
  as `/library/speech/<id>.mp3`. `stub`, the default, renders nothing and the device voice speaks.
- `TTS_VOICE_ES_ES` (required with `elevenlabs`), `TTS_VOICE_BG_BG`, `TTS_VOICE_RU_RU`,
  `TTS_VOICE_EN_GB` (English-speaking learners' prompts): one pinned voice per language (Q-15); a
  language without one gets no clips.
- `LIMIT_SPEECH_RENDERS_DAILY` (500 server-wide), `LIMIT_SPEECH_OWNER_DAILY` (100 per learner): new
  clip renders per UTC day; each clip renders once.
- `TRUST_PROXY`: set to `1` by `scripts/ec2-release.sh`; leave it out of the file.
- Optional `FIREWORKS_API_KEY` and `OPENROUTER_API_KEY`
  ([ADR-0015](../architecture/adr/0015-open-model-providers.md)): DeepSeek writes decks, notes,
  lyrics and cover shapes (Fireworks first, OpenRouter when it fails), and Muse Image draws covers
  through OpenRouter's key. Without them the labelled fallbacks answer.
- Optional `MUSIC_PROVIDER=elevenlabs` with `MUSIC_API_KEY`: ElevenLabs Music sings songs (MP3, at
  most two minutes); otherwise the demo.
- `LIMIT_*_DAILY`, `LIMIT_*_KEPT`: learners' allowances and caps
  ([library.md](../architecture/library.md)).

Clips and song audio are kept in PostgreSQL (`library_audio`, content-addressed; `library_speech`
records each utterance's clip and voice), so they live in the `loro-postgres` volume and a redeploy
renders nothing again; they are also in each pre-release dump. A new voice or model is a new clip
URL and renders afresh. `TTS_CACHE_DIR` is only the older `/v1/tts` routes' file cache (by default
the container's `/tmp`, emptied on restart), which the app does not use.

**Reading an email sign-in code.** With `inbox:local` the API writes the latest code request to
`/tmp/loro-magic-delivery.json` inside the container (mode 600, `{email, code, expires_in}`). The
image is distroless, so read it with the image's node:

```bash
ssh ec2-user@HOST 'sudo docker exec loro-api /nodejs/bin/node -p "require(\"fs\").readFileSync(\"/tmp/loro-magic-delivery.json\",\"utf8\")"'
```

The file holds one request: a second tester asking for a code replaces the first's, so take turns. A
code lasts ten minutes and allows five tries; a restart empties `/tmp`.

## Public HTTPS gateway

API Gateway → a VPC Lambda → nginx on the host port 8080 → the API on `127.0.0.1:3000`. The gateway
is the CloudFormation stack `loro-api-gateway` (`infra/ec2/https.yaml`, the Lambda's code inline,
tested from that source by `pnpm test:deploy`); nginx is installed by
`scripts/deploy-ec2-proxy.sh HOST readonly|accounts`. Only the Lambda's security group reaches
port 8080. Both layers allow explicit routes: health and the content endpoints always; with the
stack's `AccountAccess=enabled` and nginx in `accounts` mode also sign-in, `/me`, sync and **the
library** (`/v1/library/*`): every route the app calls, each with its own methods (reads also answer
`HEAD`; `OPTIONS` preflights reach the API's CORS). Any other path is
`404 {"error":"not_available"}` at the Lambda. Google sign-in is in testing mode (project
`loro-508020`); Apple is unconfigured; email codes go to a host-local inbox.

What passes through, on library routes:

- **Requests**: the bearer, `Content-Type`, `Range` and `If-None-Match`; the query keys `target`,
  `kind`, `q`, `sort`, `exp`, `sig` and `v`. Bodies up to 4 MiB (a learner's progress can reach 3.8
  MB; account routes keep 1 MiB). Cookies and caller forwarding headers never pass. The Lambda names
  the caller's address (`requestContext.http.sourceIp`) to nginx, which sends it to the API as
  `X-Real-IP`, replacing anything the caller sent. The release runs the API with `TRUST_PROXY=1`, so
  sign-in limits count per learner rather than for everyone behind nginx; the API takes the header
  only from a loopback or private-network peer (nginx arrives through Docker's bridge).
- **Responses**: JSON and text as text; audio, covers and anything else base64-encoded, so song
  audio, ranges (`206`, `Content-Range`, `Accept-Ranges`) and clips arrive byte-exact. The API's
  `Cache-Control`, `ETag`, `Content-Security-Policy` and `Retry-After` pass through; a reply without
  a `Cache-Control` gets `no-store`. Lambda refuses replies over 6 MB, so one that would exceed it
  is `502 {"error":"response_too_large"}` rather than a cut-off body. Demo songs are at most 4 MiB
  of WAV (`synth.ts`), 5.6 MB as base64; a player asking for a byte range gets less.
- **Rates**: the stage allows 50 requests/s with a burst of 100 (Explore loads a cover per set; the
  player checks a clip per phrase). nginx allows the library 50 r/s (burst 100) and account routes
  20 r/s (burst 40) per gateway address.
- **Time**: an HTTP API integration has at most **30 s**. The Lambda gives up on the API at 28 s
  (its own timeout is 29 s) and nginx at 28 s. So everything slow is a job the app polls: a deck
  (`POST /library/decks`, 30–40 s measured on Fireworks), a cover (15 s or so) and a song. Notes for
  one phrase answer in the request (2–6 s). The older `POST /library/generate/phrases` waits for the
  deck and reaches the app as a gateway `503` past 30 s; only older app builds call it.

Roll out a change to the gateway or nginx in this order: the API (above), then nginx, then the
stack. `aws cloudformation deploy` keeps every parameter it isn't given at the stack's current value
(`VpcId`, `SubnetId`, `PrivateIp`, `OriginSecurityGroup`):

```bash
bash scripts/deploy-ec2-proxy.sh HOST accounts
aws cloudformation deploy --profile loro --region eu-central-1 --stack-name loro-api-gateway \
  --template-file infra/ec2/https.yaml --capabilities CAPABILITY_IAM \
  --parameter-overrides AccountAccess=enabled
aws cloudformation describe-stacks --profile loro --region eu-central-1 \
  --stack-name loro-api-gateway --query 'Stacks[0].Outputs'
node scripts/check-account-api.mjs https://GATEWAY_HOST/v1
```

The proxy script validates the configuration under the container's restrictions, reloads nginx and
probes it from the host: health, denied paths, and in `accounts` mode the pack, a signed-out
`usage`, a clip's `HEAD`, a 3 MB body accepted and a 5 MB one refused. `AccountAccess=disabled`
withdraws sign-in, sync and the library from the gateway without touching data.

## Teardown

Deleting the stack destroys the instance, its disk, the database volume and local backups. Take and
verify an off-host backup first ([backend-testing.md](../runbooks/backend-testing.md)).
