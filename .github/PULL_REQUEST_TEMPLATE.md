<!--
Keep it under ~400 changed lines. If it's bigger, stack it.
See docs/process/git-workflow.md#pull-requests
-->

## What and why

<!-- Two sentences. The diff shows what changed; say why. -->

**Requirements:** <!-- e.g. P3-31, LIB-03 — from docs/product/prd.md --> **Design:**
<!-- the app behaviour this changes, or "new design" -->

## How I verified it

<!--
Be specific. For anything audio, animated, or native, say WHICH DEVICE —
the simulator lies about audio sessions and can't show a dropped frame.
-->

- [ ] `pnpm ci:local` passes locally (include commit, command and result)
- [ ] Tested on a real device: <!-- iPhone SE 3 / Pixel 6a / ... -->

## The five checks

Every PR asserts these. They enforce the architecture rules
([overview.md](../docs/architecture/overview.md#rules)).

- [ ] **No new path moves recorded audio, or a derivative of it, off the device**
- [ ] **No number shown to a learner is simulated, estimated, or placeholder** (latency is measured
      or `null`; scores come from real signal)
- [ ] **No copy shames a missed day**
- [ ] Every synced field I added has a **declared merge class** in
      `apps/mobile/src/shared/state/merge.ts`
      ([sync-protocol.md](../docs/architecture/sync-protocol.md))
- [ ] Every target-language text I added carries its **`lang`** (e.g. `lang={set.targetLang}`)

## Screenshots / recording

<!--
Visual change → screenshot.
ANIMATED change → screen recording. A still cannot show a stutter.
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

</details>

<details><summary>State machine or learner log</summary>

- [ ] `transition` stays pure; new events are allowed in `chart.ts`
- [ ] Unit/property tests in `apps/mobile/src/shared/state/`
- [ ] Deterministic: time only from `state/clock.ts`
- [ ] **Maintains every progress signal it can compute, including ones it doesn't display**
- [ ] Saved progress migrates (`persistence.ts`); an interruption resumes rather than restarts

</details>

<details><summary>Sync</summary>

- [ ] Merge class declared and correct for each new field
- [ ] Commutativity and idempotency tested
- [ ] Two-device scenario tested
- [ ] **Reviewed by both tech lead and backend**

</details>

<details><summary>loro-core (Rust)</summary>

- [ ] FSRS parity passes (`cargo test --test fsrs_parity`) — or a moved vector is **explained
      below**, not re-baselined silently
- [ ] Criterion shows no >10% regression
- [ ] Calendar parity passes (`cargo test --test parity`)
- [ ] No `Date.now()`, no unseeded RNG, no I/O

**If a parity vector moved, explain here:**

</details>

<details><summary>Audio / native module</summary>

- [ ] Tested on real devices, both platforms
- [ ] Interruption cases checked (call, route change, background)
- [ ] No PCM crosses into JS
- [ ] Buffer released after use

</details>

<details><summary>Content</summary>

- [ ] `content:validate` passes
- [ ] **Reviewed by a native speaker** of the course's language (Q-23)
- [ ] Audio rendered and **listened to by a human**

</details>

<details><summary>Analytics event</summary>

- [ ] Properties allowlisted
- [ ] No free text, no audio derivative, no PII

</details>

## Performance

<!-- If this touches a measured surface, state the before/after against the budget. -->

## Notes for the reviewer

<!-- Generated or mechanical files to skip; anything you're unsure about; what you'd like scrutinised. -->
