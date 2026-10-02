# EC2 development host

The API runs on one restricted Amazon Linux 2023 EC2 instance (`infra/ec2/template.yaml`): a
t3.small with an encrypted 30 GiB disk, IMDSv2, Docker, and SSH open to one IPv4 address. The API
binds to host loopback; the app reaches it through the [HTTPS gateway](#public-https-gateway) and
administrators through an SSH tunnel. This is a development host, not production. Backups and
recovery are in [the runbook](../runbooks/backend-testing.md).

## Current instance

- AWS profile `loro` (SSO), region `eu-central-1`, stack `loro-api-dev`, key pair `loro-ec2-dev`
  (private key at `~/.ssh/loro-ec2-dev`). The instance is the stack's `InstanceId` output.
- The public DNS name can change after a stop and start; read the stack's `Host` output before
  connecting. When your IP changes, re-run [provisioning](#provision) with the new `ADMIN_CIDR` (add
  `NO_EXECUTE=1` to see the change set first). The script keeps the image the instance runs: a
  different one would replace the instance, its disk and the database on it.
- Merging to `main` does not redeploy; the host runs whatever was last deployed.

## Provision

Needs AWS credentials with CloudFormation and EC2 access, an existing VPC with a public subnet, and
an EC2 key pair.

```bash
export AWS_PROFILE=loro AWS_REGION=eu-central-1 VPC_ID=vpc-… SUBNET_ID=subnet-… KEY_NAME=… \
  ADMIN_CIDR=YOUR_IP/32
./scripts/provision-ec2.sh      # STACK_NAME defaults to loro-api-dev
```

Verify the host key through the AWS console, add it to `known_hosts` (every script uses strict
host-key checking in batch mode) and set `IdentityFile` in `~/.ssh/config`.

## Database and runtime files

The runtime configuration is `secrets/ec2-api.enc.env` (the API) and `secrets/ec2-postgres.enc.env`
(`POSTGRES_PASSWORD` and `LORO_DB_PASSWORD`). Stream each into a root-owned mode-600 file on the
host, so no plaintext copy is left locally, then create the database:

```bash
export SOPS_AGE_KEY_FILE=~/.config/sops/age/loro.txt
sops decrypt --input-type dotenv --output-type dotenv secrets/ec2-postgres.enc.env |
  ssh ec2-user@HOST 'sudo install -D -m 600 -o root -g root /dev/stdin /opt/loro/database/postgres.env'
sops decrypt --input-type dotenv --output-type dotenv secrets/ec2-api.enc.env |
  ssh ec2-user@HOST 'sudo install -D -m 600 -o root -g root /dev/stdin /opt/loro/runtime/api.env'
ssh ec2-user@HOST 'sudo bash -s' < scripts/ec2-database.sh
```

`scripts/ec2-database.sh` runs PostgreSQL 16 as `loro-postgres` on a persistent `loro-postgres`
volume and a private `loro-backend` Docker network (no host port), with a non-superuser `loro` role
owning the `loro` database. It never resets an existing database. Containers read their file when
they start: after changing `api.env`, install it again and redeploy.

## Deploy

Needs Node 22, installed dependencies, cargo and `wasm-pack` on the PATH, and Docker that builds
linux/amd64 images.

```bash
pnpm check
bash scripts/deploy-ec2.sh HOST /opt/loro/runtime/api.env loro-backend
ssh -N -L 127.0.0.1:13000:127.0.0.1:3000 ec2-user@HOST    # in another terminal
curl --fail http://127.0.0.1:13000/v1/health/ready
```

The script builds the WASM merge and the linux/amd64 image locally from the working tree
(uncommitted changes included; the tag `loro-api:<commit>-<UTC time>` names `HEAD`), checks the
image against a throwaway PostgreSQL (`scripts/ci-api-image.sh`) and streams it over SSH. On the
host, `scripts/ec2-release.sh` then:

1. dumps the database to `/opt/loro/backups/pre-release-<time>.dump`;
2. starts an unpublished candidate, which must pass readiness **and** serve
   `GET /v1/library/pack?target=es-ES` (the first library request seeds Loro's content, so a seed
   that fails stops the release before cutover);
3. stops `loro-api`, keeps it as `loro-api-previous`, and starts the new image on `127.0.0.1:3000`
   (brief downtime), which must pass the same checks;
4. on failure, restores `loro-api-previous` (held to readiness only, since an older image may
   predate the library).

The release adds `NODE_ENV=production`, `AI_PROVIDER=stub` and `TRUST_PROXY=1` to the runtime file.
A lock (`/var/lock/loro-api-deploy.lock`) keeps releases and backups from overlapping.

To roll back by hand, release an earlier image through the same script, with the same runtime file
and network (without them the container has no database and fails readiness):

```bash
ssh ec2-user@HOST 'sudo docker images loro-api'
ssh ec2-user@HOST 'sudo bash -s -- loro-api:PREVIOUS_TAG /opt/loro/runtime/api.env loro-backend' \
  < scripts/ec2-release.sh
ssh ec2-user@HOST 'sudo docker logs --tail 100 loro-api'
```

Migrations must stay backward compatible: a rollback never restores an older database over new
writes.

## Runtime settings

What each variable does is in [environments.md](environments.md). On this host:

- `DATABASE_URL` and `AUTH_*` come from the durable account release. Email codes go through Amazon
  SES with `AUTH_MAGIC_DELIVERY_URL=ses`, `AUTH_EMAIL_FROM` and `AWS_REGION`
  ([below](#email-sign-in-codes)).
- `LIBRARY_URL_SECRET` is set (32+ random characters). Without it every redeploy would invalidate
  the signed song links learners hold.
- `TTS_PROVIDER=elevenlabs` with its key, model, format and the `TTS_VOICE_*` voices: the server's
  voices speak phrases as `/v1/library/speech/<id>.mp3`. With `stub` phrases have no sound.
- `FIREWORKS_API_KEY` and `OPENROUTER_API_KEY` are in `secrets/ec2-api.enc.env` (plan 111,
  [ADR-0015](../architecture/adr/0015-open-model-providers.md)): DeepSeek writes decks, notes,
  lyrics and cover shapes (Fireworks first, OpenRouter when it fails), and Muse Image draws covers.
  Without them the labelled fallbacks write. `MUSIC_PROVIDER=elevenlabs` and `MUSIC_API_KEY` are
  there too; without them songs get the demo instrumental. See
  [Turning on the AI writers and ElevenLabs Music](#turning-on-the-ai-writers-and-elevenlabs-music).
- Leave `TRUST_PROXY` out of the file; the release sets it.

Clips and song audio are kept in PostgreSQL (`library_audio`, content-addressed; `library_speech`
records each utterance's clip and voice), so they live in the `loro-postgres` volume and in each
pre-release dump, and a redeploy renders nothing again. A new voice or model is a new clip URL and
renders afresh.

### Turning on the AI writers and ElevenLabs Music

The app's Create tab says who writes on this server (`GET /v1/library/usage`): "Phrase bank (no AI)"
and "Demo sound" mean the keys below are missing from the running container. `AI_PROVIDER` plays no
part (the release sets it to `stub` for the older `/v1/ai` routes); the library follows
`FIREWORKS_API_KEY` and `OPENROUTER_API_KEY` alone. Since plan 111 both, and the music keys, are in
`secrets/ec2-api.enc.env`; these steps change them. Needs the age identity
(`~/.config/sops/age/loro.txt`).

1. Edit the host's encrypted file (`pnpm env:edit` edits the local `api.enc.env`, not this one):

   ```bash
   export SOPS_AGE_KEY_FILE=~/.config/sops/age/loro.txt
   sops edit --input-type dotenv --output-type dotenv secrets/ec2-api.enc.env
   ```

   ```dotenv
   # DeepSeek on Fireworks writes decks, notes, lyrics and cover shapes.
   FIREWORKS_API_KEY=fw_…
   # The same model when Fireworks fails, and Muse Image for covers.
   OPENROUTER_API_KEY=sk-or-…
   # ElevenLabs Music sings songs (a plan with Music); the key may be TTS_API_KEY's.
   MUSIC_PROVIDER=elevenlabs
   MUSIC_API_KEY=…
   ```

   Comments go on lines of their own: Docker's `--env-file` keeps a `#` after a value as part of it.
   `FIREWORKS_MODEL`, `OPENROUTER_TEXT_MODEL` and `OPENROUTER_IMAGE_MODEL` are optional
   (`.env.example`). `TTS_PROVIDER=elevenlabs`, `TTS_API_KEY` and the voices are already there.
   Commit only the encrypted file.

2. Install it on the host and redeploy; a container reads the file only when it starts, and the
   deploy ships the current code with it:

   ```bash
   HOST=$(aws cloudformation describe-stacks --profile loro --region eu-central-1 \
     --stack-name loro-api-dev --query "Stacks[0].Outputs[?OutputKey=='Host'].OutputValue" --output text)
   sops decrypt --input-type dotenv --output-type dotenv secrets/ec2-api.enc.env |
     ssh ec2-user@$HOST 'sudo install -D -m 600 -o root -g root /dev/stdin /opt/loro/runtime/api.env'
   pnpm check
   bash scripts/deploy-ec2.sh $HOST /opt/loro/runtime/api.env loro-backend
   ```

3. Check: the Create tab now names AI and ElevenLabs Music, and a deck's cards say "Written by AI".
   A key that is wrong shows in the log as `Provider request failed: configuration` (a refused key
   or an unknown model), `rate_limited` or `unavailable`, after which the fallback answered:

   ```bash
   ssh ec2-user@$HOST 'sudo docker logs --since 10m loro-api 2>&1 | grep -E "writer failed|cover .*failed|song .* failed"'
   ```

### Email sign-in codes

The API sends codes through Amazon SES itself
([ADR-0021](../architecture/adr/0021-email-codes-through-amazon-ses.md)). The stack gives the
instance a role that may only call `ses:SendEmail`, and a metadata hop limit of 2 so the container
reaches its credentials; `scripts/provision-ec2.sh` applies both in place. SES itself was set up
once, by hand, in the host's region; the host has sent codes this way since 2026-10-02:

1. **Verify the sending domain.** Codes come from `codes@loro.savienko.com`. The SES identity is
   `loro.savienko.com` (Easy DKIM, RSA 2048) with the custom MAIL FROM domain
   `mail.loro.savienko.com`. Its DNS is at GoDaddy: the three DKIM CNAME records that
   `aws sesv2 get-email-identity --email-identity loro.savienko.com` lists, an MX record for
   `mail.loro.savienko.com` pointing at `feedback-smtp.eu-central-1.amazonses.com` (priority 10),
   and a TXT record `v=spf1 include:amazonses.com ~all` on the same name. DMARC comes from the
   registrar's default record on `savienko.com`.
2. **Request production access** (requested 2026-10-02, under review). Until it is granted the
   account is in the sandbox: it sends only to verified addresses, 200 a day. Check with
   `aws sesv2 get-account --query ProductionAccessEnabled`; while it is `false`, add a tester with
   `aws sesv2 create-email-identity --email-identity ADDRESS` and have them click AWS's link.
3. **Switch the host** in `secrets/ec2-api.enc.env`: `AUTH_MAGIC_DELIVERY_URL=ses`,
   `AUTH_EMAIL_FROM=Loro <codes@loro.savienko.com>` and `AWS_REGION=eu-central-1`;
   `AUTH_MAGIC_DELIVERY_TOKEN` may stay. Then redeploy.

A refused send answers `PROVIDER_UNAVAILABLE` and logs only the error's name:

```bash
ssh ec2-user@$HOST 'sudo docker logs --since 10m loro-api 2>&1 | grep "email code delivery failed"'
```

`MessageRejected` means the sender's domain is not verified or, in the sandbox, the recipient isn't.

### Reading an email sign-in code

On a host set to `inbox:local` (the EC2 host before SES), the API writes the latest code request to
`/tmp/loro-magic-delivery.json` inside the container (mode 600, `{email, code, expires_in}`). The
image is distroless, so read it with the image's own node:

```bash
ssh ec2-user@HOST 'sudo docker exec loro-api /nodejs/bin/node -p "require(\"fs\").readFileSync(\"/tmp/loro-magic-delivery.json\",\"utf8\")"'
```

The file holds one request: a second tester asking for a code replaces the first's, so take turns. A
code lasts ten minutes and allows five tries; a restart empties `/tmp`.

## Public HTTPS gateway

API Gateway (HTTP API) → a VPC Lambda → nginx on host port 8080 → the API on `127.0.0.1:3000`. The
gateway is the CloudFormation stack `loro-api-gateway` (`infra/ec2/https.yaml`, with the Lambda's
code inline; `pnpm test:deploy` tests it from that source). nginx runs as `loro-public-proxy`,
installed by `scripts/deploy-ec2-proxy.sh HOST readonly|accounts`. Only the Lambda's security group
reaches port 8080.

Both layers allow explicit routes only. Health, the `/v1/content/v2` manifest, diff and pack, and
`/v1/auth/providers` are always open. With the stack's `AccountAccess=enabled` and nginx in
`accounts` mode, sign-in, `/me`, `/v1/sync/*` and **the library** (`/v1/library/*`) open too: every
route the app calls, each with its own methods (reads also answer `HEAD`; `OPTIONS` preflights reach
the API's CORS). Any other path is `404 {"error":"not_available"}` at the Lambda. Google sign-in is
in testing mode (project `loro-508020`); Apple is not configured; email codes go to the host-local
inbox.

On library routes:

- **Requests**: the bearer, `Content-Type`, `Range` and `If-None-Match` headers, and the query keys
  `target`, `kind`, `q`, `sort`, `exp`, `sig` and `v`. Bodies up to 4 MiB (a learner's progress can
  reach 3.8 MB; account routes keep 1 MiB). Cookies and the caller's forwarding headers never pass.
  The Lambda names the caller's address (`requestContext.http.sourceIp`) to nginx, which sends it to
  the API as `X-Real-IP`, replacing anything the caller sent. With `TRUST_PROXY=1` sign-in limits
  count per learner rather than for everyone behind nginx; the API takes the header only from a
  loopback or private-network peer (nginx arrives through Docker's bridge).
- **Responses**: JSON and text travel as text; audio, covers and anything else base64-encoded, so
  song audio, ranges (`206`, `Content-Range`, `Accept-Ranges`) and clips arrive byte-exact. The
  API's `Cache-Control`, `ETag`, `Content-Security-Policy`, `Retry-After` and CORS headers pass
  through; a reply without `Cache-Control` gets `no-store`. Lambda refuses replies over 6 MB, so one
  that would exceed it is `502 {"error":"response_too_large"}` rather than a cut-off body. Demo
  songs are at most 4 MiB of WAV (`synth.ts`), 5.6 MB as base64; a player asking for a byte range
  gets less.
- **Rates**: the stage allows 50 requests/s with a burst of 100 (Explore loads a cover per set; the
  player checks a clip per phrase). nginx allows the library 50 r/s (burst 100) and other routes 20
  r/s (burst 40).
- **Time**: an HTTP API integration has at most **30 s**. The Lambda gives up on the API at 28 s
  (its own timeout is 29 s), and so does nginx. So everything slow is a job the app polls: a deck
  (`POST /library/decks`, 30–40 s measured on Fireworks), a cover (15 s or so) and a song. Notes for
  one phrase answer in the request (2–6 s). The older `POST /library/generate/phrases` waits for the
  deck and reaches the app as a gateway `503` past 30 s; only older app builds call it.

Roll out a change to the gateway or nginx in this order: the API ([Deploy](#deploy)), then nginx,
then the stack. `aws cloudformation deploy` keeps every parameter it isn't given (`VpcId`,
`SubnetId`, `PrivateIp`, `OriginSecurityGroup`) at the stack's current value:

```bash
bash scripts/deploy-ec2-proxy.sh HOST accounts
aws cloudformation deploy --profile loro --region eu-central-1 --stack-name loro-api-gateway \
  --template-file infra/ec2/https.yaml --capabilities CAPABILITY_IAM \
  --parameter-overrides AccountAccess=enabled
aws cloudformation describe-stacks --profile loro --region eu-central-1 \
  --stack-name loro-api-gateway --query 'Stacks[0].Outputs'
node scripts/check-account-api.mjs https://GATEWAY_HOST/v1
```

The proxy script validates the nginx configuration under the container's restrictions, reloads it
and probes it from the host: health, denied paths, and in `accounts` mode the pack, a signed-out
`usage`, a clip's `HEAD`, a 3 MB body accepted and a 5 MB one refused. `check-account-api.mjs`
probes the public URL: readiness, the start and cancellation of Google sign-in, the library pack and
languages, and that account, sync and library routes refuse anonymous callers. Live Google consent
and a device session are separate checks. `AccountAccess=disabled` withdraws sign-in, sync and the
library from the gateway without touching data.

## Teardown

Deleting the stack destroys the instance, its disk, the database volume and the local backups. Take
and verify an off-host backup first ([the runbook](../runbooks/backend-testing.md)).
