# Landing page deployment

`apps/landing` is served from AWS Amplify Hosting, deployed by hand from the repository with
`pnpm landing:deploy`. The stack is `infra/landing/template.yaml`; the host is the same AWS account
as the [EC2 development host](ec2-deployment.md) (profile `loro`, region `eu-central-1`).

## Current deployment

- **URL:** <https://main.d8avifn92wmt4.amplifyapp.com/> (the stack's `Url` output). There is no
  custom domain yet ([Q-27](../decisions/open-questions.md#q-27)).
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
not changed), then zips `index.html` and `src/` without the test file and uploads the archive as one
Amplify deployment, and waits for it to finish. Amplify serves the new files everywhere as soon as
the job succeeds; there is nothing to invalidate. Each deployment is a numbered job in the Amplify
console, and an earlier one can be redeployed from there.

Only the browser's files go up: not the README, `package.json`, `tsconfig.json`, the local server or
`src/releases.test.js`.

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
exactly this), delete the `loro-landing` stack, and update this page and
[Q-27](../decisions/open-questions.md#q-27).

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
- **The stack is CloudFormation and the deployment is a script**, like the EC2 host: the repository
  says what exists, and the console is for looking.
- **Deploying is a person's command, not a merge.** The CI policy ([ci-cd.md](ci-cd.md)) runs
  nothing on GitHub, and the page changes rarely.
