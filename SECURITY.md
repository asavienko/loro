# Security

Loro is a small project with one maintainer. Reports are read and answered, but not on a service
desk's clock: expect an acknowledgement within seven days.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting: **Security → Report a vulnerability** on this
repository. It opens a private advisory that only the maintainer sees. Please do not open a public
issue, and do not disclose the problem elsewhere until it is fixed or 90 days have passed.

Say what you found, where (file and line, route, or screen), how to reproduce it and what it lets an
attacker do. A proof of concept against your own account or a local build is welcome; see the scope
below for what is not.

## Scope

In scope:

- the app in `apps/mobile`, including its native modules;
- the API in `apps/api` and the gateway configuration in `infra/ec2`;
- the Rust core in `packages/core-rs`;
- this repository's build, release and secret-handling scripts.

The one promise above all others is that **recorded audio never leaves the device** and that no code
path records it ([ADR-0011](docs/architecture/adr/0011-analytics-and-privacy.md)). A way to break it
is the most serious report there is.

Out of scope, or please don't:

- testing against `api.loro.app` beyond your own account: it is a development host shared by the
  people trying the app, so no denial of service, no rate-limit flooding, no reading or changing
  another learner's data, no automated scanning;
- the findings already recorded in
  [the 2026-10-01 security review](docs/reviews/2026-10-01-security-review.md) — they are known and
  tracked, though a working exploit for one of them is still worth a report;
- vulnerabilities in dependencies with no reachable path in Loro (Dependabot already reports those);
- social engineering, physical attacks and anything that needs a compromised device.

## Secrets in this repository

Only `apps/api/.env.example` and the SOPS-encrypted `secrets/*.enc.env` files are tracked; the
latter are AES-256-GCM ciphertext for one age recipient whose private key is not in any repository.
Finding a plaintext credential anywhere in the tree or its history is a vulnerability: report it.

## Supported versions

Only `main` and the latest Android preview release on GitHub Releases. There are no store releases
yet.
