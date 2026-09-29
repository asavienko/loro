# 0001 · Build the app with React Native and Expo

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Mobile lead, tech lead, product

## Context

We need one iOS and Android app covering **21 dense, animated screens** (the screen catalog, since
removed with the first app; Git history at `52a0e3b`), built by a team of two mobile engineers.

The screens are not simple. They include a colour-and-shadow-morphing "warming card", pitch contours
traced against a native reference, dual waveforms, a live-redrawing forgetting curve, a card-shuffle
reveal, bottom sheets, segmented controls, and a continuous audio stream with lock screen transport.

At the same time, substantial parts of the app are _not_ UI:

- a native audio graph with recording, rate control, and interruption handling
  ([audio-speech.md](../audio-speech.md));
- on-device DSP for pitch and alignment ([prosody-dsp.md](../prosody-dsp.md));
- a scheduler whose numbers must be identical on both platforms ([scheduling.md](../scheduling.md)).

So the question is not "which framework does everything", but "which framework does the 21 screens
cheaply while letting us drop to native where we must".

## Options considered

### A · React Native + Expo

**Pros**

- One TypeScript codebase for all 21 screens; roughly halves the UI cost.
- **Expo Modules** make writing Swift/Kotlin native modules a normal, well-trodden task rather than
  a bridge-plumbing project. That matters: we need three of them (audio, speech, core bindings).
- Shares `packages/core` — domain types, engine contracts, validation schemas — **with the API**.
  The sync wire format is typed once.
- Reanimated 4 runs the warming card and press feedback on the UI thread; Skia handles the charts.
  Both are mature.
- EAS gives us builds, OTA updates, and store submission without owning that pipeline.
- Largest hiring pool of the three options.

**Cons**

- Custom graphics cost more effort than in Flutter — Skia via a binding rather than natively.
- Two native codebases still exist for the modules and the widgets.
- Framework churn; New Architecture migration history is real.

### B · Flutter

**Pros**

- The charts and the warming-card animation are cheapest here — one rendering engine,
  pixel-identical on both platforms, `CustomPainter` is excellent.
- Strong, stable animation and layout story.

**Cons**

- **Isolates the codebase from everything else we write.** The API is Node/TypeScript, and
  `packages/core` sharing disappears — the sync protocol and domain types would be defined twice, in
  two languages, which is exactly the kind of duplication that produces data-loss bugs.
- Dart is a second language for the team on top of TypeScript and Rust.
- Platform channels for audio are workable but less ergonomic than Expo Modules for the amount of
  native work we need.

### C · Native iOS + Android (SwiftUI + Compose), shared logic in Kotlin Multiplatform

**Pros**

- Best possible audio access and platform feel.
- No framework risk; widgets and Live Activities are first-class rather than a separate target.

**Cons**

- **Roughly 2× the UI work for 21 screens.** With two mobile engineers that is the whole budget, and
  it would push the labs out of v1.1 into v2.
- KMP shares logic between the apps but not with the API.
- Every design change is implemented twice, which in practice means the two platforms diverge.

## Decision

**React Native 0.81 + Expo SDK 54, New Architecture, TypeScript strict.** Reanimated 4 for
animation, Skia for custom graphics, three local Expo Modules for audio, speech, and the Rust core
bindings, and native targets for the widgets.

The deciding factor was not raw capability — Flutter draws better and native feels better. It was
that **React Native lets us share the domain model and the sync contract with the backend**, and the
sync contract is the highest-consequence code in the system. A protocol defined twice in two
languages diverges, and the divergence shows up as a learner losing their phrase library.

Everything Flutter would have won (the charts) is a bounded, one-time cost in Skia. Everything RN
sharing wins (the protocol, the domain types, the validation schemas) is a recurring correctness
benefit.

## Consequences

### Good

- 21 screens for one team; the labs stay in v1.1 rather than slipping.
- `packages/core` is shared with the API: one Zod schema per endpoint, one set of domain types, one
  definition of the merge-class policy.
- Expo Modules make the native work routine, and the modules are small and testable.
- OTA updates let us fix a copy or layout bug in hours
  ([`process/ci-cd.md`](../../process/ci-cd.md)).

### Bad — accepted deliberately

- The charts cost more than in Flutter. Mitigated by isolating every chart behind a small component
  boundary and lazily importing the Skia-heavy lab screens
  ([performance.md](../performance.md#bundle-and-install)).
- We carry the New Architecture's rough edges. Mitigated by pinning versions and upgrading
  deliberately, not eagerly.
- Widgets are native-only and duplicated per platform. Unavoidable in every option; the snapshot
  approach keeps the duplicated surface tiny
  ([widgets-notifications.md](../widgets-notifications.md#data-flow)).
- The JS thread is a shared resource. Mitigated by the rule that anything animating during audio
  runs on the UI thread, and the hot path uses JSI (`op-sqlite`, UniFFI) rather than the async
  bridge.

### Revisit if…

- Reanimated or Skia cannot hold 60 fps on the device floor for the warming card or the contour
  trace. That is a **hard requirement** ([performance.md](../performance.md#frame-rate)); if it
  fails, the affected screens become native views embedded in the RN app before we reconsider the
  whole framework.
- The audio module's interruption handling proves unworkable through a module boundary.
- The team composition changes such that two native platforms become affordable.

## Amendment — 2026-09-09 · local APK, not EAS

The option-A pro "EAS gives us builds, OTA updates, and store submission" is not the current
pipeline. Custom native modules rule out Expo Go. Android preview is `pnpm apk:local`; GitHub
Actions is disabled; EAS is not a required gate ([`process/ci-cd.md`](../../process/ci-cd.md),
[`process/local-apk.md`](../../process/local-apk.md)). Revisit EAS only if a later release process
explicitly adopts it.
