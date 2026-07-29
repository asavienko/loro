# Component inventory

The components the 21 screens are actually made of. Built in `apps/mobile/src/ui/`, ordered by build
priority — the first two sections cover most of the app.

`P1` = needed for M1 · `P2` = M2 · `P3` = M3+

---

## Primitives · `src/ui/primitives/`

Nothing above these knows about phrases.

| Component      | Props                                                                 | Notes                                                                                                | Pri |
| -------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --- |
| `Text`         | `variant`, `color`, `align`, `numberOfLines`, `lang`                  | Wraps the type scale. **`lang="es"` sets the accessibility language** — required on all Spanish text | P1  |
| `Pressable`    | `feedback: 'row' \| 'button' \| 'icon' \| 'small' \| 'grow'`          | The four press behaviours from [motion.md](motion.md#press-feedback). Enforces a 44×44 hit area      | P1  |
| `Card`         | `padding`, `radius`, `border`, `elevation`                            | White surface, `radius.xl`, `line.default`                                                           | P1  |
| `DarkCard`     | `gradient`, `padding`                                                 | The gradient card with the inverted ink ramp                                                         | P1  |
| `Row`          | `gap`, `align`, `justify`                                             | Flex helper                                                                                          | P1  |
| `Stack`        | `gap`, `direction`                                                    | Flex helper                                                                                          | P1  |
| `Pill`         | `tone: semantic \| neutral \| accent`, `size`                         | 10–11 px uppercase, tracked, semantic background                                                     | P1  |
| `Chip`         | `selected`, `emoji`, `label`, `onPress`                               | Selectable chip with the 180 ms selection transition                                                 | P1  |
| `Button`       | `variant: primary \| secondary \| destructive`, `disabled`, `loading` | Primary uses the accent-tinted shadow. Disabled = grey bg, grey text, no shadow                      | P1  |
| `Segmented`    | `options`, `value`, `onChange`                                        | Sunken track, white thumb with `shadow.card`                                                         | P1  |
| `Sheet`        | `visible`, `onDismiss`, `children`                                    | Bottom sheet: asymmetric radius, handle, 42% scrim, `sheetUp`                                        | P1  |
| `Toast`        | `message`, `action?`, `duration`                                      | Dark pill, bottom-centre, `popIn`. One at a time                                                     | P1  |
| `ProgressBar`  | `value`, `color`, `height`, `animated`                                |                                                                                                      | P1  |
| `Dots`         | `count`, `filled`, `variant: pip \| dot \| bar`                       | Repeat pips, set dots, onboarding segments                                                           | P1  |
| `IconButton`   | `glyph`, `label`, `onPress`                                           | Glyph or emoji, with a real accessibility label                                                      | P1  |
| `TextField`    | `value`, `onChange`, `placeholder`, `focused`                         | Accent border on focus, clear button                                                                 | P1  |
| `TextArea`     | uncontrolled via ref                                                  | Import paste — uncontrolled to avoid IME/caret issues                                                | P2  |
| `EmojiTile`    | `emoji`, `size`, `background`                                         | The rounded emoji tile used everywhere                                                               | P1  |
| `StatTile`     | `value`, `label`                                                      | Big number over an uppercase label. Always in threes                                                 | P1  |
| `SectionLabel` | `children`                                                            | 11 px, 700, uppercase, tracked, `muted`                                                              | P1  |
| `Divider`      | `tone`                                                                |                                                                                                      | P1  |
| `Equalizer`    | `bars`, `active`, `tempo`                                             | `eqB` staggered. Also the beat, with a tempo prop                                                    | P1  |
| `Scrim`        | `opacity`, `onPress`                                                  |                                                                                                      | P1  |

---

## Domain components · `src/ui/components/`

These know what a phrase is.

| Component            | Props                                                                            | Used by                                                                                  | Pri |
| -------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --- |
| `PhraseRow`          | `phrase`, `showAudio`, `showAdd`, `showLove`, `showDifficulty`, `onPress`, `on*` | Every list in the app. **One focusable element; sub-controls are accessibility actions** | P1  |
| `PhraseHero`         | `phrase`, `showRespelling`                                                       | Detail, review card back                                                                 | P1  |
| `DifficultySelector` | `value`, `onChange`, `layout: segmented \| cards`                                | Sheet, detail, stream                                                                    | P1  |
| `TagChips`           | `value`, `onChange`                                                              | Sheet, detail                                                                            | P1  |
| `LoveToggle`         | `value`, `onChange`, `size`                                                      | Detail, stream, rows                                                                     | P1  |
| `DifficultyPill`     | `value`, `onPress?`                                                              | Rows, cards. Tapping cycles                                                              | P1  |
| `ThemePill`          | `theme`                                                                          | Detail, review card                                                                      | P1  |
| `WordChips`          | `words`, `onWordPress`                                                           | Detail word-by-word                                                                      | P1  |
| `MemoryHookCard`     | `note`, `suggestions`, `onPick`, `onEdit`                                        | Detail, review reveal                                                                    | P1  |
| `StreamStrip`        | `phrases`, `selectedId`, `onSelect`                                              | Add phrases — the horizontal recent strip                                                | P1  |
| `TransportBar`       | `playing`, `speed`, `onPlay/Next/Prev/Speed`                                     | Stream                                                                                   | P1  |
| `NowPlayingCard`     | `phrase`, `repeatIndex`, `repeatTarget`, `progress`                              | Stream                                                                                   | P1  |
| `UpNextList`         | `phrases`, `on*`                                                                 | Stream                                                                                   | P1  |
| `MicButton`          | `state: idle \| listening \| processing \| done`, `onPress`                      | Every speaking screen. `pulseRing` when listening                                        | P2  |
| `BlurredWordChips`   | `tokens`, `revealed`, `justRevealed`                                             | Speak to progress. **Hidden words expose no text**                                       | P2  |
| `FocusBanner`        | `tag`                                                                            | Review — the tag-driven instruction banner                                               | P3  |
| `GradeButtons`       | `grades`, `onGrade`                                                              | Review                                                                                   | P3  |
| `ConfidenceLevels`   | `levels`, `value`, `onChange`                                                    | Memory model                                                                             | P3  |
| `WarmingCard`        | `automaticity`, `mode`, `content`                                                | **The Refrain hero.** See below                                                          | P2  |
| `AutomaticityMeter`  | `value`                                                                          | The Refrain                                                                              | P2  |
| `EffortChart`        | `samples`                                                                        | The Refrain — falling latency bars. **Gaps for unmeasured reps, never interpolation**    | P2  |
| `ModeStrip`          | `modes`, `currentIndex`                                                          | The Refrain                                                                              | P2  |
| `WaveList`           | `waves`, `onStart`                                                               | Today                                                                                    | P2  |
| `TodaySetList`       | `phrases`, `onPress`                                                             | Today                                                                                    | P2  |
| `AmbientToggle`      | `active`, `onToggle`                                                             | Today                                                                                    | P2  |
| `CueBar`             | `level`, `maturity`, `timer?`                                                    | Prosody                                                                                  | P3  |
| `SkillAxes`          | `perception`, `recall`, `production`                                             | Prosody                                                                                  | P3  |
| `SyllableChips`      | `syllables`, `scores?`, `onPress`                                                | Pronunciation, prosody                                                                   | P3  |
| `ScoreRing`          | `score`, `verdict`                                                               | Pronunciation                                                                            | P3  |
| `RungPips`           | `rung`                                                                           | Phrasebook                                                                               | P3  |
| `LadderBadge`        | `rung`                                                                           | Phrasebook, run wrap                                                                     | P3  |
| `MasteryBar`         | `buckets`                                                                        | Progress                                                                                 | P1  |
| `TrickyRollup`       | `tags`, `onDrill`                                                                | Progress. **Rows are actionable** — this closes the tag loop                             | P1  |
| `MilestoneRow`       | `milestone`                                                                      | Progress                                                                                 | P1  |
| `StreakCard`         | `current`, `best`, `week`                                                        | Progress, Today                                                                          | P1  |
| `CountdownCard`      | `trip`, `owned`, `target`                                                        | Countdown home                                                                           | P2  |
| `DropCard`           | `drop`, `onAdd`                                                                  | Countdown home, drop screen                                                              | P2  |
| `SurvivalRow`        | `phrase`, `onPlay`                                                               | Survival mode                                                                            | P2  |
| `SceneBubble`        | `speaker`, `es`, `en`, `onHear`                                                  | Roleplay                                                                                 | P3  |
| `ReplyOptions`       | `options`, `onPick`, `onHear`                                                    | Roleplay                                                                                 | P3  |
| `CoachNote`          | `text`, `isBest`                                                                 | Roleplay                                                                                 | P3  |

---

## Charts · `src/ui/charts/` · React Native Skia

Every chart is accompanied by a **visible text summary** carrying the same information
([accessibility.md](../architecture/accessibility.md#graphs-and-the-labs)). The summary is not
screen-reader-only — it improves the screen for everyone, and it's checked in CI.

| Component         | Draws                                                                                    | Screen        | Pri |
| ----------------- | ---------------------------------------------------------------------------------------- | ------------- | --- |
| `PitchContour`    | Native (dashed) vs learner (solid) polylines, off-target dots, the animated trace cursor | Prosody       | P3  |
| `RhythmBars`      | Paired native/learner stress bars, flexed by syllable duration                           | Prosody       | P3  |
| `WaveformPair`    | Two 34-bar lanes; the learner's animates while recording                                 | Pronunciation | P3  |
| `ForgettingCurve` | `0.5^(t/S)` with a filled area, the 50% threshold, now and next-review dots              | Memory model  | P3  |
| `Sparkline`       | Last 6 take scores                                                                       | Prosody       | P3  |
| `LadderHistogram` | Five-bar distribution in rung colours                                                    | Phrasebook    | P3  |
| `WeekDots`        | 7-day streak strip                                                                       | Progress      | P1  |

---

## The three components worth extra care

### `WarmingCard`

The Refrain's hero, and the app's most important animation.

```tsx
interface WarmingCardProps {
  automaticity: number // 0–100 drives everything
  mode: RefrainMode // echo | chorus | speed | cloze | call | cold
  es: string
  en: string
  cloze?: string
  hook?: string
}
```

- Background, text colour, and glow interpolate across four bands
  ([design-system.md](design-system.md#scales)) over 500 ms.
- Driven by a Reanimated shared value and `interpolateColor` — **never** a re-render per band.
- Content is mode-dependent: full text · cloze with a gap · English-only · ❄️ plus the hook.
- Under Reduce Motion the **colour stays** and only the glow animation drops.
- Checked at 60 fps on the device floor every release
  ([performance.md](../architecture/performance.md#frame-rate)).

### `PhraseRow`

Used more than any other component, and the one most likely to be got wrong for accessibility.

```tsx
interface PhraseRowProps {
  phrase: PhraseView
  variant: 'suggestion' | 'queue' | 'related' | 'survival' | 'collection'
  showAudio?: boolean
  showAdd?: boolean
  showLove?: boolean
  showDifficulty?: boolean
  onPress?: () => void
  onPlay?: () => void
  onLove?: () => void
  onDifficulty?: () => void
  onAdd?: () => void
}
```

- **One focusable element.** Sub-controls become accessibility actions, not separate tab stops.
- Spanish gets `lang="es-ES"`.
- Sub-control taps must `stopPropagation` — the blueprint does this explicitly (`Loro.dc.html:2353`)
  and forgetting it means every ♪ tap also opens the detail screen.
- Both text lines ellipsise at one line.
- **Tapping the row always opens phrase detail.** No exceptions across the whole app — that
  consistency is what makes it feel like one object graph.

### `EffortChart`

Small, but it's where the honesty rule bites.

```tsx
interface EffortChartProps {
  samples: (number | null)[] // ms; null = NOT MEASURED
}
```

`null` renders a **gap**, never an interpolated bar. If no sample in the window was measured, the
whole chart is hidden rather than shown empty-but-plausible
([`product/learning-model.md`](../product/learning-model.md#where-the-blueprints-numbers-came-from--and-what-is-real)).

---

## Conventions

1. **Primitives know nothing about the domain.** A primitive that takes a `phrase` prop belongs in
   `components/`.
2. **Colours come from tokens, never literals.** Enforced by a lint rule.
3. **Every interactive component has press feedback** via `Pressable`'s `feedback` prop.
4. **Every Spanish text node carries `lang`.** Checked in CI.
5. **Every chart has a visible text summary.** Checked in CI.
6. **Empty states are the component's job**, not the screen's. A `UpNextList` with no items renders
   its own empty copy.
7. **Reduced-motion behaviour lives in the motion tokens**, so a new component inherits it.
8. **Stories for every state**, including empty, loading, error, and long-content. The long-content
   case is where the blueprint's tight rows break.

---

## Rough counts

| Group             | Count   | Milestone       |
| ----------------- | ------- | --------------- |
| Primitives        | 23      | M1              |
| Domain components | 39      | M1–M3           |
| Charts            | 7       | M1 (1) · M3 (6) |
| **Total**         | **~69** |                 |

M1 needs roughly 35 of them, which is why the design system is scheduled as its own workstream in
[`product/roadmap.md`](../product/roadmap.md#m1--the-spine--5-weeks) rather than emerging screen by
screen.
