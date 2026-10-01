# The public repository

The repository is public and source-available
([ADR-0018](../architecture/adr/0018-public-source-available-repository.md),
[`LICENSE`](../../LICENSE)). This page is the checklist that made it so, the settings it relies on,
and what must never enter it. The audit behind it is summarised in the ADR.

## What is public, and what is not

Public: the whole tree and its history, the issues and pull requests, the GitHub Releases (Android
preview APKs, signed with a development key) and the discussions in them.

Not public, and never to be committed ([git-workflow.md](git-workflow.md#never-commit)): plaintext
`.env` values, the age identity that decrypts `secrets/*.enc.env`, learner data, recorded audio,
database dumps, signing keys, store credentials and the EC2 runtime files. The encrypted
`secrets/*.enc.env` files are published as ciphertext on purpose; the age private key is the one
thing that protects them, and its loss means rotating every value in them the same day.

Identifiers that are in the history and stay there: an earlier public host name of the EC2
development host, the API Gateway id behind `api.loro.app`, and the instance id. They are not
secrets; the host accepts SSH from one administrator address only and binds the API to loopback.

## Repository settings

Done before the switch (on the private repository):

- `.github` templates, Dependabot updates (`dependabot.yml`), the gitleaks pre-commit hook.
- Dependabot alerts turned on (`PUT /repos/{owner}/{repo}/vulnerability-alerts`).
- Repository description set.
- A full-history gitleaks scan (no credential, ever) and a read of every tracked image. One
  screenshot in `feedback/` was a phone lock screen with a phone number and other people's messages:
  it was deleted from the tree, and it is purged from history before the switch.

Still to do before the switch, once the open branches have landed, because it rewrites the hashes of
every commit since `c00b355b` (2026-10-01) and every clone and worktree must rebase:

```bash
git clone --mirror git@github.com:asavienko/loro.git loro-purge.git && cd loro-purge.git
git filter-repo --invert-paths --path 'feedback/photo_2026-10-01 18.34.57.jpeg'
git push --force --all && git push --force --tags     # main and every claude/* branch
```

Then, in each local checkout, `git fetch` and `git rebase --onto origin/main <old-base>`; delete the
old Releases' commit links if GitHub keeps pointing at vanished hashes (the release assets stay).
Confirm with `git log --all --oneline -- 'feedback/photo_2026-10-01 18.34.57.jpeg'`, which must
print nothing, and ask GitHub support to drop the cached commit `c00b355b` from their side.

To do right after `gh repo edit --visibility public --accept-visibility-change-consequences`, in
this order, because each is free only for public repositories:

```bash
repo=asavienko/loro
# Secret scanning with push protection: a pushed credential is blocked, not merely reported.
gh api -X PATCH "repos/$repo" --input - <<'JSON'
{"security_and_analysis":{"secret_scanning":{"status":"enabled"},
 "secret_scanning_push_protection":{"status":"enabled"}}}
JSON
# Private vulnerability reporting: the channel SECURITY.md tells reporters to use.
gh api -X PUT "repos/$repo/private-vulnerability-reporting"
# Dependabot security updates (pull requests for alerts, on top of the alerts themselves).
gh api -X PUT "repos/$repo/automated-security-fixes"
# Protect main: pull requests only, linear history, no force-push, no deletion.
gh api -X PUT "repos/$repo/branches/main/protection" --input - <<'JSON'
{"required_status_checks":null,"enforce_admins":false,
 "required_pull_request_reviews":{"required_approving_review_count":0},
 "restrictions":null,"required_linear_history":true,
 "allow_force_pushes":false,"allow_deletions":false}
JSON
```

Then check in the browser: **Settings → Code security** shows the three features on; the
**Security** tab shows "Report a vulnerability"; **Insights → Community Standards** is complete
(description, README, contributing, licence, security policy, issue and pull request templates).
GitHub will not recognise the custom `LICENSE` as a known licence; that is expected.

Leave off: GitHub Actions (the [CI policy](ci-cd.md) runs everything locally), Discussions and the
wiki (issues are enough for one maintainer), and GitHub Pages.

## Before every push, as before

The pre-commit hook runs gitleaks on the staged changes. A full-history rescan is one command and
worth running after any large import:

```bash
gitleaks git --no-banner --redact .
```

## If something private does get pushed

Rotate first, scrub second: a public commit is cloned within minutes, so removing it from history
protects nothing. Rotate the credential, then rewrite and force-push only if the content must not
remain visible for other reasons (learner data, for instance), and ask GitHub support to purge the
cached views.
