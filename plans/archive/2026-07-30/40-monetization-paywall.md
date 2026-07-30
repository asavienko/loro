# Monetization: the paywall, billing, and the Trip Pass question

- **Requirement IDs:** the M2 monetization scope
- **Milestone:** M2 — **currently blocked**
- **Spec:** `docs/product/monetization.md`
- **Open questions:** Q-08 (pricing — blocks v1 launch), Q-12 (RevenueCat vs direct)
- **Size:** L

## Start by being clear about the blocker

`docs/decisions/open-questions.md` Q-08, marked 🔴 and blocking v1 launch:

> Everything in `monetization.md` is a **proposal, not a decision** — the blueprint contains no
> monetization surface at all.

Needed before M2 mid: willingness-to-pay research across all four personas, a decision on whether
the Trip Pass is a compromise or the primary SKU, confirmation that the free tier teaches enough to
be honest, and regional pricing tiers.

So the honest sequencing is: **the research is the first deliverable of this plan, and no paywall
code should be written before it.** Building a paywall against a proposal means building it twice.
What _can_ be built ahead of the decision is the entitlement plumbing, because it is independent of
price.

The interesting hypothesis worth testing explicitly: if trip-mode learners convert at several times
everyday learners, the whole pricing model should be built around trips rather than around a monthly
subscription with trips as an add-on.

## Work that does not depend on Q-08

### 1. Entitlements, cached with a grace period

The hard constraint, from `docs/architecture/backend.md#billing` and repeated in Q-12: **a learner
abroad with no network must not lose Plus mid-trip.** That is the requirement that decides the
design:

- Entitlement state cached locally with a signed expiry and a generous grace period.
- Every gate reads the cached entitlement; **no gate awaits the network** — the same rule as
  everywhere else in this codebase.
- Failure mode is _grant_, not deny. A learner who paid and has no signal keeps their features. The
  cost of occasionally granting wrongly is far lower than the cost of locking a paying learner out
  at a hotel reception desk.

### 2. The gate mechanism

One `entitlement(feature)` check, used everywhere, so what is free and what is paid is legible in
one place rather than scattered across screens. Then the paywall's contents are configuration, not
code, and Q-08's answer changes data.

### 3. Q-12: RevenueCat or direct

RevenueCat is faster, handles receipt validation and cross-platform entitlements, and costs revenue
share. Direct StoreKit 2 / Play Billing is more work and more control. The deciding constraint is
already written down: whichever is chosen "has to support [offline entitlement caching with a grace
period] cleanly."

Evaluate both against that specifically, decide, and record it as an ADR. Do not let the decision be
made implicitly by whoever writes the first integration.

## Work that depends on Q-08

### 4. The paywall surface

Where it appears, what it says, and — the part this product should care about more than most —
**what stays free forever.** `monetization.md` has a section on exactly that, and it interacts with
a non-negotiable: paywalling the thing a learner needs while standing at a counter abroad, with no
signal, is the kind of decision that reads as extractive. Write down the list of never-paywalled
surfaces and treat it like the non-negotiables.

Survival mode is the obvious candidate for that list.

### 5. The Trip Pass

A one-off purchase tied to a trip, versus a subscription. It is on the M2 cut list (first item), so
build it in a way that can be cut without unpicking the subscription path.

### 6. Regional pricing and store configuration

Tiers, localised prices, the store listings, and the tax/legal metadata. Slow and unglamorous; start
early because store review is not fast.

## Cross-cutting

- **Restore purchases** must work, including on a fresh install with no account (anonymous-first
  means a purchase can predate a sign-in — that is a real case and it is the one most likely to be
  broken).
- **Receipt validation server-side**; never trust the client's claim of entitlement for anything
  that costs money to serve (the AI endpoints).
- **Subscription lifecycle**: renewal, cancellation, refund, billing retry, grace period, and family
  sharing if enabled. Each has a state the app must handle.
- **Telemetry** — conversion funnel and revenue metrics per `docs/product/metrics.md`, with no
  payment details in analytics.
- **Store compliance**: in-app deletion path (see
  [auth-anonymous-first.md](14-auth-anonymous-first.md)), privacy manifest accuracy, and
  subscription disclosure requirements.

## Acceptance criteria

- Q-08 answered and recorded, with the willingness-to-pay research behind it, before paywall UI
  ships.
- Q-12 decided and recorded as an ADR.
- Entitlements cached with a grace period; a learner abroad with no network keeps Plus for the whole
  trip — tested in airplane mode across a simulated multi-week period.
- No gate awaits the network; failure grants rather than denies.
- One entitlement check used by every gate.
- The never-paywalled list is written down and enforced, and survival mode is on it.
- Restore purchases works on a fresh install with no account.
- Receipts validated server-side before any paid AI call.
- Every subscription lifecycle state is handled.
- Store listings, pricing tiers, and privacy manifests complete and accepted.

## Tests

- Entitlement caching: expiry, grace period, clock manipulation (a learner setting their clock
  forward must not extend a subscription), network absence.
- Purchase, restore, cancel, refund, and billing-retry flows against store sandboxes.
- A test asserting no gate guards a never-paywalled surface.
- Anonymous purchase → later sign-in → entitlement follows the account.

## Risks

- **Q-08 slipping blocks v1**, and it is a research task with a lead time. It is the most likely
  non-content reason M2 slips; raise it early and often.
- **Paywalling the wrong thing** damages the product's core claim. The never-paywalled list is the
  defence.
- **Store review** on subscriptions is strict and slow. Submit early with a test account that works.

## Out of scope

Web checkout, promo codes, and referral programmes.
