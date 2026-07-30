# Loro — design system

Loro is a **phrase-first Spanish learning app**. The unit of learning is a phrase you would actually say, not a word or a grammar rule; every phrase carries tags for *what is hard about it*, and those tags steer practice, review and stats downstream. The product is documented as a five-phase blueprint (Onboard → Build the stream → Practice daily → Stay on track → The trip arc) plus four "advanced loops" (A–D) that explore different ways of drilling. Loop D — **the open chat** — is the newest surface and the most fully built.

This design system was extracted from the project's own screens; there was no external codebase, Figma file or brand kit.

## Sources
| Source | What it is |
| --- | --- |
| `Loro.dc.html` | The product blueprint: 21 interactive phone screens across 5 phases + 3 advanced loops + the trip arc, on a warm "desk" canvas |
| `Loro Chat.dc.html` | Loop D, isolated: the open chat + the message inspector |

No logo files, icon sets, fonts binaries or photography were provided. See **Caveats**.

## Index
- `styles.css` — the single entry point consumers link. `@import` list only.
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `radius.css`, `shadow.css`, `motion.css` (keyframes + `.lo-tap` / `.lo-row` / `.lo-press` interaction utilities).
- `components/` — 27 primitives in 6 groups:
  - `frames/`: **PhoneFrame**, **StatusBar**
  - `core/`: **SectionLabel**, **Card**, **PillButton**, **InlineAction**, **Tag**, **ListRow**, **CountChip**
  - `forms/`: **SearchField**, **TextArea**, **SegmentedTabs**, **ChoiceCard**, **StepDots**
  - `chat/`: **MessageBubble**, **PhraseRow**, **DiffRow**, **MicButton**, **BottomSheet**, **Toast** (with undo), **VoiceWave**, **TypingDots**
  - `practice/`: **RevealCard**, **GradeRow**, **ScoreRing**, **WordChip**
  - `progress/`: **LadderPips**, **StatFigure**, **MeterBar**
- `ui_kits/loro-app/` — live recreation of three screens (chat, message inspector, today) with shared state; see its README.
- `guidelines/cards/` — 15 foundation specimen cards (Colors, Type, Spacing, Brand).
- `SKILL.md` — Agent-Skills wrapper so this folder works inside Claude Code.

## Content fundamentals
**Voice: a fluent friend, not a teacher.** Second person, present tense, no exclamation marks, no praise inflation. The product says what happened and what it means, then stops.

- **Sentence case everywhere.** Buttons are sentence case ("Use it & keep the fix", "Queue for today's review"), never Title Case or ALL CAPS. The only uppercase is the tiny tracked label ("KEPT FROM THIS CHAT", "PHRASES OWNED").
- **Say the number.** "2 things to fix", "1 line queued for today", "41 banked" — quantities are always concrete, singular/plural handled ("1 thing to fix" vs "3 things to fix").
- **Explain the why in one sentence, in plain words.** "Spanish carries the subject in the verb. Leaving 'yo' in makes it emphatic — as if you and nobody else were the tired one." Grammar terms appear only as the *tag* on a correction (Agreement, Register, Accent, Extra word), never in the explanation.
- **Register is a first-class label**: casual · formal · shortest · very local · warm · ordering · polite swap. Alternatives are always labelled this way rather than ranked "better/worse".
- **Spanish leads, English follows and only on request.** In the chat, English is hidden until the user taps `EN`. Pronunciation respellings are lowercase-with-caps-stress: "teh ah-peh-TEH-theh oon kah-FEH".
- **Confirmations are past tense and specific**: "Saved to your stream", "Fixed — and saved to practice", "Now talking about the café". Never "Success!", never "Great job!".
- **Em dashes and typographic quotes** are used freely in explanatory copy; curly quotes around quoted Spanish (“yo”).
- **Emoji: essentially none.** Two survive from the blueprint (🔥 streak, 🏆 owned) and both are being replaced by type — do not add more. Unicode glyphs *are* the icon set (see Iconography).
- **What the product never says**: gamification language ("XP", "level up", "combo"), guilt ("You've missed 3 days"), or vague encouragement. Progress speaks for itself: "128 phrases owned", "day 3".

## Visual foundations
**The idea:** warm printed paper with ink on it. Nothing glows, nothing floats except the phone.

- **Colour.** Two warm paper grounds (`#EAE6DE` canvas, `#F6F2EA`/`#FBF9F4` app) and a ten-step warm grey ink ramp. White is a *card*, never a page. Exactly one accent at a time — Coral by default, with Sunset/Teal/Berry as whole-product themes via `data-accent`. Green (`#356B4F`) means progress or "nothing to fix"; brick red (`#A94A2B`) means a correction is waiting; amber (`#7A6247` on `#FAF1E7`) means Loro is teaching you something. Max two background colours per screen.
- **Type.** Plus Jakarta Sans for everything structural — 600 for headings and Spanish phrases, 700 for anything 12px and under, 400 only for long body copy. Instrument Serif appears in three places and nowhere else: the phrase hero in the inspector (27px), phase numerals, and single italic asides. Tracking tightens as size grows (`-0.034em` at 48px) and opens as size shrinks (`.13em`–`.16em` on caps labels).
- **Spacing.** Dense and 1px-granular: gaps of 5–15px inside screens, 26–28px between blueprint units. Layout is flex/grid with `gap` — never margins between siblings. Screens are a fixed 344×732 column: fixed header, `flex:1` scroller, fixed footer.
- **Backgrounds.** Flat colour only. No photography, no illustration, no pattern, no texture. One gradient exists in the whole product — `linear-gradient(165deg,#332E27,#141310)` on the dark "ambient loop" card — and it reads as ink, not as a glow.
- **Borders and cards.** 1px hairlines in five warm weights do all the separating. A card is white + `1px solid #E5DFD2` + 12px radius and **no shadow**. Lists are hairline-separated rows, not stacks of cards. Radius ladder: 2px pips → 8px tags → 12px default → 16px → 20/22px pills → 26px sheets → 38px screen → 46px bezel.
- **Elevation.** Only three shadows exist: the phone (`--shadow-device`), the toast (`--shadow-toast`), and the mic button (`--shadow-lift`). In-app depth is expressed by a hairline or a tint, never by a shadow.
- **Transparency & blur.** Almost none. Sheets use a flat scrim (`rgba(26,24,21,.24)`); the learner's own speech bubble is `color-mix(in srgb, var(--accent) 10%, paper)` — 18% when selected. No frosted glass anywhere.
- **Animation.** Functional only, 0.13–0.4s. `eqB` waveform while listening, `barJump` typing dots, `pulseRing` while push-to-talk is held, `sheetUp` for sheets, `popIn` for toasts, `grow` for meters. Easing is `cubic-bezier(.2,.8,.2,1)` for movement and `cubic-bezier(.2,.85,.25,1)` for arrivals. Nothing bounces decoratively; nothing animates on scroll.
- **Press & hover.** Touch first: `scale(.98)` on taps, `scale(.988)` + paper tint on rows, `scale(.9)` + `brightness(.93)` on the mic. Hover exists only behind `@media (hover:hover)` and is a 2% paper lift — never a colour change.
- **Selection.** The selected chat line darkens its text and reveals its action row; no outline, no highlight bar.
- **Actions.** One filled pill per screen, everything else is 11–12px/700 text with a 40px tap height. Destructive actions are text in `--alert-quiet`, never a red button.
- **Layout rules.** Status bar 34px, gutters 16px (18px in chat), tap targets ≥40px (primary 44px, mic 56px). The blueprint canvas is horizontally scrollable at `width: max-content` and collapses to one column under 860px.

## Iconography
There is no icon library, icon font or SVG set in the source — **and none should be invented**. Loro draws its "icons" three ways:

1. **Unicode glyphs as icons**, at text size and ink colour: `♪` audio, `⇄` alternatives, `↻` repeat/shadow, `‹ ›` navigation, `→` send, `×` cancel, `✓` done/saved, `⌄` opens a sheet, `·` selected, `⬆` climbed a rung, `▶ ❙❙` ambient loop.
2. **Primitive shapes built from divs**: the mic (a 10×15 rounded capsule over a 15×2 bar), the waveform (five 3px bars), typing dots (three 5px circles), ladder pips (14×5 bars), the battery outline and notch in the status bar.
3. **Type as identity**: the serif `L` avatar for Loro, and the wordmark set in Plus Jakarta Sans 700.

Two emoji remain in the blueprint (🔥 streak, 🏆 owned); treat them as legacy. If a genuine icon set is ever needed, ask the brand owner first — a stroked set at 1.5px (Lucide-like) would be the closest match to the hairline language, but that substitution has **not** been made here.

## Screen map
| Blueprint screen | Where it lives | Ported to the UI kit |
| --- | --- | --- |
| Onboarding | `Loro.dc.html` phase 1 | — |
| Add phrases · Phrase detail | phase 2 | — |
| Adaptive stream · Speak to progress · Review session | phase 3 | — |
| Advanced loops A–C (conversation sim, curve, prosody, refrain, the run) | after phase 3 | — |
| **The open chat** | `Loro Chat.dc.html` | ✅ `ChatScreen.jsx` |
| **Message inspector** | `Loro Chat.dc.html` | ✅ `InspectorScreen.jsx` |
| **Today · the ritual** | Loop B | ✅ `TodayScreen.jsx` |
| Progress | phase 4 | — |
| Trip arc (5 stages) | phase 5 | — |

## Where each primitive comes from
| Primitive | Source screen |
| --- | --- |
| SearchField, TextArea, SegmentedTabs | Add phrases (discover / browse / import) |
| ChoiceCard, StepDots | Onboarding |
| RevealCard, GradeRow | Review session + forgetting-curve loop (`flip .3s ease`, Again/Difficult/Good/Easy with real intervals) |
| ScoreRing | Prosody + pronunciation loops |
| WordChip | Phrase detail + message inspector |
| VoiceWave, TypingDots | Chat, speak-to-progress, ambient loop |
| CountChip | Today streak, chat kept counter, banked phrases |
| Toast `actionLabel` | Add phrases undo (2.6s toast) |

## Intentional additions
- **PhoneFrame / StatusBar** — the blueprint repeats this bezel markup 21 times inline; it is factored out here as one component. Same values, no new design.
- **MeterBar / StatFigure / LadderPips** — the same three progress idioms recur across Today, Review, Progress and the rogue loop with slightly different inline styles; they are unified on the most common values (5–6px bar, 14×5 pips, tabular numerals).

## Caveats
- **Fonts are CDN-linked, not shipped.** No binaries were provided, so `tokens/fonts.css` imports Plus Jakarta Sans + Instrument Serif from Google Fonts. Send licensed files if you need self-hosting.
- **No logo.** The brand appears as plain type or a serif `L`; nothing was drawn.
- **The UI kit covers 3 of 21 screens.** Chat, inspector and today are complete; the rest are listed in the screen map and can be ported next.
- **Component cards are static HTML replicas** of each family (real tokens, hand-written markup) rather than live bundle mounts, because this project is not yet flagged as a Design System file type.
