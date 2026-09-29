# 0013 · Treat design tokens as generated code, with contrast checking in CI

- **Status:** Superseded (2026-09-30) — `packages/design-tokens` was removed with the first app; the
  current app keeps its tokens in `apps/mobile/src/ui/theme.ts` with no generator or contrast gate.
- **Date:** 2026-07-28
- **Deciders:** Designer, mobile lead

## Context

The blueprint is an unusually complete design specification, but it expresses itself as **inline
styles on 3 629 lines of HTML**. Its design system is real and consistent — it just isn't extracted.
What it contains:

- A warm light palette with an intentional split between `--accent` (fills) and `--accent-ink` (text
  on light) and `--accent-on-dark` (`Loro.dc.html:49`, `3617–3625`).
- **Four accent themes** — Coral, Sunset, Teal, Berry — each with all three variants.
- Semantic colour families with a background, border, and text value each (success, warn, danger,
  info, violet).
- Five ladder-rung colours, four mastery-bucket colours, five confidence-level colours, and a
  four-band "warming" scale for the Refrain card.
- Two fonts with specific weights (Plus Jakarta Sans 400–800; Instrument Serif italic 400).
- A radius scale, a spacing rhythm, three shadow recipes, eleven keyframe animations, and three
  easing curves.

Two problems follow. First, drift: a hand-copied palette across 21 screens diverges within weeks.
Second, **contrast**: the palette is warm and low-contrast by design, and several tokens sit near
the WCAG AA boundary ([accessibility.md](../accessibility.md#contrast-audit)). `accent` Coral on the
app surface is 4.0:1 — fine for large text and UI, **not** for body text. The blueprint already
respects this by using `accent-ink` for text, but nothing enforces it.

## Options considered

### A · Hand-written constants in the app

**Pros** Zero tooling. **Cons** Four accent themes × three variants × 21 screens is exactly where
copy-paste drift happens. No place to enforce the accent/accent-ink rule. Widgets (Swift/Kotlin)
would need their own hand-maintained copy, guaranteeing divergence.

### B · A hosted design-token platform (Figma variables → a sync service)

**Pros** Designer-owned; single source in the design tool. **Cons** The source of truth here is the
**blueprint**, not a Figma file — and the blueprint is executable, which is better. Adding a
platform dependency to bridge to something we don't have is backwards.

### C · Tokens as JSON in the repo, generating typed TS, Swift, and Kotlin, with contrast checked in CI

**Pros**

- One source, versioned with the code, reviewable in a diff.
- Widgets get the same palette, generated, so the lock screen can't drift from the app.
- **Contrast can be a build gate**, which is the only way a low-contrast warm palette stays
  accessible through a year of changes.
- Token _names_ can encode the rules (`accentInk` vs `accent`), making the correct choice the
  obvious one.

**Cons** A small build step; regeneration discipline.

## Decision

**Option C.** `packages/design-tokens/` holds the tokens as JSON, extracted from the blueprint, plus
a generator.

```
packages/design-tokens/
├── tokens/
│   ├── color.json        # base palette, semantic families, scales
│   ├── accent.json       # Coral · Sunset · Teal · Berry × {base, ink, onDark}
│   ├── type.json         # families, sizes, weights, line heights, tracking
│   ├── space.json        # spacing rhythm
│   ├── radius.json       # 8 · 10 · 12 · 16 · 20 · 24 · 38 · 46
│   ├── shadow.json       # card, device, sheet, glow recipes
│   └── motion.json       # 11 animations, 3 easings, durations, the audio repeat gap
├── src/generate.ts
└── out/                  # generated — never edited by hand
    ├── tokens.ts         # typed TS for the app
    ├── Tokens.swift      # for the iOS widget target
    └── Tokens.kt         # for the Glance widget
```

`pnpm tokens:build` regenerates. CI regenerates and **fails if `out/` differs from the commit**, so
a hand-edited generated file cannot merge.

### Naming encodes the accessibility rules

```jsonc
{
  "accent": { "coral": "#bf5722" }, // fills, ≥17px semibold text on accent, UI elements
  "accentInk": { "coral": "#a2461a" }, // TEXT on light surfaces — 5.6:1
  "accentOnDark": { "coral": "#e8a06a" }, // text and marks on dark cards
}
```

A developer reaching for a text colour finds `accentInk`. The name is the rule, which works better
than a comment nobody reads.

### Contrast is a build gate

The generator computes contrast for every foreground/background pair that appears in the codebase,
**for all four accent themes**, and fails the build on a violation of:

| Rule                                     | Threshold              |
| ---------------------------------------- | ---------------------- |
| Body text (< 17 px, or < 14 px semibold) | 4.5:1                  |
| Large text and UI components             | 3:1                    |
| `accent` used as body text               | **forbidden outright** |
| `muted2` used below 14 px semibold       | **forbidden outright** |

A new accent theme that fails is adjusted before it ships, not after an audit.

### Motion tokens too

The eleven keyframes and three easing curves from the blueprint become tokens
(`docs/design/motion.md`, removed 2026-09-30), so a reduced-motion variant can be generated from the
same source rather than hand-maintained per animation.

## Consequences

### Good

- One palette across the app, both widget targets, and the docs. The lock screen cannot drift from
  the app.
- **Contrast regressions are impossible to merge.** For a deliberately warm, low-contrast palette,
  this is the difference between "accessible at launch" and "accessible in eighteen months".
- Adding a fifth accent theme is a JSON change plus a passing contrast gate.
- Token names carry the rules, so the accessible choice is the default one.
- Reduced-motion variants are generated, not remembered.
- The blueprint stays the source of truth; extraction is mechanical and reviewable.

### Bad — accepted deliberately

- A build step, and a CI check that fails on stale generated output. Mitigated by making
  regeneration one command and part of the pre-commit hook.
- Generated Swift and Kotlin must be committed (the widget targets build natively, outside the JS
  build). Accepted; the CI drift check keeps them honest.
- Extracting tokens from inline styles is one-time manual work, and a judgement call in places — the
  blueprint uses several near-identical greys. Resolved by consolidating to the documented scale and
  noting any deliberate deviation.
- Contrast checking can only see pairs it knows about. Mitigated by a lint rule requiring colour
  usage to come from tokens, never a literal hex.

### Revisit if…

- We add a dark theme (v1.1). That doubles every surface pairing and the contrast gate needs to run
  per theme — a mechanical extension, but worth planning rather than discovering.
- The team adopts a design tool as the primary source, in which case the JSON becomes generated
  _from_ that tool and the rest of the pipeline is unchanged.
