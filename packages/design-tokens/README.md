# @loro/design-tokens

Design tokens extracted from `Language Learning by Phrases/Loro.dc.html`, and the generators that
turn them into typed code for four targets.

Rationale: [ADR-0013](../../docs/architecture/adr/0013-design-tokens-pipeline.md) · Reference:
[design-system.md](../../docs/design/design-system.md)

## Why this is a package and not a constants file

The blueprint's design system is real and consistent — it just expresses itself as **inline styles
on 3,629 lines of HTML**. Two problems follow:

1. **Drift.** Four accent themes × three variants × 21 screens is exactly where copy-paste diverges.
   And the widgets are native (Swift/Kotlin), so a hand-maintained second copy would guarantee the
   lock screen stops matching the app.
2. **Contrast.** The palette is warm and low-contrast by design, and several tokens sit near the AA
   boundary. `accent` Coral is 4.0:1 — fine for large text and UI, **not** for body text. The
   blueprint respects this by using `accentInk` for text; nothing enforced it.

## Layout

```
tokens/
├── color.json      # surfaces, ink, lines, semantic families, the four ordered scales
├── accent.json     # Coral · Sunset · Teal · Berry × {accent, accentInk, accentOnDark}
├── type.json       # families, the scale, and the two typography rules
├── layout.json     # space, gutters, radius, shadow, sizes
└── motion.json     # 11 animations, 3 easings, press feedback, audio timing
src/
├── generate.ts     # → out/
└── checkContrast.ts
out/                # GENERATED — committed and drift-checked. Never hand-edit
├── tokens.ts       # for the app
├── Tokens.swift    # for the iOS widget target
└── Tokens.kt       # for the Glance widget
```

## Commands

```bash
pnpm tokens:build                             # regenerate out/
pnpm --filter @loro/design-tokens check:contrast   # the CI gate
```

CI regenerates and **fails if `out/` differs from the commit**, so a hand-edited generated file
cannot merge.

## The naming rule

```jsonc
"accent":       "#bf5722"   // fills, borders, >=17px semibold text ON the accent — 4.0:1
"accentInk":    "#a2461a"   // TEXT on light surfaces — 5.6:1
"accentOnDark": "#e8a06a"   // text and marks on dark cards
```

A developer reaching for a text colour finds `accentInk`. **The name is the rule**, which works
better than a comment nobody reads — and the contrast gate catches it if they get it wrong anyway.

## The contrast gate

`checkContrast.ts` computes contrast for every foreground/background pair used in the codebase,
**for all four accent themes**, and fails the build on:

| Rule                                     | Threshold              |
| ---------------------------------------- | ---------------------- |
| Body text (< 17 px, or < 14 px semibold) | 4.5:1                  |
| Large text and UI components             | 3:1                    |
| `accent` used as body text               | **forbidden outright** |
| `muted2` below 14 px semibold            | **forbidden outright** |

A new accent theme that fails is adjusted before it ships, not after an audit. For a deliberately
warm, low-contrast palette, this is the difference between "accessible at launch" and "accessible in
eighteen months".

## Motion tokens carry their own reduced-motion behaviour

Each animation declares `reducedMotion` (`crossfade` · `instant` · `static` · `keep` · `keepColour`
· `scrubber`), so a new component inherits the correct behaviour rather than needing to remember it.

Note `warmingCard.reducedMotion: "keepColour"` — the Refrain card's colour change is _information_,
so it survives Reduce Motion. Only the glow animation drops.

## Adding a token

1. Edit the relevant `tokens/*.json`, with a `use` note and a blueprint line reference.
2. `pnpm tokens:build`
3. `pnpm --filter @loro/design-tokens check:contrast`
4. Commit both the source and `out/`.
