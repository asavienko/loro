# One player for phrases and songs, in the light palette

- **Requirement IDs:** `P3-01` (continuous playback), `AI-06` (songs made from sets)
- **Milestone:** Main app
- **Status:** ✅ Done 2026-09-30, checked on the web and the Android emulator.
- **Owner request, 2026-09-30:** "Right now, the song functionality lives separately from phrases. I
  want to have it in the same player, with the same functionality and the same sets, but to
  distinguish phrases from songs, you should use a separate icon. Also, the songs have only a dark
  template. I want to have everything in a light template, but also, similar to the phrases, songs
  should have voting functionality like heart, easy, and missed."
- **Owner decisions (same day):** rating a song reviews each phrase it sings; the Music tab goes,
  songs live in their sets (albums stay as the learner's grouping, in Library and Create); a set's
  Play plays its phrases only, and a song plays when tapped.
- **Supersedes:** plan 106's two sides (the Music tab, the night palette, the separate song player).

## Scope

1. [x] State: a song can be liked (`song:<id>` likes, merged like any like); `RATE_PHRASES` and
       `UNRATE_PHRASES` rate or undo every phrase a song sings, as pending ratings with the usual
       undo window, from any player status.
2. [x] One player: the mini player and the full player show what plays last, a phrase or a song; a
       song shows a music icon and has Missed / Hard / Easy (reviewing its phrases) and a heart.
3. [x] Light palette for everything musical: the song view, albums, a set's songs, covers' frames.
4. [x] No Music tab: four tabs; a set's page lists its songs (music icon) beside its phrases; albums
       in Library; `/music` links open Library's albums.
5. [x] Docs: `library.md`, the design decisions, CLAUDE.md's tab list, plan 106.
6. [x] One list (owner's follow-up, same day): a set's songs sit in its phrase list, each row with
       its kind's icon; covers show the phrase icon, the song icon, or both (`songCount` on sets).

## Verification

- `pnpm --filter @loro/mobile test` covers the new events (likes, song ratings and undo).
- Web and the Android emulator: play a set, tap one of its songs, rate it, like it, see its phrases
  reviewed; the mini player follows whichever plays.
