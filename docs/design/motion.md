# Motion

Every animation in the blueprint, what it means, and how it behaves under Reduce Motion.

Source: `Loro.dc.html:19–62`. Tokens:
[`packages/design-tokens/tokens/motion.json`](../../packages/design-tokens/tokens/motion.json).

---

## Principles

**1 · Motion is feedback, not decoration.** Every animation in this app answers a question the
learner just asked: did that register? is it working? am I getting better?

**2 · The most important animation is a colour change.** The Refrain's warming card carries the
product's core feedback signal. It's 500 ms of background and shadow interpolation, and it must
never drop a frame ([performance.md](../architecture/performance.md#frame-rate)).

**3 · Physical, not bouncy.** The easing set is one overshoot curve for arrivals and two flat curves
for everything else. Nothing wobbles.

**4 · Everything responds to touch.** No interactive element is silent on press.

**5 · Off the JS thread.** Anything animating while audio plays runs via Reanimated on the UI
thread. Runtime wiring lives in [`apps/mobile/src/ui/motion.ts`](../../apps/mobile/src/ui/motion.ts)
([plan 100](../../plans/100-ui-design-system.md)). Device 60 fps proof remains 58/72.

---

## Easing

| Token         | Curve                        | Character                  | Use                                         |
| ------------- | ---------------------------- | -------------------------- | ------------------------------------------- |
| `ease.out`    | `cubic-bezier(.2,.8,.2,1)`   | Decelerating, no overshoot | Growth, sheets, layout, presses             |
| `ease.pop`    | `cubic-bezier(.2,.85,.25,1)` | Slight overshoot           | Arrivals — something appearing that matters |
| `ease.press`  | `cubic-bezier(.3,.7,.3,1)`   | Snappy, symmetric          | Icon-button presses                         |
| `ease.inOut`  | `ease-in-out`                | Symmetric                  | Looping indicators                          |
| `ease.linear` | `linear`                     | —                          | Progress bars tracking real playback        |

---

## The animation set

### Arrivals

| Name      | Keyframes                                     | Duration   | Easing     | Where                                                                            |
| --------- | --------------------------------------------- | ---------- | ---------- | -------------------------------------------------------------------------------- |
| `popIn`   | `scale .6 → 1.08 → 1`, opacity 0→1            | 300–500 ms | `ease.pop` | Toasts, welcome tile, ✓ completion, 💎 lock-in, level-up card, celebration tiles |
| `stepIn`  | `translateX 18 → 0`, opacity 0→1              | 300 ms     | `ease.out` | Onboarding step content                                                          |
| `flip`    | `rotateX 8° + translateY 10 → 0`, opacity 0→1 | 300 ms     | `ease.out` | Card reveal, score card, curve panel                                             |
| `fadeIn`  | opacity 0→1                                   | 200–300 ms | `ease.out` | Scrims, coach notes, deck cards                                                  |
| `sheetUp` | `translateY 105% → 0`                         | 340 ms     | `ease.pop` | The tagging sheet                                                                |
| `grow`    | `scaleX 0 → 1`                                | 500 ms     | `ease.out` | Mastery bar, tag bars, ladder bars                                               |

`popIn`'s 8% overshoot is the app's signature arrival. It's used for **rewards** specifically — the
lock-in diamond, the level-up card, the completion checkmark — and using it for routine UI dilutes
it.

### Continuous indicators

| Name        | Keyframes                            | Duration                              | Where                                                                       |
| ----------- | ------------------------------------ | ------------------------------------- | --------------------------------------------------------------------------- |
| `eqA`       | height `6 ↔ 20 px`                   | 1 s, infinite                         | Small equalisers                                                            |
| `eqB`       | height `7 ↔ 22 px`                   | 1 s, infinite, staggered 0.15 s       | Now-playing equaliser, mic listening, ambient loop                          |
| `barJump`   | `scaleY .35 ↔ 1` from bottom         | 0.7–0.9 s, infinite, staggered 0.12 s | Listening bars, typing dots, waveform-while-recording, **the Refrain beat** |
| `pulseRing` | `box-shadow 0 → 18px` accent, fading | 1.6 s, infinite                       | The mic button while listening                                              |
| `tapRing`   | `box-shadow 0 → 14px`, fading        | one-shot                              | Tap ripple                                                                  |

**The beat** deserves attention: `barJump` at **0.72 s** normally and **0.34 s** in Speed mode
(`Loro.dc.html:3414`). The tempo change is the only visual cue that Speed mode is different, and it
works because the learner is already moving to it.

Staggering is what makes these read as organic rather than mechanical — three bars in phase looks
like a loading spinner; three bars 0.12 s apart looks like sound.

### Transitions

| Property                                       | Duration                  | Easing        | Where                                   |
| ---------------------------------------------- | ------------------------- | ------------- | --------------------------------------- |
| **Warming card** — background + box-shadow     | **500 ms**                | `ease`        | The Refrain card, per automaticity band |
| Automaticity bar width                         | 450 ms                    | `ease.out`    | The Refrain                             |
| Word chip un-blur — filter, colour, background | 300–400 ms                | `ease.out`    | Speak to progress                       |
| Card grow on press-in                          | 280 ms                    | `ease.out`    | Suggestion rows                         |
| Queue row reorder                              | 320 ms                    | `ease.out`    | Stream Up-next                          |
| Progress bar width                             | 400 ms                    | `ease.out`    | Session progress                        |
| Skill-axis bar width                           | 500 ms                    | `ease.out`    | Prosody axes                            |
| Contour trace cursor                           | ~45 ms/step, ~2.3 s total | `ease.linear` | Prosody pitch trace                     |
| Border / background on selection               | 180–200 ms                | `ease.out`    | Difficulty and tag chips                |

### Press feedback

| Class        | Transform                         | Duration | Applies to                               |
| ------------ | --------------------------------- | -------- | ---------------------------------------- |
| Row / card   | `scale(0.988)` + background shift | 160 ms   | Rows, list cards, option cards           |
| Button       | `scale(0.98)`                     | 150 ms   | Buttons, chips, pills                    |
| Small button | `scale(0.9)` + `brightness(.93)`  | 130 ms   | Compact actions                          |
| Icon         | `scale(0.82)` + `opacity(.6)`     | 130 ms   | Icon-only controls                       |
| Grow-card    | `scale(0.985)` + shadow           | 280 ms   | Suggestion rows (a larger, softer press) |

---

## The three signature animations

These three carry actual information. They are not interchangeable with a fade.

<a id="1--the-warming-card--the-refrain"></a>

### 1 · The warming card — the Refrain

`Loro.dc.html:1438`, `3392–3396`

The phrase card's background, text colour, and glow shift across four bands as automaticity climbs:
cold blue-grey → cream → peach → hot coral, over 500 ms on both background and shadow.

> **This is the product's core feedback loop rendered as a colour.** The learner watches a phrase
> heat up as it becomes automatic. It is the reason Loop B is the v1 hero
> ([`product/practice-loops.md`](../product/practice-loops.md#loop-b--the-daily-refrain--v1-hero)).

Implementation: Reanimated `interpolateColor` on a shared value driven by `automaticity`, plus an
animated shadow. **Never** a React re-render per band — that would stutter at exactly the wrong
moment.

Under Reduce Motion: **the colour change stays** (it's information); only the glow animation is
dropped.

### 2 · The word un-blur — Speak to progress

`Loro.dc.html:706–714`

Hidden words are grey blocks with `filter: blur(6px)` and a text-shadow ghost. A correctly
pronounced word transitions to accent-filled (just-revealed), then settles to white with dark ink,
over 300–400 ms.

The mechanic _is_ the reward: you say it, it appears. The intermediate accent state is what makes
the just-said word legible in a row of already-revealed ones.

Under Reduce Motion: an instant swap, no blur transition. The information is preserved.

### 3 · The trace — Prosody lab

`Loro.dc.html:1202–1206`, `3221–3229`

A vertical rule sweeps across the pitch chart with one dot on the native contour and one on the
learner's, both interpolated, synchronised with audio playback of the take.

This is the only way to _understand_ the contour comparison rather than merely see it — it turns two
static lines into "here's where you diverged".

Under Reduce Motion: a static plot with a draggable scrubber, so the comparison is still explorable.

---

## Reduced motion

The rule: **if an animation carries information, the information survives; only the motion goes.**

| Animation                                          | Reduce Motion behaviour                    |
| -------------------------------------------------- | ------------------------------------------ |
| `popIn`, `stepIn`, `flip`, `sheetUp`, `grow`       | Cross-fade, 150 ms                         |
| `fadeIn`                                           | Kept (it's already minimal)                |
| **Warming card colour**                            | **Kept** — it's data                       |
| Warming card glow animation                        | Dropped                                    |
| Automaticity / progress bars                       | Instant width change, no transition        |
| Word un-blur                                       | Instant swap                               |
| Contour trace                                      | Static plot + scrubber                     |
| `eqA`, `eqB`, `barJump` (equalisers, beat, typing) | Static indicator                           |
| `pulseRing`                                        | Static ring                                |
| Deck shuffle (Loop C)                              | Immediate reveal                           |
| Press feedback                                     | **Kept** — a 130 ms affordance, not motion |

Reduce Motion is detected via `AccessibilityInfo.isReduceMotionEnabled()` and applied through the
motion tokens, so a new animation inherits the correct behaviour rather than needing to remember it
([ADR-0013](../architecture/adr/0013-design-tokens-pipeline.md)).

---

## Audio-synchronised timing

| Value                                 | Duration | Why                                                                 |
| ------------------------------------- | -------- | ------------------------------------------------------------------- |
| Repeat gap in the stream              | 350 ms   | Silence for the learner to shadow the phrase                        |
| Auto-play delay after reveal          | 200 ms   | Lets the card settle before audio starts                            |
| Full-phrase playback after completion | 250 ms   | A beat of acknowledgement before the reward                         |
| Prosody processing state              | ≥ 400 ms | The score arrives faster than that; a too-fast result reads as fake |
| Deck shuffle                          | 1 200 ms | The suspense _is_ the mechanic (`Loro.dc.html:3487`)                |
| Voice-clone generating                | 1 200 ms | Same — the wait signals real work                                   |

Two of these are deliberately **minimum** durations rather than measured ones. When a result arrives
in 80 ms, showing it instantly makes the learner doubt it was computed. This is honest — the work is
real; the pacing just lets it read that way.

---

## Performance rules

1. **Anything animating while audio plays runs on the UI thread.** Reanimated worklets, not React
   state.
2. **The warming card is the canary.** It's checked at 60 fps on the device floor every release.
3. **Continuous indicators cost ≤3% CPU** combined
   ([performance.md](../architecture/performance.md#battery-and-thermals)).
4. **No layout animation in lists.** Row reorder uses transforms, never height changes.
5. **Skia charts animate their own values**, never by re-rendering the component.
6. **No `setInterval` drives an animation.** The blueprint's 80 ms progress timer
   (`Loro.dc.html:2521`) is prototype-only; real progress tracks real playback position.

---

## What we don't do

| Not used                           | Why                                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Spring physics with visible bounce | The palette is calm; bouncing would read as playful in the wrong register                            |
| Parallax and scroll-linked effects | Costly, and the content is dense enough already                                                      |
| Skeleton loaders                   | There's almost nothing to load — data is local ([offline.md](../architecture/offline.md))            |
| Confetti / particles               | The blueprint's celebrations are a `popIn` tile and a warm gradient. That restraint is why they land |
| Page-transition choreography       | Native stack transitions; the platform's feel is better than ours                                    |
| Animated illustrations             | The app's personality is the parrot emoji and the italic serif, not a mascot animation               |
