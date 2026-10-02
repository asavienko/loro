# 0021 · Email sign-in codes are sent through Amazon SES

- **Status:** Accepted
- **Date:** 2026-10-02
- **Deciders:** the owner (conversation of 2026-10-02)

## Context

Email sign-in sends a six-digit code. The API could hand it to an HTTPS webhook or, on the
development host, write it to a file inside the container (`inbox:local`). Nothing behind either one
sent an email: the deployed host used `inbox:local`, so a learner who asked for a code was told it
was on its way and never got it. Only someone with SSH access to the host could sign in by email.

## Decision

- The API sends codes itself through **Amazon SES** (API v2, `SendEmail`) when
  `AUTH_MAGIC_DELIVERY_URL=ses`, from the address in `AUTH_EMAIL_FROM`. Email sign-in is advertised
  only when that sender is set. The webhook and `inbox:local` remain for local development.
- Codes come from `codes@loro.savienko.com`, a subdomain of the owner's domain (registered
  2026-10-02), so the app's sending reputation and DKIM keys stay apart from the root domain's mail.
- The email is plain text in English: the code in the subject and the body, how long it lasts, and
  that it can be ignored.
- The EC2 host gets an instance role whose only permission is `ses:SendEmail` in its region, and a
  metadata hop limit of 2 so the API container can read that role's credentials. No AWS key is
  stored in the encrypted environment.
- A failed send is logged by its error name only (for example `MessageRejected`), never the address
  or the code, and the learner gets `PROVIDER_UNAVAILABLE` rather than a promise of an email.

### Rejected

- **A separate webhook service in front of SES.** The delivery contract allowed it, but it would be
  one more thing to deploy and secure for a single call the API can make directly.
- **Another email provider (Postmark, Resend, SendGrid).** All would work; SES is in the AWS account
  that already hosts the API and the landing page, costs cents at this volume, and needs no new
  vendor or key.
- **A static IAM user key in `secrets/ec2-api.enc.env`.** A long-lived key that could leak and must
  be rotated, where the instance role's credentials rotate themselves.

## Consequences

### Good

- Email sign-in works for any address once SES can send to it, with no extra service.
- The API's AWS permission is one action.

### Bad — accepted deliberately

- The `@aws-sdk/client-sesv2` dependency joins an API that otherwise talks to providers with
  `fetch`.
- Any process in a container on the host can read the role's credentials; the role can only send
  email.
- The email is English whatever the learner's interface language, until the sign-in request carries
  one.
- SES must first be set up by hand: a verified sending domain and production access, without which
  SES sends only to verified addresses
  ([ec2-deployment.md](../../process/ec2-deployment.md#email-sign-in-codes)).

### Revisit if…

SES deliverability is poor (codes land in spam or bounce), the API moves off AWS, or codes need
localized or branded HTML email that a transactional-email service would make easier.
