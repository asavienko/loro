# Android and EC2 readiness

- **Requirement IDs:** F-03, F-04, F-09
- **Status:** ✅ Standalone HTTPS connection, updated EC2 deployment, APK/emulator proof and
  readiness review completed. Essential production learning remains with plans 59–68 and their
  audio/quality gates; it is not claimed by this audit. See
  [the evidence](../docs/reviews/2026-09-08-readiness.md).

## Scope

1. Verify current EC2 and published APK, then redeploy the current API through its existing gate.
2. Provide an AWS-owned HTTPS hostname through API Gateway and a VPC-attached Lambda proxy. Expose
   only explicit GET health/content/provider-discovery routes; legacy writes stay private.
3. Show actual backend connection status in Account, independent of sign-in availability.
4. Build a traceable standalone APK and verify HTTPS from Android, including offline failure.
5. Record tested features and remaining release blockers without treating health as product
   readiness.

No production learner data, paid domain purchase, store publishing, or activation of gated speech
features is part of this delivery. Account provider credentials and durable sync remain
prerequisites for their owning feature slices.
