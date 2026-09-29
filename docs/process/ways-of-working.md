# Ways of working

How the team operates. Small team, short feedback loops, written decisions.

---

## The team

| Role                | Count        | Owns                                                   |
| ------------------- | ------------ | ------------------------------------------------------ |
| Mobile engineer     | 2            | The app, the native modules, the widgets               |
| Backend engineer    | 1            | `api`, workers, infrastructure, the content pipeline   |
| Designer            | 0.5 (shared) | The design system, screen fidelity, copy               |
| Content lead        | 0.5          | The Spanish catalog, packs, scenarios, roleplay scenes |
| Product / tech lead | 1 (combined) | Priorities, ADRs, the loop question                    |

Roughly 4.5 FTE. Every estimate in [`../product/roadmap.md`](../product/roadmap.md) assumes this.

**One person owns `loro-core`** — the Rust core is where the reproducible maths lives, and a
shared-ownership DSP module drifts. Others contribute with review from the owner.

---

## Cadence

| Ritual                 | When           | Length | Purpose                                                                                                             |
| ---------------------- | -------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| **Async standup**      | Daily, written | —      | What I shipped, what's next, what's blocked. In a thread, not a meeting                                             |
| **Weekly review**      | Monday         | 45 min | North star + guardrails ([`../product/metrics.md`](../product/metrics.md)), last week's ship list, this week's plan |
| **Design review**      | Wednesday      | 45 min | Screens in progress against the blueprint, side by side, on a device                                                |
| **Milestone planning** | Per milestone  | 2 h    | Scope, exit criteria, the cut list                                                                                  |
| **Retro**              | Per milestone  | 1 h    | What to change, one concrete action                                                                                 |
| **Learning review**    | Monthly        | 1 h    | The learning-quality dashboard: is the pedagogy working?                                                            |

That's it. Four hours of meetings a month in steady state.

**The learning review is the unusual one and the most important.** Once a month we look at retention
at 30 days, latency trends, FSRS calibration, and tag predictiveness
([`../architecture/observability.md`](../architecture/observability.md#learning-quality-telemetry))
and ask whether the product is teaching. Nobody else in the category does this, and it's the only
way the loop question gets answered with evidence rather than opinion.

---

## Planning

**Milestones, not sprints.** Each milestone in the roadmap has a scope, exit criteria, and a cut
list agreed up front. Work is pulled from the milestone; there is no per-sprint re-estimation
ceremony.

**Requirement IDs are the unit of work.** `P2-04`, `LB-25`, `AI-03` from
[`../product/prd.md`](../product/prd.md). An issue references its IDs; so does the branch and the
PR. That means "what's left in M2?" is answerable by listing open IDs.

**WIP limit: two items per engineer.** More than that and review latency becomes the bottleneck.

**The cut list is decided before the work starts, not when we're late.** M2's cut order is: Trip
Pass · ambient loop · Import · accent theming. Never cut: offline survival mode, the production
gate, real latency measurement.

---

## Decisions

Three tiers, and the tier determines the artefact.

| Tier              | Example                                                 | Artefact                                   | Who decides                     |
| ----------------- | ------------------------------------------------------- | ------------------------------------------ | ------------------------------- |
| **Architectural** | Framework, sync semantics, wire format, privacy posture | An [ADR](../architecture/adr/)             | Tech lead, after written review |
| **Product**       | Which loop is v1's hero, what's in the free tier        | A doc update + a note in the weekly review | Product lead                    |
| **Local**         | A library inside one module, a component's props        | Code review                                | The author                      |

**Rules**

- An architectural decision without an ADR isn't made. If it's only in a Slack thread, it will be
  re-litigated in three months.
- An ADR is never edited to change its decision — it's superseded, and the old file points forward
  ([ADR README](../architecture/adr/README.md)).
- **Every ADR has a "Revisit if…" section.** A decision with no stated trigger for reconsidering it
  becomes dogma.
- Open questions with no owner live in
  [`../decisions/open-questions.md`](../decisions/open-questions.md) with a date by which they
  block.

### Disagreement

Disagree in writing, on the PR or the ADR, with a concrete alternative. If it's unresolved after one
round, the owner of that area decides and the dissent is recorded in the ADR's consequences. Then
everyone commits.

**Escalation is not a failure mode.** A two-day unresolved technical disagreement costs more than a
decision made slightly wrong.

---

## The three non-negotiables

Everyone can push back on scope, schedule, and approach. These three are not negotiable, and knowing
that up front saves the argument:

1. **🔒 Recorded audio never leaves the device.** Printed on screen; therefore binding
   ([ADR-0011](../architecture/adr/0011-analytics-and-privacy.md)).
2. **Every number shown to a learner is real.** No simulated latency, no fake scores, not even
   behind a flag
   ([`../product/learning-model.md`](../product/learning-model.md#where-the-blueprints-numbers-came-from--and-what-is-real)).
3. **No screen shames a missed day.** Constrains the scheduler and the widget, not just copy.

A PR that violates one of these is reverted, not discussed.

---

## Dogfooding

**Everyone on the team uses Loro daily from M1 onward**, with a real learning goal — not a test
account.

Feedback goes to a single `#dogfood` channel, one message per observation, no triage ceremony. The
weekly review reads it.

This is not optional or symbolic. The blueprint's central bet is that repetition can feel alive, and
the only way to know whether the Refrain achieves that is to do six reps of the same phrase every
day for a month. A team that doesn't will ship something that looks right and feels tedious.

---

## Working with the design

The app in `apps/mobile` is the reference for learner-visible behaviour, and
[`../design/v2-prototype-decisions.md`](../design/v2-prototype-decisions.md) records the decisions
it carries. The v1.1 blueprint (`design/Language Learning by Phrases - V1.1/Loro.dc.html`) was
removed on 2026-09-30 and stays in Git history at `52a0e3b`; citations into it in `docs/` record
where a requirement came from.

- **When a doc and the app disagree,** decide which is intended, then fix the other in the same
  change.
- Intended-design changes are recorded in `docs/` with their requirement ID.

---

## Code ownership

| Area                                  | Owner            | Reviewers                                                |
| ------------------------------------- | ---------------- | -------------------------------------------------------- |
| `apps/mobile/src/{screens,sheets,ui}` | Mobile           | Mobile + designer for anything visual                    |
| `apps/mobile/modules/*` (native)      | Mobile lead      | Mobile lead required                                     |
| `apps/mobile/src/shared/state`        | Tech lead        | Tech lead required                                       |
| `packages/core-rs`                    | Core owner       | Core owner required                                      |
| `packages/core/src/sync`              | Tech lead        | **Tech lead + backend, both**                            |
| `apps/api`                            | Backend          | Backend                                                  |
| `packages/content`                    | Content lead     | Content lead required; native-speaker review for Spanish |
| `docs/`                               | The area's owner | One reviewer                                             |

Encoded in `.github/CODEOWNERS`.

**`packages/core/src/sync` requires two reviewers, one from each side.** A merge-class mistake there
is silent data loss ([`../architecture/sync-protocol.md`](../architecture/sync-protocol.md)), and
it's the one place where the client and server perspectives both need to be in the room.

---

## Definition of ready

Before work starts, an issue needs:

- [ ] Requirement IDs from the PRD
- [ ] A blueprint reference (line range) or an explicit note that it's new
- [ ] Acceptance criteria, testable
- [ ] Known edge cases listed (the functional spec usually has them)
- [ ] Design tokens and components identified, or flagged as new
- [ ] Any open question resolved, or explicitly deferred with a stated assumption

Done gates: [definition-of-done.md](definition-of-done.md).

---

## Communication

| Channel    | For                                     |
| ---------- | --------------------------------------- |
| `#dogfood` | Daily use observations. One per message |
| `#eng`     | Technical discussion, async standup     |
| `#alerts`  | Automated only — no conversation        |
| `#content` | Catalog questions, Spanish review       |
| GitHub PRs | All code discussion                     |
| ADRs       | All architectural decisions             |
| `docs/`    | Everything durable                      |

**If a decision matters in three months, it goes in `docs/`.** Slack is for coordination, not
memory.

---

## Onboarding a new person

Day 1 — [onboarding.md](onboarding.md): tools, clone, bootstrap, run on a device, ship a trivial PR.
Day 2 — read the five-doc reading order in the [root README](../../README.md#reading-order); open
the blueprint and play with every screen. Week 1 — pick up an issue with a clear blueprint
reference; pair on review. Week 2 — start dogfooding with a real goal.

The blueprint is the fastest way to understand this product. Half an hour interacting with it beats
a day of reading these docs, which is why it's step two and not step ten.
