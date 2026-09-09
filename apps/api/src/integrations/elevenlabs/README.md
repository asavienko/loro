# ElevenLabs TTS transport — plan 86 / 97 / AS-01

`ElevenLabsTts` is a provider-local HTTP adapter. Nest registration, cache identity and learner
fallback live in the TTS module. Authoring `content:render` injects the same class.

The adapter sends one text-only Text-to-Speech request to the fixed HTTPS provider endpoint. It uses
explicit model, format, byte, deadline and concurrency limits. Redirects and automatic retries are
disabled. Streamed audio is bounded. Exceptions contain only a fixed failure code. Optional
`xi-character-count` is recorded when it is a non-negative integer; missing counts stay null. The
adapter does not estimate duration or cost.

`maxConcurrentRequests` is required. Excess concurrent calls fail immediately with `capacity`. Reuse
one instance for the process. Cancellation releases capacity only when the transport settles.

Stub mode (`StubTts` / `TTS_PROVIDER=stub`) never returns audio bytes. Failed and stub renders
cannot be published as production catalog audio. Q-15 still gates live seed rendering.

Credentials and production text are not needed for tests. An injected fetch exercises deterministic
failure modes; a loopback server proves a stalled body is aborted. No live ElevenLabs traffic is
sent.

No recorded learner audio, ASR upload or voice-clone transport exists here.
