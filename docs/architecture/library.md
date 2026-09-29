# The library: content, accounts, sharing and generation

Plan [106](../../plans/106-connected-app.md). How the app and the API share content, what a learner
can make with AI, who can see it, and what it costs them. Code: `apps/api/src/library/` (API),
`apps/mobile/src/shared/api/` and `src/state/{account,content,progressSync}.tsx` (app), contracts in
`packages/core/src/api/library.ts`.

## Where content lives

The app ships no phrase content. Loro's pre-generated sets, phrases, notes, the phrase bank, the
topics and one album per course are in `packages/content/v2/`; the API seeds them into PostgreSQL
the first time the library is used after a content change (`library_meta.seed` holds the content
version and a seed revision, taken under an advisory lock). The songs of Loro's albums are the sets'
phrases arranged as lyrics, with the demo instrumental.

The app downloads a course's **pack** (`GET /library/pack?target=es-ES`): the topics, Loro's sets
and phrases, the learner's own and saved sets when signed in, the course's phrase bank and the
albums. It keeps every pack on the device (`contentCache.ts`) and installs them before the learner's
state loads, so it opens offline. The pack's `version` changes whenever anything in it does. With no
copy of the course at all, the app says it is getting it, or that the server can't be reached.

A set opened from a link or Community is kept on the device too (`installExtras`), so progress on
its phrases stays attached. Learner progress on a phrase that is not installed (another course, a
set not downloaded yet) is kept by `sanitizeLearner`; only the player's queue needs installed
phrases.

## Two sides: phrases and music

| Tab     | What it holds                                                                          |
| ------- | -------------------------------------------------------------------------------------- |
| Home    | The daily loop                                                                         |
| Phrases | Loro's course, the learner's own and saved sets, Community sets, Make a set with AI    |
| Music   | Albums of songs sung from sets, in the night palette, with their own player and lyrics |
| Create  | Making sets, songs and covers, with today's allowance beside each                      |
| Library | Progress: liked, due, learned phrases; the learner's sets                              |

A song never plays with the phrase loop: starting one pauses the other.

## Accounts

Sign-in is the existing email code (`/auth/magic-link`, `/auth/magic-link/verify`). The app keeps
the refresh token in the Keychain/Keystore (`expo-secure-store`; `localStorage` on the web), the
account's public details in the key-value store, and renews the 15-minute access token before use or
after a 401. Signing out revokes the refresh token and forgets the downloaded packs (they held the
learner's own sets); progress on the device is untouched. The display name shown on shared items is
`POST /library/profile`.

A signed-in learner's **progress** follows them (`GET/POST /library/progress`): the device merges
the account's copy of its learner state (union of logs, latest of each field, as two tabs merge) and
writes the result back with the revision it merged onto. A write on an older revision is refused
(`409 CURSOR_EXPIRED`) and merged again, so no device's progress is lost. It runs on signing in, on
returning to the foreground and 20 s after a change.

## Visibility and sharing

| Visibility | Who can read it                                     | Listed in Community |
| ---------- | --------------------------------------------------- | ------------------- |
| `private`  | Its owner                                           | No                  |
| `link`     | Anyone with its id or share code (`/shared/<code>`) | No                  |
| `public`   | Anyone                                              | Yes                 |

Loro's rows are public and read-only. Anyone who can read a set or album can save it to their
library; it then comes with their pack until its owner makes it private. Only the owner changes or
deletes something; for anyone else it is not found. Deleting removes it from everyone's library.

Song audio is served with byte ranges from `GET /library/songs/:id/audio`. An audio element cannot
send a bearer, so a song's `audioUrl` carries a signature valid for about 12 hours
(`LIBRARY_URL_SECRET`, random per process when unset); the app fetches the song again for a fresh
one.

## Generation and limits

| Route                            | Claude (`ANTHROPIC_API_KEY`)              | Without it (labelled)                            |
| -------------------------------- | ----------------------------------------- | ------------------------------------------------ |
| `POST /library/generate/phrases` | Phrases with pictures and all three notes | The phrase bank, best theme first (`bank`)       |
| `POST /library/generate/notes`   | Notes and a picture for a typed phrase    | `503`; the app keeps its own rules' notes        |
| `POST /library/generate/cover`   | A shape spec designed for the title       | A pattern drawn from the title (`pattern`)       |
| `POST /library/generate/song`    | Lyrics that sing every phrase             | The set's phrases arranged as a song (`phrases`) |

A song's sound comes from ElevenLabs Music with `MUSIC_PROVIDER=elevenlabs` and `MUSIC_API_KEY`;
otherwise the server synthesizes a **demo instrumental** (`synth.ts`: chords, bass, melody and beat
in the style, two bars per lyric line) whose line timings let the lyrics follow the sound. It is
labelled "Demo sound" everywhere it is heard. A song is saved at once as `rendering` and made in the
background; the app polls it. `GET /library/usage` says which writer each kind uses here.

The app asks the server's phrase writer only when it is Claude; otherwise the device's copy of the
phrase bank answers the same suggestions without spending the allowance.

**Covers are never markup from a model.** Claude (or the pattern drawer) produces a spec of at most
24 circles, rectangles and paths with `#RRGGBB` colours and numeric ranges; `covers.ts` validates it
and is the only code that writes SVG. Path data may hold only commands and numbers. Covers are
served with `Content-Security-Policy: default-src 'none'`.

**Allowances** are counted per learner per UTC day in `library_usage` with one atomic upsert, before
any provider is asked: phrase decks and notes (`LIMIT_PHRASES_DAILY`, default 30), covers
(`LIMIT_COVER_DAILY`, 10) and songs (`LIMIT_SONG_DAILY`, 5). One account keeps at most
`LIMIT_SETS_KEPT` (100) sets, `LIMIT_ALBUMS_KEPT` (30) albums and `LIMIT_SONGS_KEPT` (120) songs. A
spent allowance is `429 LIMIT_REACHED` with `resets_at`; the app shows what is left before the
learner asks. Generation needs an account; reading does not.

## Running it locally

```bash
docker compose up -d --wait postgres          # or: pnpm --filter @loro/api dev:up
pnpm env:decrypt                              # apps/api/.env (or copy .env.example)
node scripts/local-magic-delivery.mjs &      # email codes land in .tmp/loro-magic-delivery.json
pnpm --filter @loro/api start                 # :3000; seeds the library on first use
pnpm --filter @loro/mobile web                # the app; EXPO_PUBLIC_API_URL in apps/mobile/.env
```

`LORO_TEST_DATABASE_URL=postgres://loro:loro@localhost:5432/loro pnpm --filter @loro/api test` runs
the library suite against PostgreSQL; without it the pure writer, cover and synthesizer tests run.
