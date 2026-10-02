# 0020 · Analytics go to PostHog US Cloud

- **Status:** Accepted
- **Date:** 2026-10-02
- **Deciders:** the owner (conversation of 2026-10-02)
- **Amends:**
  [ADR-0011](0011-analytics-and-privacy.md#product-analytics-and-session-replay-amended-2026-09-30),
  which named PostHog EU Cloud

## Context

ADR-0011 sends product analytics, session replay, logs and error reports to PostHog EU Cloud. The
project the owner set up and reads is on PostHog US Cloud (`us.posthog.com`), and its key is the one
the builds carry. A key from the US project sent to the EU host is rejected, so the code's EU
default could only ever lose events.

No APK so far carried a key at all: `pnpm apk:local` ignores dotenv files and the key lived only in
`apps/mobile/.env`, so every build sent nothing.

## Decision

- Analytics go to **PostHog US Cloud**: `EXPO_PUBLIC_POSTHOG_HOST` defaults to
  `https://us.i.posthog.com`. Everything else in ADR-0011 (opt-out, unmasked replay except the
  sign-in code, never audio) is unchanged.
- The APK build reads `EXPO_PUBLIC_POSTHOG_KEY` and `EXPO_PUBLIC_POSTHOG_HOST`, and only those, from
  `apps/mobile/.env` when the shell doesn't set them, and `pnpm apk:github` refuses to build without
  a key ([local-apk.md](../../process/local-apk.md#api-url)).

### Rejected

- **A new project on EU Cloud.** It would keep EU residency, but the owner works in the US project
  and would start again with no history; nothing here depended on EU residency.
- **Keep the key only in the shell.** That is how every build so far shipped without one.

## Consequences

Learner analytics, including replays of what they wrote, are stored in the US. The privacy notes
([security-privacy.md](../security-privacy.md)) say so.

### Revisit if…

Loro is offered in a market or to an organisation that requires EU data residency.
