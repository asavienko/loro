# Everything from the backend: server-only writing, notes, sets and sound

- **Requirement IDs:** `AI-06` (make a set), `F-04` (accounts and sync), `P3-01` (continuous
  playback)
- **Milestone:** Main app
- **Status:** ✅ Done 2026-10-01. Scope 1–4 landed on 2026-09-30 (7f22e979, 7a5d2eea, bbf36b8f,
  9b36525b, c84ebae4, 9314c379); scope 5 (clips only, c6e62372) and 6 (languages from the API,
  c0b19e08 and e2d8b6e8) on 2026-10-01, with `TTS_VOICE_EN_GB` set to ElevenLabs' premade "Alice"
  (`Xb7hH8MSUJpSbSDYk0k2`, British) for English prompts until the owner picks one (Q-15). Verified
  on 2026-10-01: the web app against a local API with ElevenLabs played a phrase's English prompt
  and Spanish target from server clips; the deployed EC2 API, through the public gateway, signed a
  learner in with an email code, answered Make a set from the phrase bank without spending the
  allowance, and made a set with one of Loro's phrases, a bank phrase and a typed phrase whose notes
  the rules wrote and whose clips rendered. The one-time upload of a device's sets is covered by the
  app's and the API's tests, not by a live run.
- **Owner request, 2026-09-30:** "I want to make all the functionality work with the existing
  backend, so all the sound phrase generation should work with the backend. All the data should come
  from the backend."
- **Depends on:** plan [106](106-connected-app.md) (the library module, packs, speech clips).

## Where it started

Content already comes only from `GET /v1/library/pack`; the device copy is a cache. What the device
still makes on its own:

1. **Suggestions** in Make a set: `generate/local.ts` searches the course and the bank on the device
   whenever the learner is signed out, the server has no Claude, the allowance is spent, or the
   writer fails, and the app discards the server's own bank answer (`generate/remote.ts`).
2. **Notes** for a phrase the learner types: rule-written on the device (`shared/notes/*`); the
   server's `/generate/notes` answers only with Claude.
3. **Own phrases and sets** (Create set, Add to set, Add phrase, Make a set signed out) live in
   learner state, reach the server only inside the progress blob, and can never have a clip.
4. **Sound**: the player falls back to device speech whenever a phrase has no clip, and bank
   phrases, English prompts, suggestion previews and the voice tests never have one.

## Decisions (owner, 2026-09-30)

- **Suggestions come only from the server.** Make a set needs sign-in; the server's answer is used
  whether Claude or the phrase bank wrote it; offline or refused, the screen says so. The device
  search is deleted.
- **Own sets become library sets.** Every set and phrase the learner makes goes through
  `/library/sets`. Sets already on a device are uploaded once on sign-in, keeping each typed
  phrase's id so its practice history carries on.
- **Notes rules move to the API.** `/generate/notes` and a typed phrase added without notes are
  answered by Claude where configured, otherwise by the rules, labelled as such. The app no longer
  ships `shared/notes`.
- **Sound comes only from server clips.** No device speech: a phrase without a clip can't be played,
  and the player says so. The voice picker and voice tests go.

## Scope

1. **Server sound for everything the app says.** `TTS_VOICE_EN_GB`; bank phrases register their
   utterances and carry `audio` in the pack; written suggestions register theirs (against the
   learner's allowance) and carry `audio`.
2. **Server notes.** Port `apps/mobile/src/shared/notes` to `apps/api/src/library/notes/`;
   `/generate/notes` falls back to them (`provider: 'rules'`); a `written` phrase may be added
   without notes or picture and the server writes them.
3. **Suggestions server-only** in the app: always `/generate/phrases`, bank answers kept with their
   `bankId`, sign-in gate, delete `generate/local.ts`.
4. **Own sets as library sets.** API: empty sets, edit a phrase's text, reorder, and a one-time
   upload that keeps the device's phrase ids. App: the sheets call the API and refresh the pack; the
   upload runs on sign-in and then clears `ownSets`/`ownPhrases`.
5. **Clips only** in the app: `speak` plays the clip or fails as `no-clip`; the playback-rate
   setting drives the clip; remove expo-speech, `voiceByLang`, the Onboarding and Settings voice
   tests.
6. **Languages from the API**: `GET /library/languages`, cached like a pack, replacing the bundled
   `languages.json`. (`meta.json` is the persistence migration table, not content, and stays.)

## Verification

`pnpm check` after each step; the API's library PostgreSQL tests for each new route; the app's unit
tests; a web run against a local API with a TTS key, signed in, through Make a set, Add phrase, a
set upload from a device state, and playback.
