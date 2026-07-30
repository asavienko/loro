# Audio and speech

The subsystem the whole product rests on. If audio is unreliable, nothing else matters.

Rationale: [ADR-0007](adr/0007-audio-pipeline.md) ·
[ADR-0005](adr/0005-on-device-asr-cloud-fallback.md)

---

## Implementation boundary (current repository)

This document is the target architecture. The native subsystem it describes is **not implemented
yet**:

- `apps/mobile/modules/loro-audio/`, `apps/mobile/modules/loro-speech/`, and the native `loro-core`
  bridge do not exist. There are no generated `ios/` or `android/` projects either.
- The mobile package has no playback, capture, speech-recognition, notification, or secure-storage
  dependency. `app.config.ts` declares the future microphone/speech purpose strings and background
  capabilities, but configuration is not an audio implementation.
- The Stream and Refrain routes exercise queue and practice state on the web. They deliberately show
  that audio is unavailable; no current route plays a clip, records a learner, detects onset, or
  invokes ASR.
- `packages/core-rs/src/asr.rs` does implement and test deterministic transcript-to-target matching,
  and the shared engine contracts require measured latency or `null`. Those are reusable domain
  pieces, not evidence that either platform can obtain a transcript or measurement.
- Generated Swift and Kotlin UniFFI bindings are committed, but nothing in the mobile application
  links or calls them. In particular, a generated binding that can marshal byte arrays must never
  become the recorded-audio API; capture-to-DSP integration still has to enforce the native-memory
  handle boundary below.

The interfaces and graphs in the rest of this document are therefore normative designs. Code
examples are proposed contracts unless a source path above says otherwise.

### Prerequisites for implementing it

Implementation must land in independently verifiable layers: create the native projects and local
Expo modules; prove pitch-preserving playback, interruption handling, and real-device background
operation; add capture with an opaque, lifetime-checked buffer registry; link `loro-core` so PCM is
consumed by handle without entering JS; then integrate on-device speech availability and the reveal
fallback. Catalog playback also needs reviewed audio artifacts and a real local cache—most catalog
rows do not carry audio today.

No learner-visible score, latency, waveform, playback progress, or microphone-success state may be
enabled until its producing native path and failure state are both wired. The device matrix and the
privacy-boundary tests in [Testing](#testing) are release prerequisites, not follow-up hardening.

## Requirements this has to satisfy

From the blueprint, in the order they constrain the design:

1. **Continuous hands-free playback** with repeats, and it must survive backgrounding, the lock
   screen, and a 40-minute commute (`Loro.dc.html:603–634`, `1356–1367`).
2. **Variable rate, pitch preserved** — 0.6× slow, 0.92× normal, up to 1.5×, and 1.15× for the
   Refrain's Speed mode.
3. **Record and analyse** — for ASR matching, per-syllable scoring, and pitch contours.
4. **Immediate play/record alternation.** In the Refrain a learner hears a model then speaks, six
   times in ninety seconds. Session teardown between modes would ruin the beat.
5. **Latency measurement accurate enough to be honest** — the falling-effort chart is the Refrain's
   entire feedback signal.
6. **Interruptions handled properly** — calls, Siri, other apps, headphones yanked mid-rep.
7. **All of it offline.**

None of these are satisfiable with a JS-level audio library. Hence a native module.

---

## Modules

Two local Expo Modules, both thin wrappers over platform primitives, both with a single TS surface.

```
modules/
├── loro-audio/       playback · capture · rate · routing · interruptions · lock screen
│   ├── ios/          AVAudioEngine + AVAudioSession + MPNowPlayingInfoCenter
│   └── android/      Oboe (AAudio) + MediaSession + AudioFocus
└── loro-speech/      on-device ASR · device TTS
    ├── ios/          SFSpeechRecognizer (on-device) + AVSpeechSynthesizer
    └── android/      SpeechRecognizer (offline pref.) + TextToSpeech
```

### `loro-audio` API

```ts
interface LoroAudio {
  // ── Session ──
  configure(mode: 'playback' | 'playAndRecord' | 'measurement'): Promise<void>
  activate(): Promise<void>
  deactivate(): Promise<void>

  // ── Playback ──
  /** Load a clip into a slot. Slots let us pre-load the next phrase with no gap. */
  load(slot: number, uri: string): Promise<{ durationMs: number }>
  play(slot: number, opts?: { rate?: number; volume?: number }): Promise<void>
  pause(): Promise<void>
  stop(): Promise<void>
  seek(ms: number): Promise<void>
  setRate(rate: number): Promise<void> // 0.5–2.0, pitch-preserved

  // ── Capture ──
  startRecording(opts: {
    sampleRate: 16000 | 44100
    /** Emit onSpeechOnset for latency measurement. */
    detectOnset: boolean
    /** Keep PCM in memory for DSP. Never written to disk by default. */
    retainBuffer: boolean
  }): Promise<void>
  stopRecording(): Promise<{ onsetMs: number | null; durationMs: number; bufferId: string | null }>

  /** Hand a retained buffer to loro-core. Frees it afterwards. */
  analyzeBuffer(bufferId: string, kind: 'pitch' | 'align' | 'both'): Promise<AnalysisHandle>
  releaseBuffer(bufferId: string): Promise<void>

  // ── Now playing / lock screen ──
  setNowPlaying(info: {
    title: string
    subtitle: string
    durationMs: number
    positionMs: number
  }): void
  setRemoteCommandsEnabled(cmds: ('play' | 'pause' | 'next' | 'previous')[]): void

  // ── Events ──
  addListener(e: 'onPositionUpdate', cb: (p: { slot: number; positionMs: number }) => void): Sub
  addListener(e: 'onPlaybackEnded', cb: (p: { slot: number }) => void): Sub
  addListener(e: 'onSpeechOnset', cb: (p: { atMs: number }) => void): Sub
  addListener(e: 'onInterruption', cb: (p: { began: boolean; shouldResume: boolean }) => void): Sub
  addListener(e: 'onRouteChange', cb: (p: { reason: string; hasHeadphones: boolean }) => void): Sub
  addListener(e: 'onRemoteCommand', cb: (p: { command: string }) => void): Sub
}
```

**Why slots.** The stream must advance between phrases with no audible gap while a repeat is
counting. Slot 0 plays while slot 1 preloads; they swap on advance.

**Why `retainBuffer` and `bufferId`.** Recorded PCM stays in native memory and is handed to
`loro-core` by handle. It is never copied into JS and never written to disk. That's how
[ADR-0011](adr/0011-analytics-and-privacy.md)'s promise is structurally guaranteed rather than
merely intended.

### `loro-speech` API

```ts
interface LoroSpeech {
  asrAvailability(locale: string): Promise<{
    available: boolean
    onDevice: boolean
    requiresDownload: boolean
  }>

  startListening(opts: {
    locale: 'es-ES'
    interimResults: boolean
    /** Hard requirement — we never silently use a cloud recogniser. */
    onDeviceOnly: boolean
    maxAlternatives: number
  }): Promise<void>
  stopListening(): Promise<void>

  addListener(e: 'onPartialResult', cb: (p: { transcript: string }) => void): Sub
  addListener(e: 'onFinalResult', cb: (p: { alternatives: string[] }) => void): Sub
  addListener(e: 'onAsrError', cb: (p: { code: AsrErrorCode }) => void): Sub

  // Device TTS — fallback only, for learner-authored phrases without rendered audio.
  speak(text: string, opts: { locale: string; rate: number }): Promise<void>
  cancelSpeech(): Promise<void>
}
```

---

## The audio graph

### iOS

```
AVAudioSession  (.playAndRecord, .measurement | .default,
                 .allowBluetoothA2DP, .duckOthers)
        │
AVAudioEngine
  ├── playerNodeA ─┐
  ├── playerNodeB ─┼─▶ varispeed (AVAudioUnitVarispeed / timePitch) ─▶ mainMixer ─▶ output
  └── inputNode ───┴─▶ tap(bufferSize: 1024) ─▶ ring buffer ─▶ { onset detector, PCM store }
```

- Two player nodes for gapless slot swapping.
- `AVAudioUnitTimePitch` for rate change with pitch preserved (varispeed alone shifts pitch, which
  would corrupt the pronunciation model).
- `.measurement` mode when recording for DSP — it disables the input processing chain (AGC, noise
  suppression, EQ) that would otherwise distort the pitch contour we're about to measure.
- `MPNowPlayingInfoCenter` + `MPRemoteCommandCenter` for lock screen transport.
- Background mode `audio` in `Info.plist`.

### Android

```
AudioManager (requestAudioFocus: GAIN, usage MEDIA / VOICE_COMMUNICATION when recording)
        │
Oboe (AAudio, exclusive when available; OpenSL ES fallback on old devices)
  ├── two playback streams ─▶ rate transform ─▶ mixer ─▶ output
  └── input stream (VOICE_RECOGNITION preset, UNPROCESSED where supported)
                        └─▶ ring buffer ─▶ { onset detector, PCM store }
```

- Oboe rather than `ExoPlayer` because we need low-latency capture and sample-accurate positions.
- `UNPROCESSED` / `VOICE_RECOGNITION` source to avoid the same DSP-corrupting preprocessing.
- `MediaSessionCompat` + a foreground service for background playback and notification transport.
- `AudioFocus` handling mirrors the iOS interruption model.

---

## The hands-free stream

The blueprint drives the stream with a synthetic 80 ms timer that advances a fake progress bar
(`Loro.dc.html:2539–2554`). The real implementation is event-driven:

```
StreamEngine.start()
  ├─ load(slot 0, clip[current])
  ├─ load(slot 1, clip[next])            ← preload
  └─ play(slot 0, rate)

onPositionUpdate  → progress bar (real playback position)
onPlaybackEnded   → repeatIndex++
                    repeatIndex < repeatTarget(difficulty)
                      → play(slot 0) again          (repeat)
                    else
                      → plays++, advance
                      → swap slots, load next into the free slot
                      → play

onInterruption(began)         → pause, remember position
onInterruption(!began, resume)→ resume from position
onRouteChange(headphones out) → pause  (never blast audio out of the speaker)
onRemoteCommand               → same handlers as on-screen transport
```

**Repeat gaps.** A short deliberate silence between repeats (~350 ms) gives the learner room to
shadow. It's a token (`motion.audioRepeatGapMs`), not a magic number.

**Progress bar honesty.** The bar tracks real playback position. When the clip is time-stretched the
duration changes, and the bar must reflect that rather than a nominal duration.

---

## Recording and latency

The Refrain's falling-effort chart is only meaningful if latency is measured correctly.

```
prompt ends (onPlaybackEnded for model audio, or render-complete for silent modes)
   │        t0 = monotonic clock
   ▼
startRecording({ detectOnset: true })
   │
   ▼  learner starts speaking
onSpeechOnset(atMs)  →  latencyMs = atMs − t0
```

**Onset detection** is a short-time energy + zero-crossing gate with a 120 ms hangover, running in
the native tap. It is deliberately simple; we need onset, not classification.

**Honesty rules**

- If onset is never detected (the learner said nothing, or noise floor is too high), `latencyMs` is
  `null` and the read-out is **hidden**. It is never estimated from rep count.
- Measured latency is clamped for _display_ to `[0.3 s, 5 s]` but stored raw.
- The monotonic clock is used, never wall time — wall time jumps.

Onset detection is validated against 200 hand-labelled recordings; target ≤ ±60 ms. See
[prosody-dsp.md](prosody-dsp.md#validation).

---

## TTS strategy

Three tiers, in preference order:

| Tier                               | Used for                                   | Quality                                                        |
| ---------------------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| **1 · Pre-rendered catalog audio** | Every catalog phrase                       | Best; identical for every learner; the pronunciation reference |
| **2 · Server-rendered on demand**  | Learner phrases, when online and requested | Good; cached to the file cache and to the outbox for reuse     |
| **3 · On-device TTS**              | Learner phrases offline; any cache miss    | Variable by platform/locale; acceptable but visibly worse      |

**Rule: the prosody and pronunciation labs are catalog-only.** They need a trustworthy native
reference contour, and a device-synthesised voice is not one
([content-model.md](../product/content-model.md#audio)).

**Cache.** Content-addressed by `sha256`, LRU-evicted, with pinned sets that are never evicted:
today's Refrain set, the whole trip set, and everything in the current stream queue. Cache size cap
150 MB; pinned content is exempt and reported separately in Settings.

**Word-level audio.** The word-by-word chips speak individual words. Where the chip text is a
fragment (`¿Dón`), the phrase's `words[].say` field supplies the real word (`dónde`) — the blueprint
does this at `Loro.dc.html:2483`. Word audio uses tier 3 (device TTS); rendering 600 phrases × 5
words is not worth the storage.

---

## ASR

**On-device only.** `onDeviceOnly: true` is a hard flag, not a preference.

| Platform    | Recogniser                                                     | Notes                                                                                        |
| ----------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| iOS 16+     | `SFSpeechRecognizer` with `requiresOnDeviceRecognition = true` | Spanish on-device support must be checked per device; `supportsOnDeviceRecognition` gates it |
| Android 10+ | `SpeechRecognizer` with `EXTRA_PREFER_OFFLINE`                 | Offline Spanish requires a downloaded language pack; we detect and prompt                    |

### Degradation ladder

```
1. On-device ASR available                → full experience
2. Requires a language-pack download      → in-context prompt with a deep link to settings;
                                             reveal mode meanwhile
3. Unavailable                            → REVEAL MODE
```

**Reveal mode** is a first-class experience, not an error state. From the blueprint: mic tap reveals
and speaks the next word, and the hint reads _"No mic here — tap to reveal a word"_
(`Loro.dc.html:2661`, `2729`). Every speaking screen completes without a microphone.

### Matching

Matching is **not** in the ASR module — it's in `loro-core`, so iOS and Android agree exactly.

```rust
// loro-core::asr::match_tokens
// Normalise: lowercase, NFD, strip combining marks, strip non-alphanumeric except ñ.
// Then walk target tokens from `revealed`, searching forward in heard tokens
// with a monotonically increasing cursor.
pub fn match_tokens(heard: &[String], target: &[String], revealed: usize) -> MatchResult
```

Properties, all inherited from the blueprint (`Loro.dc.html:2674–2683`):

- **Order matters.** Words must be produced in sequence.
- **Insertions are tolerated.** ASR noise between target words doesn't break the match.
- **Progress is monotonic.** `revealed` only increases; partial credit is never lost.
- **Accent- and punctuation-insensitive.** `dónde` matches `donde`; `¿Cuánto cuesta?` matches
  `cuanto cuesta`.

Fuzzy tolerance (a bounded edit distance for near-misses) is a tunable in `loro-core`, off by
default. Turning it on is a pedagogical decision, not an implementation detail: it makes the gate
more forgiving.

---

## Interruptions and edge cases

| Event                                | Behaviour                                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Incoming call                        | Pause, remember position, resume if the OS says to                                                    |
| Siri / Assistant                     | Pause; resume on end                                                                                  |
| Another app takes focus              | Pause (we never duck-and-continue during practice; the learner can't shadow over a podcast)           |
| Headphones unplugged / BT disconnect | **Pause.** Never fall through to the speaker                                                          |
| BT connected mid-session             | Continue; route change only                                                                           |
| Screen lock during the stream        | Continue, with lock screen transport                                                                  |
| Screen lock during a Refrain rep     | Pause the rep; resume on unlock (a rep needs the screen)                                              |
| App backgrounded during recording    | Stop recording, discard the buffer, return to idle                                                    |
| Mic permission revoked mid-session   | Fall to reveal mode immediately, no crash, no modal                                                   |
| Audio route is a car system          | Stream works; speaking screens warn that the mic may be poor                                          |
| Silent switch on (iOS)               | Playback still audible — we use `.playback`-family categories, because a muted language app is broken |
| Very low battery / power saving      | Reduce prefetch; never degrade playback                                                               |
| Two audio sources (stream + a rep)   | Impossible by construction: playback is exclusive, one session                                        |

---

## Testing

| Layer                | How                                                                             |
| -------------------- | ------------------------------------------------------------------------------- |
| `loro-core` matching | Golden tests over recorded transcripts, including ASR-noise cases               |
| Onset detection      | 200 hand-labelled recordings; ±60 ms tolerance                                  |
| Module contracts     | Fakes in `src/platform/audio` and `src/platform/speech` for all component tests |
| Interruptions        | Manual matrix on real devices — the simulator lies about audio sessions         |
| Rate + pitch         | Spectral check that a 1.5× clip has the same F0 as the 1.0× original            |
| Background playback  | 40-minute soak on both platforms, screen locked, with route changes             |
| Cache                | Eviction and pinning under a forced 150 MB cap                                  |

Devices and the manual matrix: [`process/qa-device-matrix.md`](../process/qa-device-matrix.md).
