# Offline behaviour

Offline-first is the product contract, not the current implementation state.

## Current state

The implemented learner screens can run in the Expo web target without the API because their catalog
and store state are in the JavaScript bundle/process. That is useful development behaviour, but it
is not durable offline support:

- the live Zustand store is in memory and is not hydrated from SQLite;
- no on-device SQLite driver or native composition root exists;
- no mobile sync client drains the outbox or applies pulls;
- audio playback, recording, ASR, DSP integration, widgets, prefetch and cache management are not
  implemented;
- the API's sync repository is in memory and loses rows on restart.

Consequently the cold-launch airplane-mode acceptance test below does **not** pass today. Browser
E2E coverage protects the implemented web states; it must not be cited as evidence for native
offline audio, microphone, durability or sync.

The persistence foundation does exist: `packages/core/src/persistence/` contains a driver-agnostic
SQLite schema, repositories and outbox tested against real SQLite. It becomes product behaviour only
after the app store writes through it, hydrates from it on launch, and a device driver exists.

## The acceptance test

> In airplane mode, force-quit and relaunch the native app. Implemented daily practice and survival
> content must be usable from durable local state without a network error or sync spinner; every
> promised audio asset must play from disk.

Measure the launch budget on the device floor once the native runtime exists. Do not mark the gate
green with web storage, a warm JavaScript process or mocked network responses.

<a id="2--there-is-no-offline-mode"></a>

## Offline contract for new work

### Local writes finish locally

A learner action may wait for its SQLite transaction, because durable local storage is the action.
It must not wait for HTTP, authentication refresh, analytics or asset upload. For a syncable change,
the row update and outbox append commit in the same transaction.

The current repositories and outbox can participate in one transaction, but they do not couple the
two calls and are not wired to the app. The mobile integration must provide a single mutation seam
so a screen cannot accidentally update one without the other.

### Local state renders the UI

Screens render from the local store/database. Network responses may update local state and trigger a
normal re-render; they are never a required read-through cache for practice. There is no separate
“offline mode” for local features and no practice-screen banner implying that practice is degraded.

The blueprint's `✈ OFFLINE` survival indicator is reassurance about a fully available local deck,
not evidence that the current app implements that deck.

### Server-only work degrades honestly

Sign-in, purchase verification, sync and genuinely server-only generation may be unavailable. The UI
must distinguish “queued”, “not downloaded” and “requires connection”; it must not display a fake
success or a fabricated score. Imported/captured content can become usable locally only when its
local parsing/capture implementation actually exists.

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

| Capability                         | Required offline result                               | Current implementation                                       |
| ---------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| Implemented text screens/catalog   | Navigate and read bundled content                     | Web process only; not restart-durable                        |
| Learner state and progress         | Persist across force-quit and device restart          | SQLite library exists; app wiring missing                    |
| Review scheduling                  | Plan and record locally from authoritative core maths | Engines exist; durable write path missing                    |
| Audio for owned/daily/trip phrases | Play verified local assets                            | Missing native audio/cache/prefetch                          |
| Speech/ASR/pronunciation/prosody   | Use on-device modules and real measurements           | Missing native modules                                       |
| Sync                               | Queue locally and converge later                      | Outbox and server endpoints exist separately; client missing |
| Trips/widgets/notifications        | Derive from durable local calendar state              | Not implemented                                              |
| Open chat                          | Continue through bundled topic/reply graphs           | Authored prototype only; no route/domain/persistence         |
| Live AI/translation/purchase       | Degrade or defer with honest copy                     | Server-side pieces are partial or absent                     |

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
