# Offline behaviour

Offline-first is the product contract. Runtime progress is durable; native audio acceptance remains
a gate.

## Current state

The app hydrates learner progress, settings and course/session state from SQLite. Native uses
OP-SQLite; web uses SQL.js with atomic persistent snapshots and an exclusive tab lock. Repository
writes and outbox changes commit together before rendering. Database errors preserve prior state and
offer recovery rather than automatic reset.

Authenticated client sync replays the durable outbox and applies canonical Rust merges locally. The
API uses Postgres for account state, sync rows, revision cursors and idempotency receipts. No
practice action waits for the API. Native foreground TTS and on-device recognition are implemented,
with reveal-mode degradation. The listening-class file cache and `/listen-export` composer exist;
Q-15 leaning pins enable licensed generate when native cache exists and ElevenLabs (or labeled
`TTS_STUB_RENDER`) is configured; share-out-of-app remains Q-22, and
physical-device airplane-mode listen of a previously cached licensed batch remains an evidence gate
(58/72). An Android emulator has played a labeled development fixture from that cache with no
network. Approved catalog audio clips/cache, background playback, DSP, widgets and the native
device-floor acceptance matrix remain open. See
[setup and verified limits](../process/persistent-practice.md).

## The acceptance test

> In airplane mode, force-quit and relaunch the native app. Implemented daily practice and survival
> content must be usable from durable local state without a network error or sync spinner; every
> promised audio asset must play from disk.

Measure the launch budget on the physical device floor; the Android emulator cold-launch smoke
proves persistence but does not replace that performance matrix. Do not mark the gate green with web
storage, a warm JavaScript process or mocked network responses.

<a id="2--there-is-no-offline-mode"></a>

## Offline contract for new work

### Local writes finish locally

A learner action may wait for its SQLite transaction, because durable local storage is the action.
It must not wait for HTTP, authentication refresh, analytics or asset upload. For a syncable change,
the row update and outbox append commit in the same transaction.

The mobile learner-storage adapter owns this transaction. The Zustand store publishes only the
committed repository projection; disk failure leaves the prior projection and outbox intact.

### Local state renders the UI

Screens render from the local store/database. Network responses may update local state and trigger a
normal re-render; they are never a required read-through cache for practice. There is no separate
“offline mode” for local features and no practice-screen banner implying that practice is degraded.

The blueprint's `✈ OFFLINE` survival indicator is reassurance about a fully available local deck,
not evidence that the current app implements that deck.

### Server-only work degrades honestly

Sign-in, purchase verification, sync and genuinely server-only generation may be unavailable. The UI
must distinguish “queued”, “not downloaded” and “requires connection”; it must not display a fake
success or a fabricated score. Plan 99 listening generation is server-only on a cache miss: first
prepare needs network; a verified on-disk batch then plays in airplane mode. Imported/captured
content can become usable locally only when its local parsing/capture implementation actually
exists.

Recorded audio never enters a deferred upload queue. Cloud ASR and every other recorded-audio upload
are prohibited by the learner-facing promise and ADR-0011; consent is not an exception.

Open chat is usable offline from versioned authored topic/reply graphs, including answer
suggestions, translations and inspector material. The graphs are the production floor for the two
surfaces in `Loro Chat.dc.html:95–449`, not timer-driven canned replies. A live guarded text
provider may improve a turn when reachable, but entry, multiple coherent turns, inspection and
explicitly keeping a line cannot depend on it. Provider failure cancels the stale request and
continues the local graph without a decorative delay or a fabricated “AI is typing” result.

Voice chat follows the normal native degradation order: on-device ASR, an honest unavailable state,
then text input. Recorded audio remains in native memory. Reference playback uses downloaded assets
when present and approved on-device Spanish speech for arbitrary lines; the browser speech API and
canned transcript in `ChatLogic` are prototype-only (`Loro Chat.dc.html:514`, `529–531`).

## Target capability matrix

This is a delivery checklist, not a claim about current behaviour.

| Capability                         | Required offline result                               | Current implementation                                                                                                         |
| ---------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Implemented text screens/catalog   | Navigate and read bundled content                     | Bundled native/web content with cold-launch persistence                                                                        |
| Learner state and progress         | Persist across force-quit and device restart          | SQLite runtime; Android force-stop and browser reload verified                                                                 |
| Review scheduling                  | Plan and record locally from authoritative core maths | Canonical Rust scheduling and transactional writes                                                                             |
| Audio for owned/daily/trip phrases | Play verified local assets                            | Foreground device TTS; recorded cache/prefetch remain                                                                          |
| Listening companion (`AS-07`)      | Play a previously cached phrase×voice batch from disk | Composer/cache landed; emulator fixture listen evidenced; Q-15 pins enable generate with native cache + ElevenLabs or `TTS_STUB_RENDER`; pronunciation review and live key remain (plan 99) |
| Speech/ASR/pronunciation/prosody   | Use on-device modules and real measurements           | Strict native ASR with reveal fallback; DSP/onset remain                                                                       |
| Sync                               | Queue locally and converge later                      | Authenticated Postgres/client replay and merge implemented                                                                     |
| Trips/widgets/notifications        | Derive from durable local calendar state              | Not implemented                                                                                                                |
| Open chat                          | Continue through bundled topic/reply graphs           | Authored prototype only; no route/domain/persistence                                                                           |
| Live AI/translation/purchase       | Degrade or defer with honest copy                     | Server-side pieces are partial or absent                                                                                       |

A feature may be documented as offline only after its asset/data dependencies, cold-launch path and
failure behaviour are implemented and tested.

## Target asset policy

When media support lands, assets required for the next practice surface must be on disk before the
surface promises availability. The intended priority order is:

1. bundled starter/survival content;
2. owned phrases and today's frozen Refrain set;
3. the active practice queue and complete trip set;
4. optional lab references and suggestions.

Pinned daily/trip/active-queue assets must not be evicted by ordinary LRU cleanup. Every cached
asset is content-addressed or otherwise integrity-checked; a metadata row without a usable file does
not count as prefetched. Exact caps and cellular thresholds should be set from measured native
behaviour when the cache exists, rather than preserved as unevidenced constants in architecture
documentation.

### ASR

The target degradation order is on-device recognition, an honest language-pack/download affordance,
then reveal mode. There is no cloud ASR fallback because recorded audio never leaves the device.

## Detecting connectivity

Connectivity affects scheduling, never correctness. A future connectivity service must combine OS
reachability with an API probe, treat captive portals as offline, and react to transitions rather
than poll continuously. Unknown connectivity may attempt a request; failure leaves durable work
queued.

The sync queue retries with bounded, jittered backoff and is never truncated to recover from an
error. Other deferred queues (translation, TTS, analytics, receipts) must have independent retention
and consent rules; they must not share the sync outbox by convenience.

## Extension invariants

1. **No network on a learner mutation path.** Persist locally, then schedule background work.
2. **No false offline claim.** A route is offline-capable only after cold restart with its required
   data/assets on disk.
3. **No fake fallback.** Latency and scores are measured or absent; missing media degrades to honest
   text/phonetics, never simulated success.
4. **No recorded-audio upload.** PCM stays in native memory and is released after local processing.
5. **No cache dependency for learner state.** Evicting reproducible media may be safe; learner
   progress, outbox rows and authored phrases are not cache entries.
6. **No partial durable mutation.** State and outbox commit together; disk-full failure leaves both
   unchanged and is reported honestly.
7. **No new native feature without offline tests.** Add cold-launch, airplane-mode, interrupted
   write and missing-asset coverage with the feature.
8. **No shaming through scheduling.** Offline notification/widget logic still follows the missed-day
   tone invariant.
9. **No provider-shaped chat floor.** Bundled graphs must complete useful turns and inspection on a
   cold offline launch; regex corrections, canned recognition and timer replies do not qualify.

## Verification required before v1

Native tests must cover cold launch in airplane mode, process death after local commit, process
death between attempted state/outbox operations, long offline replay, flaky/captive networks, disk
full, cache eviction under pressure, corrupt/missing media, trip completeness and sync
reconvergence. Until those tests exist, this document describes the contract and the remaining
integration work, not a shipped capability.
