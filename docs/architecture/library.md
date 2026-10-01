# The library: content, accounts, sharing and generation

Plans [106](../../plans/106-connected-app.md),
[107](../../plans/archive/2026-09-30/107-one-player.md) and
[108](../../plans/archive/2026-10-01/108-backend-only.md). How the app and the API share content,
what a learner can make, who can see it, and what it costs them. Code: `apps/api/src/library/`
(API), `apps/mobile/src/shared/api/` and `apps/mobile/src/state/` (app), contracts in
`packages/core/src/api/library.ts`. Every path below is under `/v1`.

## Where content lives

The app ships no phrase content. Loro's sets, phrases, notes, the phrase bank, the topics and one
album per course (Spanish, Bulgarian, British English, Russian, American English, Polish and Czech)
are in `packages/content/v2/`; the API seeds them into PostgreSQL the first time the library is used
after a content change (`library_meta.seed` holds the content version and a seed revision, taken
under an advisory lock). The songs of Loro's albums are the sets' phrases arranged as lyrics over
the demo instrumental.

The app downloads a course's **pack** (`GET /library/pack?target=es-ES`): the topics, Loro's sets
and phrases, the learner's own and saved sets when signed in, the course's phrase bank and the
albums. It keeps every pack on the device (`shared/api/contentCache.ts`) and installs them before
the learner's state loads, so it opens offline. The pack's `version` changes whenever anything in it
does. With no copy of the course at all, the app says it is getting it, or that the server can't be
reached.

The **languages** the app offers come from `GET /library/languages`: `{version, languages}`, each
language with its `code`, `flag`, the interface locale for a learner who speaks it (`uiLocale`,
`null` when the app can't speak it) and whether a course teaches it (`canTarget`); `version` is a
hash of the list. The list is `packages/content/v2/languages.json`, not the database, so the route
answers before the seed and needs no account. `LIBRARY_LANGUAGES`/`LIBRARY_COURSES` in `@loro/core`
and `V2_COURSES`/`V2_NATIVES` in `@loro/content/v2` are the same list, held equal by content's v2
test. The app keeps the list on the device (`loro.content.languages`) and waits for it before
onboarding; a saved course is kept across the first start after an update, before the list has
arrived.

A set opened from a link or Community is kept on the device too (`installExtras`), so progress on
its phrases stays attached. Learner progress on a phrase that is not installed (another course, a
set not downloaded yet) is kept by `sanitizeLearner`; only the player's queue needs installed
phrases.

## Phrases and songs: one player

| Tab     | What it holds                                                                              |
| ------- | ------------------------------------------------------------------------------------------ |
| Home    | The daily loop, and Loro's album of the course sung                                        |
| Explore | Loro's course, the learner's own and saved sets, Community sets, Make a set with AI        |
| Create  | Making sets and songs, with today's allowance and who makes them beside each               |
| Library | Progress: liked, due, learned phrases; the learner's sets; Albums (theirs, Loro's, shared) |

Songs live in their sets: a set's page lists its phrases and its songs in one list, a song marked
with the music note; the set's Play plays its phrases, and a song plays when tapped. Covers say what
they hold (top left): a set shows the phrase icon when it has phrases, plus the song icon when songs
are sung from it (`songCount` on every set); an album shows the song icon. Phrases and songs share
one player: the bar above the tabs and `/player` show what was started last (a song wears a
music-note badge), and starting one pauses the other. A song has a heart (a liked `song`) and Missed
/ Hard / Easy, which review every phrase of the learner's course it sings (`RATE_PHRASES`, with the
usual window and undo). Every learner has a "Liked phrases" set (first in Library's sets) and a
"Liked songs" album (first among their albums), made on the device from their synced likes, so they
are there signed in or not: most recently liked first, played like any set or album, an item gone
when unliked (`LIKED_ID`, `likedSetView`, `src/music/LikedSongs.tsx`). They are never stored on the
server. The one player — a song or a phrase — takes the lock screen and notification shade with its
grades, and plays on with the screen locked (`modules/loro-media`). Everything is in the app's light
palette, drawn covers included; Loro's covers carry the seed revision in their ids, since covers are
served as immutable.

## Sets and phrases a learner makes

Every set and phrase a learner makes lives in the library, not in learner state: Create set, Add to
set, Add phrase and Make a set call `/library/sets` and `/library/phrases`, then refresh the pack. A
phrase added on its own goes into the course's "My phrases" set, made by the first such phrase. A
phrase keeps the notes it came with (a model's, from `generate/notes` or a suggestion); a bank
phrase keeps the bank's; any other gets notes written by Loro's rules on the server, labelled. For
Spanish and Bulgarian the rules transcribe the phrase's sounds; English spelling doesn't give its
sounds and Russian spelling hides the stress, so for those courses the grammar rule and a sound tip
are chosen from the spelling alone (`notes/grammar.ts`, `notes/tips.ts`), and the IPA and respelling
are taken word by word from Loro's own phrases, with … for any word Loro hasn't met and a sentence
saying so (`notes/learned.ts`); a hint that needs syllables becomes echoing the clip. Sets and
phrases made on a device before it signed in are uploaded once on sign-in (`src/state/upload.ts`),
each phrase keeping its id so its practice history carries on; the uploaded copies are then marked
deleted in learner state, which every device syncs.

## Accounts

Sign-in is an email code (`/auth/magic-link`, `/auth/magic-link/verify`), or Google and Apple where
the server has their credentials (`/auth/capabilities` says which). For a provider, the web leaves
for the provider's page and returns to `/account`; iOS and Android open it in an auth session
returning to `loro://account` (`loro-dev://account` for a development build), with PKCE either way.
The app keeps the refresh token in the Keychain/Keystore (`expo-secure-store`; `localStorage` on the
web) and the account's public details in the key-value store, and renews the 15-minute access token
before use or after a 401. Signing out revokes the refresh token and forgets the downloaded packs
(they held the learner's own sets); progress on the device is untouched.

The display name shown on shared items is `POST /library/profile`. `POST /library/me/delete` deletes
everything a learner keeps in the library (sets, albums, songs, covers, saves, reports, profile,
account progress, and their phrases' clips); the app then ends the session without saving progress
back, and the progress on the device stays. The day's allowance use is kept: deleting things doesn't
give generations back. `POST /library/me/delete-account` deletes all of that and the account itself
(synced rows, song jobs, the user with its identities, devices, sessions and refresh tokens); the
app forgets what it kept on the device under that account and ends the session.

A signed-in learner's **progress** follows them through `GET/POST /library/progress`; how it merges,
when it runs and what happens on a shared phone are in [sync-protocol.md](sync-protocol.md).

## Visibility and sharing

| Visibility | Who can read it                                     | Listed in Community |
| ---------- | --------------------------------------------------- | ------------------- |
| `private`  | Its owner                                           | No                  |
| `link`     | Anyone with its id or share code (`/shared/<code>`) | No                  |
| `public`   | Anyone                                              | Yes                 |

Loro's rows are public and read-only. A signed-in learner can report someone else's shared set or
album once (`POST /library/reports`: offensive, wrong, spam or other); three learners' reports take
a public item out of Community, while its link still opens it. Its owner is told (`hidden` in their
pack); nobody else sees the flag or the count, and reported albums leave a set's songs too. Anyone
who can read a set or album can save it to their library; it then comes with their pack until its
owner makes it private. Only the owner changes or deletes something; for anyone else it is not
found. Deleting removes it from everyone's library.

Community lists newest first or most saved first (`sort=popular`), each item with how many learners
keep it (`savedBy`). A shared set's or album's page offers its maker's other public ones
(`/library/{sets,albums}/:id/more`): the item leads to its maker, so no user id leaves the server.
Titles, descriptions and display names refuse links (`shownText` in `@loro/core/api/library`).

Song audio is served with byte ranges from `GET /library/songs/:id/audio`. An audio element cannot
send a bearer, so a song's `audioUrl` carries a signature valid for about 12 hours
(`LIBRARY_URL_SECRET`, random per process when unset); the app fetches the song again for a fresh
one.

## Phrases spoken by the server

With `TTS_PROVIDER=elevenlabs`, each phrase in a pack (and each suggestion) carries a clip URL for
every one of its languages that has a pinned voice (`TTS_VOICE_ES_ES`, `TTS_VOICE_BG_BG`,
`TTS_VOICE_RU_RU`, and `TTS_VOICE_EN_GB` for English prompts):
`/library/speech/<utterance>.mp3?v=<voice>`. Only text the library holds can be spoken: storing a
phrase registers its utterances (a hash of language and text), and the route renders nothing else. A
clip renders once, on its first request, is kept with the songs' audio and is served as immutable.
New renders are capped per day for the server (`LIMIT_SPEECH_RENDERS_DAILY`, default 500) and per
learner whose phrases they are (`LIMIT_SPEECH_OWNER_DAILY`, default 100); a render the provider
refuses isn't tried again for six hours.

The app has no device voice. A phrase without a clip (no provider, no voice for its language, or a
clip that won't load) can't be played, and the player says so. On the web the player preloads the
next phrase's clips in the two languages the learner hears.

## Generation and limits

| Route                          | A model (`ai`, [ADR-0015](adr/0015-open-model-providers.md)) | Without one (labelled)                           |
| ------------------------------ | ------------------------------------------------------------ | ------------------------------------------------ |
| `POST /library/decks`          | Phrases with pictures and all three notes, in the background | The phrase bank, best theme first (`bank`)       |
| `POST /library/generate/notes` | Notes and a picture for a typed phrase                       | Notes and a picture by Loro's rules (`rules`)    |
| `POST /library/generate/cover` | An illustration (Muse Image), else a shape spec, background  | A pattern drawn from the title (`pattern`)       |
| `POST /library/generate/song`  | Lyrics that sing every phrase                                | The set's phrases arranged as a song (`phrases`) |

Text comes from DeepSeek V4.1 Flash on Fireworks (`FIREWORKS_API_KEY`), and from the same model
through OpenRouter (`OPENROUTER_API_KEY`) when Fireworks fails, with reasoning off; covers are drawn
by Muse Image through OpenRouter. A deck takes 30–40 s and a cover 15 s or so, longer than the EC2
gateway waits, so both are written in the background: `POST /library/decks` (202) and the cover
request return at once and the app polls `GET /library/decks/{id}` (the learner's own) and
`GET /library/covers/{id}.json`. A set or album keeps its old cover until the new one is ready. The
older `POST /library/generate/phrases` answers the same deck synchronously, for older app builds.

A phrase's three notes are a mnemonic, a grammar rule and its sounds, in the learner's language. The
mnemonic is a hook for remembering the phrase: the model is asked for a word of the learner's it
sounds like, a picture or tiny scene, a word they know or a pattern of their language, and never for
an invented etymology or fact (`notesBrief` in `writers.ts`). Loro's rules only use what is true of
the phrase: a word of its meaning it sounds like, a word it shares with Loro's phrases, or its
pieces and beats (`notes/memory.ts`).

Suggestions and notes come only from the server: the app always asks these routes and shows which
writer answered. The phrase bank and the rules are free; only a model's decks and notes spend the
day's phrases allowance, and a model's answer that fails gives it back while the bank or the rules
answer instead. The model writes six suggestions to a deck (More asks for the next six), so the
first card comes sooner. Notes for one phrase are answered while the request waits, so they wait at
most 22 s for the model, inside the EC2 gateway's 30 s; past that the rules answer.
`GET /library/usage` reports the day's use, the kept counts and which writer each kind uses here.

A song's sound comes from ElevenLabs Music with `MUSIC_PROVIDER=elevenlabs` and `MUSIC_API_KEY`;
otherwise the server synthesizes a **demo instrumental** (`synth.ts`: chords, bass, melody and beat
in the style, two bars per lyric line) whose line timings let the lyrics follow the sound. It is
labelled "Demo sound" everywhere it is heard. A demo is a 22.05 kHz 16-bit mono WAV of at most 4
MiB, which the HTTPS gateway can carry ([ec2-deployment.md](../process/ec2-deployment.md)): it sings
as many whole lines as fit (12 in a gentle ballad, 16 to 22 in the other styles) and the song's
lyrics end where its sound does. When the server has a voice for the song's language, each lyric
line is also spoken over its bars (raw PCM from the voice, the music ducked under it; distinct lines
only, counted against the owner's and the server's clip allowances), and the song is labelled
"Spoken demo". Loro's own album songs are voiced the same way once, in the background, after the
server starts with a voice (`LIBRARY_VOICE_LORO_SONGS=0` turns it off).

A song is saved at once as `rendering` and made in the background; the app polls it. A song that
fails (or is lost to a restart, after ten minutes) gives the day's song back; its owner can make it
again (`POST /library/songs/:id/retry`, another of the day's songs) or remove it
(`DELETE /library/songs/:id`).

**Covers are never markup from a model.** An illustration is accepted only as PNG, JPEG or WebP by
its bytes' signature (at most 2.5 MB) and carried inside the SVG as a base64 `data:` image. A shape
cover is a spec of at most 24 circles, rectangles and paths with `#RRGGBB` colours and numeric
ranges, from the text model or the pattern drawer. `covers.ts` validates both and is the only code
that writes SVG; path data may hold only commands and numbers. Covers are served with
`Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src data:`.

**A cover is drawn from the artwork itself.** The artwork of a set, album, song or phrase on its
page and in the player has a button in its corner (`src/ui/CoverRedraw.tsx`, inside `SetCover`,
`AlbumCover` and `PhraseImage`). It first says what will happen and how many covers are left today,
and who draws them here; signed out it offers sign-in. `POST /library/generate/cover` with
`attachTo` draws for the item's own words (a set's or album's title and description, a song's title
and album, a phrase and its meaning), never for text the app sends:

| The artwork of                   | The new cover                                                                                                                                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The learner's own set or album   | Worn by it in place                                                                                                                                                                                                                                 |
| One of Loro's sets or albums     | Worn by a copy that is the learner's (Loro's stay read-only): a set lists Loro's phrases by reference, so their progress stays one, with its subtitle in the learner's language as the description; an album takes its ready songs (the same sound) |
| Any phrase or song they can read | The learner's own (`library_item_covers`, by user and id): in the `covers` of their packs (signed-in, by course), shown wherever the phrase or song is, only to them, on every device; kept across reseeds                                          |
| Someone else's set or album      | None: it keeps its maker's cover (not found)                                                                                                                                                                                                        |

The cover is drawn in the background like any other (above); where it goes is settled when it is
asked for. A copy of one of Loro's is made at once, wearing Loro's cover until the new one is ready,
and the first answer names it (`copy: {kind, id}`) so the app opens it while the cover is drawn. A
copy must fit the kept caps before the day's cover is spent, and a cover nothing could wear is given
back. Once ready, a cover goes on a set or album only while the learner still owns it.

**Allowances** are counted per learner per UTC day in `library_usage` with one atomic upsert, before
any provider is asked: a model's phrase decks and notes (`LIMIT_PHRASES_DAILY`, default 30), covers
(`LIMIT_COVER_DAILY`, 10, drawn patterns too) and songs (`LIMIT_SONG_DAILY`, 5, demos too); zero
turns a kind off. One account keeps at most `LIMIT_SETS_KEPT` (100) sets, `LIMIT_ALBUMS_KEPT` (30)
albums and `LIMIT_SONGS_KEPT` (120) songs; the course's "My phrases" set is one of the sets, so at
the cap a phrase added on its own is refused until it goes into a set the learner has. A spent
allowance is `429 LIMIT_REACHED` with `resets_at` (`null` for a kept cap); the app shows what is
left before the learner asks. Making anything needs an account; reading does not.

## Running it locally

```bash
docker compose up -d --wait postgres          # or: pnpm --filter @loro/api dev:up
pnpm env:decrypt                              # apps/api/.env (or copy .env.example)
node scripts/local-magic-delivery.mjs &       # email codes land in .tmp/loro-magic-delivery.json
pnpm --filter @loro/api start                 # :3000; seeds the library on first use
pnpm --filter @loro/mobile web                # the app; EXPO_PUBLIC_API_URL in apps/mobile/.env
```

`LORO_TEST_DATABASE_URL=postgres://loro:loro@localhost:5432/loro pnpm --filter @loro/api test` runs
the library suite against PostgreSQL; without it the PostgreSQL tests are skipped and the pure
writer, cover and synthesizer tests run.
