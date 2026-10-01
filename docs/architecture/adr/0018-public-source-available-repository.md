# 0018 · The repository is public and source-available, not open source

- **Status:** Accepted
- **Date:** 2026-10-02
- **Deciders:** the owner (decisions of 2026-10-02)

## Context

The repository had been private since its first commit. Making it public lets the work be read,
cited and discussed, lets native speakers report content problems without an invitation, and unlocks
GitHub features that are free only for public repositories (secret scanning with push protection,
branch protection, private vulnerability reporting, Dependabot alerts).

Going public is close to irreversible: once cloned, the history is out. So four questions had to be
settled first, each with a hard-to-reverse answer: what licence the code carries; what happens to
the three age-encrypted `secrets/*.enc.env` files, which hold real API keys, a Google client secret
and database passwords as AES-256-GCM ciphertext; whether the eleven Android preview builds on
GitHub Releases stay downloadable; and whether
[the security review of 2026-10-01](../../reviews/2026-10-01-security-review.md), which lists 34
unfixed findings with file and line against the development API, stays in the tree.

A gitleaks scan of all 1,164 commits and of the untracked working tree found no credential, ever
(four false positives: an image digest and a test fixture). The history does hold an earlier EC2
public host name, an API Gateway id and the instance id of the development host. A read of every
tracked image found one that is not the app at all: a phone lock screen among the 2026-10-01 device
feedback, showing a phone number and other people's message previews.

## Options considered

### A · Public under an OSI licence (MIT, Apache-2.0 or AGPL-3.0)

Pros: the convention for a public repository, no friction for a contributor, GitHub shows the
licence. Cons: it is a one-way door. MIT and Apache let anyone ship the courses, the voices' clips
and the app under another name; AGPL stops closed forks but still allows a competing open one. The
product has no store release and no business model yet (Q-08, Q-12), so giving the reuse right away
now forecloses choices that have not been made.

### B · Public, source-available, all rights reserved

Pros: everything can be read and run locally, issues and pull requests can be made, and the owner
keeps every option on reuse and relicensing; moving to an OSI licence later is one commit, moving
back is impossible. Cons: GitHub shows no licence badge, some people will not contribute to a
non-open repository, and contributions need an explicit grant (written into `LICENSE`) because no
licence otherwise covers them.

### C · Stay private

Pros: nothing to decide. Cons: none of the benefits above; the paid tier is the only way to get
branch protection and secret scanning on a private repository.

### The encrypted secrets

- **Keep them.** Age with X25519 and AES-256-GCM is not brute-forceable; the private key lives only
  on the owner's machines; publishing SOPS ciphertext is standard practice. The risk is permanent:
  if the age key ever leaks, every secret in the history is exposed at once and must be rotated.
- Remove them from the tree, keep history: only reduces discoverability; the ciphertext stays in
  public history.
- Remove them and rewrite history, then rotate everything: invalidates every clone and open pull
  request, and rotation would be required anyway because the private repository was already readable
  by GitHub.

### Rewriting history for the host name, gateway id and instance id

Identifiers, not secrets: SSH on the host is open to one administrator address, the API binds to
loopback, and the gateway is what `api.loro.app` fronts anyway. A rewrite of the whole history to
hide three identifiers was judged disproportionate. The instance id was removed from the current
documentation; the rest stays in history.

### The releases and the security review

The preview APKs are builds of the same source that is being published, talk to a public API and are
signed with a development key; hiding them hides nothing. The review's findings describe what
reading the source shows and name a development host; it stays, and `SECURITY.md` points reporters
at it so they do not re-report what is known.

## Decision

Make the repository public under a source-available licence (option B): read, fork, run locally and
propose changes, no reuse elsewhere, contributions granted to the copyright holder under the terms
in [`LICENSE`](../../../LICENSE). Keep the SOPS-encrypted secrets, the GitHub Releases and the
security review in the tree; do not rewrite history. `SECURITY.md` and `CONTRIBUTING.md` state how
to report and how to contribute. The GitHub settings to turn on once the repository is public, and
what must never enter it, are in [`public-repository.md`](../../process/public-repository.md).

## Consequences

### Good

- Anyone can read and run the project; native speakers can report content problems directly.
- The free security features for public repositories apply from the day the switch is flipped.
- Every option on licensing, pricing and store distribution stays open.

### Bad — accepted deliberately

- No licence badge and a smaller pool of willing contributors than an open-source project has.
- The age key is now a single point of failure for every secret ever committed; its loss means
  rotating all of them, not some.
- Everything in the history is public forever, including the earlier host identifiers and the
  unfixed findings of the security review.

### Revisit if…

- A store release or a business model is decided (Q-08, Q-12): the licence may then be chosen for
  that, in either direction.
- A second regular contributor appears and the contribution grant in `LICENSE` is not enough.
- The age private key is suspected leaked: rotate every value in `secrets/*.enc.env` and the EC2
  runtime files the same day, and re-encrypt for a new recipient.
