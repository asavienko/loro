# Fix latency: non-monotonic clock, discarded samples, and a display floor that lies

- **Requirement IDs:** `LB-27`, `AS-03`
- **Milestone:** M1/M2 (bug — real latency measurement is on the "never cut" list,
  `docs/product/roadmap.md:130`)
- **Size:** M
- **Non-negotiables touched:** #2 (every number shown to a learner is real)

## Three defects, one subject

Real latency measurement is one of three things the roadmap says is **never cut** — alongside
offline survival mode and the production gate (`docs/product/roadmap.md:130`). All three defects
below are in that path. The requirement it serves is `LB-27` (_"Falling effort — a latency read-out
that drops with reps, plus an effort-history bar chart and a plain-language label"_,
`docs/product/prd.md:268`); the read-out and the label are one requirement, so a hidden value has to
leave the label coherent.

### 1. The comment says monotonic; the code uses wall-clock

`apps/mobile/app/practice/refrain.tsx` (`repStart` and `doRep`)

```ts
// Monotonic, so a wall-clock jump can't corrupt a measurement.
const repStart = useRef<number>(deviceClock.now())
```

`deviceClock.now()` currently delegates to `Date.now()`, so it is still wall-clock time despite the
comment. `doRep` subtracts two readings from it; a backwards correction yields a **negative**
latency and a forwards one an inflated one. Use `performance.now()` (available in Hermes and on web)
for durations, and keep the wall clock only for the attempt's `at` timestamp. Expose a separate
`Stopwatch` helper rather than adding an ambiguously named time source to `Clock`.

### 2. The measured sample is thrown away

`RefrainEngine.record()` now returns `latencySampleMs`, and the screen correctly hands the whole
delta to the store. But `apps/mobile/src/store/state.ts` explicitly drops that field in
`applyDeltaToPhrase()` because `PhraseState` has no latency history yet:

```ts
// NOT STORED YET, and deliberately not faked:
//   • `latencySampleMs` — the latency store lands with the measurement fix
```

Nothing stores it. The Refrain's per-rep read-out is local component state (`lastLatency` and
`history`) that dies on unmount. The `ProgressDelta` plumbing and conformance tests are already in
place; the missing part is a durable, mergeable sample model. The consequences are unchanged: no
latency trend on Progress, nothing to feed
`docs/architecture/observability.md#learning-quality-telemetry`, and no way to answer Q-01 ("is 6
reps the right target?"), whose whole premise is watching latency plateau.

Store a bounded ring of recent samples per phrase (`latencySamples: (number | null)[]`, last 20)
plus the derived best/median. Add the field to `packages/core/src/sync/fieldPolicy.ts` with a
declared merge class — CI fails without one, and that is the point.

### 3. The display floor invents numbers

`apps/mobile/src/lib/format.ts:29–33`

```ts
const clamped = Math.min(Math.max(ms, 300), 5000)
return `${(clamped / 1000).toFixed(1)}s`
```

A genuinely measured 120 ms renders as `0.3s`; a measured 9 s renders as `5.0s`. The comment says
"clamped for DISPLAY only", but the learner reads the display — that _is_ the number shown, and it
is not the one measured. Rule 2 does not have a display exemption.

Replace with honest rendering:

- Below the plausibility floor (the value is almost certainly a mis-triggered onset, not human
  speed): show nothing and log a `latency_implausible` sample. `null` is already a first-class value
  the UI knows how to hide — `Attempt.latencyMs` says so in as many words (`types.ts:83–88`).
- Above the ceiling: render `>5s`, not `5.0s`.
- In range: one decimal, as now.

Pick the floor from the audio doc rather than inventing it —
`docs/architecture/audio-speech.md#recording-and-latency` (`:208`) — and put the constant in
`core-rs` alongside the other shared numbers.

## The work

1. `performance.now()` for every duration in `refrain.tsx`; add a `Stopwatch` helper in
   `src/lib/clock.ts` so no screen does the subtraction itself.
2. Extend `PhraseState`/persistence and `applyDeltaToPhrase()` to retain `latencySampleMs`;
   `RefrainEngine.record`, the screen-to-store delta path, and engine conformance coverage already
   exist. Do not reintroduce a screen-specific `recordRep` write path.
3. New field + merge class in `fieldPolicy.ts`.
4. Fix `formatLatency`; add the plausibility constants to `core-rs`.
5. Progress: a latency sparkline that renders only from real samples, with the "chart has a visible
   text summary" a11y gate satisfied (`pnpm --filter @loro/mobile check:chart-summaries`).
6. Once ASR lands ([asr-speech-module.md](12-asr-speech-module.md)), the measurement point moves
   from "prompt settled → tap" to "prompt settled → **speech onset**". Keep the two sources
   distinguishable in the stored sample (`source: 'tap' | 'onset'`), because they are not comparable
   and a mixed trend line would be a fabricated one.

## Acceptance criteria

- No duration in the app is computed from `Date.now()`.
- A simulated clock jump (±10 min) mid-rep produces no negative and no inflated sample.
- Latency samples survive navigation away and back, and appear in Progress.
- A measured 120 ms renders as hidden, not `0.3s`; 9 s renders as `>5s`.
- `latencySamples` has a declared merge class; the field-policy test passes.
- Tap-derived and onset-derived samples are never averaged together.

## Tests

- `format.test.ts` — extend the existing cases with below-floor, above-ceiling, and `null`.
- Store test: 3 reps → 3 samples, capped ring at 20.
- Engine conformance: `RefrainEngine.record` returns `latencySampleMs` for a measured attempt and
  `null` for a skipped one.

## Out of scope

Onset detection itself (that is the ASR/audio module) and voice-activity tuning.
