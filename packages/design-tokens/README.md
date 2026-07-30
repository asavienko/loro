# @loro/design-tokens

The machine-readable design token package. It turns reviewed JSON into generated TypeScript, Swift,
and Kotlin and runs the palette's WCAG contrast gate.

Rationale: [ADR-0013](../../docs/architecture/adr/0013-design-tokens-pipeline.md) · Reference:
[design-system.md](../../docs/design/design-system.md)

## Sources and boundaries

The authored design artifacts live under `design/Language Learning by Phrases - V1.1/`: the
21-screen `Loro.dc.html` blueprint, `Design System.dc.html`, `Navigation.dc.html`,
`Loro Chat.dc.html`, CSS token files, 39 prototype components, screenshots, and a small web UI kit.
They are references and executable prototypes, not runtime dependencies; do not edit them when
implementing the app.

The reviewed runtime source is `tokens/*.json`. If it disagrees with the blueprint, correct the JSON
(and document an intentional accessibility deviation); do not patch generated output or the authored
blueprint.

```text
tokens/
├── color.json      # surfaces, ink, lines, semantics, scales, dark ink, gradients
├── accent.json     # four accent themes and their derived tint inputs
├── type.json       # families, type scale, and typography rules
├── layout.json     # spacing, gutters, radii, shadows, and common sizes
└── motion.json     # easing, animation/transition, press, audio, and touch tokens
src/
├── tokens.ts       # loads and validates the JSON shape
├── generate.ts     # emits all three generated files
├── contrast.ts     # contrast maths
└── checkContrast.ts
out/                # GENERATED, committed, and drift-checked
├── tokens.ts       # React Native / TypeScript
├── Tokens.swift    # future iOS widget/native consumers
└── Tokens.kt       # future Android widget/native consumers
```

Swift and Kotlin output exists so future native targets can share the palette, but there are no
native projects or widgets in the repository today.

## Commands

Use Node 22.

```bash
pnpm tokens:build
pnpm --filter @loro/design-tokens test
pnpm --filter @loro/design-tokens check:contrast
```

CI regenerates `out/` and fails if it differs from the commit. Never hand-edit generated files. The
current contrast gate checks 122 real pairings across all four accent themes; all pass WCAG 2.2 AA.
It also reports the one live size constraint: text on `warming.peak` must be at least 17 px
semibold.

## What the generated API contains

`out/tokens.ts` exports `surface`, `ink`, `line`, `semantic`, `scale`, `onDark`, `gradient`,
`accents`, `defaultAccent`, `space`, `gutter`, `radius`, `shadow`, `size`, `typography`, and
`motion`, plus accent and token-name types and `accentTheme()`.

The most important colour naming rule is:

```text
accent       fills, borders, and large semibold text on the fill
accentInk    accent-coloured body text on a light surface
accentOnDark text and marks on dark surfaces
wash/tint    soft selected backgrounds paired with accentInk
```

The app currently resolves Coral once in `apps/mobile/src/ui/theme.ts`. The other themes are
generated and contrast-tested but are not learner-selectable yet.

## Package tokens versus component tokens

This package owns cross-platform values extracted from the design: palette, type, space, radius,
motion, and reusable sizes. Exact component geometry that has no shared design-scale name lives in
`apps/mobile/src/ui/tokens/` (for example a 1.5 px selected border or an 11 px row padding). This
keeps exact blueprint measurements without pretending every number is a global token.

Shadows and gradients are emitted as CSS strings. React Native has no mapping for them yet, so the
current mobile `DarkCard` is a flat `surface.dark` card and `Card` has no elevation prop. Add a
reviewed token-to-native mapping before claiming those effects are implemented.

## Extending safely

1. Find the authored value and usage in the blueprint/design-system artifacts.
2. Add the smallest semantic token to the relevant JSON file, with its usage and source note. Do not
   add a token for a value used at one call site; keep that value local. Repeated component-only
   geometry belongs in `apps/mobile/src/ui/tokens/`.
3. Update `src/tokens.ts` validation and every emitter when the JSON shape changes. A field present
   in JSON but absent from an emitter is not cross-platform.
4. Add generator/contrast tests for the new contract, run the three commands above, and inspect the
   Swift and Kotlin diff as well as TypeScript.
5. Commit source JSON and regenerated `out/` together. Use `accentInk` for text and add every new
   foreground/background pairing to the contrast gate.

Reduced-motion metadata is already present on animation tokens, but most animations are not wired
into React Native yet. A new animated component must implement the declared reduced-motion outcome;
having a token alone does not provide behaviour.
