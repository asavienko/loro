# Metrics

What we measure, what we refuse to optimise, and the event taxonomy.

---

## North star

**Weekly phrases produced under a real gate.**

> The count of distinct phrases per learner per week that the learner produced aloud and the app
> verified — a completed Speak-to-progress phrase, a Refrain rep at Cloze/Call/Cold, a pronunciation
> or prosody take, or a spoken roleplay reply.

Why this one:

- **Production, not recognition** — matches the core pedagogical stance
  ([learning-model.md](learning-model.md#production-over-recognition)).
- **Verified** — the app checked it; a tap can't inflate it.
- **Weekly, per learner** — rewards depth of use, not headcount.
- **Loop-agnostic** — every engine can move it, so it's a fair comparison metric
  ([practice-loops.md](practice-loops.md#how-well-actually-decide)).

It is deliberately _not_ DAU, session count, or streak length. All three can rise while learning
falls.

---

## Supporting metrics

### Learning outcomes — the ones that matter

| Metric                           | Definition                                                                | Target                        |
| -------------------------------- | ------------------------------------------------------------------------- | ----------------------------- |
| **30-day retention of learning** | % of phrases graded correctly on a cold probe 30 days after last practice | ≥ 65%                         |
| **Phrases mastered**             | Median `learned == true` per active learner at week 8                     | ≥ 40                          |
| **Production latency trend**     | Median measured mic-onset delay, by phrase rep count                      | Falls ≥40% from rep 1 → rep 6 |
| **Automaticity graduation rate** | Phrases reaching 4× lock-in ÷ phrases entered into rotation               | ≥ 55%                         |
| **Ladder distribution**          | % of owned phrases at rung ≥2 (Transferred+)                              | ≥ 30% at week 8               |
| **Trip readiness at arrival**    | `phrases_owned / target` on the arrival date                              | Median ≥ 0.8                  |
| **Real-world use**               | Phrases played or captured while abroad                                   | Median ≥ 25/trip              |

### The tagging thread — is the central mechanic actually working?

| Metric               | Definition                                                           | Target |
| -------------------- | -------------------------------------------------------------------- | ------ |
| Tag adoption         | % of added phrases with ≥1 tag **or** a non-default difficulty       | ≥ 55%  |
| Tag re-rating        | % of learners who changed a rating in the last 14 days               | ≥ 35%  |
| Tag→drill conversion | % of Progress-screen tag-row taps that start a drill and complete it | ≥ 50%  |
| Tag predictiveness   | AUC of learner-declared difficulty predicting actual recall failure  | ≥ 0.65 |

The last one is the honesty check. If learner-declared difficulty doesn't predict failure, the whole
thread is decoration and we need drift correction (Q-03 in
[learning-model.md](learning-model.md#open-pedagogical-questions)).

### Funnel

| Step                                  | Event                  | Target conversion   |
| ------------------------------------- | ---------------------- | ------------------- |
| Install → onboarding start            | `onboarding_started`   | 92%                 |
| Onboarding start → complete           | `onboarding_completed` | 80%                 |
| Onboarding → first practice session   | `session_completed`    | 70%                 |
| First session → day-2 return          | —                      | 45%                 |
| Day 2 → week-1 retained (≥3 sessions) | —                      | 30%                 |
| Week 1 → week 4 retained              | —                      | 55% of W1           |
| Free → paid                           | `subscription_started` | 4–6% of W1 retained |

Onboarding completion is high because it's six taps and seeds a real stream. If it's below 75%,
something is broken, not merely underperforming.

### Health

| Metric                        | Target                |
| ----------------------------- | --------------------- |
| Crash-free sessions           | ≥ 99.7%               |
| Cold start to interactive     | p95 ≤ 1.8 s           |
| Offline session success rate  | ≥ 99.9%               |
| ASR match latency (on-device) | p95 ≤ 400 ms          |
| Prosody scoring latency       | p95 ≤ 600 ms          |
| Sync conflict rate            | < 0.1% of synced rows |
| AI response cache hit rate    | ≥ 70%                 |

Full budgets: [`architecture/performance.md`](../architecture/performance.md).

---

<a id="guardrails"></a>

## Guardrails — metrics that must NOT improve at the expense of others

These exist because the product has explicit anti-goals ([vision.md](vision.md#what-loro-is-not)).
Each is a **circuit breaker**: if it trips, the change ships back out regardless of its wins.

| Guardrail                   | Trips when                                                   | Why it matters                                   |
| --------------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| **Streak-without-mastery**  | Streak length up >10% while phrases-mastered flat or down    | We've built a habit machine that teaches nothing |
| **Collection hoarding**     | Phrases added per learner up >20% while reps-per-phrase down | Learners are collecting, not learning            |
| **Mic avoidance**           | % of sessions with ≥1 mic attempt falls below 60%            | The core loop has become tappable-only           |
| **Session inflation**       | Sessions/day up while phrases-produced/session down >15%     | We've fragmented practice to farm opens          |
| **Notification dependence** | >50% of sessions originate from a notification               | The app isn't wanted, it's summoned              |
| **Review debt**             | Median overdue cards > 40 for SRS-loop learners              | Loop A's known failure mode is happening         |
| **Rating decay**            | Tag re-rating rate falls below 20%                           | The thread is going stale                        |

Reviewed weekly. Any tripped guardrail is an agenda item, not a dashboard colour.

---

## Event taxonomy

Naming: `object_verb_past_tense`, `snake_case`. Every event carries the
[common properties](#common-properties). Privacy rules in
[`architecture/security-privacy.md`](../architecture/security-privacy.md) — **notably: no phrase
text, chat text, transcript, correction text, or audio ever appears in an event.** Phrases are
referenced by `phrase_id` only, and learner-authored phrases are referenced by a salted hash so we
can count them without reading them.

### Lifecycle

| Event                                          | Key properties                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `app_opened`                                   | `source` (icon \| notification \| widget \| deeplink), `offline`        |
| `onboarding_started`                           |                                                                         |
| `onboarding_step_completed`                    | `step`, `answer`, `ms_on_step`                                          |
| `onboarding_completed`                         | `goal`, `level`, `daily_minutes`, `packs[]`, `seeded_count`, `total_ms` |
| `permission_requested` / `permission_resolved` | `permission`, `granted`, `context`                                      |

### Content

| Event               | Key properties                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `phrase_added`      | `phrase_id`, `source` (starter \| discover \| scenario \| browse \| custom \| import \| capture \| related \| drop \| chat \| generated), `difficulty`, `tags[]`, `theme` |
| `phrase_removed`    | `phrase_id`, `owned_days`, `reps_at_removal`                                                                                                                 |
| `phrase_rated`      | `phrase_id`, `field` (difficulty \| tags \| loved \| learned), `from`, `to`, `surface`                                                                       |
| `phrase_note_set`   | `phrase_id`, `source` (typed \| suggestion)                                                                                                                  |
| `import_parsed`     | `line_count`, `parsed_count`, `separator_hits{}`                                                                                                             |
| `import_committed`  | `added_count`, `deselected_count`                                                                                                                            |
| `capture_completed` | `line_count`, `added_count`, `ocr_confidence_bucket`                                                                                                         |
| `undo_used`         | `action`                                                                                                                                                     |

### Practice — shared

| Event               | Key properties                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `session_started`   | `engine`, `surface`, `queue_size`, `offline`                                                                               |
| `session_completed` | `engine`, `duration_ms`, `phrases_touched`, `phrases_produced`, `interruptions`                                            |
| `session_abandoned` | `engine`, `duration_ms`, `at_phrase_index`                                                                                 |
| `phrase_produced`   | **the north-star event** — `phrase_id`, `engine`, `mode`, `latency_ms`, `verified_by` (asr \| score \| self), `hints_used` |
| `audio_played`      | `phrase_id`, `rate`, `surface`, `source` (tts_cache \| tts_device \| cdn)                                                  |

### Practice — per engine

| Event                                             | Key properties                                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `stream_advanced`                                 | `phrase_id`, `repeats_completed`, `manual`                                                                |
| `stream_rerated_live`                             | `phrase_id`, `to`, `queue_position_before/after`                                                          |
| `refrain_wave_started` / `refrain_wave_completed` | `wave`, `set_size`, `reps_total`                                                                          |
| `refrain_rep_completed`                           | `phrase_id`, `mode`, `rep_index`, `latency_ms`, `automaticity`                                            |
| `refrain_phrase_locked`                           | `phrase_id`, `reps`, `total_ms`, `day_index`                                                              |
| `refrain_phrase_graduated`                        | `phrase_id`, `days_in_rotation`                                                                           |
| `srs_card_graded`                                 | `phrase_id`, `grade`, `interval_days`, `stability`, `focus_tag`, `ms_to_grade`                            |
| `curve_confidence_rated`                          | `phrase_id`, `level`, `stability_before/after`                                                            |
| `speak_word_revealed`                             | `phrase_id`, `word_index`, `via` (asr \| hint)                                                            |
| `speak_phrase_completed`                          | `phrase_id`, `hints_used`, `stars`, `asr_attempts`                                                        |
| `pron_take_scored`                                | `phrase_id`, `overall`, `worst_syllable_index`, `attempt`                                                 |
| `prosody_take_scored`                             | `phrase_id`, `melody_score`, `delta`, `cue_level`, `attempt`, `axes{}`                                    |
| `prosody_cue_leveled_up`                          | `phrase_id`, `from_level`, `to_level`                                                                     |
| `roleplay_turn_taken`                             | `scene_id`, `turn`, `was_best`, `via` (tap \| speech)                                                     |
| `roleplay_scene_completed`                        | `scene_id`, `turns`, `natural_lines`, `fluency`                                                           |
| `chat_started`                                    | `thread_id`, `topic_id`, `pace`, `offline`, `fallback_provenance`                                         |
| `chat_turn_submitted`                             | `thread_id`, `turn_id`, `turn_index`, `via` (text \| speech), `char_count`                                |
| `chat_turn_resolved`                              | `thread_id`, `turn_id`, `latency_ms`, `provenance`, `suggestion_count`, `correction_count`, `safety_code` |
| `chat_line_kept`                                  | `thread_id`, `turn_id`, `kind` (original \| corrected \| alternative)                                     |
| `chat_thread_cleared`                             | `thread_id`, `turn_count`, `age_days`                                                                     |
| `run_started` / `run_completed`                   | `deck_size`, `card_drawn`, `redrawn`, `target_phrase_id`                                                  |
| `run_rung_climbed`                                | `phrase_id`, `from_rung`, `to_rung`                                                                       |

### Trip

| Event                                    | Key properties                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `trip_created`                           | `days_until_arrival`, `trip_type`, `destination`, `target_count`            |
| `trip_drop_unlocked` / `trip_drop_added` | `day_index`, `pack_id`, `added_count`, `hours_to_add`                       |
| `trip_state_changed`                     | `from`, `to`                                                                |
| `survival_phrase_played`                 | `phrase_id`, `deck_position`, `hours_since_landing`, `offline`              |
| `trip_completed`                         | `phrases_used_abroad`, `captures`, `readiness_at_arrival`, `essentials_pct` |
| `widget_tapped`                          | `widget`, `action`                                                          |

### Commerce & system

| Event                                 | Key properties                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paywall_shown` / `paywall_dismissed` | `trigger`, `variant`                                                                                                                              |
| `subscription_started` / `cancelled`  | `plan`, `trial`, `days_since_install`                                                                                                             |
| `sync_completed`                      | `pushed`, `pulled`, `conflicts`, `duration_ms`                                                                                                    |
| `sync_failed`                         | `reason`, `retry_count`                                                                                                                           |
| `ai_request_completed`                | `endpoint`, `cache_hit`, `latency_ms`, `tokens_in/out`, `fallback_used`, `validation_failures`, `repair_attempted`, `safety_code`, `budget_state` |
| `error_surfaced`                      | `code`, `surface`, `recoverable`                                                                                                                  |

### Common properties

On every event: `event_id` (uuid, for dedup), `client_ts`, `server_ts`, `user_id` (or `anon_id`),
`session_id`, `app_version`, `build`, `platform`, `os_version`, `device_model`, `locale`,
`active_engine`, `trip_active`, `offline`, `experiments{}`.

---

## Instrumentation rules

1. **The client is the source of truth for behaviour; the server is for commerce.** Events queue
   locally and flush on connectivity, so offline behaviour is measured. Queue cap 5 000 events / 7
   days.
2. **`event_id` for idempotency.** Offline replay must not double-count.
3. **No free text, ever.** No phrase text, notes, chat turns, drafts, translations, corrections,
   inspector explanations, ASR transcripts, or audio. Learner-authored phrases get a salted hash id;
   conversation events use opaque thread/turn ids plus counts, timings, provenance and safety codes.
4. **Latency and score numbers must be real.** An event carrying a simulated value is worse than no
   event.
5. **One event per user action.** No shadow events for renders or scroll positions.
6. **New events need a PR to this file** in the same change. Undocumented events are dropped by the
   pipeline.
7. **Opt-out is honoured client-side.** With analytics disabled, nothing is queued — not just not
   sent.

---

## Dashboards

| Dashboard                                                                           | Audience                | Refresh   |
| ----------------------------------------------------------------------------------- | ----------------------- | --------- |
| **North star & guardrails**                                                         | Everyone, weekly review | Daily     |
| **Funnel**                                                                          | Product                 | Daily     |
| **Loop comparison** — retention/latency/adherence by engine cohort                  | Product + eng           | Weekly    |
| **Learning quality** — retention curve accuracy, tag predictiveness, latency trends | Product + eng           | Weekly    |
| **Health** — crashes, cold start, offline success, sync conflicts                   | Eng, on-call            | Real-time |
| **AI cost & cache** — spend per learner, cache hit rate, fallback rate              | Eng                     | Daily     |
| **Content quality** — most-removed phrases, most-tagged-difficult, never-practised  | Content                 | Weekly    |

The content-quality dashboard is the feedback loop for [content-model.md](content-model.md): a
phrase removed by 30% of learners who add it is a bad phrase, and that's actionable.
