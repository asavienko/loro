# Monetization, offline entitlements, and the paywall

- **Requirement IDs:** M2 monetization scope
- **Milestone:** M2
- **Status:** Blocked on Q-08 pricing/package and Q-12 billing mechanism
- **Depends on:** 59 durable cache, 67 accounts, 73 delivery; decision research may start earlier

## Outcome

An evidence-backed package and price controls premium access through offline-safe entitlements
without blocking survival use, losing purchases, or making learner progress hostage to the network.

## Work

1. Resolve Q-08 through interviews/willingness-to-pay/competitor and cost analysis; decide free
   boundary, subscription/Trip Pass shape, trials, regional policy, refunds, and accessibility.
2. Resolve Q-12 with a build-vs-vendor decision covering store compliance, web parity, restore,
   server notifications, costs, outages, migration, and data handling.
3. Define signed/versioned entitlement records, local cache/grace, account merge, restore, family/
   region, clock tamper, refund/revoke, and server reconciliation.
4. Implement one gate service used by routes/actions; local practice already earned or needed for
   Survival must never fail closed on network outage.
5. Build paywall/restore/manage-subscription states from approved copy and real products; no fake
   savings, countdowns, or unavailable offers.
6. Test sandbox stores, pending/ask-to-buy, cancellation/refund, reinstall, offline expiry/grace,
   account switch, webhook replay, region/currency, and provider outage.

## Acceptance criteria

- Products/prices displayed are fetched from the active store configuration and are accessible.
- Purchase/restore events are idempotent; offline grace and revocation follow the documented policy.
- A billing outage cannot corrupt progress or make cached Survival content unusable.
- App review/privacy/tax/refund requirements have named owners and verified evidence.

## Out of scope

Ads, manipulative urgency, unapproved price experiments, and marketplace resale.
