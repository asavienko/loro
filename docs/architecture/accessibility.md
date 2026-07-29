# Accessibility

**Target: WCAG 2.2 AA**, plus the platform conventions (iOS Accessibility, Android Accessibility
Suite). Verified before every release
([`process/definition-of-done.md`](../process/definition-of-done.md)).

---

## Loro's unusual starting position

An audio-first language app has one large accessibility advantage and one large obstacle, and both
are structural.

**The advantage:** the core loop is _listen and speak_. The stream, the ambient loop, and every
speaking screen already work without looking at the screen. For a blind or low-vision learner, this
is closer to the ideal language app than a text-first competitor could be.

**The obstacle:** the pronunciation and prosody labs communicate through _graphs_. A pitch contour,
a waveform pair, a rhythm chart, and a forgetting curve are all visual by nature, and three of them
carry the actual feedback.

The rest of this document is mostly about honouring the advantage and solving the obstacle honestly.

---

## Screen readers

### Every phrase row

A phrase row contains bilingual text, a difficulty pill, a love toggle, and an audio button. Read
naively, VoiceOver produces noise.

```tsx
<Pressable
  accessible
  accessibilityRole="button"
  accessibilityLabel="Me pone un cortado, por favor. A cortado, please."
  accessibilityHint="Opens phrase details"
  accessibilityValue={{ text: 'Difficult. Tagged pronunciation. Loved.' }}
  accessibilityActions={[
    { name: 'play',      label: 'Play audio' },
    { name: 'love',      label: 'Toggle loved' },
    { name: 'cycleDiff', label: 'Change difficulty' },
  ]}
  onAccessibilityAction={handleAction}
>
```

Rules:

- **Spanish text is marked with `lang="es-ES"`** so the screen reader pronounces it in Spanish
  rather than mangling it in English. This is the single highest-impact accessibility detail in the
  app.
- One focusable element per row; sub-controls become **accessibility actions**, not separate stops.
- State is in `accessibilityValue`, not appended to the label.

### Practice screens

| Screen                      | Screen-reader treatment                                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stream**                  | Now-playing announced on change (polite). Transport controls labelled with state ("Pause", not "Play/pause"). Repeat progress as `accessibilityValue`: "Repeat 2 of 4"            |
| **Refrain**                 | Mode announced when it changes ("Cloze — fill the gap out loud"). Automaticity as a progress bar with a percentage. **Lock-in is announced assertively** — it's the reward moment |
| **Speak to progress**       | Each word un-blurring is announced ("cortado — revealed. 3 of 5 words"). The gate state is announced, so a blind learner knows why Next is locked                                 |
| **Review**                  | Focus banner read first (it's the instruction). Reveal is a button, not a gesture. Grade buttons include their intervals ("Good, 3 days")                                         |
| **Prosody / Pronunciation** | See [below](#graphs-and-the-labs)                                                                                                                                                 |
| **Progress**                | The mastery bar has a text summary. The tag histogram is a list of "Pronunciation, 12 phrases", each actionable                                                                   |
| **Phrasebook**              | Rung pips are not focusable; the rung name is in the value ("Bent, rung 2 of 5")                                                                                                  |

### The blurred-word mechanic

Visual blur is meaningless to a screen reader and must not leak the answer. Hidden words are exposed
as `"hidden word"` with no text content; revealed words expose their text. The blur is a `filter` on
a separate visual layer, and the underlying text node is genuinely absent until revealed — not
transparent, not zero-opacity.

---

## Graphs and the labs

The labs' feedback must be available without sight. Three mechanisms, in order of usefulness:

### 1 · A text summary that carries the same information

Every graph has an adjacent, always-present (not screen-reader-only) summary:

| Graph                  | Summary                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| Pitch contour          | _"Your pitch rises later than the native speaker's and doesn't climb as high. Melody 74."_ |
| Rhythm & stress        | _"You stress 'ca' but the native stresses 'FÉ'. Your second syllable is too short."_       |
| Syllable accuracy      | _"Strongest: 'Dón' 92. Weakest: 'ño' 62."_                                                 |
| Forgetting curve       | _"Strong recall for 3 days. Next review Thursday, when recall reaches about 50%."_         |
| Ladder histogram       | _"3 Accumulated, 3 Bent, 2 Transferred, 1 Pressure-tested, 1 Deployed."_                   |
| Effort chart (Refrain) | _"1.2 seconds, down from 1.9 four reps ago."_                                              |

**These summaries are visible to everyone.** That's deliberate: the blueprint's own coaching copy is
already prose (_"You flatten the ending — keep the pitch climbing"_), so making the graph's meaning
explicit improves the screen for sighted learners too. Accessibility work that only benefits
assistive tech tends to rot; this doesn't.

### 2 · Sonification of the pitch contour

The contour is _pitch over time_. It can simply be played:

- **"Hear the shape"** plays the native contour as a pure tone following the F0 track, then the
  learner's, then both.
- Available to everyone, not just screen-reader users, and genuinely the clearest way to understand
  a melody mismatch. Several sighted testers will prefer it.

This is the honest answer to "how does a blind learner use the prosody lab": they hear the
difference, which is what the graph was a proxy for anyway.

### 3 · Haptic stress feedback

The rhythm chart maps to a haptic pattern — a stronger tap on the stressed syllable, timed to the
duration. Native pattern, then the learner's.

---

## Motion

| Setting                   | Behaviour                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Reduce Motion on**      | `stepIn`, `popIn`, `sheetUp`, `flip`, `grow` become cross-fades. `pulseRing` and `barJump` stop. Sheets appear without sliding |
| The warming card          | **Keeps its colour change** (that's information, not decoration) but loses the glow animation                                  |
| The pitch-contour trace   | Becomes a static plot with a scrubber instead of an auto-playing cursor                                                        |
| The deck shuffle (Loop C) | Becomes an immediate reveal                                                                                                    |
| Equalisers, beat bars     | Replaced by a static indicator                                                                                                 |
| Press feedback            | Retained — it's a 130 ms affordance, not motion                                                                                |

The rule: **if an animation carries information, its information survives; only the motion goes.**
Detail per animation: [`design/motion.md`](../design/motion.md#reduced-motion).

---

## Text and layout

| Requirement                       | Implementation                                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Dynamic Type / font scale to 200% | Every text style uses scalable units; no fixed heights on text containers                                                     |
| No text truncation at large sizes | Rows grow vertically; horizontal chip rows wrap or scroll                                                                     |
| Bold Text setting                 | Honoured via the platform font weight mapping                                                                                 |
| Minimum tap target 44×44          | The blueprint already sets 40×40 minimum with a 44×44 hit area via `.ico::after` (`Loro.dc.html:45–46`); we standardise on 44 |
| No information by colour alone    | Difficulty has a label _and_ a colour; ladder rungs have names; score bands have numbers                                      |
| Contrast                          | See below                                                                                                                     |
| Landscape                         | Supported; the phone-only layouts reflow rather than lock                                                                     |

### Contrast audit

**Done, and now automated.** `packages/design-tokens/src/checkContrast.ts` computes **107 pairings**
across all four accent themes on every CI run and fails the build on a violation.
`pnpm --filter @loro/design-tokens check:contrast` runs it locally.

The audit found **eight colours in the blueprint's palette that do not meet AA in the pairing they
are actually used in**, plus one that passes only at a declared size floor. Each was darkened along
the same hue — never re-hued, so the palette still reads as the blueprint's — and each correction is
recorded as a `deviation` field next to the value in `packages/design-tokens/tokens/color.json`:

| Token                          | Blueprint | Was    | Now       | Note                                                  |
| ------------------------------ | --------- | ------ | --------- | ----------------------------------------------------- |
| `semantic.hookMeta.text`       | `#bd9660` | 2.44:1 | `#866a44` | The largest correction. Genuinely unreadable at 10 px |
| `scale.mastery.new`            | —         | 2.29:1 | `#918b82` | Legend dots were indistinguishable                    |
| `scale.mastery.learning`       | —         | 2.46:1 | `#b58331` | Same                                                  |
| `ink.muted3`                   | `#8c8677` | 2.94:1 | `#8a8476` | On `surface.sunken`                                   |
| `warming.warm.text`            | `#9b6a3c` | 4.16:1 | `#936439` |                                                       |
| `warming.peak.bg` (light stop) | `#e08a4a` | 2.66:1 | `#d28145` | White on it failed even the 3:1 large-text floor      |
| `semantic.successAlt.text`     | `#3f7d5d` | 4.37:1 | `#3c785a` | Corrected twice — see below                           |
| `semantic.successMeta.text`    | `#5f8a71` | 3.40:1 | `#50745f` | On `semantic.success.bg`                              |

Two of these are worth calling out:

- **`successAlt` needed a second pass.** Its first correction cleared 4.5:1 on `surface.app`, which
  is where the checker was looking. But it is used on `semantic.success.bg` — a green on a green
  card — where it only reached 4.4:1. The checker now tests every `<base>Alt` / `<base>Meta` token
  against its base family's background, not just the page, because that is the tighter pairing and
  the one the UI actually renders.
- **One case was recorded rather than fixed.** White text on the peak warming band clears 3:1 but
  not 4.5:1. Darkening the gradient far enough would turn the app's single most important reward
  moment into a muddy brown, so the token carries `textSizeFloor: "large"`, the checker fails if
  that floor is removed, and the 13 px English subtitle the blueprint renders there is an open
  design question — **Q-14**.

Baseline values on the `#f6f2ea` surface:

| Token                    | Value     | On surface | Verdict                                                   |
| ------------------------ | --------- | ---------- | --------------------------------------------------------- |
| `ink`                    | `#23201b` | 13.9:1     | ✅                                                        |
| `ink-2`                  | `#514e44` | 7.4:1      | ✅                                                        |
| `ink-3`                  | `#5c584c` | 6.3:1      | ✅                                                        |
| `muted`                  | `#6c6759` | 4.8:1      | ✅ body                                                   |
| `muted-2`                | `#7a7466` | 3.9:1      | ⚠️ **large text / non-text only**                         |
| `accent` Coral `#bf5722` |           | 4.0:1      | ⚠️ large text and UI only — **never body text**           |
| `accent-ink` `#a2461a`   |           | 5.6:1      | ✅ — this is why the blueprint has a separate ink variant |
| `success` `#356b4f`      |           | 5.4:1      | ✅                                                        |
| `warn` `#8a6414`         |           | 4.7:1      | ✅                                                        |
| `danger` `#8c3f18`       |           | 6.4:1      | ✅                                                        |
| White on `accent` Coral  |           | 4.0:1      | ⚠️ large text only                                        |

**Consequences, enforced in the design system:**

1. `muted-2` is for 14 px+ semibold and non-text decoration only.
2. **`accent` is never used for body text; `accent-ink` is.** The blueprint already does this
   consistently — that's what `--accent-ink` is for (`Loro.dc.html:49`) — and the token names encode
   the rule.
3. White-on-accent is restricted to ≥17 px semibold (buttons, pills).
4. Every accent variant (Coral, Sunset, Teal, Berry) is audited independently; a theme that fails is
   adjusted, not shipped.
5. A CI check computes contrast for every token pair used in the codebase and fails on a violation
   ([ADR-0013](adr/0013-design-tokens-pipeline.md)).
6. **Colour literals are a lint error** in `apps/mobile/{app,src}/**`. The token names carry the
   accessibility rule (`accentInk` for text, `accent` for fills), so a literal is not just a style
   inconsistency — it is the one way to bypass every check above.

---

## Audio accessibility

| Requirement                                             |                                                                                                                                                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nothing is audio-only without a visual equivalent       | Every phrase shows text; every audio cue has a visible state                                                                                                                                   |
| Nothing is visual-only without an audio/text equivalent | The graph summaries and sonification above                                                                                                                                                     |
| Speech rate is adjustable                               | 0.6×–1.5×, already a product feature                                                                                                                                                           |
| Volume respects the system                              | No independent volume control that could surprise                                                                                                                                              |
| Headphone-only content                                  | None                                                                                                                                                                                           |
| Deaf and hard-of-hearing learners                       | The app is still usable for reading, tagging, review, and the memory-model surface. **The speaking gates are honestly unavailable**, and the app should say so rather than pretend — see below |

### The honest limitation

Loro is a pronunciation-and-melody app. For a profoundly deaf learner, the prosody and pronunciation
labs and the speaking gates are not meaningfully usable, and no amount of alternative text changes
that. What we do:

- **Never require a speaking gate to progress.** Reveal mode exists for ASR failure and serves here
  too; every screen completes without producing sound.
- **Offer a text-production mode** as a first-class alternative to speaking: type the phrase instead
  of saying it. Same gate, same progress, same FSRS write. ⚠️ Not yet scoped — **Q-10** in
  [open-questions.md](../decisions/open-questions.md).
- **Don't pretend.** The store listing and onboarding are clear that speaking practice is central.

---

## Cognitive accessibility

Mostly inherited from the product design rather than added:

| Property                                                | Where it comes from                                                         |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| Small, closed daily sets you can see in full and finish | Loop B's "you always see today"                                             |
| No hidden algorithm as the primary surface              | Same                                                                        |
| No time pressure by default                             | Prosody's cue-level timers are soft nudges; expiry never fails an attempt   |
| Consistent layout and terminology across 21 screens     | The design system + [`design/copy-and-tone.md`](../design/copy-and-tone.md) |
| Undo on every destructive action                        | `P2-13`                                                                     |
| No punishment for missing a day                         | The product's no-shame rule                                                 |
| Plain, concrete language                                | The blueprint's copy voice                                                  |

Loro is, almost by accident, a good app for someone with anxiety about learning. That's worth
protecting deliberately.

---

## Testing

| Test                                      | Method                                                   | Gate         |
| ----------------------------------------- | -------------------------------------------------------- | ------------ |
| Screen-reader pass, every screen          | Manual with VoiceOver and TalkBack                       | Release      |
| **Spanish `lang` attribution**            | Automated: every Spanish text node has `lang`            | Blocks merge |
| Contrast, all tokens and all four accents | Automated in CI                                          | Blocks merge |
| Dynamic Type at 200%                      | Screenshot tests at 5 scale steps                        | Blocks merge |
| Tap-target sizes                          | Automated lint on interactive components                 | Blocks merge |
| Reduce Motion                             | Snapshot tests with the flag on                          | Blocks merge |
| Graph summaries present                   | Automated: every Skia chart has an adjacent summary node | Blocks merge |
| Keyboard/switch control                   | Manual with Full Keyboard Access and Switch Access       | Release      |
| Sonification correctness                  | Manual — does the tone follow the plotted contour?       | Release      |

The two automated checks that matter most are **Spanish `lang` attribution** and **graph summaries
present**, because both are easy to forget on a new screen and both are invisible to a sighted
developer testing by hand.
