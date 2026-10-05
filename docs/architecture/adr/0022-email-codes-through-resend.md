# 0022 · Email sign-in codes are sent through Resend

- **Status:** Accepted
- **Date:** 2026-10-05
- **Deciders:** the owner (conversation of 2026-10-05)
- **Supersedes:** [0021](0021-email-codes-through-amazon-ses.md)

## Context

[ADR-0021](0021-email-codes-through-amazon-ses.md) had the API send codes through Amazon SES. A new
SES account is in the sandbox, which sends only to verified addresses, until Amazon grants
production access. Amazon refused it on 2026-10-03 without saying why. Since then every learner
asking for a code got `PROVIDER_UNAVAILABLE`: nobody but the owner could sign in or sign up by email
(F-01).

## Decision

- The API sends codes through **Resend** (`POST https://api.resend.com/emails`) when
  `AUTH_MAGIC_DELIVERY_URL=resend`, from `AUTH_EMAIL_FROM`, with the API key in
  `AUTH_MAGIC_DELIVERY_TOKEN`. Email sign-in is offered only when both are set.
- The owner already had a Resend account. The key may only send, and only from `loro.savienko.com`,
  the domain ADR-0021 chose; Resend's DKIM and return-path records sit beside the SES ones under
  different names.
- The email is unchanged: plain text in English, the code in the subject and body.
- A refused send is logged as `Resend<status>` (for example `Resend403` for an unverified domain,
  `Resend429` past the quota). Resend's error text can quote the address, so the body is never read.
- The `ses` mode, the instance role and the SES domain identity stay, so the host can go back to SES
  by changing one variable if Amazon grants production access later.

### Rejected

- **Waiting for SES.** Amazon gives no reason, and a request made again may be refused again; email
  sign-in would stay broken for days at least.
- **Postmark.** Its new accounts are also held to their own domain until a person approves them.
- **A webhook service in front of Resend.** Same reason as ADR-0021: one more thing to deploy for
  one call the API can make itself.
- **Sending from a personal Gmail address.** Mixes the app's mail with the owner's, and Gmail's
  limits and terms are not for transactional mail.

## Consequences

### Good

- Email sign-in works for any address as soon as the domain verifies, with no approval to wait for.
- The call is a plain `fetch` like the API's other providers; no SDK.

### Bad — accepted deliberately

- Learners' addresses and their codes now pass through Resend, a US company, as well as AWS
  ([security-privacy.md](../security-privacy.md)).
- A static API key lives in `secrets/ec2-api.enc.env`, where SES used the instance role's rotating
  credentials. It can only send email from one domain; rotate it in Resend if it leaks.
- Resend's free plan has a daily cap; past it codes fail with `Resend429` until the next day or a
  paid plan.

### Revisit if…

Amazon grants SES production access (then `ses` is cheaper and keyless), Resend's deliverability is
poor, or the daily cap is reached in normal use.
