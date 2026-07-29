# QA and the device matrix

What we test on, and the manual passes that can't be automated.

---

## Support floor

|         | Minimum         | Rationale                                                                                           |
| ------- | --------------- | --------------------------------------------------------------------------------------------------- |
| iOS     | **16.0**        | Live Activities (17 preferred, 16 degrades to a Lock Screen widget); on-device `SFSpeechRecognizer` |
| Android | **10 (API 29)** | Offline speech recognition; scoped storage; AAudio maturity                                         |

Moves at most once a year, announced a release ahead, never in a patch
([release-versioning.md](release-versioning.md#version-support-policy)).

---

## The device floor

**Every p95 performance budget is measured on these, not on flagships**
([`../architecture/performance.md`](../architecture/performance.md)).

|         | Device                                        | Why this one                                                        |
| ------- | --------------------------------------------- | ------------------------------------------------------------------- |
| iOS     | **iPhone SE (3rd gen)**, iOS 16               | Oldest and slowest supported; small screen exposes layout breaks    |
| Android | **Pixel 6a** or **Galaxy A54**, Android 10–13 | Mid-range volume devices; representative thermals and audio latency |

If it's smooth here, it's smooth everywhere. Testing on a Pro-model flagship tells you nothing about
whether the warming card stutters for a real learner.

---

## The matrix

### Tier 1 — every release, full manual pass

| Device              | OS     | Tests                                                |
| ------------------- | ------ | ---------------------------------------------------- |
| iPhone SE (3rd gen) | 16     | Everything. **The device floor**                     |
| iPhone 15 / 16      | latest | Dynamic Island, Live Activities, latest OS behaviour |
| Pixel 6a            | 13     | The Android device floor                             |
| Galaxy A54          | 13/14  | Samsung's audio stack and One UI differences         |

### Tier 2 — every release, targeted

| Device                     | OS     | Tests                                                          |
| -------------------------- | ------ | -------------------------------------------------------------- |
| iPhone 13 mini             | 17     | Smallest modern screen; Dynamic Type at 200%                   |
| iPad (any)                 | latest | Runs as a scaled phone app — must not be broken, not optimised |
| Pixel 8                    | 14/15  | Newest Android behaviour, predictive back                      |
| Xiaomi / OnePlus mid-range | 12+    | Aggressive battery managers killing background audio           |

### Tier 3 — nightly automated (device farm)

E2E flows across ~10 additional configurations, covering the top devices by install share.

**The Xiaomi/OnePlus row is the one people skip and shouldn't.** Aggressive OEM battery management
kills foreground services and background audio in ways stock Android doesn't, and the ambient loop
is exactly the feature that breaks.

---

## The manual passes

Automation covers a lot ([testing-strategy.md](testing-strategy.md)); these are the things it can't.

### 1 · The airplane-mode test 🔴 **release gate**

```
1. Airplane mode ON
2. Force-quit the app
3. Launch, cold
4. Time to survival mode being usable — must be < 2 s
5. Play three phrases. Navigate every trip screen.
6. Add a phrase. Rate it. Practise a full Refrain wave.
7. Assert: no error, no spinner, no empty state, nothing greyed out
```

Run on both device floors. **This is the product's most important moment**
([`../architecture/offline.md`](../architecture/offline.md#the-acceptance-test)) and the only test
that is a hard gate on shipping.

### 2 · The audio interruption matrix

The simulator lies about audio sessions. All of this is on real hardware.

| Event                      | During the stream                    | During a Refrain rep           | While recording       |
| -------------------------- | ------------------------------------ | ------------------------------ | --------------------- |
| Incoming call              | Pause → resume after                 | Pause rep → resume             | Stop, discard buffer  |
| Siri / Assistant           | Pause → resume                       | Pause → resume                 | Stop, discard         |
| Another app plays audio    | Pause                                | Pause                          | Stop                  |
| Headphones unplugged       | **Pause** (never the speaker)        | Pause                          | Stop                  |
| Bluetooth connects         | Continue, route change only          | Continue                       | Continue              |
| Bluetooth disconnects      | **Pause**                            | Pause                          | Stop                  |
| Screen lock                | **Continue** + lock screen transport | Pause (a rep needs the screen) | Stop                  |
| App backgrounded           | Continue                             | Pause                          | Stop, discard         |
| Silent switch on (iOS)     | **Still audible**                    | Audible                        | —                     |
| Car audio connected        | Continue                             | Continue                       | Warn: mic may be poor |
| Low battery / power saving | Continue; reduce prefetch            | Continue                       | Continue              |
| Alarm fires                | Pause → resume                       | Pause                          | Stop                  |

"Headphones unplugged → pause, never the speaker" appears three times because it's the one that's
embarrassing in public.

### 3 · The warming card frame check 🔴 **release gate**

On the device floor, with the frame-rate overlay on: do six reps and watch the card transition
through all four bands. **Zero dropped frames across the 500 ms transition.**

A stutter here doesn't read as a slow app — it reads as the app not having noticed the learner's
rep, which undermines the entire feedback loop
([`../design/motion.md`](../design/motion.md#1--the-warming-card--the-refrain)).

### 4 · Background stream soak

40 minutes, screen locked, on both floors:

- Audio continues without a gap
- Lock screen metadata stays current
- Two route changes mid-soak
- RSS growth ≤ 5 MB
- Battery ≤ 4%/hour
- No thermal throttle

### 5 · Screen readers

VoiceOver and TalkBack, every changed screen
([`../architecture/accessibility.md`](../architecture/accessibility.md)):

- One focusable element per phrase row; sub-controls as actions
- **Spanish read in Spanish** (the `lang` attribute working)
- Blurred words expose no text
- Charts have a readable summary
- Gate states are announced (why Next is locked)
- Lock-in and level-up announced assertively — they're the reward

### 6 · Dynamic Type

200% on both platforms: no truncation, no overlap, no clipped tap targets. The tightest screens are
Add phrases and the stream's Up-next rows.

### 7 · Widgets and Live Activities

- Every widget state, including empty and no-trip
- **Lock screen ▶ plays audio offline, without launching the app**
- Live Activity through a full trip lifecycle, including dismissal
- Day rollover updates the count
- Copy audit against the forbidden list

### 8 · Permissions

Every denial path, on a fresh install:

- Mic denied → **reveal mode works on every speaking screen**
- Speech recognition denied → same
- Notifications denied → nothing else degrades
- Camera denied → Import still available
- Permission revoked mid-session → graceful, no crash, no modal
- Android: offline Spanish language pack missing → in-context prompt

### 9 · Native-speaker score validation 🔴 **M3 gate**

Before the labs ship, and quarterly after
([`../architecture/prosody-dsp.md`](../architecture/prosody-dsp.md#validation)):

20 recorded takes across 5 speakers, rated independently by two native Spanish speakers. **Agreement
≥80%, worst-syllable identification ≥70%, false-encouragement rate <5%.**

If it fails, the labs don't ship. A wrong score is worse than no score.

### 10 · The trip test 🔴 **v1 gate**

Five real people set a 12-day trip, use the app daily, travel, and report whether they were ready.
This is the only test of whether the product does its job, and it takes twelve days — so it starts
twelve days before the release, not after.

---

## Regression suite

Run every release, in this order (fast feedback first):

1. Onboard → first practice → phrase in the stream
2. Add via each of the four methods; tag; verify the queue changed
3. A full Refrain wave, 5 phrases, all 6 modes
4. Speak to progress: mic path and reveal path
5. A review session to completion
6. Trip: create → drop → survival → souvenir
7. **The airplane-mode test**
8. Two-device sync with a conflict
9. Sign-in with existing local data
10. Migration from the previous release with a 2 000-phrase library
11. 2 000-phrase library: scroll, search, practise
12. Force-quit mid-wave → resume
13. Paywall at the 61st phrase

---

## Bug triage

| Severity | Definition                                                 | Response                              |
| -------- | ---------------------------------------------------------- | ------------------------------------- |
| **S0**   | Data loss, audio egress, crash on launch, sync corruption  | Stop the line. Hotfix or halt rollout |
| **S1**   | A core loop is broken; offline broken; a wrong score shown | Fix before the next release           |
| **S2**   | A feature is broken with a workaround                      | Next release                          |
| **S3**   | Polish, edge case, cosmetic                                | Backlog                               |

**Automatically S0 or S1** regardless of how minor it looks:

- Anything that moves recorded audio off the device
- Any displayed number that isn't real
- Any copy that shames a missed day
- Anything that breaks offline function
- Any sync path that can lose a rating, a note, or a rep count

Those five are the ten rules' teeth in triage
([`../architecture/overview.md`](../architecture/overview.md#the-ten-rules)).

### A bug report needs

Device, OS, app version + build, **online or offline**, active engine, trip state, steps, expected
vs actual, and a screen recording for anything visual or animated. For an audio bug: headphones or
speaker, and whether anything else was playing.

Learner-reported issues come with their own diagnostics bundle, which they see before sharing
([`../architecture/observability.md`](../architecture/observability.md#structured-client-logs)) —
that's how we debug without reading anyone's phrase library.
