# Landing page deployment

`apps/landing` is served from AWS Amplify Hosting, deployed by hand from the repository with
`pnpm landing:deploy`. The stack is `infra/landing/template.yaml`; the host is the same AWS account
as the [EC2 development host](ec2-deployment.md) (profile `loro`, region `eu-central-1`).

## Current deployment

- **URL:** <https://loro.savienko.com/> (the stack's `Url` output), with Amplify's default
  <https://main.d8avifn92wmt4.amplifyapp.com/> still answering (`DefaultUrl`). See
  [the custom domain](#the-custom-domain).
- **Stack `loro-landing`:** one Amplify app with one branch, `main`, with automatic builds and pull
  request previews off. Nothing is connected to GitHub: the branch only receives the archives
  `scripts/deploy-landing.sh` uploads, so merging to `main` changes nothing until someone deploys.
- **Cost:** Amplify charges for what is stored and served (about $0.02 per GB-month and $0.15 per GB
  served, after the first year's free tier); a manual deployment uses no build minutes. The page is
  under 200 KB, so a thousand visits a month cost a few cents. The build list and the APKs come from
  GitHub, not from here.
- **Headers:** the app adds HSTS, `nosniff`, `SAMEORIGIN` and a referrer policy to every response;
  the page's Content-Security-Policy is its own meta tag. HTTP redirects to HTTPS.

## Deploy

Needs Node 22, installed dependencies, the AWS CLI with the `loro` profile, `curl`, `jq` and `zip`.

```bash
export AWS_PROFILE=loro AWS_REGION=eu-central-1
pnpm landing:deploy                      # STACK_NAME defaults to loro-landing; NO_EXECUTE=1 only shows the stack's change set
```

The script lints, type-checks and tests the folder, deploys the stack (a no-op when the template has
not changed), then zips `index.html` and `src/` without the test file, writes PostHog's project key
and host into the copy's `<meta name="posthog-key">` and `posthog-host` tags
(`apps/landing/scripts/analytics-key.mjs`, from `EXPO_PUBLIC_POSTHOG_KEY`/`_HOST` in the shell or
`apps/mobile/.env`; **no key, no deploy**, so the page never goes out silent by mistake —
[ADR-0011](../architecture/adr/0011-analytics-and-privacy.md#the-landing-page-amended-2026-10-02)),
uploads the archive as one Amplify deployment, and waits for it to finish. Amplify serves the new
files everywhere as soon as the job succeeds; there is nothing to invalidate. Each deployment is a
numbered job in the Amplify console, and an earlier one can be redeployed from there.

Only the browser's files go up: not the README, `package.json`, `tsconfig.json`, the local server or
`src/releases.test.js`.

## The custom domain

The stack's `Domain` resource attaches `loro.savienko.com` to the `main` branch, with a certificate
Amplify issues and renews (no `CertificateSettings`: CloudFormation rejects
`CertificateType: AMPLIFY_MANAGED` as a custom certificate without an ARN). Only the `loro` prefix
is attached; the root `savienko.com` is left alone. The domain is registered at GoDaddy and its DNS
is there, so the two records Amplify asks for are added by hand in GoDaddy's DNS page:

| Type  | Name (GoDaddy)                      | Value                                                              |
| ----- | ----------------------------------- | ------------------------------------------------------------------ |
| CNAME | `_833ed1f6b3ecb1d5fa36aa807fc84e03` | `_999eec30456965b691e7aa72c399862f.wzccmgtwzk.acm-validations.aws` |
| CNAME | `loro`                              | `d2jent0k7is1yl.cloudfront.net`                                    |

The first proves the domain to the certificate authority and must stay for renewals; the second
serves the page. The same name also carries the Resend and SES records for email sign-in codes
(`resend._domainkey.loro`, `send.loro`, `_domainkey.loro`, `mail.loro`,
[ec2-deployment.md](ec2-deployment.md#email-sign-in-codes)); they are different names and do not
conflict. Check the association with:

```bash
aws amplify get-domain-association --app-id d8avifn92wmt4 --domain-name savienko.com \
  --query 'domainAssociation.[domainStatus,subDomains[0].verified]'
```

`AVAILABLE` and `true` mean the page is served on the domain over HTTPS.

## The video's files: the media bucket

The page's film ([promo-video.md](promo-video.md)) is about 10 MB, so it is not in the Amplify
archive: it is served straight from S3 over HTTPS.

- **Stack `loro-landing-media`** (`infra/landing/media.yaml`): bucket
  `loro-landing-media-bucket-ws2lr1msajdt`, served at
  <https://loro-landing-media-bucket-ws2lr1msajdt.s3.eu-central-1.amazonaws.com/promo/>. The bucket
  policy lets anyone read `promo/*` and nothing else (any other key answers 403), and refuses any
  request that is not HTTPS. ACLs are off; encryption is S3's own; unfinished uploads are cleaned up
  after a day.
- **Files are named by their content's hash** (`promo/loro-promo-web.<12 hex>.mp4`, `.webm`, the
  poster `.jpg`) and sent with `Cache-Control: public, max-age=31536000, immutable`. A new render is
  a new name, so a browser or a page cached with the old one keeps working, and nothing is ever
  overwritten. Old files stay until someone deletes them; at 20 MB a render, that is not worth a
  lifecycle rule.
- **The page names the bucket twice:** the `<video>`, its poster and `og:image` point at the files,
  and the Content-Security-Policy meta tag allows the bucket in `img-src` and `media-src`.
- **Cost:** storage is a fraction of a cent; reads leave AWS as internet egress, inside the
  account's 100 GB a month free and then about $0.09 per GB. The video is `preload="none"`, so only
  visitors who press play download it: a thousand plays a month is about 10 GB.

To publish a new render (Node 22, the AWS CLI with the `loro` profile, `curl`, `shasum`, `perl`):

```bash
export AWS_PROFILE=loro AWS_REGION=eu-central-1
pnpm --filter @loro/promo video          # apps/promo/out/: the web MP4, the WebM, the poster
pnpm promo:upload                        # the stack (a no-op when unchanged), the files, index.html re-pointed
pnpm landing:deploy                      # the page with the new URLs
```

`scripts/upload-promo.sh` skips a file the bucket already has, checks that each URL answers anyone
with the right content type, rewrites every URL of the same file in `apps/landing/index.html` to the
new hash, and fails if the page's Content-Security-Policy does not allow the bucket. It changes the
page in the working tree: commit that change with the render it points at.

## The cheaper host, once the account is verified

A private S3 bucket behind CloudFront costs nothing at this size: CloudFront's always-free tier
covers 1 TB and 10 million requests a month, and the bucket holds a few hundred kilobytes.
`infra/landing/cloudfront.yaml` is that stack, validated and ready: a bucket closed to the public,
read only by the distribution through an origin access control, the cheapest price class, HTTP
redirected to HTTPS, CloudFront's managed security headers, and a missing key answered with the page
and a 404.

It could not be created on 2026-10-02: the account is new, and AWS refuses every new CloudFront
resource until AWS Support has verified it
(`Your account must be verified before you can add new CloudFront resources`). Ask Support to verify
the account (quote that message), then switch:

```bash
export AWS_PROFILE=loro AWS_REGION=eu-central-1
aws cloudformation deploy --stack-name loro-landing-cdn --template-file infra/landing/cloudfront.yaml
bucket=$(aws cloudformation describe-stacks --stack-name loro-landing-cdn \
  --query "Stacks[0].Outputs[?OutputKey=='Bucket'].OutputValue" --output text)
aws s3 sync apps/landing "s3://$bucket" --delete --exclude '*' --include 'index.html' \
  --include 'src/*' --exclude 'src/*.test.js'
```

Then point `scripts/deploy-landing.sh` at it (one `s3 sync` per content type, so each object carries
its charset, and a `/*` invalidation at the end; the first version of the script in Git history did
exactly this), move `loro.savienko.com` to the distribution (an alias and a `us-east-1` ACM
certificate validated at GoDaddy, then the `loro` CNAME pointed at the distribution), delete the
`loro-landing` stack, and update this page and [Q-27](../decisions/open-questions.md#q-27).

The film can move behind the same distribution: add the media bucket as a second origin for
`promo/*` (an origin access control instead of the public policy), point the page at the
distribution's URLs, then close the bucket with `BlockPublicPolicy`.

## Decisions (2026-10-02)

- **The cheapest host with HTTPS is S3 behind CloudFront**, at no cost inside the always-free tier.
  Set aside: S3's website endpoint alone (HTTP only, and the page would be the one unencrypted thing
  a visitor sees before downloading an APK), the EC2 host's gateway (an API Gateway and a Lambda in
  front of one small instance, priced per request and not meant for a page), and GitHub Pages
  ([public-repository.md](public-repository.md)).
- **Amplify Hosting serves the page until the account is verified for CloudFront.** It runs on
  CloudFront inside AWS's own account, so the restriction does not apply, it gives HTTPS at a
  default domain, and a manual deployment is one archive upload with no build. It costs cents rather
  than nothing, which is why it is the interim and not the destination.
- **The page's address is `loro.savienko.com`** (2026-10-02), a subdomain of the owner's domain, the
  same name sign-in codes are sent from
  ([ADR-0022](../architecture/adr/0022-email-codes-through-resend.md)). Set aside: the root
  `savienko.com` (the owner's own name, kept free for other uses) and a domain of Loro's own (none
  is registered; the owner registered `savienko.com` for this). DNS stays at GoDaddy, the registrar:
  a Route 53 hosted zone would cost $0.50 a month for two records.
- **The stack is CloudFormation and the deployment is a script**, like the EC2 host: the repository
  says what exists, and the console is for looking.
- **Deploying is a person's command, not a merge.** The CI policy ([ci-cd.md](ci-cd.md)) runs
  nothing on GitHub, and the page changes rarely.
- **The film is served from its own S3 bucket, public under `promo/` only** (2026-10-02). It is 50
  times the rest of the page, and Amplify charges $0.15 per GB served where S3's egress is free for
  the first 100 GB a month. Set aside: shipping it in the Amplify archive (every deployment
  re-uploads 10 MB, and each play costs more), a private bucket behind CloudFront (the right end
  state, blocked by the same account verification), and YouTube or Vimeo (their player, tracking and
  branding on a page whose promise is that nothing is watched).
