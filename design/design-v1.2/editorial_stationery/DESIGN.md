---
name: Editorial Stationery
colors:
  surface: '#fcf9f4'
  surface-dim: '#dcdad4'
  surface-bright: '#fcf9f4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3ee'
  surface-container: '#f0ede8'
  surface-container-high: '#ebe8e2'
  surface-container-highest: '#e5e2dd'
  on-surface: '#1c1c19'
  on-surface-variant: '#57423b'
  inverse-surface: '#31302d'
  inverse-on-surface: '#f3f0eb'
  outline: '#8a726a'
  outline-variant: '#dec0b7'
  surface-tint: '#a23e18'
  primary: '#7f2500'
  on-primary: '#ffffff'
  primary-container: '#9f3c16'
  on-primary-container: '#ffc9b7'
  inverse-primary: '#ffb59c'
  secondary: '#536344'
  on-secondary: '#ffffff'
  secondary-container: '#d6e9c1'
  on-secondary-container: '#59694a'
  tertiary: '#7f2500'
  on-tertiary: '#ffffff'
  tertiary-container: '#9f3c16'
  on-tertiary-container: '#ffc9b7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbd0'
  primary-fixed-dim: '#ffb59c'
  on-primary-fixed: '#390c00'
  on-primary-fixed-variant: '#822701'
  secondary-fixed: '#d6e9c1'
  secondary-fixed-dim: '#bacda6'
  on-secondary-fixed: '#121f07'
  on-secondary-fixed-variant: '#3c4b2e'
  tertiary-fixed: '#ffdbcf'
  tertiary-fixed-dim: '#ffb59c'
  on-tertiary-fixed: '#390c00'
  on-tertiary-fixed-variant: '#822801'
  background: '#fcf9f4'
  on-background: '#1c1c19'
  surface-variant: '#e5e2dd'
typography:
  display-lg:
    fontFamily: Newsreader
    fontSize: 48px
    fontWeight: '400'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Newsreader
    fontSize: 36px
    fontWeight: '400'
    lineHeight: 44px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Newsreader
    fontSize: 32px
    fontWeight: '500'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Newsreader
    fontSize: 26px
    fontWeight: '500'
    lineHeight: 34px
  headline-sm:
    fontFamily: Newsreader
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Newsreader
    fontSize: 19px
    fontWeight: '400'
    lineHeight: 30px
  body-md:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: DM Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: DM Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-md:
    fontFamily: DM Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: DM Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1.25rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system draws inspiration from archival periodicals, tactile literary stationery, and deliberate study spaces. Unlike gamified, cartoon-centric language apps, this system prioritizes contemplative focus, depth, and the quiet satisfaction of physical media: heavy book stock, deep ink, and warm natural earth pigments.

The design movement bridges **Tactile / Skeuomorphic subtleties** with **Minimalist Editorial Modernism**. Surfaces emulate layered vellum and warm parchment, paired with structured serif typography and clean utility sans-serifs. Tactile interaction cues rely on subtle bevels, paper creases, and debossed press effects rather than hyper-saturated plastic gamification.

## Colors

The color palette is derived from raw printmaker pigments, aged unbleached cotton paper, and botanical accents:

- **Primary (`#9F3C16`) & Secondary Accent (`#C85A32`)**: Rich terracotta and burnt sienna, used for active lesson states, critical call-to-actions, and phonetic emphasis.
- **Secondary (`#516142`) & Pale Tint (`#E2ECE2`)**: Heritage sage green, applied to validation states, mastery progression tags, and completed revision paths.
- **Neutrals (`#1C1C19` to `#231E18`)**: Deep espresso ink for all high-contrast typography, structural rules, and primary iconography.
- **Surfaces (`#FCFBF8` base, `#F7F4EC` elevated)**: Warm parchment tones that eliminate eye strain during extensive reading and review sessions.

Dark mode, when implemented, transposes the palette into a study at night: deep charred charcoal (`#141412`), aged leather card surfaces (`#1E1C19`), and warm amber-lit terracotta text.

## Typography

Typography establishes an intimate, literary atmosphere. 

- **Newsreader** handles literary comprehension passages, unit banners, display titles, and grammatical syntax focus words. It incorporates optical sizing and delicate italic variants for contextual vocabulary annotations.
- **DM Sans** delivers legible, utilitarian clarity across navigation, meta labels, UI controls, and phonetic breakdown badges. Its geometric neutrality balances the calligraphic warmth of Newsreader.

## Layout & Spacing

The layout adopts a bookish, column-disciplined grid system with generous vertical breathability reminiscent of broadsheet margins.

- **Mobile (< 768px)**: 4-column layout with `1.25rem` outer margins. Content aligns along a central reading spine with edge padding reserved for gestures and interactive pull-outs.
- **Tablet (768px - 1024px)**: 8-column layout with `2rem` margins. Split-pane layout introduces source text on the left with contextual annotations and card decks on the right.
- **Desktop (> 1024px)**: 12-column fixed reading container capped at `1120px` maximum width. Generous page margins (`3rem`) create a gallery-like reading field.

## Elevation & Depth

Visual hierarchy uses physical stationery metaphors: resting sheets, pressed cards, and elevated floating bars.

- **Base Layer (`#FCFBF8`)**: The desk surface. Completely flat, unshadowed canvas.
- **Card Tier (`#F7F4EC`)**: Resting stationery cards. Defined by a 1px inner keyline of `#E9E4D6` and a soft ambient contact shadow (`0 2px 8px rgba(35, 30, 24, 0.04)`).
- **Raised Interactive Cards**: Lifted flashcards and draggable tokens utilize an offset dual shadow: `0 4px 16px rgba(35, 30, 24, 0.08)` and `0 1px 3px rgba(35, 30, 24, 0.04)`.
- **Floating Island Navigation**: Suspended bottom bar hovering over content with `0 8px 32px rgba(35, 30, 24, 0.12)`, surfaced in parchment glass (`rgba(252, 251, 248, 0.92)` with `backdrop-filter: blur(12px)`).

## Shapes

The geometric balance utilizes structural softness. Stationery elements (cards, note sheets, flash panels) feature soft `0.5rem` (`rounded-md`) to `1rem` (`rounded-lg`) corner radii to emulate trimmed cardstock. Interactive control badges, chip selectors, and navigation containers lean into full pills (`rounded-full`) to contrast against rectangular text blocks.

## Components

### Stationery Flashcards & Deck Panels
- **Container**: Layered cardstock with `#F7F4EC` background, subtle `1px solid #EAE5D9` border, and `rounded-lg` (16px) corners.
- **States**: Resting, flipped (3D card flip with smooth ease-out), and pressed (translate-y 1px with reduced shadow).

### Buttons
- **Primary Action**: Terracotta solid (`#9F3C16`), DM Sans label in `#FCFBF8`, fully rounded pill or structured `rounded-md` with debossed tactile press on click.
- **Secondary Action**: Transparent with `#1C1C19` 1.5px stroke or muted warm taupe fill (`#EFECE1`), supporting quiet editorial pacing.
- **Ghost/Tertiary**: Text-only with an animated 1px underline that expands from the center outward on hover.

### Rounded Pill Tabs
- **Container**: Encased pill track in `#EFECE1` with `4px` internal padding.
- **Selected Tab**: `#FCFBF8` background with subtle contact shadow and terracotta typography.
- **Unselected Tab**: Espresso `#1C1C19` at 65% opacity without outline.

### Input Fields & Translation Prompts
- **Field**: Parchment surface with inset shadow (`inset 0 1px 2px rgba(28, 28, 25, 0.05)`), baseline rule in `#1C1C19`, transitioning to `#9F3C16` on focus.
- **Typography**: Newsreader for user-composed target-language text, DM Sans for placeholder instructions.

### Floating Bottom Navigation Bar
- **Structure**: Floating detached dock centered horizontally, offset `1.5rem` from screen bottom.
- **Surface**: Translucent parchment tint (`#FCFBF8` at 92%) with edge rim lighting (`border: 1px solid rgba(255, 255, 255, 0.6)`) and ambient shadow.
- **Icons**: 1.5px stroke monoline glyphs in espresso ink, accenting with terracotta dot indicators when active.

### Grammar Chips & Syntax Tags
- **Style**: Compact pills with botanical sage fill (`#E2ECE2`) and dark sage text (`#516142`) for correct/verified forms; delicate terracotta tint for syntax highlights.