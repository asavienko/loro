# 0017 · The server may transcribe the songs it makes, never a learner's voice

- **Status:** Accepted
- **Date:** 2026-10-01
- **Deciders:** the owner (request of 2026-10-01, plan
  [113](../../../plans/113-lyrics-first-songs.md))

## Context

A song is sung by ElevenLabs Music from lyrics the learner approved. The singer does not always sing
exactly what was written: a word is dropped, another added, a line replaced. The owner asked that
the app show what was actually sung, with a timestamp and a translation per line, so the lyrics on
screen are true and light up as the song plays.

Showing that needs the sung audio heard back: a speech-to-text model with word timestamps. ADR-0011
says **recorded audio never leaves the device** and that there is **no cloud ASR**. That rule exists
because a learner's voice is identifying and the promise "your audio stays on your device" is one
Loro makes to learners. A song the server generated holds no learner's voice: it is licensed model
audio the server already made, from lyrics the server already sent to the music provider.

## Options considered

### A · No transcription; trust the written lyrics

The lyrics on screen would sometimes be wrong, and a sung song would never light up its lines (only
the demo sound knows its bars). The owner asked for the opposite.

### B · Ask the music provider for timings

ElevenLabs Music returns audio only; there is no per-word timing in its answer.

### C · Transcribe the generated song on the server (chosen)

ElevenLabs Scribe (`POST /v1/speech-to-text`, `scribe_v1`, word timestamps), under the same key that
sang the song, in the API process, right after the song is composed and before it is saved as ready.
The words are aligned to the approved lines (`library/align.ts`) and the result is stored with the
song.

## Decision

- **What may be transcribed:** only audio this server generated (a song from `composeLive`). The
  transcriber is called from one place, `library/transcribe.ts`, with the bytes the server just
  received from the music provider; no route accepts audio, and the app still records nothing.
- **What may not:** any audio from a device. ADR-0011 stands unchanged: recorded learner audio never
  leaves the device, and no cloud ASR of it exists. This record is the one exception, and it is an
  exception about _whose_ audio, not about ASR.
- **The transcript is a means, not a record.** The server keeps the aligned lines (text and timing
  per line), never the raw transcript, and nothing of it reaches analytics.
- **Honest on failure.** A song whose hearing-back fails keeps its lyrics as written and untimed
  (`timingBy: null`); a line the transcriber did not hear has no timing rather than a guessed one.
- **Off by a switch.** `MUSIC_TRANSCRIBE=0` turns it off with the key still set.

## Consequences

### Good

- The lyrics on a song's page are what was sung, each line timed and lit as it plays, as for the
  demo sound.
- A line the singer changed is marked, keeps the written line beside it, and gets a meaning of its
  own from the text model.

### Bad — accepted deliberately

- One more provider call per sung song, through the same vendor and key; it costs a transcription
  per song and lengthens the song's making by its duration.
- A transcriber's mistake (a misheard word) can mark a line as changed when it was not; the
  alignment forgives a letter in a long word and ignores ad-libs in pauses, no more.
- The rule in `docs/architecture/security-privacy.md` now has to say "learner audio" precisely; a
  reader who remembers "no cloud ASR" as absolute must read this record.
