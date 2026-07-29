# Code review

What reviewers look for, in what order, and how fast.

---

## SLAs

|                                       | Target                  |
| ------------------------------------- | ----------------------- |
| First response                        | 4 working hours         |
| Full review                           | 1 working day           |
| Re-review after changes               | 4 working hours         |
| A blocked PR (author waiting > 1 day) | Raised in async standup |

**Review latency is the most common bottleneck on a small team.** With a WIP limit of two per
engineer, a day-old PR means somebody is idle. Reviewing is higher priority than starting new work.

---

## The reviewer's order of attention

Read for these in order. Most review comments are wasted on #5 while #1 goes unexamined.

### 1 · Correctness of the _learning_ behaviour

Not "does the code work" — **does it teach the right thing?**

- Does the gate actually require production, or can it be passed by tapping?
- Does a rating change propagate to the queue, the card type, and the rollup?
- Is the FSRS write correct for this outcome?
- Does the engine maintain the signals it doesn't display
  ([rule 5](../architecture/overview.md#the-ten-rules))?
- Does the pedagogy match [`../product/learning-model.md`](../product/learning-model.md)?

This is the review dimension unique to this product, and it's the one a generic reviewer will skip.

### 2 · The three non-negotiables

Fast checks, and a violation is a revert not a discussion
([ways-of-working.md](ways-of-working.md#the-three-non-negotiables)):

- [ ] **No audio egress.** Does any new path move a recording or a derivative off the device?
- [ ] **No fake numbers.** Is every displayed value measured or computed from real signal?
      `latencyMs` typed as `number | null` and handled?
- [ ] **No shame.** Does any new copy — including a widget string or a notification — reference a
      missed day, a broken streak, or being behind?

### 3 · Data integrity

The highest-consequence class of bug in this app, because it's silent.

- Every new syncable field has a **declared merge class** (`fieldPolicy.ts`). CI catches a missing
  one; a _wrong_ one needs a human.
- Writes are in a transaction with the outbox append.
- Migrations are additive, forward-only, and tested from prior versions.
- No query without a `user_id` predicate (server).
- Soft deletes, not hard deletes, on synced entities.

### 4 · Design fidelity

For anything visual, **open the blueprint side by side**
([`../design/screen-catalog.md`](../design/screen-catalog.md)).

- Every `sc-if` state implemented, including empty and error
- Toast copy verbatim — it carries real meaning
- Tokens, not literals; and the right variant (`accentInk` for text, never `accent`)
- Press feedback on every interactive element
- Animation matches [`../design/motion.md`](../design/motion.md), with reduced-motion behaviour
- `lang="es-ES"` on Spanish text
- Charts have a visible text summary

### 5 · Everything else

Naming, structure, tests, types, duplication. Real, but last.

---

## What a reviewer should not do

| Don't                                                               | Why                                                         |
| ------------------------------------------------------------------- | ----------------------------------------------------------- |
| Bikeshed naming in a PR that's otherwise correct                    | Suggest, don't block                                        |
| Request a refactor of code the PR merely touched                    | Separate issue                                              |
| Demand a test for a trivially obvious change                        | Judgement; see the testing strategy                         |
| Ask for a different architecture in a feature PR                    | That's an ADR conversation                                  |
| Leave a wall of nitpicks with no summary                            | Say what blocks and what doesn't                            |
| Approve without running it, for anything audio, animated, or native | The simulator lies; and a screenshot doesn't show a stutter |

---

## Comment conventions

Prefix every comment so the author knows what blocks:

| Prefix          | Meaning                                        |
| --------------- | ---------------------------------------------- |
| **blocking:**   | Must change before merge                       |
| **question:**   | I don't understand; explain or clarify in code |
| **suggestion:** | Take it or leave it                            |
| **nit:**        | Trivial; ignore freely                         |
| **praise:**     | Genuinely good — say so                        |
| **future:**     | Worth doing, not here. File an issue           |

A review with no `blocking:` comments should be an approval, not a "looks good, but…".

---

## Authors

**Make the PR easy to review.**

- Under 400 lines; stack if bigger ([git-workflow.md](git-workflow.md#lifetime))
- Fill in the template properly, including how you verified it and on which device
- **A screen recording for anything animated.** A still image cannot show whether the warming card
  stutters
- Note which files are generated or mechanical so the reviewer skips them
- Self-review first — read your own diff before requesting review; you'll catch a third of the
  comments
- Answer every comment, even with "done"
- **Push back when you disagree**, with reasoning. Reviewers are not always right

**Don't**: sneak an unrelated refactor in; leave `console.log`; disable a lint rule without a
comment explaining why; mark a review comment resolved without addressing it.

---

## Special review paths

Some changes need more than one approval, because the failure mode is silent or the cost of being
wrong is high.

| Change                                         | Required                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `packages/core/src/sync/**`                    | **Tech lead + backend, both.** A merge-class mistake is silent data loss                       |
| `packages/core-rs/**` (scheduler or DSP)       | Core owner. **Golden-test diffs must be explained in the PR**, never re-baselined silently     |
| `apps/mobile/modules/**` (native audio/speech) | Mobile lead, tested on a real device                                                           |
| Anything touching recorded audio               | Tech lead, plus the [threat-model checklist](../architecture/threat-model.md#review-checklist) |
| A new analytics event                          | Product, plus a PR to [`../product/metrics.md`](../product/metrics.md) in the same change      |
| `packages/content/**` (Spanish)                | Content lead + a native speaker                                                                |
| A new dependency                               | Tech lead. Justify it; check the licence and the transitive tree                               |
| A schema migration                             | Backend + tech lead. Rollback plan in the PR                                                   |
| A performance-budget change                    | The surface owner. Documented reason                                                           |

**The golden-test rule is worth emphasising.** A DSP change that moves a golden score is either a
real improvement or a regression, and the only way to tell is for the author to say which and why. A
silent re-baseline is how a scoring system drifts until it's meaningless.

---

## The checklist

A reviewer's actual pass, condensed:

- [ ] I understand what this changes and why
- [ ] The learning behaviour is right, not just the code
- [ ] No audio egress · no fake numbers · no shame copy
- [ ] New syncable fields have correct merge classes
- [ ] I compared visual changes against the blueprint
- [ ] I ran it — on a device, if it's audio, animation, or native
- [ ] Tests cover the behaviour, not the implementation
- [ ] Errors are handled per [`../architecture/mobile-app.md`](../architecture/mobile-app.md#errors)
- [ ] No performance budget quietly regressed
- [ ] Docs updated if behaviour changed
- [ ] Every comment is prefixed with what it blocks
