# Monetization, offline entitlements, and the paywall

- **Requirement IDs:** M2 monetization scope
- **Milestone:** M2
- **Status:** ⛔ Product/billing implementation waits on Q-08 and Q-12. Decision research and cost
  inputs may proceed; draft schemas or vendor candidates do not authorize paid product behavior.
- **App swap (2026-09-30):** the first app this plan extended was replaced in `apps/mobile` by the
  v2.0 player (plan [104](104-prototype-react-native.md)); re-scope the client work against it
  before resuming.
- **Depends on:** Q-08 pricing/package, Q-12 billing mechanism; 59 cache, 67 identity, 73
  distribution; 86 vendor adapters.
- **Reviewed:** 2026-09-07 against merged baseline `2d9e8c3`.

## Verified starting point

Entitlement/billing proposals remain gated drafts; no purchase module, store products or paywall is
implemented. Language selection introduces no paid language boundary. Any package or per-course
restrictions require the pricing decision, not an implementation assumption.

## Outcome

An evidence-backed package and price controls premium access through offline-safe entitlements
without blocking survival use, losing purchases, or making learner progress hostage to the network.

## Remaining work

1. [ ] Resolve Q-08 through interviews/willingness-to-pay/competitor and cost analysis; decide free
       boundary, subscription/Trip Pass shape, trials, regional policy, refunds, and accessibility.
2. [ ] Resolve Q-12 with a build-vs-vendor decision covering store compliance, web parity, restore,
       server notifications, costs, outages, migration, and data handling.
3. [ ] Define signed/versioned entitlement records, local cache/grace, account merge, restore,
       family/ region, clock tamper, refund/revoke, and server reconciliation.
4. [ ] Implement one gate service used by routes/actions; local practice already earned or needed
       for Survival must never fail closed on network outage.
5. [ ] Build paywall/restore/manage-subscription states from approved copy and real products; no
       fake savings, countdowns, or unavailable offers.
6. [ ] Test sandbox stores, pending/ask-to-buy, cancellation/refund, reinstall, offline
       expiry/grace, account switch, webhook replay, region/currency, and provider outage.

## Acceptance criteria

- Products/prices displayed are fetched from the active store configuration and are accessible.
- Purchase/restore events are idempotent; offline grace and revocation follow the documented policy.
- A billing outage cannot corrupt progress or make cached Survival content unusable.
- App review/privacy/tax/refund requirements have named owners and verified evidence.

## Out of scope

Ads, manipulative urgency, unapproved price experiments, and marketplace resale.

## Post-main review and archive disposition — 2026-09-09

The [review at `de81744`](../docs/reviews/2026-09-09-post-main-plan-review.md) records this plan's
current contribution, remaining work and gates.
[Delivered slices](archive/2026-09-09/IMPLEMENTED-SLICES.md) are retained in the archive; this plan
remains incomplete. Earlier verification is dated evidence, not acceptance of the current combined
branch.
