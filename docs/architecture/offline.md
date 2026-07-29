# Offline behaviour

The most important non-functional requirement in the product. A learner in a taxi rank in Madrid
with no data plan is the person Loro was built for.

---

## The acceptance test

> **Airplane mode. Force-quit the app. Relaunch. Survival mode must be fully usable in under two
> seconds — every phrase playable, every screen navigable, no error, no spinner.**

This is a release gate for v1 ([`product/roadmap.md`](../product/roadmap.md#m2--v1--7-weeks)), run
on the device floor, on a fresh launch with a cold cache warm-up path.

---

## What works offline

| Feature                         | Offline     | Notes                                                              |
| ------------------------------- | ----------- | ------------------------------------------------------------------ |
| Onboarding, all six steps       | ✅          | Starter packs are bundled in the binary                            |
| Add phrases — Discover, Browse  | ✅          | Full local catalog                                                 |
| Add phrases — Import (paste)    | ✅          | Parsing is local; translation deferred                             |
| Add your own                    | ✅          | Device TTS for audio                                               |
| Capture (photograph a sign)     | ✅          | On-device OCR; translation deferred                                |
| Rate, tag, love, mark learned   | ✅          | Writes locally, syncs later                                        |
| Phrase detail — everything      | ✅          | Word-by-word uses device TTS                                       |
| Adaptive stream                 | ✅          | Cached audio; the queue is local                                   |
| The Refrain, all 6 modes        | ✅          | On-device ASR                                                      |
| Speak to progress               | ✅          | On-device ASR, or reveal mode                                      |
| Review session                  | ✅          | FSRS runs locally                                                  |
| Memory model / curve            | ✅          | Curve maths is local                                               |
| Pronunciation lab               | ✅          | On-device DSP; needs the pack's `mfcc_ref` prefetched              |
| Prosody lab                     | ✅          | Same                                                               |
| The Run                         | ✅          |                                                                    |
| Progress, Phrasebook            | ✅          |                                                                    |
| Trip countdown, drops, widget   | ✅          | Drops prefetched at trip creation                                  |
| **Survival mode**               | ✅          | **The whole point**                                                |
| Souvenir                        | ✅          |                                                                    |
| Roleplay                        | ⚠️ Degraded | Bundled scenes ([ai-services.md](ai-services.md#bundled-fallback)) |
| Translation of imports/captures | ⚠️ Deferred | Queued; the phrase is usable untranslated                          |
| "Hear myself, perfectly" (v2)   | ❌          | Requires the server                                                |
| Sign-in, sync, purchase         | ❌          | Queued or blocked, with honest copy                                |

**Two things are genuinely unavailable offline**, and neither is in the daily loop.

---

## What "offline-first" means concretely

### 1 · No write ever waits on the network

```ts
async function rateDifficulty(id: PhraseId, d: Difficulty): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(userPhrase).set({ difficulty: d /* hlc… */ }).where(eq(userPhrase.id, id))
    await tx.insert(outbox).values({ entity: 'user_phrase', entityId: id, op: 'upsert' /* … */ })
  })
  // Returns here. Sync happens whenever it happens.
  syncService.scheduleFlush() // fire and forget
}
```

There is no code path in the app where a learner action awaits an HTTP response. Sync is a
background process draining a queue ([sync-protocol.md](sync-protocol.md)).

### 2 · There is no "offline mode"

The app doesn't switch modes. It behaves identically; only _sync_ and the two server-dependent
features notice. Concretely:

- No offline banner on practice screens. A banner implies degradation, and there isn't any.
- No greyed-out buttons on features that work.
- No retry prompts for things that will retry themselves.
- The `✈ OFFLINE` indicator in survival mode (`Loro.dc.html:2017`) is **informational reassurance**,
  not a warning: it tells the learner the deck they're holding works.

### 3 · Local state is authoritative

The device's SQLite is the source of truth ([data-model.md](data-model.md)). The server holds a copy
for other devices. No screen renders from a network response.

---

## Prefetch policy

Everything needed is on disk before it's needed. That requires deciding what "needed" means.

| Content                                                                         | When fetched                                  | Priority   |
| ------------------------------------------------------------------------------- | --------------------------------------------- | ---------- |
| **Bundled snapshot** — 6 starter packs, ~50 phrases + audio, 24 roleplay scenes | In the app binary                             | —          |
| Catalog metadata (all phrases, no audio)                                        | First launch, then on version change          | High       |
| Audio for owned phrases                                                         | On add                                        | High       |
| Audio for today's Refrain set                                                   | On day rollover                               | **Pinned** |
| Audio for the stream queue (next 20)                                            | Rolling, as the queue advances                | **Pinned** |
| **The entire trip set + audio**                                                 | At trip creation, before the countdown starts | **Pinned** |
| `mfcc_ref` for lab-enabled packs                                                | On first lab open, per pack                   | Medium     |
| Roleplay scenes for the learner's top 3 themes                                  | Opportunistically on wifi                     | Low        |
| Audio for suggested-but-not-added phrases                                       | Never                                         | —          |

**Pinned content is never LRU-evicted.** Today's set, the stream queue, and the trip set are exempt
from the 150 MB cache cap and are reported separately in Settings, so a learner can see why the app
is using space.

### Prefetch conditions

| Condition                | Behaviour                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| Wifi + charging          | Full prefetch, including low-priority                                                                |
| Wifi                     | High + medium priority                                                                               |
| Cellular                 | High priority only, and only if the file is < 200 KB                                                 |
| Cellular + Low Data Mode | Nothing; deferred                                                                                    |
| Battery < 15%            | Nothing; deferred                                                                                    |
| Trip within 3 days       | **Trip set prefetch is forced**, on any connection, and reported to the learner if it can't complete |

That last row exists because discovering a missing audio file in a taxi rank is the failure this
document exists to prevent. Trip prefetch completeness is **verified** (every `sha256` present on
disk, right size), and if it can't complete the learner is told before departure — not after.

---

## The deferred-work queue

Work that needs a network but must not block anything:

| Deferred work                          | Trigger                               | Retry                               |
| -------------------------------------- | ------------------------------------- | ----------------------------------- |
| Sync push/pull                         | Connectivity, foreground, session end | Backoff to 5 min                    |
| Translation of imported/captured lines | Connectivity                          | 3 attempts, then leave untranslated |
| Server TTS render for a learner phrase | Connectivity + wifi                   | 3 attempts, then keep device TTS    |
| Analytics flush                        | Connectivity                          | Retained 7 days / 5 000 events      |
| Roleplay scene prefetch                | Wifi + idle                           | Best effort                         |
| Receipt re-verification                | Connectivity                          | Daily, with a grace period          |

Deferred work is **invisible**. An untranslated imported phrase shows the Spanish and an empty
English field the learner can fill in — not an error, not a badge, not a queue screen.

---

## Degradation ladder

Every server-dependent feature has a defined ladder, and each rung is a real experience.

### Roleplay

```
1. Live generated scene, tailored to theme + level + tags
2. Cached scene from a previous session (Redis-backed on the server, SQLite locally)
3. Bundled scene for the theme          ← offline lands here, and it's a good scene
4. Suggest a different practice surface  ← only if the theme has no bundled scene
```

### ASR

```
1. On-device recogniser
2. Prompt to download the language pack (deep link to settings)
3. Cloud ASR — only with explicit prior consent
4. REVEAL MODE — a first-class experience, per the blueprint
```

### Audio for a phrase

```
1. Cached rendered clip (content-addressed, verified by hash)
2. Fetch from CDN
3. On-device TTS
4. Text-only, with the phonetic respelling shown more prominently
```

Rung 4 exists for a genuinely broken device with no TTS voice installed. The respelling
(`meh PO-neh oon kor-TAH-doh por fah-VOR`) is why the field is worth authoring for every phrase.

### Translation

```
1. Cached / catalog translation
2. Server translation
3. Untranslated, with an inline "add the meaning" affordance
```

---

## Detecting connectivity

**Reachability is not connectivity.** A hotel captive portal reports a connection and returns HTML
for every request; a foreign SIM reports cellular data and drops packets.

```ts
type Connectivity =
  | { state: 'unknown' }
  | { state: 'offline' }
  | { state: 'metered'; lowDataMode: boolean }
  | { state: 'unmetered' }
  | { state: 'captive' } // reachable, but a probe failed
```

- The OS network state gives the _type_; a lightweight probe against `/health` confirms the
  _reality_.
- The probe runs on transition only, never on a timer.
- `captive` is treated exactly like `offline` for all purposes.
- **Optimistic by default:** on `unknown` we attempt the request. Being wrong costs one failed
  request; being pessimistic costs a learner their sync.

---

## Storage management

| Concern                   | Handling                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Cache cap                 | 150 MB, LRU, pinned content exempt                                                                           |
| Device nearly full        | Stop prefetch; keep pinned; warn once if the trip set cannot be completed                                    |
| Settings visibility       | "Storage" shows cache size, pinned size, and a clear-cache action (pinned content is re-fetched, never lost) |
| Write failure (disk full) | The transaction fails, the UI reports honestly, and no partial state is committed                            |

A learner whose disk is full is a real case — phones abroad fill up with photos — and the failure
must be legible rather than a mysterious crash.

---

## Testing

| Test                          | Method                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------- |
| **The acceptance test**       | Manual, scripted, on the device floor, every release                              |
| Airplane-mode E2E             | Maestro flow with the network disabled: onboard → add → practise → review         |
| Captive portal                | A proxy that returns HTML for every request                                       |
| Flaky network                 | 30% packet loss, 2 s latency — sync must converge, UI must never block            |
| 30-day offline                | Simulated clock advance, then sync; assert convergence and no data loss           |
| Trip prefetch completeness    | Create a trip, go offline, assert every trip audio file is present and hash-valid |
| Cache eviction under pressure | Force a 20 MB cap; assert pinned content survives                                 |
| Disk full                     | Fill the volume; assert honest failure and no corruption                          |
| Cold start offline            | Time to interactive with no network, cold cache, on the device floor              |

The flaky-network test is the one that catches the subtle bugs. Total offline is easy to handle
correctly; 30% packet loss is where retry storms, duplicated pushes, and stuck queues appear.
