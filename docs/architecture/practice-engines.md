# Practice engines

The abstraction that keeps all three of the blueprint's practice philosophies alive. Rationale:
[ADR-0006](adr/0006-pluggable-practice-engines.md) and
[`product/practice-loops.md`](../product/practice-loops.md).

---

## The problem it solves

The blueprint ships three complete, mutually exclusive philosophies of daily practice. They differ
in exactly three ways:

1. **Selection** — which phrases does today consist of?
2. **Sequencing** — in what order, in what manner, how many times?
3. **Evaluation** — what counts as success, and what does it write back?

They agree on everything else: the phrase store, the audio layer, the ASR layer, the DSP layer, the
design system, and the trip arc. That agreement is the interface boundary.

---

## The contract

The authoritative declaration is `packages/core/src/engines/types.ts`; the excerpt below describes
the intended shape but should not be copied as a second definition. In the current contract,
timestamps are epoch-millisecond `number`s, every item has an `itemId`, `EngineContext` also carries
an injected deterministic `seed`, and `LoroCoreFacade` is the seam for Rust-owned maths.

```ts
// packages/core/src/engines/types.ts

export type EngineId =
  'stream' | 'refrain' | 'srs' | 'prosody' | 'pronunciation' | 'roleplay' | 'run'

/** A single unit of work an engine hands to the UI. */
export interface PracticeItem {
  readonly itemId: string
  readonly phraseId: UserPhraseId
  /** Engine-specific presentation mode: 'echo' | 'cloze' | 'recall' | 'pressure-2' … */
  readonly mode: string
  /** What the learner sees as the prompt. */
  readonly prompt: PromptSpec
  /** What counts as done. */
  readonly gate: GateSpec
  /** Model audio to offer, if any. */
  readonly audio: AudioSpec | null
  /** Engine-specific payload the feature layer renders (cloze mask, cue level, beat copy…). */
  readonly meta: Readonly<Record<string, unknown>>
}

export interface PromptSpec {
  readonly show: 'full' | 'cloze' | 'meaning' | 'nothing'
  readonly clozeMask?: readonly number[] // token indices to blank
  readonly hookOnly?: boolean
}

export type GateSpec =
  | { kind: 'listen' } // no gate — playback only
  | { kind: 'self-report' } // learner grades themselves
  | { kind: 'asr-full' } // whole phrase must be produced
  | { kind: 'asr-partial'; minTokens: number }
  | { kind: 'score'; minScore: number } // DSP score threshold
  | { kind: 'tap' } // acknowledge and move on

/** What the learner did. The engine decides what it means. */
export interface Attempt {
  readonly itemId: string
  readonly outcome: 'success' | 'partial' | 'skipped' | 'failed'
  readonly latencyMs: number | null // measured, never estimated
  readonly transcript?: string
  readonly score?: ScoreBreakdown
  readonly selfGrade?: 'again' | 'hard' | 'good' | 'easy'
  readonly confidence?: 'forgot' | 'shaky' | 'ok' | 'strong' | 'instant'
  readonly hintsUsed: number
  readonly at: number // epoch ms
}

export interface SessionPlan {
  readonly engineId: EngineId
  readonly items: readonly PracticeItem[] // may be partial; engines can stream
  readonly estimatedMs: number
  readonly closed: boolean // true = finite and finishable (Refrain, Run)
}

export interface PracticeEngine {
  readonly id: EngineId

  /** Is this engine usable right now? (content available, permissions, flags) */
  availability(ctx: EngineContext): Promise<Availability>

  /** Build today's work. Pure w.r.t. the store: reads state, writes nothing. */
  plan(ctx: EngineContext): Promise<SessionPlan>

  /** The next item, or null when the session is complete. */
  next(session: SessionHandle): Promise<PracticeItem | null>

  /**
   * Record an attempt. Returns the progress deltas to persist.
   * MUST return deltas for every signal it can legitimately update —
   * including signals this engine does not display. See rule 5.
   */
  record(session: SessionHandle, attempt: Attempt): Promise<ProgressDelta>

  /** Summary for the completion screen. */
  summarize(session: SessionHandle): Promise<SessionSummary>
}
```

### `ProgressDelta` — where rule 5 is enforced

```ts
export interface ProgressDelta {
  readonly phraseId: UserPhraseId

  // Universal — every engine updates these.
  readonly reps?: number // increment
  readonly plays?: number
  readonly lastPracticedAt?: number
  readonly latencySampleMs?: number | null

  // FSRS — maintained even by engines that never show an interval.
  readonly srs?: { stability: number; difficulty: number; due: number }

  // Loop B.
  readonly repsToday?: number
  readonly automaticity?: number
  readonly lockedInToday?: boolean

  // Loop C — maintained from v1 so the Phrasebook isn't empty on day one.
  readonly rung?: LadderRung
  readonly stumbles?: number
  readonly staleReset?: boolean

  // Prosody.
  readonly cueLevel?: number
  readonly axes?: { perception?: number; recall?: number; production?: number }

  // Learner-facing flags an engine may set.
  readonly difficulty?: Difficulty
  readonly learned?: boolean
}
```

> **Rule 5 ([overview.md](overview.md#the-ten-rules)): every engine maintains every progress signal
> it can legitimately compute, including ones it doesn't display.**
>
> A learner practising only in the Refrain still accrues FSRS state and ladder rungs. This is what
> makes engine switching lossless and cross-engine A/B comparison possible. It is enforced by a
> conformance test suite every engine must pass — see [Conformance](#conformance).

### Context and handles

```ts
export interface EngineContext {
  readonly phrases: PhraseRepository // read-only view
  readonly clock: Clock // injectable — no Date.now() in engines
  readonly core: LoroCoreFacade // typed seam for Rust-owned maths
  readonly settings: PracticeSettings // daily minutes, set size, wave times
  readonly trip: TripContext | null // biases selection when a trip is active
  readonly flags: FlagReader
  readonly seed: number // injected; no Math.random() in engines
}
```

`clock` and `core` are injected so every engine is deterministic under test. **No engine calls
`Date.now()`, `Math.random()`, or a native module directly.**

---

## The engines

### Current implementation status

| Engine ID       | Contract | Headless engine | Mobile route | Current limitation                                                                          |
| --------------- | -------- | --------------- | ------------ | ------------------------------------------------------------------------------------------- |
| `stream`        | Yes      | Implemented     | Implemented  | Audio is not native/background-capable; ranking reaches it through a TS facade fallback     |
| `refrain`       | Yes      | Implemented     | Implemented  | No real audio/ASR; set selection, cloze, and FSRS still use interim TS/fabricated fallbacks |
| `srs`           | Reserved | Not implemented | No           | Requires authoritative FSRS and durable due state                                           |
| `prosody`       | Reserved | Not implemented | No           | Requires the evidence-gated DSP/native capture pipeline                                     |
| `pronunciation` | Reserved | Not implemented | No           | Requires the evidence-gated DSP/native capture pipeline                                     |
| `roleplay`      | Reserved | Not implemented | No           | Requires speech plus guarded live/offline AI behavior                                       |
| `run`           | Reserved | Not implemented | No           | Conditional on loop evidence and durable ladder history                                     |

The sections that follow specify target behavior for extension. Only Stream and Refrain describe
classes that exist today. `EngineId` membership does not mean an engine, registry entry, screen, or
native capability has shipped.

### StreamEngine · v1 · used by every loop

`Loro.dc.html:600–677`

|                |                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Selection**  | All phrases where `learned == false`                                                                                                     |
| **Sequencing** | Ascending by `rank(p) = plays + (hard −6 \| easy +4) + (loved −3)`. Each phrase repeats `hard 4 · med 3 · easy 2` times before advancing |
| **Gate**       | `{ kind: 'listen' }` — no gate; it's passive                                                                                             |
| **Writes**     | `plays`, `lastPracticedAt`, plus `reps` on completed repeat cycles                                                                       |
| **Closed?**    | No — it plays until stopped                                                                                                              |

The only engine that runs in the background, and the only one with no gate. Live re-rating re-ranks
the queue immediately, which is why `plan()` returns a stream rather than a fixed list.

### RefrainEngine · v1 · **hero**

`Loro.dc.html:1405–1532`

|                |                                                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Selection**  | Today's closed set (default 5), chosen once per day and **persisted** to `refrain_day`: due phrases first, then weakest by automaticity, then new. Never recomputed mid-day |
| **Sequencing** | Per phrase, mode by rep index: `0 echo · 1 chorus · 2 speed · 3 cloze · 4 call · 5+ cold`. Target 6 reps                                                                    |
| **Gate**       | Echo/Chorus/Speed → `asr-partial(1)`; Cloze/Call → `asr-full`; Cold → `asr-full`                                                                                            |
| **Writes**     | `repsToday`, `automaticity = min(100, round(reps/6 × 100))`, `latencySampleMs`, `lockedInToday`, plus `reps` and an FSRS review                                             |
| **Closed?**    | **Yes** — this is the point. You can finish today                                                                                                                           |

Two things it must get right:

- **Latency is measured**, from prompt-audio-end (or prompt-render for silent modes) to
  speech-onset. If measurement fails, the read-out is hidden, not faked.
- **Cloze masks pick content words.** `loro-core::cloze_mask` selects the most informative token,
  never an article or preposition.

### SrsEngine · v1.1

`Loro.dc.html:750–821` and `963–1037`

|                |                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| **Selection**  | `srs_due <= now`, capped at a daily maximum derived from the learner's daily-minutes setting               |
| **Sequencing** | Ascending by due date, then by FSRS retrievability. Frozen at session start so re-rating doesn't reshuffle |
| **Gate**       | `pron`-tagged → `asr-full`; otherwise `self-report`                                                        |
| **Writes**     | Full FSRS update, `reps`, `difficulty` (from Again/Easy), `learned`                                        |
| **Closed?**    | Yes — the due queue drains                                                                                 |

Card _type_ comes from tags ([functional-spec.md](../product/functional-spec.md#6-review-session)):
that mapping lives in the engine, not the screen. The Memory-model surface is the same engine with a
five-level confidence input instead of four grades — both map onto FSRS grades in `loro-core`.

### ProsodyEngine · v1.1

`Loro.dc.html:1124–1291`

|                |                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Selection**  | `pron`-tagged first, then lowest `ax_production`. **Catalog phrases only** — needs a trustworthy native reference ([content-model.md](../product/content-model.md#audio)) |
| **Sequencing** | One phrase, repeated takes. Prompt content is driven by the per-phrase `cue_level`                                                                                        |
| **Gate**       | `{ kind: 'score', minScore: 88 }` for levelling up; any take is recorded                                                                                                  |
| **Writes**     | `cueLevel` (+1 at ≥88, never decreases), all three `axes`, melody-score history                                                                                           |
| **Closed?**    | No — the learner leaves when they want                                                                                                                                    |

The cue ladder is the engine's own state machine, per phrase, persisted. Level never decreases
within a session.

### PronunciationEngine · v1.1

`Loro.dc.html:1051–1110`

Same shape as ProsodyEngine but scored per _syllable_ rather than per _contour_. Selection favours
phrases whose worst syllable score is lowest. Writes `ax_production` and per-syllable history.

### RoleplayEngine · v1.1

`Loro.dc.html:847–949`

|                |                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Selection**  | A scene, not phrases: chosen by `(dominant theme, level, tag profile)` and biased by the trip when active                                         |
| **Sequencing** | NPC turn → 3 options (one "best") → coach note. Typically 3 turns + a closer                                                                      |
| **Gate**       | `tap` (choose an option) or `asr-partial` (speak your own)                                                                                        |
| **Writes**     | `reps` and `lastPracticedAt` for phrases that appear in chosen lines; `rung` bump toward Transferred when a phrase is used in an unexpected scene |
| **Closed?**    | Yes — the scene ends                                                                                                                              |

The only engine with a cloud dependency, so it is also the only engine whose `availability()` can
return `degraded` — falling back to bundled scenes ([ai-services.md](ai-services.md)).

### RunEngine · v2

`Loro.dc.html:1572–1694`

|                |                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| **Selection**  | The spine (up to 3 phrases at `rung ≥ 1`) + one new phrase; then **the draw** picks a finisher and a target |
| **Sequencing** | `ready → spine → reveal → finisher → wrap`, with card-specific beat sequences                               |
| **Gate**       | Per beat — mostly `asr-full`; the Deploy finisher is `asr-partial` over free speech                         |
| **Writes**     | `rung` (+1, capped), `staleReset`, `stumbles − 1` (floor 0), `reps`                                         |
| **Closed?**    | Yes — one run                                                                                               |

The draw is deterministic given a seed, and the seed is stored on the run row, so a run can be
replayed exactly in tests and in bug reports.

```
eligible(deck)   = cards where unlocked ∧ ∃ phrase at card.sourceRung
pick(eligible)   = argmax over cards of Σ(need(candidate) + 1) + rand(0..2)
need(p)          = (stale ? 2 : 0) + stumbles
target(card)     = argmax need among phrases at card.sourceRung
```

---

## Engine resolution

The following is target policy, not current code: `packages/core/src/engines/registry.ts` does not
exist. Mobile currently constructs Stream and Refrain in `apps/mobile/src/store/engines.ts`.

```ts
// src/engines/registry.ts
function resolveEngine(ctx: ResolveContext): EngineId {
  if (ctx.settings.explicitEngine) return ctx.settings.explicitEngine // learner chose
  if (ctx.trip?.state === 'abroad') return 'stream' // survival: no drilling
  return defaultForGoal(ctx.onboarding.goal) // assigned default
}

const defaultForGoal = (goal: Goal): EngineId =>
  ({
    trip: 'refrain',
    convo: 'refrain',
    move: 'srs', // breadth at volume
    curious: 'refrain', // 'run' once v2 ships
  })[goal]
```

The eventual resolver must respect the decision recorded for loop ownership and experiment policy;
it must not be inferred by adding a registry. Plan 71 owns settings, flags, and the loop experiment,
and Q-05 currently blocks the experiment.

---

## Conformance

Every implemented engine passes a shared suite in `packages/core/src/engines/conformance.ts` against
injected repositories and clocks. This is the mechanism that makes every progress signal an explicit
`maintains` or `exempt` decision.

| Test                      | Asserts                                                                       |
| ------------------------- | ----------------------------------------------------------------------------- |
| `plan()` is read-only     | No store mutation during planning                                             |
| Determinism               | Same store + same clock + same seed → identical plan                          |
| No ambient nondeterminism | `Date.now`/`Math.random` are stubbed to throw; the engine still works         |
| **Signal manifest**       | Every `ProgressDelta` signal is classified; declarations agree with writes    |
| **Universal signals**     | Successful production engines maintain their declared universal/FSRS writes   |
| **Ladder maintenance**    | A successful attempt never _lowers_ `rung`                                    |
| **Latency honesty**       | `latencyMs` is either a measured number or `null` — never a computed estimate |
| Idempotent replay         | Recording the same attempt id twice yields the same final state               |
| Empty store               | `plan()` returns an empty plan and a usable empty state, not an error         |
| Closed sessions terminate | `next()` eventually returns `null` for `closed: true` engines                 |

The suite tests returned deltas, not durable application. It does not currently kill/relaunch a
session, write through `applyDelta`, exercise SQLite, or validate Rust FSRS correctness. Those need
store/persistence and boundary tests in the plan that adds the behavior.

A new engine is not "done" until this suite passes
([`process/definition-of-done.md`](../process/definition-of-done.md)).

---

## Adding an engine

1. Confirm the engine is in the active roadmap and its evidence/decision gates are satisfied.
2. Add `packages/core/src/engines/<id>/` as pure headless TypeScript and export it from
   `engines/index.ts`; there is no registry to edit today.
3. Put reproducible maths in Rust, expose generated bindings, and implement the `LoroCoreFacade`
   adapter. Never make a second TypeScript algorithm or fabricated fallback.
4. Extend `ProgressDelta` only for a genuinely new stored signal; add it to `PROGRESS_SIGNALS`,
   merge/apply semantics, sync field policy where applicable, and every engine's conformance
   manifest.
5. Pass conformance and engine-specific tests, then add the mobile route/composition, store wiring,
   persistence/resume coverage, E2E state manifest row, and learner-visible E2E tests together.
6. Document the implemented behavior here and in
   [`product/practice-loops.md`](../product/practice-loops.md).

If an engine needs a new _gate kind_, that's a signal it needs new evaluation machinery — a bigger
change than adding an engine, and it should come with its own ADR.
