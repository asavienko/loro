# Definition of ready / done

These gates distinguish evidence available today from gates that activate as native, persistent and
deployed surfaces are added.

---

## Definition of ready

- [ ] Requirement ID from [`../product/prd.md`](../product/prd.md)
- [ ] Blueprint line range, or an explicit new-design decision
- [ ] Observable acceptance criteria and edge/error/empty states
- [ ] Affected layer and test level identified
- [ ] Learner-visible states mapped to `apps/mobile/e2e/states.ts`
- [ ] Native, persistence, sync and offline implications stated
- [ ] Open questions resolved or a bounded assumption recorded
- [ ] Work split into coherent, independently green commits

## Definition of done — every PR

- [ ] Acceptance criteria are demonstrably met
- [ ] `pnpm check` passes with Node 22 and Cargo on `PATH`
- [ ] Tests changed at the owning layer; learner-visible changes also pass `pnpm test:e2e`
- [ ] New learner-visible states have a `states.ts` row and a functional-spec citation
- [ ] Import/asset/routing/build changes pass `pnpm test:e2e:bundle`
- [ ] The relevant package builds; mobile changes pass `pnpm --filter @loro/mobile bundle`
- [ ] Generated tokens/bindings are regenerated and committed when their sources change
- [ ] The three non-negotiables hold: no recorded-audio egress, no fake learner numbers, no
      missed-day shame
- [ ] Expected failures are usable UI states; empty and offline behaviour are handled or explicitly
      marked not applicable
- [ ] Docs and current-state limitations are updated in the same change
- [ ] Requirement ID is present in branch, commits and PR; review is approved

`pnpm check` is necessary but not sufficient: CI separately checks formatting/commit messages,
browser E2E, a production-export smoke run, build/readiness, generated drift and benchmarks.

### Screen or component

- [ ] Compared with every relevant blueprint state
- [ ] Copy comes from `src/lib/copy.ts`; tokens only, including the correct accessible colour token
- [ ] Press, keyboard and reduced-motion behaviour are covered where applicable
- [ ] Spanish nodes carry the source accessibility language property; charts have visible summaries
- [ ] Accessibility and text scale pass through the shared E2E state manifest
- [ ] Browser limitations are not presented as native accessibility evidence
- [ ] Visual/animated changes include review evidence (recording where motion matters)

### Practice engine or progress write

- [ ] Shared engine conformance passes, including determinism and termination
- [ ] Selection/sequencing and empty-session behaviour are tested
- [ ] Outcomes are expressed as `ProgressDelta` and written only through `applyDelta`
- [ ] Every computable progress signal is maintained; latency is measured or `null`
- [ ] Persistence/resume is required once durable session storage is introduced

### Persistence or sync

- [ ] Repository contract runs against every affected driver
- [ ] Every syncable field has a declared class in `fieldPolicy.ts`
- [ ] Merge idempotency/precedence are tested in Rust and through API WASM as applicable
- [ ] Transaction rollback and outbox behaviour are tested
- [ ] A new device driver adds migration, cold-hydration and force-quit/resume tests
- [ ] Auth/server persistence adds two-device, overlapping sign-in merge, tenant-isolation and
      long-offline replay tests before it can be called complete

### Rust core or learner-facing maths

- [ ] Rust unit tests and `tests/parity.rs` pass
- [ ] Criterion is run for a performance-sensitive change and the result is reviewed
- [ ] No ambient clock, unseeded randomness or I/O enters deterministic maths
- [ ] If DSP scores ship, real-recording golden tests and a documented stability threshold exist
- [ ] If review intervals ship, real FSRS `review()` passes reference fixtures, boundary/property
      tests, and native/WASM/TS parity; prototype fixed labels never appear as computed results
- [ ] “Cross-language parity” is claimed only after generated Swift, Kotlin and WASM outputs are
      actually executed against the same fixtures

### Native, audio, speech or widget work

- [ ] Contract and lifecycle tests exist, plus device flows on iOS and Android
- [ ] Permission denied, interruption, route change, background and cleanup are covered
- [ ] PCM remains in native memory and is passed to Rust by handle; buffers are released
- [ ] Device-farm/real-device evidence is wired before removing the corresponding documented gap

### Content or analytics

- [ ] Content passes `pnpm content:validate`, native Spanish review, and human listening for changed
      audio
- [ ] New analytics events are documented in [`../product/metrics.md`](../product/metrics.md), use
      allowlisted properties, and contain no PII, free text or audio derivative

## Definition of done — current pre-native milestone

The repository is not yet releasable to an app store. A milestone may be called complete only when:

- [ ] all required CI jobs that contain real commands are green;
- [ ] no required workflow step for that milestone is a `TODO`/echo scaffold;
- [ ] all implemented routes and states pass the full web E2E and production smoke suites;
- [ ] limitations in onboarding, testing and CI docs match the code;
- [ ] state-manifest `spec` references match the canonical functional-spec sections;
- [ ] deferred native/persistence acceptance gates are named, owned and planned rather than marked
      passed.

<a id="manual-gates--the-release-checklist"></a>

## Definition of done — first native release and later

These gates activate when the relevant implementation exists. They cannot be waived by a green web
suite:

- [ ] real device E2E on both platforms, including offline cold launch and force-quit resume
- [ ] audio interruption, microphone denial/fallback and background-session matrix
- [ ] VoiceOver and TalkBack pass on changed screens
- [ ] startup, bundle, data, frame-rate, battery and thermal budgets are measured on the device
      floor
- [ ] previous-schema migration and overlapping-library sign-in merge lose no data
- [ ] widget/Live Activity lifecycle is checked if shipped
- [ ] built artifacts are secret-scanned and deployment/store workflows contain no placeholder steps
- [ ] store privacy disclosures, release notes, rollback plan and guardrail monitoring are ready

For pronunciation/prosody, native-speaker agreement and the real-recording golden suite block the
feature, not merely the release.

## Not done

| Claim                          | Missing evidence                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| “The screen renders”           | Every learner-visible state, empty/error/long content and the state-manifest gates |
| “The app compiles”             | The Metro/Hermes bundle and representative production-export flows                 |
| “Offline first works”          | On-device persistence, airplane-mode cold launch and force-quit resume             |
| “Sync works”                   | Two devices, a partition and reconvergence; overlapping sign-in data               |
| “Audio works”                  | Real-device permissions, interruptions, backgrounding and cleanup                  |
| “The score is real”            | Real signal processing, recording goldens and native-speaker validation            |
| “Cross-platform parity passes” | Executing Swift, Kotlin and WASM outputs, not only one Rust fixture test           |
| “CI deploys/releases it”       | All workflow placeholders replaced and credentials/environments exercised          |
