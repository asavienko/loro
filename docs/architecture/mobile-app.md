# Mobile app architecture

The Expo / React Native app. Layers, folders, navigation, state, rendering, and errors.

---

## Layers

Strictly one-directional. A layer may only import from layers below it.

```
┌──────────────────────────────────────────────────────────┐
│  app/            Routes (Expo Router)                    │
│                  Screens compose features; no logic      │
├──────────────────────────────────────────────────────────┤
│  src/features/   Feature modules                         │
│                  Screen-level components + view models   │
├──────────────────────────────────────────────────────────┤
│  src/engines/    Practice engines                        │
│                  PracticeEngine implementations          │
├──────────────────────────────────────────────────────────┤
│  src/domain/     Domain services                         │
│                  phrases · trips · progress · content    │
├──────────────────────────────────────────────────────────┤
│  src/data/       Persistence + sync                      │
│                  Drizzle schema · repositories · outbox  │
├──────────────────────────────────────────────────────────┤
│  src/platform/   Native bridges                          │
│                  audio · speech · core (Rust) · widgets  │
├──────────────────────────────────────────────────────────┤
│  src/ui/         Design system                           │
│                  tokens · primitives · components        │
└──────────────────────────────────────────────────────────┘
```

Enforced by an ESLint `no-restricted-imports` boundary rule, not by convention. Two additional
rules:

- **`src/ui/` imports nothing from above it.** A design-system component that knows what a phrase is
  is a feature component in the wrong folder.
- **`src/engines/` never imports from `src/features/`.** Engines are headless and unit-testable
  without a renderer.

---

## Folder structure

```
apps/mobile/
├── app/                            # Expo Router — routes only
│   ├── _layout.tsx                 # root: providers, fonts, splash, deep links
│   ├── index.tsx                   # → home, or countdown when a trip is active
│   ├── onboarding/[step].tsx
│   ├── add/index.tsx               # Discover · Browse · Import
│   ├── phrase/[id].tsx
│   ├── practice/
│   │   ├── stream.tsx
│   │   ├── refrain.tsx
│   │   ├── speak.tsx
│   │   ├── review.tsx
│   │   ├── curve.tsx
│   │   ├── pronunciation.tsx
│   │   ├── prosody.tsx
│   │   ├── roleplay.tsx
│   │   └── run.tsx
│   ├── progress.tsx
│   ├── phrasebook.tsx
│   ├── trip/
│   │   ├── new.tsx
│   │   ├── index.tsx               # countdown home
│   │   ├── drop/[day].tsx
│   │   ├── survival.tsx
│   │   └── souvenir.tsx
│   └── settings/
│       ├── index.tsx
│       ├── practice.tsx            # engine selection
│       └── privacy.tsx
│
├── src/
│   ├── features/
│   │   ├── onboarding/
│   │   ├── add-phrases/            # search, scenarios, browse grid, import, tag sheet
│   │   ├── phrase-detail/
│   │   ├── stream/
│   │   ├── refrain/                # WarmingCard, AutomaticityMeter, ModeStrip, EffortChart
│   │   ├── speak/                  # BlurredWordChips
│   │   ├── review/
│   │   ├── curve/                  # ForgettingCurve (Skia)
│   │   ├── pronunciation/          # SyllableChips, WaveformPair, ScoreRing
│   │   ├── prosody/                # PitchContour (Skia), RhythmBars, SkillAxes, CueBar
│   │   ├── roleplay/
│   │   ├── run/                    # DeckShuffle, FinisherBeats, LadderClimb
│   │   ├── phrasebook/             # LadderHistogram, RungPips
│   │   ├── progress/               # StreakCard, MasteryBar, TrickyRollup, Milestones
│   │   └── trip/
│   │
│   ├── engines/
│   │   ├── types.ts                # the PracticeEngine contract
│   │   ├── registry.ts             # active-engine resolution + flags
│   │   ├── stream/
│   │   ├── refrain/
│   │   ├── srs/
│   │   ├── prosody/
│   │   ├── pronunciation/
│   │   ├── roleplay/
│   │   └── run/
│   │
│   ├── domain/
│   │   ├── phrases/                # add, rate, tag, remove, related, search
│   │   ├── trips/                  # lifecycle, drops, need-ordering
│   │   ├── progress/               # rollups, buckets, milestones, streaks
│   │   ├── content/                # catalog sync, packs, prefetch
│   │   ├── settings/
│   │   └── analytics/              # event queue + flush
│   │
│   ├── data/
│   │   ├── db/
│   │   │   ├── schema.ts           # Drizzle schema (single source of DDL)
│   │   │   ├── migrations/
│   │   │   └── client.ts
│   │   ├── repositories/
│   │   ├── outbox.ts
│   │   ├── sync/
│   │   └── api/                    # generated client from packages/core contracts
│   │
│   ├── platform/
│   │   ├── audio/                  # LoroAudio Expo Module wrapper
│   │   ├── speech/                 # LoroSpeech Expo Module wrapper
│   │   ├── core/                   # loro-core UniFFI bindings wrapper
│   │   ├── widgets/                # timeline/state pushes
│   │   ├── notifications/
│   │   ├── ocr/
│   │   └── purchases/
│   │
│   ├── ui/
│   │   ├── tokens/                 # generated from packages/design-tokens
│   │   ├── primitives/             # Text, Pressable, Sheet, Toast, Segmented, Chip, Card
│   │   ├── components/             # PhraseRow, DifficultySelector, TagChips, TransportBar…
│   │   └── motion/                 # shared animation configs
│   │
│   └── lib/                        # pure helpers: normalize, format, clock, result
│
├── modules/                        # local Expo Modules (native source)
│   ├── loro-audio/{ios,android}/
│   ├── loro-speech/{ios,android}/
│   └── loro-core/{ios,android}/    # UniFFI binding wrapper
│
├── targets/                        # native widget targets
│   ├── ios-widget/                 # WidgetKit + ActivityKit
│   └── android-widget/             # Glance
│
├── assets/{fonts,images,audio-seed}/
├── e2e/                            # Maestro flows
├── app.config.ts
├── eas.json
└── package.json
```

**Why `features/` and `engines/` are separate.** A feature is a screen with its components and view
model. An engine is headless practice logic. The Refrain screen renders; the RefrainEngine decides.
That split is what makes the loop swappable and the pedagogy testable without a simulator.

---

## Navigation

Expo Router, file-based, with typed routes (`experiments.typedRoutes`).

**The home route is conditional.** `app/index.tsx` resolves to:

| Condition                            | Renders                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------- |
| Onboarding not complete              | → `/onboarding/0`                                                          |
| Trip active, state `countdown`       | Countdown home                                                             |
| Trip active, state `abroad`          | Survival mode                                                              |
| Trip just completed, souvenir unseen | → `/trip/souvenir`                                                         |
| Otherwise                            | The active engine's home (Refrain → Today; SRS → Review home; Run → Ready) |

**Modals and sheets.** The tagging sheet is a route-level modal (`presentation: 'modal'`) so it gets
back-gesture handling and a URL. Toasts are not routes.

**Deep links** — `loro://` and `https://loro.app/…`:

| Link                                   | Target                         |
| -------------------------------------- | ------------------------------ |
| `loro://practice/refrain?wave=midday`  | Wave reminder notification     |
| `loro://phrase/<id>?play=1`            | Widget "phrase of the moment"  |
| `loro://trip`                          | Widget countdown tap           |
| `loro://trip/drop/<day>`               | Morning drop notification      |
| `loro://practice/stream?playlist=trip` | "Play today's 8 in the stream" |

**Rule: audio survives navigation.** The stream keeps playing across route changes and behind
sheets. The audio module holds playback state; no screen owns it.

---

## State

Three tiers, with no overlap. Duplicated truth is the main source of bugs in apps like this, so the
boundaries are strict.

| Tier          | Holds                                                                   | Mechanism                              | Survives                                                  |
| ------------- | ----------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------- |
| **Durable**   | Phrases, ratings, tags, schedules, trips, settings, outbox              | SQLite, read through live queries      | Everything                                                |
| **Session**   | Active engine session — current index, rep count, revealed words, phase | Zustand store, one slice per engine    | Backgrounding (rehydrated); not process death mid-session |
| **Ephemeral** | Focus, scroll, sheet open, toast, animation values                      | React state / Reanimated shared values | Nothing                                                   |

### Durable state is read, never mirrored

```ts
// A screen subscribes to the DB. There is no phrase array in a store.
const phrases = useLiveQuery(db.select().from(phrasesTable).where(eq(phrasesTable.learned, false)))
```

Any write goes through a repository, which writes SQLite **and** appends an outbox row in one
transaction. Live queries then push the change to every subscribed screen. This is why re-rating a
phrase in the stream instantly updates the Progress screen with no explicit invalidation
([ADR-0012](adr/0012-state-management.md)).

### Session state is engine-owned

```ts
interface RefrainSessionState {
  setId: string
  phraseIndex: number
  repsByPhrase: Record<string, number>
  phase: 'rep' | 'locked' | 'done'
  lastLatencyMs: number | null
}
```

Persisted to SQLite on every transition so a crash mid-wave resumes rather than restarts. This
matters: a learner five reps into a phrase who loses their progress will not do it again.

### What must never happen

- A phrase's difficulty stored in a Zustand store as well as the DB.
- A screen holding a `useState` copy of a list it also subscribes to.
- A "refresh" call. If a screen needs one, its data isn't coming from a live query.

---

## Rendering strategy

| Surface                                                      | Approach                                        | Why                                                              |
| ------------------------------------------------------------ | ----------------------------------------------- | ---------------------------------------------------------------- |
| Lists (Up next, Phrasebook, suggestions)                     | FlashList                                       | 2 000-phrase libraries must scroll at 60 fps                     |
| The warming card                                             | Reanimated `interpolateColor` on a shared value | 500 ms colour + shadow transition, off the JS thread             |
| Pitch contour, waveforms, forgetting curve, ladder histogram | React Native Skia                               | Real drawing; SVG-in-RN is too slow for the animated trace       |
| Press feedback, sheets, toasts                               | Reanimated + Gesture Handler                    | Consistent 130–340 ms feel from [motion.md](../design/motion.md) |
| Equalisers, beat bars, pulse rings                           | Reanimated `withRepeat`                         | Continuous, cheap, never on the JS thread                        |
| Screen transitions                                           | Expo Router native stack                        | Platform-native feel                                             |

**The 60 fps rule.** Anything that animates while audio plays runs on the UI thread. A dropped frame
in the warming card during a rep is a visible defect, because that animation _is_ the feedback.

---

## Errors

Errors are values in the domain layer and exceptions only at boundaries.

```ts
type Result<T, E = DomainError> = { ok: true; value: T } | { ok: false; error: E }
```

| Class           | Example                                          | Handling                                                                                   |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Expected**    | No phrases due; ASR heard nothing; no network    | A UI state, not an error. Never a toast that says "error"                                  |
| **Degradable**  | ASR unavailable; TTS clip missing; LLM timeout   | Fall back silently to the documented path (reveal mode, device TTS, bundled scene) and log |
| **Recoverable** | Sync conflict; migration retry; write contention | Retry with backoff; surface only if it persists past a session                             |
| **Fatal**       | Corrupt DB; failed migration                     | Error boundary, an honest screen, a recovery path, and a crash report                      |

**Three rules**

1. **A session never dies from a recoverable error.** If ASR fails mid-rep, the rep continues in
   reveal mode.
2. **No error message blames the learner.** _"Didn't catch it — try that word again"_, not
   _"Recognition failed"_.
3. **Every degradation is logged** with enough context to tell a real device problem from a bug.

Error boundaries sit at the route level. A crashed Prosody screen must not take down the stream
playing behind it.

---

## Performance practices

Budgets and how they're measured: [performance.md](performance.md).

- **Cold start** — splash held only until fonts, tokens, and the DB are ready; content sync and
  prefetch are deferred to after first paint.
- **DB reads on the hot path go through prepared statements** in `op-sqlite` via JSI. No async
  bridge hop mid-rep.
- **`loro-core` calls are synchronous** through UniFFI for anything sub-millisecond (rank, mode,
  interval) and asynchronous for DSP (pitch extraction, alignment), which runs on a native thread.
- **Audio decoding is native.** The JS thread never touches PCM.
- **Images and emoji** are static; no runtime image processing.
- **Bundle** — Hermes, inline requires, and the Skia-heavy lab screens are lazily imported so v1
  learners who never open them don't pay for them.

---

## Testing seams

The layering exists so these seams are available. Detail in
[`process/testing-strategy.md`](../process/testing-strategy.md).

| Seam                       | Enables                                                                        |
| -------------------------- | ------------------------------------------------------------------------------ |
| `PracticeEngine` interface | Engine unit tests with an in-memory repository, no renderer                    |
| Repository interfaces      | Domain tests against an in-memory DB                                           |
| `src/platform/*` wrappers  | Fakes for audio, speech, and OCR in component tests                            |
| `loro-core`                | Golden-file tests in Rust, plus a cross-language parity test                   |
| Live queries               | A write in a test propagates to a rendered component, exactly as in production |
