# Design system

Every token, extracted from `Language Learning by Phrases/Loro.dc.html`. The machine-readable source
is [`packages/design-tokens/tokens/`](../../packages/design-tokens/tokens/); this document explains
the system and records where each value came from.

Pipeline and the contrast gate: [ADR-0013](../architecture/adr/0013-design-tokens-pipeline.md).

---

## The look, in one paragraph

Warm paper, not white. Near-black ink with a warm cast, never pure black. A single burnt-orange
accent that appears sparingly and always means "act here". Deep charcoal-brown cards for the moments
that should feel like a stage — now playing, the countdown, a recap. Generous radii (12–24 px) and
soft, low shadows. Two typefaces: a geometric sans for everything, and an italic serif used _only_
for emotional punctuation — _"¡Hola! I'm Loro"_, _"¡Hecho!"_, _"it climbed"_. The result reads calm
and physical, closer to a well-made notebook than to a productivity app.

---

## Colour

### Surfaces

| Token             | Value     | Use                                     | Source       |
| ----------------- | --------- | --------------------------------------- | ------------ |
| `surface.canvas`  | `#eae6de` | The blueprint's own page backdrop       | `16`, `89`   |
| `surface.app`     | `#f6f2ea` | **The app screen background**           | `131`        |
| `surface.card`    | `#ffffff` | Cards, rows, sheets                     | throughout   |
| `surface.sunken`  | `#ece7db` | Inset areas, inactive chips, icon tiles | `170`, `561` |
| `surface.sunken2` | `#e9e3d6` | Segmented-control track                 | `643`        |
| `surface.device`  | `#1a1815` | Device bezel (blueprint chrome only)    | `130`        |

### Ink

| Token    | Value     | On `surface.app` | Use                                     |
| -------- | --------- | ---------------- | --------------------------------------- |
| `ink`    | `#23201b` | 13.9:1           | Headings, phrase text, primary values   |
| `ink2`   | `#514e44` | 7.4:1            | Body copy                               |
| `ink3`   | `#5c584c` | 6.3:1            | Secondary body, labels                  |
| `ink4`   | `#57534a` | 6.8:1            | Nav links                               |
| `muted`  | `#6c6759` | 4.8:1            | Captions, translations, hints           |
| `muted2` | `#7a7466` | 3.9:1            | ⚠️ **≥14 px semibold or non-text only** |
| `muted3` | `#8c8677` | 3.2:1            | ⚠️ Decorative marks only                |

### Lines

| Token            | Value     | Use                                            |
| ---------------- | --------- | ---------------------------------------------- |
| `line.subtle`    | `#ece7db` | Dividers inside cards                          |
| `line.default`   | `#e5dfd2` | Card borders                                   |
| `line.strong`    | `#ddd6c7` | Interactive borders (inputs, outlined buttons) |
| `line.stronger`  | `#d9d3c5` | Section rules, sheet handle                    |
| `line.strongest` | `#cbc4b5` | Header underlines                              |

Five line weights sounds excessive; it's what the blueprint actually uses, and the gradation is what
makes a screen of stacked white cards on cream readable without heavy borders.

### Accents — four themes, three variants each

The three-variant split is the most important structural idea in the palette (`Loro.dc.html:49`,
`3617–3625`).

| Theme               | `accent` (fills)  | `accentInk` (text on light) | `accentOnDark` (on dark cards) |
| ------------------- | ----------------- | --------------------------- | ------------------------------ |
| **Coral** (default) | `#bf5722` · 4.0:1 | `#a2461a` · 5.6:1           | `#e8a06a`                      |
| Sunset              | `#95560f`         | `#7d470b`                   | `#ddab5e`                      |
| Teal                | `#1f7d6c`         | `#186356`                   | `#68c0ae`                      |
| Berry               | `#9c4470`         | `#7f345a`                   | `#d98fb4`                      |

**The rule the names encode:** `accent` is for fills, borders, and ≥17 px semibold text _on_ the
accent. **`accentInk` is for accent-coloured text on light surfaces.** `accent` at 4.0:1 fails AA
for body text; `accentInk` at 5.6:1 passes. The blueprint is consistent about this, and the token
names make the correct choice the obvious one
([accessibility.md](../architecture/accessibility.md#contrast-audit)).

Accent tints, used for soft backgrounds:

| Token           | Value                 | Use                             |
| --------------- | --------------------- | ------------------------------- |
| `accent.tint`   | `rgba(191,87,34,.07)` | Selected option background      |
| `accent.tint2`  | `rgba(191,87,34,.10)` | Pressed / emphasised            |
| `accent.wash`   | `#f8ece1`             | Accent-family pills, icon tiles |
| `accent.border` | `rgba(191,87,34,.38)` | Soft accent borders             |

### Semantic families

Each has a text, background, and border value — that triple is what makes the pills and banners
work.

| Family       | Text      | Background | Border    | Means                                               |
| ------------ | --------- | ---------- | --------- | --------------------------------------------------- |
| `success`    | `#356b4f` | `#e8f1ea`  | `#bcd6c6` | Easy, learned, locked in, ≥85 score                 |
| `successAlt` | `#3f7d5d` |            |           | Mastered dot, ✓ marks                               |
| `warn`       | `#8a6414` | `#f7efdd`  | `#e3d1a8` | Learning, ⭐ useful, 70–84 score                    |
| `danger`     | `#8c3f18` | `#f8e9e3`  | `#e2b8a5` | Difficult, destructive, <70 score                   |
| `dangerAlt`  | `#a94a2b` |            |           | Retry copy, tricky-words tag                        |
| `info`       | `#3d6a94` | `#eaeff5`  | `#c5d5e4` | Pronunciation focus, Easy grade, Instant confidence |
| `violet`     | `#77558f` | `#f1edf6`  | `#ded3e8` | Hard-to-remember focus, remediation                 |
| `hook`       | `#7a6247` | `#faf1e7`  | `#efe0cd` | Memory hooks, coach notes                           |
| `hookMeta`   | `#bd9660` |            |           | "tap to change"                                     |

### Scales

Four ordered scales carry meaning by position, so their order is part of the contract.

**Mastery** (`2839–2842`) — New `#a8a196` → Learning `#c99236` → Strong `#5b89ab` → Mastered
`#3f7d5d`

**Ladder rungs** (`3429–3435`) — Accumulated `#5f6b78` → Bent `#7f6a44` → Transferred `#8a6810` →
Pressure-tested `#bf5722` → Deployed `#8c3f18`

**Confidence** (`2993–2998`) — Forgot `#8c3f18` → Shaky `#a94a2b` → OK `#8a6414` → Strong `#356b4f`
→ Instant `#3d6a94`

**The warming scale** (`3392–3396`) — the Refrain card, by automaticity band. This is the most
important colour transition in the app.

| Band   | Background                                          | Text      | Glow                              |
| ------ | --------------------------------------------------- | --------- | --------------------------------- |
| 0–32%  | `#edf0f4` cold blue-grey                            | `#516275` | `0 2px 8px rgba(0,0,0,.04)`       |
| 33–65% | `#faf1e7` cream                                     | `#9b6a3c` | `0 6px 16px rgba(191,87,34,.12)`  |
| 66–99% | `linear-gradient(160deg,#f8ddc8,#f0cfa9)` peach     | `#8f4a1f` | `0 10px 28px rgba(191,87,34,.26)` |
| 100%   | `linear-gradient(160deg,#e08a4a,#bf5722)` hot coral | `#ffffff` | `0 14px 40px rgba(191,87,34,.45)` |

### Gradients

| Token                  | Value                                             | Use                                     |
| ---------------------- | ------------------------------------------------- | --------------------------------------- |
| `gradient.darkCard`    | `linear-gradient(170deg,#332e27,#141310)`         | Now playing, countdown, recap           |
| `gradient.darkCardAlt` | `linear-gradient(160deg,#33302a,#141310)`         | Trip cards                              |
| `gradient.warm`        | `linear-gradient(165deg,#f8ece1,#f2ddc5)`         | Welcome tile, new-phrase card, level-up |
| `gradient.warmStrong`  | `linear-gradient(150deg,#a2461a,#bd7d1f)`         | Arrival banner                          |
| `gradient.night`       | `linear-gradient(165deg,#6b4e33,#3a2e22,#171310)` | Lock screen                             |
| `gradient.fire`        | `linear-gradient(160deg,#e08a4a,#bf5722)`         | Completion tile, locked-in              |

### Dark-card ink

On dark cards, ink inverts to a warm grey ramp (`Loro.dc.html:49–52`). The blueprint does this with
CSS attribute selectors; we do it with an explicit token set:

| Token              | Value                   |
| ------------------ | ----------------------- |
| `onDark.primary`   | `#ffffff`               |
| `onDark.secondary` | `#e5dfd2`               |
| `onDark.tertiary`  | `#c2bbac`               |
| `onDark.muted`     | `#a8a196`               |
| `onDark.faint`     | `rgba(255,255,255,.6)`  |
| `onDark.surface`   | `rgba(255,255,255,.08)` |
| `onDark.surface2`  | `rgba(255,255,255,.12)` |
| `onDark.line`      | `rgba(255,255,255,.16)` |

---

## Typography

Two families, and the second one has exactly one job.

| Family                      | Token               | Weights                     | Use                            |
| --------------------------- | ------------------- | --------------------------- | ------------------------------ |
| **Plus Jakarta Sans**       | `type.family.sans`  | 400 · 500 · 600 · 700 · 800 | Everything                     |
| **Instrument Serif** italic | `type.family.serif` | 400 italic                  | **Emotional punctuation only** |

The serif appears in exactly these places: _"¡Hola! I'm Loro"_, _"You're all set"_, _"¡Hecho!"_,
_"¡Escena completada!"_, _"today's run"_, _"shuffling the deck…"_, _"it climbed"_, _"¡Hecho! Today
is done"_, and the phase numerals. Never for UI labels, never for body copy. **If you're reaching
for the serif and it isn't a moment of feeling, use the sans.**

### Scale

| Token          | Size  | Weight     | Tracking             | Use                               |
| -------------- | ----- | ---------- | -------------------- | --------------------------------- |
| `display`      | 62–74 | 700        | −0.03/−0.04em        | Countdown days, lock screen clock |
| `hero`         | 46–56 | 700        | −0.03em              | Streak count, recap number        |
| `title1`       | 26–28 | 700        | −0.01em              | Phrase hero, welcome headline     |
| `title2`       | 22–24 | 700        | −0.01em              | Screen headings, card phrases     |
| `title3`       | 20    | 700        | −0.01em              | Screen titles                     |
| `headline`     | 18    | 700        | −0.01em              | Lab titles                        |
| `body`         | 15    | 600–700    | —                    | Row primary, CTA labels           |
| `bodySm`       | 14    | 600–700    | —                    | Row primary (dense), buttons      |
| `caption`      | 13    | 600–700    | —                    | Row secondary, helper text        |
| `captionSm`    | 12    | 600–700    | —                    | Translations, tips                |
| `label`        | 11    | 700        | .04–.05em, uppercase | Section labels, pills             |
| `labelSm`      | 10    | 700        | .03–.06em, uppercase | Tile labels, micro-labels         |
| `serifDisplay` | 26    | 400 italic | —                    | The emotional moments             |
| `serifNum`     | 32    | 400        | tabular              | Phase numerals                    |

Line heights: `1.0–1.2` display and titles; `1.4–1.5` body; `1.55–1.62` long paragraphs.
`tabular-nums` on every changing number (streaks, counters, scores) so digits don't jitter.

**Uppercase labels always carry letter-spacing.** `.04em` at 11 px, `.05em`+ at 10 px. Uppercase
without tracking is the most common way this palette looks cheap.

---

## Space

An 8 px rhythm with 4 px half-steps, and deliberate deviations the blueprint makes for density.

| Token       | Value | Typical use                         |
| ----------- | ----- | ----------------------------------- |
| `space.0.5` | 2     | Micro-gaps in stacked labels        |
| `space.1`   | 4     | Icon-to-label                       |
| `space.1.5` | 6     | Chip internals                      |
| `space.2`   | 8     | Row gaps, chip gaps                 |
| `space.2.5` | 10    | Row internals                       |
| `space.3`   | 12    | Card internal gaps                  |
| `space.3.5` | 14    | Card padding (dense)                |
| `space.4`   | 16    | Card padding, screen gutter (dense) |
| `space.4.5` | 18    | Screen gutter                       |
| `space.5`   | 20    | Screen gutter (roomy), card padding |
| `space.5.5` | 22    | Section gaps                        |
| `space.6`   | 24    | Large section gaps                  |

Screen gutters in the blueprint are 14–22 px depending on density: 20–22 px on reading screens
(phrase detail, onboarding), 14–16 px on list-dense screens (add phrases, stream) so rows get more
width.

---

## Radius

| Token           | Value  | Use                                                   |
| --------------- | ------ | ----------------------------------------------------- |
| `radius.sm`     | 8      | Micro-pills, day cells, sort segments                 |
| `radius.md`     | 10     | Segmented-control thumb                               |
| `radius.lg`     | 12     | **The workhorse** — buttons, chips, rows, small cards |
| `radius.xl`     | 16     | Cards, tiles, toasts                                  |
| `radius.2xl`    | 20     | Panel cards                                           |
| `radius.3xl`    | 24     | Hero cards, dark cards                                |
| `radius.pill`   | 20–999 | Status pills                                          |
| `radius.screen` | 38     | Device screen inner (blueprint chrome)                |
| `radius.device` | 46     | Device bezel (blueprint chrome)                       |

`radius.lg` (12) is on almost every interactive element. When unsure, it's 12.

---

## Elevation

Four recipes, all low and warm-tinted. There are no hard grey drop shadows in this system.

| Token           | Value                            | Use                          |
| --------------- | -------------------------------- | ---------------------------- |
| `shadow.card`   | `0 1px 2px rgba(40,34,25,.16)`   | Segmented thumb, subtle lift |
| `shadow.raised` | `0 8px 20px rgba(191,87,34,.32)` | Primary CTA (accent-tinted)  |
| `shadow.sheet`  | `0 -12px 40px rgba(0,0,0,.22)`   | Bottom sheets                |
| `shadow.toast`  | `0 10px 24px rgba(0,0,0,.28)`    | Toasts                       |
| `shadow.float`  | `0 16px 40px rgba(0,0,0,.16)`    | The dealt card (Loop C)      |
| `shadow.glow.*` | see the warming scale            | The Refrain card             |

Note the CTA shadow is **accent-tinted**, not grey. That's what makes the primary button feel warm
rather than pasted on.

---

## Touch and interaction

From the blueprint's touch layer (`Loro.dc.html:29–58`):

| Property                    | Value                                                 |
| --------------------------- | ----------------------------------------------------- |
| Minimum tap target          | 40×40 (we standardise to **44×44** for WCAG)          |
| Icon-button hit area        | 44×44 via a pseudo-element, regardless of visual size |
| Row / card press            | `scale(0.988)`, 160 ms                                |
| Button press                | `scale(0.98)`, 150 ms                                 |
| Icon press                  | `scale(0.82)` + `opacity(0.6)`, 130 ms                |
| Small-button press          | `scale(0.9)` + `brightness(0.93)`, 130 ms             |
| Row hover (pointer devices) | `background: #faf7f1`                                 |
| Row pressed background      | `#f6f2ea`                                             |
| Tap highlight               | none — replaced entirely by scale feedback            |
| `touch-action`              | `manipulation` on all interactive elements            |
| Text selection              | disabled on interactive elements                      |

**Every interactive element scales on press.** Nothing in this app is tappable without physical
feedback, and that consistency is a large part of why the blueprint feels good in the hand.

---

## Iconography

The blueprint uses **emoji and typographic glyphs, not an icon set**. This is a deliberate stylistic
position: emoji carry the warm, personal register, and glyphs
(`♪ ♥ ♡ ✓ ✕ ‹ › ◄◄ ►► ▮▮ ► ⬆ ⏱ 🔒 💎 ❄️ 🃏`) keep the chrome light.

**Consequences we have to handle:**

- Emoji render differently across platforms and OS versions. Accepted — it's part of the register.
- Every emoji needs an `accessibilityLabel`; a bare 🔥 reads as "fire" to a screen reader.
- Glyphs used as controls (`◄◄`, `▮▮`) need real labels ("Previous", "Pause"), not their character
  names.
- Phrase emoji come from content, so they're one per phrase and validated in CI.

---

## Composition patterns

Recurring structures worth naming, because they appear on nearly every screen.

**The dark card.** Full-bleed gradient, 24 px radius, white ink, inverted ramp. Used for the moment
a screen wants to feel like a stage: now playing, the countdown, a recap, the ambient loop.

**The row.** White, 12 px radius, 1 px `line.default` border, 10–12 px padding, emoji or icon tile
left, two-line text centre, actions right. Ellipsised at one line each. This is the atom of the app.

**The pill.** 10–11 px uppercase 700 text with tracking, 4–6 px vertical padding, 8–20 px radius,
semantic background. Carries state: theme, difficulty, rung, score band.

**The three-up segmented control.** Equal-flex options in a sunken track, white thumb with
`shadow.card`. Used for difficulty everywhere.

**The bottom sheet.** `surface.app` background, `24px 28px 40px 40px` radius (asymmetric — wider at
the bottom), a 42×5 handle, over a `rgba(26,24,21,.42)` scrim.

**The stat tile.** White, 16 px radius, centred: a large 700 number over a 10–11 px uppercase label.
Always in rows of three.

**The section label.** 11 px, 700, uppercase, `.04em`, `muted`, 8–10 px below. The only heading
style used inside cards.
