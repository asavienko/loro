<!--
Keep it under ~400 changed lines. If it's bigger, stack it.
See docs/process/git-workflow.md#pull-requests
-->

## What and why

<!-- Two sentences. The diff shows what changed; say why. -->

**Requirements:** <!-- e.g. P2-04, LB-25 — from docs/product/prd.md --> **Design:**
<!-- the app behaviour this changes, or "new design" -->

## How I verified it

<!--
Be specific. For anything audio, animated, or native, say WHICH DEVICE —
the simulator lies about audio sessions and can't show a dropped frame.
-->

- [ ] `pnpm ci:local` passes locally (include commit, command and result)
- [ ] Tested on a real device: <!-- iPhone SE 3 / Pixel 6a / ... -->

## The five checks

Every PR asserts these. They're the ten rules' teeth
([overview.md](../docs/architecture/overview.md#the-ten-rules)).

- [ ] **No new path moves recorded audio, or a derivative of it, off the device**
- [ ] **No number shown to a learner is simulated, estimated, or placeholder** (latency is measured
      or `null`; scores come from real signal)
- [ ] **No copy shames a missed day** — including widget strings and notifications
- [ ] Every syncable field I added has a **declared merge class** in `fieldPolicy.ts`
- [ ] Every Spanish text node I added carries **`lang="es-ES"`**

## Screenshots / recording

<!--
Visual change → screenshot.
ANIMATED change → screen recording. A still cannot show whether the warming card stutters.
-->

## Scope-specific

<!-- Delete the sections that don't apply. -->

<details><summary>Screen or component</summary>

- [ ] Compared with the running app (web and a device)
- [ ] Every state implemented, including empty and error
- [ ] Copy in `apps/mobile/src/shared/copy/`, in all three UI languages
- [ ] Colours from `apps/mobile/src/ui/theme.ts`, no literals
- [ ] Press feedback on every interactive element
- [ ] Reduced-motion variant works
- [ ] Dynamic Type at 200% doesn't break
- [ ] Screen-reader pass (labels, values, actions)
- [ ] Charts have a visible text summary

</details>

<details><summary>State machine or learner log</summary>

- [ ] `transition` stays pure; new events are allowed in `chart.ts`
- [ ] Unit/property tests in `apps/mobile/src/shared/state/`
- [ ] Deterministic: time only from `state/clock.ts`
- [ ] **Maintains every progress signal it can compute, including ones it doesn't display** (rule 5)
- [ ] Saved progress migrates (`persistence.ts`); an interruption resumes rather than restarts

</details>

<details><summary>Sync</summary>

- [ ] Merge class declared and correct for each new field
- [ ] Commutativity and idempotency tested
- [ ] Two-device scenario tested
- [ ] **Reviewed by both tech lead and backend** (CODEOWNERS)

</details>

<details><summary>loro-core (Rust)</summary>

- [ ] Golden tests pass — or a moved score is **explained below**, not re-baselined silently
- [ ] Criterion shows no >10% regression
- [ ] Cross-language parity passes
- [ ] No `Date.now()`, no unseeded RNG, no I/O

**If a golden score moved, explain here:**

</details>

<details><summary>Audio / native module</summary>

- [ ] Tested on real devices, both platforms
- [ ] Interruption cases checked (call, route change, background)
- [ ] No PCM crosses into JS
- [ ] Buffer released after use

</details>

<details><summary>Content</summary>

- [ ] `content:validate` passes
- [ ] **Reviewed by a native es-ES speaker**
- [ ] Audio rendered and **listened to by a human**
- [ ] Meets the ten-point quality bar

</details>

<details><summary>Analytics event</summary>

- [ ] Documented in `docs/product/metrics.md` **in this PR**
- [ ] Properties allowlisted
- [ ] No free text, no audio derivative, no PII

</details>

## Performance

<!-- If this touches a measured surface, state the before/after against the budget. -->

## Notes for the reviewer

<!-- Generated or mechanical files to skip; anything you're unsure about; what you'd like scrutinised. -->
