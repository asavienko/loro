# Lyrics first: a song the learner approves, hears back, and is told about

- **Requirement IDs:** `AI-05` (guarded generation with labelled fallbacks), `LIB-02` (limits shown
  before the learner asks), `LIB-03` (songs in the one player)
- **Milestone:** Main app
- **Status:** 🟡 Started 2026-10-01 at the owner's request; scope 1–8 landed the same day. **Left:**
  scope 9, a live run against ElevenLabs (a sung song transcribed and aligned, a push delivered to a
  phone) and an APK; the transcription and the push are tested against recorded answers only.
- **Owner request, 2026-10-01:** "When a user generates a song, make sure he can select more styles
  than he has right now after selecting the phrases. 1. Generate the lyrics. 2. Allow the user to
  regenerate the lyrics or tweak it with the text query. 3. After the lyrics are approved, send a
  request to generate the song. 4. After the song is generated, send the user a notification that
  the song was generated. 5. After the song is generated, run the song and listen to the lyrics and
  how it was actually singing the song, because sometimes the generated lyrics and the prompted
  lyrics are different. 6. Put the timestamps and translation for the lyrics."
- **Depends on:** plan [106](106-connected-app.md) (songs, albums, allowances) and plan
  [111](111-open-model-providers.md) (the text model writes the lyrics).

## Outcome

Making a song is two steps the learner controls. They pick a set, one of **twelve** styles (four
until now), an album and a title, and ask for the **lyrics first**: the text model writes them in
the background and the sheet shows them, each line with its meaning. The learner can have them
**written again**, or type what to change ("shorter chorus", "mention the beach") and have them
**rewritten**; each draft counts against a new daily allowance of lyrics. Only when they **approve**
the lyrics is the song sung from exactly those lines. When it is ready, the learner is **told**: a
toast in the app, and a notification on the phone (a local one when the app is in the background, a
push through Expo's service when the app is closed and the device has registered). The server then
**listens to what was sung**: it transcribes the song with word timestamps, aligns the transcript to
the approved lines, and stores each line as it was actually sung, with when it starts and ends. A
line the singer changed keeps the written line beside it and gets a fresh translation; the song page
shows the timestamp, the sung line, the written line when different, and the meaning. The demo
instrumental keeps its bar timings. Nothing a learner sees is estimated: a line without a heard
timing has none.

## Decisions

- **Lyrics are a draft resource, not a song state.** `POST /library/lyrics` writes a draft in the
  background (202, polled at `GET /library/lyrics/:id`), `POST /library/lyrics/:id/rewrite` writes
  it again with an optional instruction, and `POST /library/generate/song` takes `lyricsId` to sing
  a ready draft as it stands. A song started without one is written as before, for older app builds.
  A failed song made again sings the lyrics it was given, never new ones.
- **Drafts have their own allowance** (`LIMIT_LYRICS_DAILY`, 20 a day): a rewrite is a model call,
  and a learner who rewrites ten times should see that, not a silent cap. Without a text model the
  set's phrases are the draft at once, free, labelled `phrases`, and the sheet offers no rewriting.
- **The server may transcribe its own songs.** The audio promise
  ([ADR-0011](../docs/architecture/adr/0011-analytics-and-privacy.md)) forbids cloud ASR of
  _recorded learner audio_; a song the server itself generated holds no learner's voice and no
  learner's text beyond the lyrics already sent to the music provider.
  [ADR-0017](../docs/architecture/adr/0017-transcribing-generated-songs.md) draws the line.
- **What was sung is the truth on screen.** A line the transcript does not match keeps the written
  line as `written` and shows the sung words as `text`; its meaning is translated again by the text
  model (the written meaning stands if the model fails). A line the singer skipped keeps its words
  and has no timing. The alignment is a plain dynamic-programming match on folded tokens, in
  `library/align.ts`, with its own tests.
- **Push goes through Expo's service.** The app registers an Expo push token (needs an EAS project
  id; without one the app registers nothing and relies on its local notification), the server keeps
  it with the learner's UI language and sends one message per song, deleting tokens the service
  reports as gone. No other device identifier is kept.
- **Twelve styles.** Pop, folk, ballad, sing-along, rock, hip-hop, reggaeton, jazz, dance, country,
  lullaby and bossa nova: each a style pack for ElevenLabs and a tempo, chord progression and feel
  for the demo synthesizer, so every style sounds different with or without a music provider.

## Scope

1. This plan, ADR-0017, and the docs (`library.md`, `api.md`, `environments.md`,
   `v2-prototype-decisions.md`, `security-privacy.md`).
2. Core, content, API and app: twelve styles (ids, packs, demo settings, labels in five languages).
3. API: lyric drafts (`library_lyric_drafts`, migration `018`), the routes, the `lyrics` allowance,
   `lyricsId` on a song, retry singing the same lines; the rewrite prompt in `writers.ts`.
4. API: `transcribe.ts` (ElevenLabs Scribe, word timestamps, bounded, no retries), `align.ts`,
   `translateLines`, the render pipeline storing sung lines with timings; `timingBy` and `written`
   on the wire.
5. API: `push.ts` (Expo push), `library_push_tokens` (migration `019`), the token routes, a message
   when a song is ready or failed, tokens removed with the account.
6. App: the two-step sheet (set-up, then the lyrics with rewrite and approve), the lyrics poller and
   routes in `shared/api/library.ts`, the `lyrics` allowance in Account, copy in en, bg, ru, pl, cs.
7. App: the song page shows each line's time, the sung line, the written line when the singer
   changed it, and the meaning; badges say the lyrics were heard back.
8. App: `expo-notifications` (native only, through the `NATIVE` map), the token registered after the
   first song, a local notification from the watcher when the app is in the background, a tap
   opening the album.
9. A live run with `MUSIC_PROVIDER=elevenlabs` and a device with an EAS project id; an APK.

## Verification

- `pnpm check`: `align.test.ts`, `transcribe.test.ts`, `push.test.ts`, `writers.test.ts`,
  `synth.test.ts`, `style-packs.test.ts`, the app's `library.test.ts` and `copy.test.ts`.
- `library.postgres.test.ts` against PostgreSQL: a draft written, rewritten and sung; a song from a
  draft keeps its lines on retry; a push sent with the learner's language and a dead token
  forgotten.
- Scope 9 on a phone.
