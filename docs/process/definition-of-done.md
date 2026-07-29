# Definition of ready / done

Gates at three levels: an issue, a PR, a release.

---

## Definition of ready — before work starts

- [ ] **Requirement IDs** from [`../product/prd.md`](../product/prd.md)
- [ ] **Blueprint reference** (line range from `Loro.dc.html`), or an explicit note that this is new
      design
- [ ] **Acceptance criteria**, testable, written as observable behaviour
- [ ] **Edge cases listed** — usually already in
      [`../product/functional-spec.md`](../product/functional-spec.md)
- [ ] **Design tokens and components identified**, or flagged as new (which means designer
      involvement)
- [ ] **Open questions resolved**, or explicitly deferred with a stated assumption
- [ ] **Sized** — if it's more than two days, it's split

An issue that isn't ready doesn't get picked up. Making it ready is fifteen minutes; discovering it
wasn't is half a day.

---

## Definition of done — a PR

### Always

- [ ] `pnpm check` passes locally and in CI
- [ ] Acceptance criteria met, demonstrably
- [ ] **The three non-negotiables asserted** (no audio egress · no fake numbers · no shame copy)
- [ ] Tests at the right level ([testing-strategy.md](testing-strategy.md))
- [ ] Errors handled per [`../architecture/mobile-app.md`](../architecture/mobile-app.md#errors) —
      expected states are UI states, not errors
- [ ] Empty state handled
- [ ] Offline behaviour correct, or explicitly N/A
- [ ] No new performance-budget regression
- [ ] Docs updated if behaviour changed
- [ ] Reviewed and approved

### If it's a screen or a component — the design-fidelity gate

- [ ] **Compared against the blueprint side by side**, on a device
- [ ] Every `sc-if` state implemented, including empty and error
- [ ] Toast and label copy verbatim where the blueprint has copy
- [ ] Tokens only, no colour literals; correct variant (`accentInk` for text)
- [ ] Press feedback on every interactive element
- [ ] Animations match [`../design/motion.md`](../design/motion.md), reduced-motion variant works
- [ ] `lang="es-ES"` on every Spanish text node
- [ ] Charts have a visible text summary
- [ ] Dynamic Type at 200% doesn't break layout
- [ ] Screen-reader pass: labels, values, actions, one focusable element per row
- [ ] Screen recording in the PR for anything animated

### If it's an engine

- [ ] **Passes the conformance suite**
      ([`../architecture/practice-engines.md`](../architecture/practice-engines.md#conformance))
- [ ] Selection and sequencing rules unit-tested
- [ ] `plan()` is read-only; determinism with an injected clock and seed
- [ ] Maintains **every** progress signal it can compute, including undisplayed ones
- [ ] Session state persisted, so an interruption resumes rather than restarts

### If it touches sync

- [ ] Every new field has a **declared merge class** in `fieldPolicy.ts`
- [ ] Merge commutativity and idempotency tested
- [ ] Two-device scenario tested
- [ ] Reviewed by **both** tech lead and backend

### If it touches `loro-core`

- [ ] Golden tests pass, or a diff is **explained in the PR** — never re-baselined silently
- [ ] Criterion benchmarks show no >10% regression
- [ ] Cross-language parity test passes (Swift, Kotlin, WASM agree)
- [ ] No `Date.now()`, no unseeded RNG, no I/O

### If it touches audio or the native modules

- [ ] Tested on a **real device**, both platforms
- [ ] Interruption cases checked (call, route change, background)
- [ ] No PCM crosses into JS
- [ ] Buffer released after use

### If it's content

- [ ] `content:validate` passes (schema, pack counts, references, audio)
- [ ] **Reviewed by a native Spanish speaker**
- [ ] Audio rendered and **listened to by a human**
- [ ] Meets the ten-point quality bar
      ([`../product/content-model.md`](../product/content-model.md#quality-bar-for-a-catalog-phrase))

### If it adds an analytics event

- [ ] Documented in [`../product/metrics.md`](../product/metrics.md) **in the same PR**
- [ ] Properties allowlisted
- [ ] No free text, no audio derivative, no PII

---

## Definition of done — a release

### Automated gates (CI blocks the build)

- [ ] All checks green on the release branch
- [ ] Performance budgets: startup, `core-rs`, data layer, bundle size
- [ ] Accessibility: contrast (all four accents), `lang` attribution, tap targets, Dynamic Type
      snapshots, chart summaries
- [ ] E2E suite green on both platforms
- [ ] No secrets in the built artifact (scanned)
- [ ] Content validation green

### Manual gates — the release checklist

Run on the device floor ([qa-device-matrix.md](qa-device-matrix.md)).

- [ ] **The airplane-mode test:** airplane mode, force-quit, relaunch, survival mode fully usable in
      under 2 s ([`../architecture/offline.md`](../architecture/offline.md#the-acceptance-test))
- [ ] **The warming card holds 60 fps** through a full 500 ms transition, on the device floor
- [ ] **Audio interruption matrix** — call, Siri, route change, headphones out, background, lock
- [ ] 40-minute background stream soak: no leak, no drop, lock screen stays in sync
- [ ] Mic denied → reveal mode works on every speaking screen
- [ ] Screen-reader pass on every changed screen (VoiceOver + TalkBack)
- [ ] Battery: stream ≤ 4%/h screen-off; refrain ≤ 12%/h screen-on
- [ ] No thermal throttling in a 30-minute session
- [ ] Widget and Live Activity states, including offline playback from the lock screen
- [ ] **Copy audit:** every new string checked against the forbidden list
      ([`../design/copy-and-tone.md`](../design/copy-and-tone.md#what-we-never-write))
- [ ] Migration from the previous released schema, with a 2 000-phrase fixture
- [ ] Sign-in merge with overlapping libraries — nothing lost

### Product gates

- [ ] Requirement IDs for the milestone closed, or explicitly deferred with a note
- [ ] Store metadata, screenshots, and privacy disclosures updated
      ([`../architecture/security-privacy.md`](../architecture/security-privacy.md#gdpr--regulatory-duties))
- [ ] Release notes written for humans
- [ ] Rollback plan confirmed (OTA revert, or the previous binary)
- [ ] Guardrail metrics instrumented and reading
- [ ] On-call knows the release is going out

### Milestone-specific gates

| Milestone       | Extra gate                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **M2 (v1)**     | The trip test — ≥5 real people set a 12-day trip, travel, and report readiness                                                                                           |
| **M3 (labs)**   | **Native-speaker agreement ≥80% on 20 recorded takes.** If it fails, the labs don't ship ([`../architecture/prosody-dsp.md`](../architecture/prosody-dsp.md#validation)) |
| **M4**          | Load test passes at 10× projected peak                                                                                                                                   |
| **M5 (Loop C)** | Rung ≥2 correlates with 30-day retention                                                                                                                                 |

---

## Not done

Things that look done and aren't:

| Looks done             | Actually needs                                                              |
| ---------------------- | --------------------------------------------------------------------------- |
| "The screen renders"   | Every state, including empty, error, and long content                       |
| "It works on my phone" | The device floor, both platforms                                            |
| "The animation plays"  | 60 fps on the device floor, plus a reduced-motion variant                   |
| "Audio plays"          | Interruptions, route changes, backgrounding                                 |
| "The score appears"    | Validated against a native speaker, and stable across takes                 |
| "Sync works"           | Two devices, a partition, and reconvergence                                 |
| "It's behind a flag"   | The flag resolving offline, and the off path tested                         |
| "Tests pass"           | Tests that would fail if the behaviour broke                                |
| "The copy is in"       | Checked against the forbidden list, and screen-reader-read                  |
| "The latency shows"    | **Measured**, with `null` handled and the read-out hidden when unmeasurable |

That last row is the one that matters most. A plausible-looking number that isn't real is worse than
no number, because nobody will ever question it.
