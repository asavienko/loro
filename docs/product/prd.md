# Product requirements

Every piece of functionality in Loro, derived from the authored design package. Organised by the
original blueprint's five phases, the v1.1 conversation addition, and cross-cutting concerns.

**How to read this**

- **ID** — stable. Cite it in issues, branch names, commits, and tests (`P2-04`).
- **Rel** — target release: `v1` · `v1.1` · `v2` · `later`. See [roadmap.md](roadmap.md).
- **Rel is scope, not delivery status.** A `v1` row is not necessarily implemented. Use the
  implementation ledger below and the linked active plan before treating a requirement as shipped.
- **Source** — line range in the named file under `design/Language Learning by Phrases - V1.1/`. An
  unqualified range means `Loro.dc.html`; navigation and chat rows name their adjacent authored
  artifact.
- Screen-level behaviour (states, transitions, edge cases) lives in
  [functional-spec.md](functional-spec.md). This document says _what_; that one says _how it
  behaves_.

### Implementation ledger — 2026-07-30

`Built surface` means a learner can reach the route on web today. `Partial` means some UI/domain
seams exist but the requirement range is not complete; in particular, browser interaction is not
evidence for native audio, speech, persistence, offline, widgets, or notifications. The
dependency-ordered source for remaining work is [`../../plans/README.md`](../../plans/README.md).

| Requirement area                                    | Current implementation                                                                                                                                                                                                                                                 | Completion path                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `P1-01`…`P1-12`                                     | **Partial:** six-step onboarding route and stream seeding exist; answers are in memory, trip handoff and in-context permissions do not                                                                                                                                 | [55](../../plans/archive/2026-09-07/55-current-surface-truth-and-fidelity.md), [59](../../plans/archive/2026-09-09/59-device-persistence-and-resume.md), [63](../../plans/archive/2026-09-09/63-native-speech-speak-and-latency.md), [69](../../plans/69-trip-domain-and-arc.md), [70](../../plans/archive/2026-09-09/70-survival-widgets-and-notifications.md)                                                                                                        |
| `P2-01`…`P2-14`, `P2-20`…`P2-40`                    | **Partial:** Discover, Browse, tagging, and phrase-detail routes exist over three 31-phrase starter catalogs; Import, real audio, durable edits and full failure boundaries remain                                                                                     | [55](../../plans/archive/2026-09-07/55-current-surface-truth-and-fidelity.md), [56](../../plans/archive/2026-09-09/56-navigation-failure-and-input-shell.md), [59](../../plans/archive/2026-09-09/59-device-persistence-and-resume.md), [61](../../plans/archive/2026-09-09/61-content-and-audio-assets.md), [62](../../plans/archive/2026-09-09/62-native-audio-playback.md), [65](../../plans/archive/2026-09-09/65-import-and-capture.md)                           |
| `P2-15`                                             | **Not built:** Capture is v1.1 scope                                                                                                                                                                                                                                   | [65](../../plans/archive/2026-09-09/65-import-and-capture.md), then the guarded provider seam in [76](../../plans/archive/2026-09-09/76-roleplay-and-live-ai.md) if needed                                                                                                                                                                                                                                                                                             |
| `P3-01`…`P3-12`                                     | **Partial:** Stream manual browsing, re-rating and recovery exist; real playback/background transport and durable practice remain                                                                                                                                      | [55](../../plans/archive/2026-09-07/55-current-surface-truth-and-fidelity.md), [59](../../plans/archive/2026-09-09/59-device-persistence-and-resume.md), [60](../../plans/archive/2026-09-09/60-authoritative-core-maths.md), [62](../../plans/archive/2026-09-09/62-native-audio-playback.md), [64](../../plans/archive/2026-09-09/64-today-and-refrain-production-loop.md)                                                                                           |
| `P3-20`…`P3-28`                                     | **Not built:** no microphone or ASR route/module exists                                                                                                                                                                                                                | [63](../../plans/archive/2026-09-09/63-native-speech-speak-and-latency.md)                                                                                                                                                                                                                                                                                                                                                                                             |
| `LB-01`…`LB-10`, `LB-20`…`LB-32`                    | **Partial:** Today and six-mode Refrain routes, frozen set, warming UI, `applyDelta`, and completion state exist; waves are not durable/timed/audible; manual confirmation correctly records null latency                                                              | [55](../../plans/archive/2026-09-07/55-current-surface-truth-and-fidelity.md), [59](../../plans/archive/2026-09-09/59-device-persistence-and-resume.md), [60](../../plans/archive/2026-09-09/60-authoritative-core-maths.md), [62](../../plans/archive/2026-09-09/62-native-audio-playback.md), [63](../../plans/archive/2026-09-09/63-native-speech-speak-and-latency.md), [64](../../plans/archive/2026-09-09/64-today-and-refrain-production-loop.md)               |
| `P4-01`…`P4-08`                                     | **Partial:** Progress stats, non-interactive tag rollups and earned milestones exist; durable history and real tag-filtered sessions remain                                                                                                                            | [55](../../plans/archive/2026-09-07/55-current-surface-truth-and-fidelity.md), [59](../../plans/archive/2026-09-09/59-device-persistence-and-resume.md), [60](../../plans/archive/2026-09-09/60-authoritative-core-maths.md)                                                                                                                                                                                                                                           |
| `F-01`…`F-04`, `F-07`                               | **Foundation only:** persistence schema/repositories/outbox and API/WASM seams exist; device SQLite, durable backend, identity, and client sync are not wired                                                                                                          | [54](../../plans/archive/2026-09-07/54-local-persistence-correctness.md), [58](../../plans/archive/2026-09-09/58-native-workspace-and-device-ci.md), [59](../../plans/archive/2026-09-09/59-device-persistence-and-resume.md), [66](../../plans/archive/2026-09-09/66-backend-contract-data-and-security.md), [67](../../plans/archive/2026-09-09/67-anonymous-auth-and-account-lifecycle.md), [68](../../plans/archive/2026-09-09/68-sync-and-offline-convergence.md) |
| `F-05`, `F-06`, `F-08`, `F-09`                      | **Partial foundation:** design tokens and multilingual UI/catalog support exist; bilingual review, durable device language settings and native minimum-OS proof remain gates. Shared motion/gesture kit is specified, not wired                                        | [57](../../plans/archive/2026-09-09/57-runtime-design-system.md), [100](../../plans/100-ui-design-system.md), [58](../../plans/archive/2026-09-09/58-native-workspace-and-device-ci.md), [71](../../plans/archive/2026-09-09/71-settings-telemetry-and-experiments.md), [72](../../plans/archive/2026-09-09/72-release-quality-gates.md)                                                                                                                               |
| `P5-01`…`P5-13`, `N-01`…`N-04`                      | **Not built:** trip, Survival, widgets, Live Activity, and notification surfaces have no app routes or native targets                                                                                                                                                  | [69](../../plans/69-trip-domain-and-arc.md), [70](../../plans/archive/2026-09-09/70-survival-widgets-and-notifications.md); trip semantics are blocked on [Q-07](../decisions/open-questions.md#q-07)                                                                                                                                                                                                                                                                  |
| `P3-30`…`P3-40`, `P3A-*`, `P3B-*`, `P3C-*`, `P3D-*` | **Not built as learner surfaces:** core/provider seams are inputs, not completed screens                                                                                                                                                                               | [75](../../plans/archive/2026-09-09/75-review-and-memory.md), [76](../../plans/archive/2026-09-09/76-roleplay-and-live-ai.md), and evidence-gated [77](../../plans/archive/2026-09-09/77-dsp-and-speech-labs.md)                                                                                                                                                                                                                                                       |
| `LC-01`…`LC-15`                                     | **Not built and conditional:** compatible ladder data may be retained, but Run/Phrasebook UI waits for comparative evidence                                                                                                                                            | [78](../../plans/78-conditional-run-and-phrasebook.md), blocked on [Q-05](../decisions/open-questions.md#q-05) and M3 data                                                                                                                                                                                                                                                                                                                                             |
| `NAV-01`…`NAV-16`                                   | **Specified, not built:** the route-owned surface model, spine, switcher, honest exits/resume, and travelling transport have no production implementation                                                                                                              | [81](../../plans/archive/2026-09-09/81-navigation-spine-switcher-and-more.md), on the route foundation in [56](../../plans/archive/2026-09-09/56-navigation-failure-and-input-shell.md) and the persistence/audio owners named there                                                                                                                                                                                                                                   |
| `P3E-01`…`P3E-18`                                   | **Specified, not built:** Open chat and Message inspector have no routes, durable domain, bundled conversation pack, or guarded provider                                                                                                                               | [82](../../plans/archive/2026-09-09/82-guided-chat-domain-and-service.md) defines the private domain/service after the named decisions below; [83](../../plans/83-open-chat-and-message-inspector.md) implements the two surfaces                                                                                                                                                                                                                                      |
| `AS-07`                                             | **Partial:** `/listen-export` composer, listening-class TTS contract, pinned `LISTENING_VOICE_DECISION` (in-app only), native file-URI cache/`playFile`, emulator fixture listen. Pronunciation review remains on Q-15; share ⛔ Q-22; physical-device 58/72 remaining | [99](../../plans/99-batch-phrase-audio-export.md); device TTS is fallback only                                                                                                                                                                                                                                                                                                                                                                                         |

When code lands, update this ledger in the same change. Do not mark a range complete unless every
row in that range has acceptance evidence; narrow partial ranges instead.

---

## Phase 0 — Foundations (cross-cutting)

| ID   | Requirement                                                                                       | Rel  | Notes                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------- |
| F-01 | Account creation and sign-in (Apple, Google, email magic link)                                    | v1   | Sign-in is required before onboarding or practice; Apple, Google, or email magic link                                     |
| F-02 | Signed-in practice: the app is usable only with an account; local progress survives sign-out      | v1   | Restored native credentials still work offline; web reload uses the in-memory vault unless an E2E harness restores it     |
| F-03 | Offline-first: every practice surface functions with no network                                   | v1   | [offline.md](../architecture/offline.md)                                                                                  |
| F-04 | Cross-device sync of stream, ratings, tags, schedules, and progress                               | v1   | Delta sync, per-field LWW: [sync-protocol.md](../architecture/sync-protocol.md)                                           |
| F-05 | Accent theming — Coral · Sunset · Teal · Berry, themes the whole app                              | v1.1 | Blueprint prop; `2065–2067`, `3617–3625`                                                                                  |
| F-06 | Light theme only in v1; dark theme deferred                                                       | v1.1 | Blueprint is a single warm light palette throughout                                                                       |
| F-07 | Data export (phrases + progress, JSON) and account deletion                                       | v1   | GDPR duty: [security-privacy.md](../architecture/security-privacy.md)                                                     |
| F-08 | Native/UI: English, Bulgarian, Russian; learn Spanish, Bulgarian, Russian (different from native) | v1   | Seven supported pairs; starter content review and device persistence gates: [localization.md](../process/localization.md) |
| F-09 | Minimum OS: iOS 16, Android 10 (API 29)                                                           | v1   | [qa-device-matrix.md](../process/qa-device-matrix.md)                                                                     |

### Navigation contract (`NAV-01…NAV-16`)

The authored navigation shorthand uses `N9` and `N13`…`N16`. Durable requirements use `NAV-*` so
they cannot collide with notification requirements `N-01`…`N-04`.

| ID     | Requirement                                                                                                                                                                               | Rel  | Source                                             |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------- |
| NAV-01 | Every learner route declares exactly one surface class: **Root · Push · Session · Flow · Sheet**                                                                                          | v1.1 | `Navigation.dc.html:40–76`                         |
| NAV-02 | A Root is a resolved home, has no Back control, and owns a stateful text rail plus one primary filled action                                                                              | v1.1 | `Navigation.dc.html:88–165`                        |
| NAV-03 | A Push names the destination Back will reach; cold entry uses `✕ <resolved home>` rather than inventing browser history                                                                   | v1.1 | `Navigation.dc.html:167–240`, `696–746`            |
| NAV-04 | A Session disables back gestures and exits through **Pause · End it here · Keep going**; Pause is offered first and never threatens lost progress                                         | v1.1 | `Navigation.dc.html:242–269`, `488–491`            |
| NAV-05 | A Flow steps backward without losing answers, exposes only valid flow steps, and remains resumable across interruption                                                                    | v1.1 | `Navigation.dc.html:413–450`, `869`                |
| NAV-06 | A Sheet owns focus, scrim and swipe dismissal while open; its underlying surface remains mounted and cannot also escape                                                                   | v1.1 | `Navigation.dc.html:643–691`                       |
| NAV-07 | Route-owned metadata names place, parent/resolved home, hub/group, built state, expected use, resumability, practice-source parser, and empty-state copy                                  | v1.1 | `Navigation.dc.html:456–470`, `865–873`            |
| NAV-08 | The switcher lists **Ongoing** first, then built roots/contextual flow steps; `/more` lists **Lately · Phrases · Practice · You**, with real counts and no dead rows                      | v1.1 | `Navigation.dc.html:332–450`, `272–305`, `494–496` |
| NAV-09 | A deep link lands immediately unless work is at stake; then it queues in-surface. Valid-empty, gone/deleted, and malformed/unresolvable targets remain distinct and explain what happened | v1.1 | `Navigation.dc.html:582–638`, `751–799`            |
| NAV-10 | Home rails are declared per possible resolved home, carry useful state such as a real due count, and leave the thumb arc for the one filled action                                        | v1.1 | `Navigation.dc.html:111–163`, `479–499`            |
| NAV-11 | A paused session, playing loop, or half-answered flow is one canonical **ongoing** item shown consistently in the spine, switcher, and resolved home                                      | v1.1 | `Navigation.dc.html:315–330`, `383–397`, `460–462` |
| NAV-12 | Every route declares expected use as `daily`, `weekly`, or `rare`; daily destinations cannot silently sit at depth three, and unbuilt groups remain hidden                                | v1.1 | `Navigation.dc.html:865–873`                       |
| NAV-13 | Dismissing a resumable Session writes a checkpoint and changes the resolved home's primary CTA into **Resume**; it does not add a competing CTA                                           | v1.1 | `Navigation.dc.html:518–578`                       |
| NAV-14 | Exactly one escape is active: while a Sheet is open, the underlying Session exit is inert and inaccessible                                                                                | v1.1 | `Navigation.dc.html:643–691`                       |
| NAV-15 | Audio that outlives its route has one travelling transport on Root/Push; it hides on its own Session, pauses before another practice Session, and continues behind Flow/Sheet             | v1.1 | `Navigation.dc.html:802–860`                       |
| NAV-16 | Every non-Sheet surface renders one 28 px spine: readable place on the left, zero/one/many ongoing state on the right, both actionable                                                    | v1.1 | `Navigation.dc.html:311–330`, `454–475`            |

---

<a id="phase-1--onboard"></a>

## Phase 1 — Onboard

> _Set up in under a minute and land with a real stream — never an empty app._
> `Loro.dc.html:123–212`

| ID    | Requirement                                                                                                                                               | Rel | Source                                                   |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------------------------------- |
| P1-01 | Welcome screen: Loro introduces itself and the method ("by the phrase", parrot metaphor)                                                                  | v1  | `144–151`                                                |
| P1-02 | Stepped setup with a segmented progress bar and back navigation; 6 steps                                                                                  | v1  | `134–142`                                                |
| P1-03 | **Goal** — one of: a trip coming up · real conversations · moving abroad · just curious                                                                   | v1  | `2073–2078`                                              |
| P1-04 | **Level** — starting out · some basics · fairly confident. Sets initial phrase length and difficulty                                                      | v1  | `2079–2083`                                              |
| P1-05 | **Daily time** — 5 · 10 · 20 minutes. Sizes the daily set and wave length                                                                                 | v1  | `2084–2088`                                              |
| P1-06 | **Starter packs** — multi-select from 6 packs (Café 8 · Getting around 10 · Eating out 8 · Small talk 8 · Shopping 6 · Survival 8); at least one required | v1  | `2089–2096`                                              |
| P1-07 | Continue disabled until the current step is answered, with visibly disabled affordance                                                                    | v1  | `2111–2116`, `2169`                                      |
| P1-08 | Ready screen: seeded phrase count, the daily-minutes promise, and a summary of all four answers                                                           | v1  | `180–196`, `2153–2158`                                   |
| P1-09 | Selected packs are actually written into the stream before the first session                                                                              | v1  | `2124`                                                   |
| P1-10 | If goal = "a trip coming up", offer the trip setup flow immediately after onboarding                                                                      | v1  | Bridge to `P5-01`                                        |
| P1-11 | Microphone and notification permissions requested in context, never at launch                                                                             | v1  | See [functional-spec.md](functional-spec.md#permissions) |
| P1-12 | Whole flow completable in under 60 seconds                                                                                                                | v1  | Design goal, `125`                                       |

---

## Phase 2 — Build the stream

> _Grow a personal collection by association — and tell Loro what's hard about each phrase._
> `Loro.dc.html:217–587`

### Four ways to add (`P2-01…P2-14`)

| ID    | Requirement                                                                                                                         | Rel  | Source                 |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------- |
| P2-01 | Mode switcher: **Discover · Browse · Import**                                                                                       | v1   | `233–242`              |
| P2-02 | Live count of phrases in stream, always visible                                                                                     | v1   | `230`                  |
| P2-03 | **Discover** — free-text search across Spanish, English, and theme, accent-insensitive                                              | v1   | `2296–2299`, `2219`    |
| P2-04 | **Discover** — association: after adding a phrase, suggestions re-rank to "more like _that_"                                        | v1   | `2304–2308`, `2367`    |
| P2-05 | **Discover** — "Popular starters" as the zero-query default; never an empty list                                                    | v1   | `2309`, `2368`         |
| P2-06 | **Scenario** chips build a coherent set (Dinner reservation · Catching a train · Hotel check-in · Market & shops · Getting un-lost) | v1   | `2230–2238`            |
| P2-07 | **Add your own** — typed text becomes a custom phrase when it isn't in the library                                                  | v1   | `2313`, `2370`         |
| P2-08 | **Browse** — 8 theme tiles with remaining-count labels, drilling into a theme list                                                  | v1   | `2239–2245`, `2361`    |
| P2-09 | **Import** — paste a list; parse `es SEP en` on `—`, `–`, `-`, `=`, `:`, `: `, tab; cap at 12 rows                                  | v1   | `2254–2260`            |
| P2-10 | **Import** — per-row select/deselect before committing; "Paste sample menu" demo affordance                                         | v1   | `2288–2297`, `2252`    |
| P2-11 | **Add all N** bulk action whenever ≥2 suggestions are showing                                                                       | v1   | `2273–2280`, `2372`    |
| P2-12 | Audio preview (♪) on any suggestion row without adding it                                                                           | v1   | `332`, `2353`          |
| P2-13 | Undo on every add/import/remove, for ~2.6 s, via toast                                                                              | v1   | `2282–2288`, `420–425` |
| P2-14 | Empty state that routes forward ("Try another theme, scenario, or type your own")                                                   | v1   | `336–338`              |
| P2-15 | **Capture** — photograph a sign/menu, OCR it, review the extracted lines, add                                                       | v1.1 | `2020` (survival mode) |

### The tagging sheet — the connective thread (`P2-20…P2-26`)

| ID    | Requirement                                                                                                          | Rel | Source                                 |
| ----- | -------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------------- |
| P2-20 | Bottom sheet on add: phrase + audio, then difficulty, then tags, then confirm                                        | v1  | `366–418`                              |
| P2-21 | **Difficulty**: `easy` (Easy) · `med` (Learning, default) · `hard` (Difficult)                                       | v1  | `2327–2331`, `2397–2401`               |
| P2-22 | **"What's tricky about it?"** multi-select tags: Pronunciation · Hard to remember · Very useful ⭐ · Tricky words 🔤 | v1  | `2332–2339`                            |
| P2-23 | Tags and difficulty are editable forever, from the sheet or the detail screen                                        | v1  | `2445–2446`, `474–507`                 |
| P2-24 | Difficulty and tags drive: stream repeat count, queue rank, review card type, prosody priority, and progress rollups | v1  | `681`, `838`, `2526–2527`, `2769–2774` |
| P2-25 | "In your stream" horizontal strip of recently added phrases, chip-coloured by difficulty, tap to re-open             | v1  | `343–364`, `2382–2395`                 |
| P2-26 | Remove from stream, from the sheet or detail                                                                         | v1  | `413–415`, `573`                       |

### Phrase detail (`P2-30…P2-40`)

| ID    | Requirement                                                                                     | Rel | Source                 |
| ----- | ----------------------------------------------------------------------------------------------- | --- | ---------------------- |
| P2-30 | One source of truth per phrase; every list in the app opens this screen                         | v1  | `435–585`              |
| P2-31 | Spanish, English, and phonetic respelling (e.g. `DON-deh es-TAH lah pah-RAH-dah deh TAHK-sees`) | v1  | `448–451`, `2886`      |
| P2-32 | **Hear it** (normal, rate 0.92) and **Slow** (rate 0.6)                                         | v1  | `454–457`, `2499`      |
| P2-33 | **Word by word** — tappable chips with gloss, each speaking its own word                        | v1  | `459–471`, `2887`      |
| P2-34 | Difficulty and tag editors, identical to the add sheet                                          | v1  | `473–507`              |
| P2-35 | **In context** — a longer example sentence using the phrase                                     | v1  | `509–517`, `2888`      |
| P2-36 | **Memory hook** — user note, with three generated suggestions when empty                        | v1  | `519–536`, `2453–2460` |
| P2-37 | **Add related to your stream** — same-theme phrases not yet added, inline-addable               | v1  | `538–559`, `2461–2462` |
| P2-38 | Status row: Learning / Learned, next review date, and a "Mark learned" toggle                   | v1  | `561–569`              |
| P2-39 | Love (♥) toggle — surfaces the phrase more often                                                | v1  | `443`, `2448`          |
| P2-40 | **Practice now →** jumps straight into a session focused on this phrase                         | v1  | `574`                  |

---

## Phase 3 — Practice daily

> _Three ways to drill — all reading from the same stream, all shaped by your tags._
> `Loro.dc.html:592–828`

All practice surfaces implement one `PracticeEngine` contract:
[practice-engines.md](../architecture/practice-engines.md).

### Adaptive stream — hands-free listening (`P3-01…P3-12`)

| ID    | Requirement                                                                                      | Rel | Source                                             |
| ----- | ------------------------------------------------------------------------------------------------ | --- | -------------------------------------------------- |
| P3-01 | Continuous playback of the queue with no interaction required                                    | v1  | `603–634`                                          |
| P3-02 | Each phrase repeats N times before advancing: `hard` → 4, `med` → 3, `easy` → 2                  | v1  | `2526`                                             |
| P3-03 | Repeat pips and a per-repetition progress bar                                                    | v1  | `617–624`                                          |
| P3-04 | Transport: prev · play/pause · next, and a speed cycle (1× → 1.25× → 1.5× → 0.75×)               | v1  | `625–633`, `2557`                                  |
| P3-05 | Live re-rating during playback: Love · Easy / Learning / Difficult segmented control · ✓ Learned | v1  | `636–653`                                          |
| P3-06 | Queue rank = `plays + (hard: −6 · easy: +4) + (loved: −3)`, ascending                            | v1  | `2527`                                             |
| P3-07 | Re-rating re-ranks the live queue immediately, with a toast explaining the effect                | v1  | `2564`, `2571`                                     |
| P3-08 | ✓ Learned removes the phrase from the stream and advances                                        | v1  | `2576`                                             |
| P3-09 | **Up next** list with per-row love and difficulty controls, and tap-to-open-detail               | v1  | `655–672`                                          |
| P3-10 | Counters: ♥ loved · Difficult · Learned                                                          | v1  | `657`                                              |
| P3-11 | Background audio + lock screen / notification transport controls                                 | v1  | [audio-speech.md](../architecture/audio-speech.md) |
| P3-12 | Empty state when the stream has no unlearned phrases                                             | v1  | `2584–2595`                                        |

### Speak to progress (`P3-20…P3-28`)

| ID    | Requirement                                                                         | Rel | Source                 |
| ----- | ----------------------------------------------------------------------------------- | --- | ---------------------- |
| P3-20 | Prompt is the **English**; the Spanish is hidden word-by-word behind a blur         | v1  | `697–716`              |
| P3-21 | Each correctly pronounced word un-blurs, left to right, in order                    | v1  | `2674–2683`            |
| P3-22 | Matching is accent- and punctuation-insensitive, and tolerates ASR word insertions  | v1  | `2653`, `2678`         |
| P3-23 | **Next is locked** until the whole phrase has been produced — not merely recognised | v1  | `737`, `2737`          |
| P3-24 | Hint reveals and speaks the next word; hints reduce the 3-star result               | v1  | `2685–2696`            |
| P3-25 | Graceful degradation with no ASR available: mic tap reveals a word instead          | v1  | `2661`, `2729`         |
| P3-26 | "Hear the answer" is always available                                               | v1  | `700`                  |
| P3-27 | Live listening indicator, transcript echo (`heard: "…"`), and per-state status copy | v1  | `717–730`, `2708–2716` |
| P3-28 | Deck progress bar and counter                                                       | v1  | `691–695`              |

### Review session — spaced repetition (`P3-30…P3-40`)

| ID    | Requirement                                                                                                                                              | Rel  | Source            |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------- |
| P3-30 | Recall → reveal → grade, one card at a time                                                                                                              | v1.1 | `759–801`         |
| P3-31 | Four grades: **Again** · **Difficult** · **Good** · **Easy**; the displayed intervals come from the real FSRS result, never the prototype's fixed labels | v1.1 | `2790–2795`       |
| P3-32 | Grades write back to difficulty and reps; 4× Easy at reps ≥3 marks the phrase learned                                                                    | v1.1 | `2759`            |
| P3-33 | **Tag-driven focus banner**: Pronunciation → say it out loud; Hard to remember → use the hook; Very useful → worth nailing; else → plain recall          | v1.1 | `2769–2774`       |
| P3-34 | Pronunciation-tagged cards prompt "Say this in Spanish" and auto-play audio on reveal                                                                    | v1.1 | `2802–2806`       |
| P3-35 | Hard-to-remember cards surface the memory hook on reveal                                                                                                 | v1.1 | `776–778`, `2786` |
| P3-36 | Card chrome shows theme and current difficulty                                                                                                           | v1.1 | `766–767`         |
| P3-37 | Deck ordering by `reps + (hard: −5 · easy: +3)` ascending                                                                                                | v1.1 | `2749–2750`       |
| P3-38 | Session complete: count reviewed, % recalled well, streak, next due                                                                                      | v1.1 | `804–816`         |
| P3-39 | Progress bar and `n / total` counter                                                                                                                     | v1.1 | `753–757`         |
| P3-40 | "Review again" restarts with a freshly built deck                                                                                                        | v1.1 | `2767`            |

---

## Phase 3+ — Advanced practice (Loop A extensions)

> _Four sophisticated alternatives to the daily drill — pick the depth that fits the moment._
> `Loro.dc.html:833–1297`. All four read from the same tagged stream.

### A · Roleplay — AI conversation simulator (`P3A-01…P3A-10`)

| ID     | Requirement                                                                           | Rel  | Source                                           |
| ------ | ------------------------------------------------------------------------------------- | ---- | ------------------------------------------------ |
| P3A-01 | A scene with place, city, and NPC role (e.g. Café Central, Madrid, Camarero)          | v1.1 | `2914`                                           |
| P3A-02 | Turn-by-turn chat: NPC line (Spanish + English), then the learner's reply             | v1.1 | `865–893`                                        |
| P3A-03 | Three reply options per turn, each with an audio preview before sending               | v1.1 | `902–913`                                        |
| P3A-04 | One option per turn is the "best" / most native; picking it is acknowledged as such   | v1.1 | `2917`, `2969`                                   |
| P3A-05 | Coach note after every reply — "Loro · that's how a local says it" or a coaching note | v1.1 | `895–900`                                        |
| P3A-06 | **Speak your own reply** — free speech matched against the options                    | v1.1 | `914–931`                                        |
| P3A-07 | Turn pips showing progress through the scene                                          | v1.1 | `853–862`                                        |
| P3A-08 | Scene recap: turns · natural lines · fluency %                                        | v1.1 | `935–948`                                        |
| P3A-09 | Scene topic selection is biased by the learner's tags and themes                      | v1.1 | `838`                                            |
| P3A-10 | Scenes are LLM-generated and cached, with a bundled fallback set                      | v1.1 | [ai-services.md](../architecture/ai-services.md) |

### B · Memory model — the visible forgetting curve (`P3B-01…P3B-08`)

| ID     | Requirement                                                                            | Rel  | Source              |
| ------ | -------------------------------------------------------------------------------------- | ---- | ------------------- |
| P3B-01 | Five-point self-rated confidence: Forgot · Shaky · OK · Strong · Instant               | v1.1 | `2993–2999`         |
| P3B-02 | Stability multipliers `0.35 / 0.9 / 1.7 / 2.7 / 4.3`, scaled by prior reps             | v1.1 | `2994–2998`, `3025` |
| P3B-03 | Live-redrawing retention curve `R(t) = 0.5^(t/S)` with the 50% review threshold marked | v1.1 | `3010–3019`         |
| P3B-04 | Read-outs: strength (days) · recall at +7 d · next review                              | v1.1 | `1006–1010`, `3027` |
| P3B-05 | Human interval formatting: `~10 min` · `tomorrow` · `N days` · `N wks`                 | v1.1 | `3009`              |
| P3B-06 | Explanatory copy tying the curve to the schedule                                       | v1.1 | `1003`, `3041`      |
| P3B-07 | Reveal gate before rating                                                              | v1.1 | `975–987`           |
| P3B-08 | "Schedule & next card" commits the interval                                            | v1.1 | `1032–1034`         |

### C · Pronunciation lab — per-syllable scoring (`P3C-01…P3C-08`)

| ID     | Requirement                                                                                         | Rel  | Source                   |
| ------ | --------------------------------------------------------------------------------------------------- | ---- | ------------------------ |
| P3C-01 | Record the phrase; get a per-syllable accuracy score                                                | v1.1 | `1066–1076`, `3089–3095` |
| P3C-02 | Syllable chips colour-banded: ≥85 green · ≥70 amber · <70 red                                       | v1.1 | `3083`, `3092–3093`      |
| P3C-03 | Tapping a syllable speaks that word                                                                 | v1.1 | `3094`                   |
| P3C-04 | Your waveform rendered against a native reference waveform                                          | v1.1 | `1078–1088`              |
| P3C-05 | Overall score as a conic-gradient ring, with a verdict (`¡Excelente!` / `Casi` / `Keep practising`) | v1.1 | `1090–1099`, `3115–3116` |
| P3C-06 | Exactly one concrete, actionable fix per phrase (e.g. _"the double rr needs a real roll"_)          | v1.1 | `3053`, `3056`, `3059`   |
| P3C-07 | "Hear native" reference playback                                                                    | v1.1 | `1063`                   |
| P3C-08 | Re-record and next-phrase controls                                                                  | v1.1 | `1103–1108`              |

### D · Prosody lab — the hero loop (`P3D-01…P3D-14`)

> _The prompt strips its cues as you improve — text → meaning → cold — and that "level up" is the
> reward._ `Loro.dc.html:1294`

| ID     | Requirement                                                                                                                                         | Rel  | Source                   |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------ |
| P3D-01 | **Cue ladder** with four levels: Listen & repeat → From text → From meaning (5 s timer) → Cold recall (3 s timer)                                   | v1.1 | `3142–3147`              |
| P3D-02 | Cue level rises when a take scores ≥88; the level-up is celebrated _as a removal of help_                                                           | v1.1 | `3184`, `1254–1258`      |
| P3D-03 | Prompt content is cue-dependent: full text · meaning only · nothing                                                                                 | v1.1 | `1146–1168`, `3266`      |
| P3D-04 | Model audio is offered **only** at cue level 0                                                                                                      | v1.1 | `3267`                   |
| P3D-05 | Maturity bar showing progress through the cue ladder                                                                                                | v1.1 | `1133–1141`, `3264`      |
| P3D-06 | **Pitch contour** — your F0 traced against a native's, with off-target points marked                                                                | v1.1 | `1191–1211`, `3218–3220` |
| P3D-07 | **Trace** playback: a synchronised cursor across both contours                                                                                      | v1.1 | `1202–1206`, `3221–3229` |
| P3D-08 | **Rhythm & stress** — per-syllable stress and duration bars, yours vs native                                                                        | v1.1 | `1212–1226`, `3242–3245` |
| P3D-09 | **Three skill axes** per phrase: Perception · Recall · Production, each advancing differently                                                       | v1.1 | `1171–1183`, `3180–3182` |
| P3D-10 | Melody score with a delta against your previous take ("+7 clearer than last time")                                                                  | v1.1 | `1230–1245`, `3278–3279` |
| P3D-11 | Sparkline of the last 6 takes                                                                                                                       | v1.1 | `1246–1251`, `3253`      |
| P3D-12 | **Excluded as authored:** "Hear myself, perfectly" cannot upload a learner recording; reconsider only if a truthful on-device implementation exists | —    | `1264`, `3201–3206`      |
| P3D-13 | Targeted remediation offer when a take is weak                                                                                                      | v1.1 | `1267–1273`              |
| P3D-14 | 🔒 **Promise:** "Private — your audio stays on your device" — displayed, therefore binding                                                          | v1.1 | `1281`                   |

---

## Loop B — The Daily Refrain (v1 hero)

> _A small fixed set each day, repeated in waves until it's automatic. No hidden scheduler — you
> always see today._ `Loro.dc.html:1302–1539`

### Today — the ritual surface (`LB-01…LB-10`)

| ID    | Requirement                                                                                                                                                      | Rel | Source                                         |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ---------------------------------------------- |
| LB-01 | A **closed, finite set** for today (default 5), fully visible and finishable                                                                                     | v1  | `1326–1340`                                    |
| LB-02 | Per-phrase automaticity bar, day counter (`day n/4`), and a LOCKED badge at 100%                                                                                 | v1  | `1330–1337`                                    |
| LB-03 | **Three waves** across the day — Morning (meet & first reps) · Midday (re-rep, from memory) · Evening (cold + perform) — with times and done/ready/locked states | v1  | `1343–1354`, `3306–3310`                       |
| LB-04 | Completion label: "n of 5 locked in"                                                                                                                             | v1  | `1327`, `3332`                                 |
| LB-05 | **Ambient loop** — hands-free all-day looping of today's set                                                                                                     | v1  | `1356–1367`                                    |
| LB-06 | **Rolling window**: a fading tail of yesterday's phrases with days-left, plus a count of graduated & banked phrases                                              | v1  | `1369–1381`                                    |
| LB-07 | Streak chip, warm and central but never punitive                                                                                                                 | v1  | `1319–1322`                                    |
| LB-08 | CTA is the next incomplete wave                                                                                                                                  | v1  | `1384–1386`                                    |
| LB-09 | Tapping a phrase in the set speaks it                                                                                                                            | v1  | `3323`                                         |
| LB-10 | Set composition is chosen by the scheduler from due + weak + new phrases                                                                                         | v1  | [scheduling.md](../architecture/scheduling.md) |

### The Refrain — the repetition hero (`LB-20…LB-32`)

| ID    | Requirement                                                                                                                                                   | Rel | Source                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --------------------------- |
| LB-20 | One phrase at a time; a rotating **mode per rep**: Echo → Chorus → Speed → Cloze → Call → Cold                                                                | v1  | `3353–3360`                 |
| LB-21 | Mode strip showing done / current / upcoming modes                                                                                                            | v1  | `1422–1434`, `3400`         |
| LB-22 | Mode-specific display: full text · cloze with a gap · native-language cue · nothing but a hook                                                                | v1  | `1440–1455`, `3407`         |
| LB-23 | Mode-specific model audio: Echo/Chorus at 0.95×, Speed at 1.15×, none for Cloze/Call/Cold                                                                     | v1  | `3375`                      |
| LB-24 | Mode-specific mic label: Say it · Chorus it · Faster! · Fill & say · Respond · Say it cold                                                                    | v1  | `3415`                      |
| LB-25 | **The warming card** — the hero metaphor. Background and text warm cold-blue → cream → peach → hot coral across four automaticity bands (0/33/66/100)         | v1  | `3392–3396`                 |
| LB-26 | **Automaticity meter** — `round(reps / 6 × 100)%`, animated                                                                                                   | v1  | `1459–1464`, `3378`         |
| LB-27 | **Falling effort** — a latency read-out that drops with reps, plus an effort-history bar chart and a plain-language label ("warming up" → "instant & smooth") | v1  | `1465–1472`, `3377`, `3411` |
| LB-28 | A visible **beat** — animated bars whose tempo changes in Speed mode (0.34 s vs 0.72 s)                                                                       | v1  | `1476–1482`, `3414`         |
| LB-29 | Rep dots out of the target (6) and set dots for the 5 phrases                                                                                                 | v1  | `1483–1491`, `1412–1418`    |
| LB-30 | **Lock-in** at 100%: 💎 "It comes out without thinking now"                                                                                                   | v1  | `1503–1506`                 |
| LB-31 | Overlearning: the target is past first success, deliberately                                                                                                  | v1  | `1536`, `3361`              |
| LB-32 | Completion ritual: locked-in count · reps today · streak · one phrase **graduated** out of rotation                                                           | v1  | `1516–1531`                 |

---

## Loop C — The Roguelike Run (v2)

> _A bounded run: a fixed spine plus one finisher dealt from a deck. Every phrase climbs a five-rung
> ladder — and you never lose what you earned._ `Loro.dc.html:1543–1774`

| ID    | Requirement                                                                                                                                                                              | Rel | Source                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------ |
| LC-01 | **Five-rung ladder**: Accumulated → Bent → Transferred → Pressure-tested → Deployed                                                                                                      | v2  | `3429–3435`              |
| LC-02 | **Four finisher cards**, each advancing one specific rung: the Rally (Bend) · the Curveball (Transfer) · the Gauntlet (Pressure) · the Sportscaster (Deploy)                             | v2  | `3436–3442`              |
| LC-03 | Cards unlock only when the deck contains a phrase at the required rung                                                                                                                   | v2  | `3466`, `3524`           |
| LC-04 | **Run structure**: ready → spine → reveal → finisher → wrap                                                                                                                              | v2  | `3459`, `1576–1693`      |
| LC-05 | **Spine step 1** — re-fire the chain: recite phrases in rotation (retrieval as warm-up)                                                                                                  | v2  | `1606–1616`              |
| LC-06 | **Spine step 2** — intake: meet today's new phrase and fold it onto the chain immediately                                                                                                | v2  | `1617–1627`              |
| LC-07 | **The Draw** — a real shuffle animation, then a dealt card, constrained to eligible cards and biased toward weak spots (`need = stale×2 + stumbles`)                                     | v2  | `3467`, `3479–3488`      |
| LC-08 | One redraw per run                                                                                                                                                                       | v2  | `3489`, `1653`           |
| LC-09 | **Finisher beats** per card type — Bend: return it, as a question, in the past; Transfer: same phrase in an unexpected place; Pressure: calm → impatient → noisy; Deploy: free narration | v2  | `3492–3499`              |
| LC-10 | Felt-progress label per beat ("Rally ×2", "Round 3 survived")                                                                                                                            | v2  | `3533`                   |
| LC-11 | **Wrap** — the climb: from-rung → to-rung, with "✓ Nothing lost — you only climb or hold"                                                                                                | v2  | `1679–1693`, `3506–3515` |
| LC-12 | **Phrasebook / Collection** — every phrase with its rung pips, sortable by rung or by needs-work                                                                                         | v2  | `1704–1773`, `3537–3542` |
| LC-13 | **Ladder distribution** chart — the histogram that _is_ the learner's real ability                                                                                                       | v2  | `1716–1728`, `3535`      |
| LC-14 | Needs-refresh flags for stale or repeatedly stumbled phrases; 🏆 for Deployed                                                                                                            | v2  | `3541`                   |
| LC-15 | Recent climbs feed                                                                                                                                                                       | v2  | `1758–1766`, `3512`      |

---

## Loop D — Guided open chat (v1.1 supplementary)

> _Talk first, take it apart after._ `Loro Chat.dc.html:91–99`

Loop D is an optional conversation surface, not a fourth daily-practice engine and never a
provider-dependent core loop. Its usable floor is a bundled, finite topic graph. A guarded live text
provider may make replies less repetitive when policy, budget, and safety gates pass.

| ID     | Requirement                                                                                                                                                                                                                                | Rel  | Source                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | --------------------------------------------------------------------------- |
| P3E-01 | Open chat offers an explicit topic and Loro pace; authored topics include Morning talk, At the café, Weekend plans, and Asking directions, with **Natural** or **Slow + English** pace                                                     | v1.1 | `Loro Chat.dc.html:108–114`, `269–289`, `456–459`                           |
| P3E-02 | The thread distinguishes Loro and learner turns, keeps Spanish primary, anchors new turns at the bottom, and selects only one line for contextual actions                                                                                  | v1.1 | `Loro Chat.dc.html:116–162`, `604–635`                                      |
| P3E-03 | English is hidden by default and revealed or hidden for one line at a time through **EN**; changing pace to Slow + English changes actual help/playback policy                                                                             | v1.1 | `Loro Chat.dc.html:123–155`, `327`, `646–666`                               |
| P3E-04 | A learner can compose, edit, and send a non-empty Spanish text turn; empty input has no send action                                                                                                                                        | v1.1 | `Loro Chat.dc.html:242–262`, `674–677`                                      |
| P3E-05 | **Ways to answer** exposes three editable suggestions with English/register, preview audio, direct send, **Others**, and **Hide**                                                                                                          | v1.1 | `Loro Chat.dc.html:172–196`, `668–673`                                      |
| P3E-06 | Voice input supports hold-to-talk, tap/slide-to-lock where available, cancel/Done, a final **Heard you say** confirmation, Again, and explicit Send                                                                                        | v1.1 | `Loro Chat.dc.html:208–240`, `251–260`, `678–684`                           |
| P3E-07 | A submitted turn enters a real pending state and resolves from the current thread/topic; cancellation, late-result protection, honest failure, and bundled degradation replace fake delay                                                  | v1.1 | `Loro Chat.dc.html:163–169`, `576–588` (prototype timing is non-production) |
| P3E-08 | Selecting a Loro line exposes independent **Hear · EN · Save · Open** actions; selecting a learner line exposes **Say again · EN · Save · Open/Fix**                                                                                       | v1.1 | `Loro Chat.dc.html:118–162`                                                 |
| P3E-09 | A high-confidence draft correction may be offered before send and applied explicitly; changed/stale or low-confidence text is never silently rewritten                                                                                     | v1.1 | `Loro Chat.dc.html:198–206`, `641–643`, `674–677`                           |
| P3E-10 | Topic/pace and kept-line Sheets dismiss without losing the thread; **Start over** deliberately clears retained turns, while interruption/relaunch resumes the durable draft/thread                                                         | v1.1 | `Loro Chat.dc.html:265–318`, `523–538`                                      |
| P3E-11 | Message inspector identifies Loro/You and position, returns to chat, and steps previous/next through the same durable thread                                                                                                               | v1.1 | `Loro Chat.dc.html:331–345`, `686–710`                                      |
| P3E-12 | Inspector shows the full Spanish line plus available English and respelling, with real normal/slow playback and Say again for learner turns                                                                                                | v1.1 | `Loro Chat.dc.html:347–365`, `689–695`                                      |
| P3E-13 | A learner-line correction shows count, plain diff, category, explanation, fixed line and preview; **Use it & keep the fix** is one explicit, idempotent handoff that preserves the original evidence                                       | v1.1 | `Loro Chat.dc.html:367–398`, `696–700`                                      |
| P3E-14 | Inspector exposes alternative phrasings with English/register, per-item playback/save, word glosses, and a contextual explanation when supplied                                                                                            | v1.1 | `Loro Chat.dc.html:400–434`, `701–709`                                      |
| P3E-15 | Saving/removing an original, fixed, or alternative line is explicit and deduplicated; kept lines enter the same phrase repository/stream as every learner-owned phrase                                                                     | v1.1 | `Loro Chat.dc.html:293–318`, `542–565`                                      |
| P3E-16 | Kept lines can be queued explicitly for today's Review with a real singular/plural count; the handoff cannot fabricate progress or a due interval                                                                                          | v1.1 | `Loro Chat.dc.html:293–316`, `538`                                          |
| P3E-17 | Threads are private/local by default, survive ordinary interruption under the chosen retention policy, never enter analytics or normal phrase sync, and recorded audio never leaves the device                                             | v1.1 | `Loro Chat.dc.html:95–99`; privacy extension required by `P3D-14`           |
| P3E-18 | Every topic has a useful bundled offline path; live text is bounded, budgeted, schema/safety validated, and honestly degraded. Prototype regex corrections, timed canned replies, browser speech, and fabricated recognition are forbidden | v1.1 | `Loro Chat.dc.html:456–588` (prototype mechanisms explicitly rejected)      |

---

## Phase 4 — Stay on track

> _See it add up — and steer what comes next._ `Loro.dc.html:1778–1883`

| ID    | Requirement                                                                                                           | Rel | Source                   |
| ----- | --------------------------------------------------------------------------------------------------------------------- | --- | ------------------------ |
| P4-01 | Range toggle: **Week** / **All time**                                                                                 | v1  | `1792–1795`              |
| P4-02 | Streak card: current streak, best streak, and a 7-day dot strip                                                       | v1  | `1799–1815`              |
| P4-03 | Three headline stats — minutes listened · phrases in stream · reviews done                                            | v1  | `1817–1824`              |
| P4-04 | **Phrase mastery** stacked bar over four states: New · Learning · Strong · Mastered, bucketed by `reps` and `learned` | v1  | `1826–1840`, `2828`      |
| P4-05 | **"What's tricky in your stream"** — a rollup of the learner's own tags, bar-charted                                  | v1  | `1842–1857`, `2851–2853` |
| P4-06 | Tapping a tricky category starts a drill of exactly those phrases                                                     | v1  | `2853`                   |
| P4-07 | **Milestones** — first 10 phrases · 7-day streak · first pack complete · 25 mastered, with earned/unearned styling    | v1  | `1859–1870`, `2854–2859` |
| P4-08 | Nothing on this screen shames a missed day                                                                            | v1  | Design principle         |

---

## Phase 5 — The trip arc

> _When you're learning for a real date, the whole app reorganises around the countdown._
> `Loro.dc.html:1887–2059`. Full detail: [trip-arc.md](trip-arc.md).

| ID    | Requirement                                                                                                            | Rel  | Source      |
| ----- | ---------------------------------------------------------------------------------------------------------------------- | ---- | ----------- |
| P5-01 | **Set the arrival** — destination (with a Spanish variant), arrival date, trip type (Vacation · Work · Family)         | v1   | `1895–1925` |
| P5-02 | **Countdown home** replaces the normal home while a trip is active: days-to-go, phrase-ownership progress (`38 / 100`) | v1   | `1928–1956` |
| P5-03 | **Today's drop** — a themed pack of ~8 phrases per day, one tap into the stream                                        | v1   | `1941–1949` |
| P5-04 | **Escalating drop schedule** — survival basics first, "sound local" extras as the date nears                           | v1   | `1981`      |
| P5-05 | Drop screen: unlock reveal, per-phrase check state, "Add 8 & load into today's stream"                                 | v1   | `1958–1982` |
| P5-06 | **Lock screen widget / Live Activity** — countdown, ownership ring, and a phrase of the moment that plays in one tap   | v1   | `1984–2010` |
| P5-07 | Urgency without guilt in all countdown copy                                                                            | v1   | `2009`      |
| P5-08 | **Survival mode flips on landing**: offline survival deck reordered by immediate need                                  | v1   | `2012–2031` |
| P5-09 | Capture is promoted to a primary action while abroad                                                                   | v1   | `2020`      |
| P5-10 | Offline indicator and full offline function while travelling                                                           | v1   | `2017`      |
| P5-11 | **Souvenir** — phrases used for real, new captures, essentials %, streak                                               | v1   | `2034–2058` |
| P5-12 | Trip set **graduates** into long-term spaced review, closing the arc                                                   | v1   | `2047–2051` |
| P5-13 | Share recap, and plan next trip                                                                                        | v1.1 | `2052`      |

---

## Cross-cutting: audio, speech, and AI

| ID    | Requirement                                                                                                                                                                                                                                                                    | Rel  | Notes                                                                                                                                                                                                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AS-01 | Native-quality Spanish TTS for every phrase, cached on device                                                                                                                                                                                                                  | v1   | Pre-rendered per phrase; on-device TTS fallback                                                                                                                                                                                                                                              |
| AS-02 | Variable playback rate (0.6× – 1.5×) preserving pitch                                                                                                                                                                                                                          | v1   |                                                                                                                                                                                                                                                                                              |
| AS-03 | On-device ASR for Spanish, with reveal mode when recognition is unavailable                                                                                                                                                                                                    | v1   | [ADR-0005](../architecture/adr/0005-on-device-asr-cloud-fallback.md)                                                                                                                                                                                                                         |
| AS-04 | Background audio, lock screen transport, ducking, and interruption recovery                                                                                                                                                                                                    | v1   | [audio-speech.md](../architecture/audio-speech.md)                                                                                                                                                                                                                                           |
| AS-05 | Pitch (F0) extraction and contour comparison on-device                                                                                                                                                                                                                         | v1.1 | [prosody-dsp.md](../architecture/prosody-dsp.md)                                                                                                                                                                                                                                             |
| AS-06 | Forced alignment of the learner's audio to the expected syllables                                                                                                                                                                                                              | v1.1 |                                                                                                                                                                                                                                                                                              |
| AS-07 | Generate licensed multi-voice listening takes online, cache each phrase×voice clip on device, and listen offline from that cache; optionally concatenate cached clips into one AAC/M4A for an external player. Each phrase repeats several times with distinct licensed voices | v1   | Listening companion, not practice; never includes learner recordings; does not replace `AS-01` reference audio. First render needs network; cache hits do not. Share-out-of-app waits on [Q-22](../decisions/open-questions.md#q-22). [plan 99](../../plans/99-batch-phrase-audio-export.md) |
| AI-01 | LLM roleplay scene generation and coach notes                                                                                                                                                                                                                                  | v1.1 | [ai-services.md](../architecture/ai-services.md)                                                                                                                                                                                                                                             |
| AI-02 | LLM-assisted phrase enrichment (respelling, gloss, example, hook) at content-authoring time                                                                                                                                                                                    | v1   | Offline pipeline, human-reviewed                                                                                                                                                                                                                                                             |
| AI-03 | Translation and normalisation for imported and captured lines                                                                                                                                                                                                                  | v1.1 |                                                                                                                                                                                                                                                                                              |
| AI-04 | Reserved; no implementation may upload recorded learner audio                                                                                                                                                                                                                  | —    | P3D-12 remains excluded unless a real on-device design exists                                                                                                                                                                                                                                |
| AI-05 | Every learner-visible AI path is bounded, rate-limited, schema/safety validated, and has a useful bundled fallback; cache only where privacy and semantics permit                                                                                                              | v1.1 | Open chat remains subject to `P3E-17`…`P3E-18`                                                                                                                                                                                                                                               |
| AI-06 | Guarded Discover phrase suggestions: catalog-first, marked own-phrase candidates, explicit add; live traffic gated by Q-21                                                                                                                                                     | v1.1 | [plan 97](../../plans/97-generative-discover-and-phrase-reach.md)                                                                                                                                                                                                                            |

## Cross-cutting: notifications

| ID   | Requirement                                                               | Rel | Notes                                |
| ---- | ------------------------------------------------------------------------- | --- | ------------------------------------ |
| N-01 | One daily practice reminder at a learner-chosen time                      | v1  | Local notification, no server needed |
| N-02 | Wave reminders in Loop B (morning / midday / evening) — opt-in, max 3/day | v1  |                                      |
| N-03 | Trip drop notification each morning while a trip is active                | v1  |                                      |
| N-04 | Absolutely no guilt, streak-loss, or re-engagement-bait copy              | v1  | 🔒 Product principle                 |

---

## Explicitly out of scope for v1

| Not doing                              | Why                                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Social features, leaderboards, friends | Not in the blueprint; conflicts with the no-shame stance                                              |
| Other target languages                 | Architecture is ready; content and voice work are not ([localization.md](../process/localization.md)) |
| Tablet / iPad layouts                  | Blueprint is phone-only (344×732 and 320×680 frames)                                                  |
| Web app                                | Blueprint's `@media (max-width:860px)` rules are for the _blueprint canvas_, not a product surface    |
| Teacher / classroom tooling            | Non-persona ([personas.md](personas.md))                                                              |
| Grammar exercises                      | Anti-goal ([vision.md](vision.md))                                                                    |
| Dark theme                             | v1.1 — the blueprint palette is single-mode warm light                                                |
