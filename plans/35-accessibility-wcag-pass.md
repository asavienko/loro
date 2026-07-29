# Accessibility: the WCAG 2.2 AA pass, and resolving Q-14

- **Requirement IDs:** the accessibility pass in M2 scope; Q-10, Q-14
- **Milestone:** M2
- **Spec:** `docs/architecture/accessibility.md`
- **Size:** M–L

## Current state — a genuinely good starting point

Four accessibility gates already run in CI (`.github/workflows/ci.yml`, `a11y` job):

- Contrast across all four accent themes (`pnpm --filter @loro/design-tokens check:contrast`)
- Spanish text carries `lang="es-ES"` (`check:lang`)
- Every chart has a visible text summary (`check:chart-summaries`)
- Tap targets ≥44×44 (`check:tap-targets`)

That is more automated a11y enforcement than most shipped apps have, and the contrast gate has
already earned its keep — Q-14 was "found by the contrast gate, not by inspection, which is the gate
doing its job."

What is missing is everything the gates cannot check by static analysis: screen-reader semantics,
focus order, dynamic type, reduced motion, and whether the app is actually usable without hearing or
without speech.

## Resolve Q-14 first — it blocks the hero screen

At 100% automaticity the Refrain's warming card is a hot-coral gradient with white text. The
blueprint puts a **13 px English subtitle in white at 0.7 opacity** on it (`Loro.dc.html:1442`).
White on the gradient's light stop is **2.66:1** — below even the 3:1 large-text floor. Reaching
4.5:1 for 13 px text means darkening the gradient to roughly `#a86737 → #8f4119`, "a muddy brown,
which destroys the app's single most important reward moment."

The constraint is currently _recorded and enforced_ rather than resolved:
`packages/design-tokens/tokens/color.json` declares `warming.peak.textSizeFloor: "large"` and
`checkContrast.ts` fails if that floor is removed while the colours stay.

Options on record, with the lean being (a) or (b): (a) drop the English subtitle at peak — arguably
right, since at 100% the learner owns the phrase; (b) render the subtitle on a solid inset chip; (c)
accept the muddy gradient; (d) keep white but raise the subtitle to ≥17 px semibold.

**Needs the designer.** Get the decision, implement it, and close the question — the peak state is
the v1 hero screen's payoff and it cannot ship in a state the contrast gate is holding at arm's
length.

## The work

### 1. Screen-reader semantics, screen by screen

Labels, roles, hints, grouping, and **reading order** for all 21 screens. The non-obvious ones:

- The Refrain's warming card conveys meaning through **colour and warmth**. A screen-reader user
  gets none of it, so the accessible version must state the progress as words, and the card's
  accessible label has to change as automaticity climbs.
- Charts: the text summary gate ensures one exists; this pass makes it _good_ (see
  [screen-memory-model.md](25-screen-memory-model.md) §5).
- The token-reveal in Speak to progress announces progress without announcing every partial ASR
  result, which would be unusable.

### 2. Dynamic type

Test at the largest OS text size on both platforms. Spanish is typically longer than English, and
the blueprint's cards are tight — expect real layout work, not a font-scale flag. Nothing may clip,
and nothing may become unreachable.

### 3. Reduced motion

`docs/design/motion.md` catalogues 11 keyframe animations. Each needs a reduced-motion behaviour,
and "disable everything" is wrong for the ones that carry information (the warming transition
communicates progress). Substitute a non-animated representation rather than removing the signal.

### 4. The honest limitation, and Q-10

`docs/architecture/accessibility.md#the-honest-limitation` states it: Loro is a
pronunciation-and-melody app, and for a profoundly deaf learner the labs and speaking gates are not
meaningfully usable.

Q-10 proposes typing the phrase as a **first-class alternative** to saying it — same gate, same
progress, same FSRS write. Two things worth saying about it:

1. It is not scoped, and it is a genuine feature rather than an accessibility afterthought.
2. It also serves anyone who cannot speak aloud right now — an open office, a quiet carriage, a
   sleeping baby — "which is a much larger group than the accessibility framing suggests."

That second point is the argument for building it. It is adjacent to the reveal fallback in
[screen-speak-to-progress.md](21-screen-speak-to-progress.md) but is not the same thing. Scope it in
this plan or spin it out, but stop leaving it open.

### 5. Colour independence

No state may be conveyed by colour alone — difficulty chips, mastery buckets, off-target contour
points. Add shape, text, or pattern. The contour marking in the Prosody lab is the hardest case and
the one most likely to be missed.

### 6. Extend the automated gates

- Contrast in **dark theme** too, once `F-06` lands.
- A gate that every interactive element has an accessibility label — the same static-analysis
  approach as `check:tap-targets`, which proves the pattern works in this codebase.
- Reduced-motion coverage: every animation registers in a manifest and the check fails on an
  unregistered one.

### 7. A real manual pass

VoiceOver and TalkBack, full flows, by someone who uses them regularly if possible. Record it in
`docs/process/qa-device-matrix.md` as a per-release checklist, not a one-off.

## Acceptance criteria

- Q-14 resolved, implemented, and closed in `docs/decisions/open-questions.md`.
- All 21 shipped screens navigable and completable with VoiceOver and with TalkBack.
- Largest dynamic type: no clipping, no unreachable controls, on both platforms.
- Every animation has a reduced-motion behaviour that preserves its information.
- No state conveyed by colour alone.
- WCAG 2.2 AA met for the shipped surface, with exceptions documented and justified rather than
  unnoticed.
- Q-10 has a decision: scoped, or explicitly deferred with a reason.
- New automated gates in CI, and the existing four still green.

## Tests

- The extended CI gates.
- Per-screen accessibility-label snapshot tests.
- Dynamic-type layout tests at the largest size.
- The documented manual pass, per release.

## Out of scope

Full localization ([ui-localization.md](43-ui-localization.md)) — related but a different problem.
