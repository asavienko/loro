# Four false statements on screen, and the missing undo

- **Requirement IDs:** `P3-03`, `P4-05`, `P4-06`, `P1-03`, `P1-04`, `P1-08`, `P1-10`, `LB-03`,
  `LB-08`, `P2-13`, `P2-26`
- **Milestone:** M1 — these are defects in code that already exists
- **Spec:** `docs/product/functional-spec.md` §2 §3 §11 §15, `docs/product/prd.md`,
  `docs/design/copy-and-tone.md` (rule 3)
- **Size:** S–M

## What this is

Five defects found by reading the seven ported screens against the specs. Four of them are the same
class of bug as [02-fix-fabricated-streak](02-fix-fabricated-streak.md): **the interface states
something to the learner that the code does not do.** The fifth removes a phrase with no way back.

They are grouped because they share a fix shape — delete the claim or implement it, and add a test
that fails if the claim returns — and because each is small enough to land on its own. They are
_not_ grouped with [34-design-system-completion](34-design-system-completion.md) or
[47-typography-motion-and-haptics](47-typography-motion-and-haptics.md): those add something
missing, these remove something untrue.

Two of them touch [46-navigation-system](46-navigation-system.md): §2's drill is that plan's defect
10 (the un-named practice subset) seen from the other end, and §4's wave state is what its route
parameters will carry. Where they meet, 46 owns the route and the parameter; this plan owns what the
screen says.

Non-negotiable #2 — "every number shown to a learner is real" — currently has **three** live
violations, not the two recorded in [README.md](README.md). §1 below is the third.

---

## 1 · A playback progress bar hardcoded at 35% · `P3-03`

`apps/mobile/app/practice/stream.tsx:148`

```tsx
<ProgressBar value={0.35} color={accent.accent} track={onDark.line} height={4} />
```

There is no audio ([11-audio-playback-module](11-audio-playback-module.md)), so this bar tracks
nothing. It renders 35% of an utterance that never plays, on the screen whose entire purpose is
playback. One line above, `:144`, the repeat pips are `filled={0}` and never advance, so `P3-03`'s
two halves are both drawn and both inert.

The screen already handles this honestly elsewhere — `:326–331` prints a card saying audio arrives
with the native module. That is the correct treatment; the bar contradicts it.

**Fix:** the progress bar and repeat pips render only from real playback position and a real repeat
index. Until the audio module lands, they do not render at all. `null` is the honest value and the
codebase already has the pattern — `formatLatency(null)` hides the effort read-out in
`refrain.tsx:437` rather than printing a plausible number.

## 2 · A drill that does not drill · `P4-05`, `P4-06`

`apps/mobile/app/progress.tsx:219–222`

```tsx
onPress={() => {
  showToast(`Drilling ${r.count} “${r.label.toLowerCase()}” phrases`)
  router.push('/practice/refrain')
}}
```

The Refrain practises today's frozen set (`refrainSet`), which has no relationship to the tag that
was tapped. No tag-filtered session exists anywhere in the app. So the toast names a count and a
category, and then the learner gets whatever today's set already was.

This is worse than a missing feature: `P4-06` and
[functional-spec.md §15](../../../docs/product/functional-spec.md#15-progress) call this row "the
tag thread closing its loop", and `copy-and-tone.md` rule 3 exists specifically so a toast can be
trusted to state a real consequence. A toast that lies about a consequence undoes the reason the
consequence toasts exist.

**Fix, in this order:**

1. **Now:** the row states only what is true. Either it stops claiming a drill (no toast, or "4
   phrases tagged pronunciation") or it does not navigate.
2. **Then:** a real tag-filtered session. `RefrainEngine.plan(ctx)` already takes an
   `EngineContext`; the filter belongs there as a plan-scoped selector, not as a screen-local
   `phrases.filter`, so the engine keeps owning set selection
   ([practice-engines.md](../../../docs/architecture/practice-engines.md)). Coordinate with
   [18-select-rs-cloze-and-set-selection](18-select-rs-cloze-and-set-selection.md), which owns
   `select_refrain_set` in Rust — a tag-scoped selection is the same function with a predicate, not
   a second implementation (ADR-0002) — and with [46-navigation-system](46-navigation-system.md)
   defect 10, which names the same thing from the route side: `?playlist=trip` and "a drill of
   exactly those phrases" are one concept and need one parameter. Take the parameter name from 46;
   do not invent a second.

## 3 · Onboarding asks four questions and uses two · `P1-03`, `P1-04`, `P1-08`, `P1-10`

`apps/mobile/app/onboarding.tsx:113–123`

```tsx
complete({
  goal: String(answers['goal'] ?? 'curious'),
  dailyMinutes: mins === 5 ? 5 : mins === 20 ? 20 : 10,
  packIds: answers['packs'] as string[],
})
```

`answers['level']` is collected across a whole step and **never passed to the store** — the answer
is dropped on the floor at the moment of commit. Its helper text promises otherwise: _"Sets how long
and tricky your first phrases are"_ (`:50`), which is also what `P1-04` requires.

`goal` reaches the store and is persisted (`store/index.ts:196`, `store/state.ts:77`) but **nothing
reads it**. `P1-03` is inert and `P1-10` — "if goal = a trip coming up, offer the trip setup flow" —
is unimplemented, so the learner who chose "A trip coming up" gets the identical app to the one who
chose "Just curious".

The ready screen compounds it: `P1-08` and FS §1 specify a summary of **all four** answers;
`:278–305` renders three (Goal · Daily · Packs), which is the visible symptom of the dropped field.

**Fix:**

- `level` is persisted with the other three and shown in the ready summary, making it four rows.
- `level` and `goal` either **do** something or the question goes. Concretely: `level` biases
  initial phrase length and difficulty in set selection; `goal` biases pack and theme ordering, and
  gates the trip flow. If a bias cannot be implemented until
  [18-select-rs-cloze-and-set-selection](18-select-rs-cloze-and-set-selection.md) lands, persist the
  answers now and land the bias with it — but do not ship a question whose answer is discarded.
- `P1-10`'s routing is owned by [22-trip-arc-screens](22-trip-arc-screens.md); this plan only
  guarantees `goal` survives to be read.

**Decision needed:** whether `level` biases content or only the _first_ set. Q-06's leaning (per
[08-built-screens-fidelity-audit](08-built-screens-fidelity-audit.md)) is that the goal assigns the
engine, which is adjacent. Record the answer in the plan rather than in a commit message.

## 4 · Waves that are neither timed nor correctly labelled · `LB-03`, `LB-08`

`apps/mobile/app/index.tsx:168–173`

```tsx
{ label: 'Morning', sub: 'Meet & first reps', time: '8:00' },
{ label: 'Midday',  sub: 'Re-rep, from memory', time: '1:00' },
{ label: 'Evening', sub: 'Cold + perform', time: '7:00' },
...
const ready = i === 0 || lockedIn > 0
```

Three problems in six lines:

- **The times are literals**, while the real schedule is `waveTimes: ['08:00','13:00','19:00']`
  (`store/index.ts:459`). Two sources for one fact.
- **"1:00" is wrong for 13:00** — the only clock in the app renders the midday wave as one in the
  morning.
- **Readiness is not time-driven.** Morning is always ready, and Midday _and_ Evening both light up
  the moment one phrase locks in, which can be 08:05. The CTA (`:270`) says "Start the wave →"
  regardless of which wave, or whether one is due.

**Fix:** wave rows render from `settings.waveTimes` through the clock (`clock.localDay()` /
`deviceClock.now()` — never a new `Date`, per [01](01-fix-local-day-boundary.md)), formatted once in
`src/lib/format.ts` so 13:00 has exactly one rendering. Readiness and the CTA label come from the
current local time plus persisted wave progress.

The behavioural half of this — completion, resume, doing all three waves at breakfast — is owned by
[20-screen-today-ritual](20-screen-today-ritual.md) §3 and waits on persistence
([10](10-sqlite-persistence-and-outbox.md)). **The mislabelled time and the duplicated schedule do
not wait on anything** and should land here.

## 5 · Remove has neither a confirmation nor an undo · `P2-13`, `P2-26`

`apps/mobile/src/store/index.ts:258` — `removePhrase` issues no toast. `addPhrase` (`:240`) and
`addOwnPhrase` (`:252`) both pass an undo closure; remove does not.

`apps/mobile/app/phrase/[id].tsx:339–346` calls it and then `router.back()`, so the row disappears
with no acknowledgement of any kind.

Three documents assume the undo exists:

| Document                     | Says                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `prd.md` `P2-13`             | "Undo on every add/import/**remove**, for ~2.6 s, via toast"                   |
| `functional-spec.md` §3      | "`Remove` navigates back and toasts; **it does not confirm (undo covers it)**" |
| `accessibility.md` cognitive | "Undo on every destructive action — `P2-13`"                                   |

So the app has neither the confirmation the spec deliberately omitted nor the undo that was supposed
to replace it. This is the cheapest fix in this plan and the one with the worst failure mode: the
phrase, its tags, its memory hook, and its practice history all go, silently.

**Fix:** `removePhrase` shows a toast with an undo that restores the **whole row**, not a
re-`addPhrase` — a re-add produces a fresh `id`, a zeroed `reps`, and no note, which is a different
phrase wearing the same text ([04-fix-user-phrase-identity](04-fix-user-phrase-identity.md)). Keep
the removed `PhraseState` in the closure and put it back verbatim, including its position, then call
`ensureRefrainSet()` so a restored member rejoins today's set.

Note the interaction with the 2.6 s window: `router.back()` fires immediately, so the toast must
survive navigation. `ToastHost` is mounted in `_layout.tsx:33`, above the stack, so it already does
— verify it rather than assuming, because this is exactly the kind of thing that works until someone
moves the host.

---

## Acceptance criteria

- No screen renders a progress value, pip count, or percentage that is not derived from a
  measurement. Verified against non-negotiable #2 for all seven ported screens, and
  [README.md](README.md)'s rule-2 tally updated.
- The "what's tricky" row either drills exactly the tagged phrases or claims nothing.
- All four onboarding answers are persisted and shown on the ready screen; every question either
  changes behaviour or has been removed, with the decision recorded here.
- Wave times come from `settings.waveTimes` and render 13:00 correctly; there is exactly one
  formatter.
- Removing a phrase is undoable for 2.6 s and the undo restores the original row, identity and
  history intact.
- `pnpm check` green, including the four a11y gates.

## Tests

- A store test proving `removePhrase` → undo restores a row that is `deepEqual` to the original,
  including `id`, `reps`, `note`, `srs`, and set membership.
- An onboarding test asserting every collected answer reaches `AppData`, written so that adding a
  fifth question without wiring it fails. The current bug passes any test that only checks
  `dailyMinutes` and `packIds`.
- A screen test asserting the stream renders no progress bar and no repeat pips while no audio
  module is registered.
- A test that the tricky-row tap produces a session whose items are all tagged with the tapped tag
  (or, in phase 1, that it makes no drill claim).
- A wave test with an injected clock at 07:59 / 08:01 / 12:59 / 13:01 / 19:01 asserting readiness
  and the CTA label, plus one asserting the midday row reads `13:00` (or `1:00 pm`) and never
  `1:00`.
- The e2e suite in `apps/mobile/e2e/` already drives these screens; extend `progress.spec.ts`,
  `onboarding.spec.ts`, `stream.spec.ts`, and `phrase-detail.spec.ts` rather than adding a new file.

## Risks

- **§2 and §3 grow into feature work.** Both have a one-line honest fix and a real implementation.
  Land the honest fix first, in its own commit, so the lie is gone within a day even if the feature
  slips.
- **§5's undo tempts a re-add.** It is the wrong fix and it typechecks. Assert identity in the test.

## Out of scope

- The audio module (`11`) and ASR (`12`) — §1 removes a false bar, it does not add playback.
- The trip flow (`22`) — §3 only makes `goal` readable.
- Wave completion, resume, and persistence (`20`, `10`).
- Latency's display floor and the invented FSRS intervals — [03](03-fix-latency-measurement.md) and
  [05](05-fix-shared-maths-duplication.md) own those, and they are the other two rule-2 violations.
