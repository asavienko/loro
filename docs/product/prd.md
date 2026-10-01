# Product requirements

What Loro must do. Cite the ID in branches, commits and PRs (`P3-01`). IDs are stable and never
reused; requirements of the removed first app (Refrain, Run, trips, chat, labs, widgets) were
dropped on 2026-09-30 and remain in Git history at `52a0e3b`. Delivery status lives in
[`plans/README.md`](../../plans/README.md); how screens behave is the running app and
[v2-prototype-decisions.md](../design/v2-prototype-decisions.md).

## Foundations

| ID   | Requirement                                                                                                                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | Sign-in with an email code, Google or Apple. Listening works without an account; generation needs one.                           |
| F-03 | Offline-first: the player, ratings and the kept course pack work with no network.                                                |
| F-04 | Progress and the learner's own sets, songs and likes sync across devices ([sync-protocol.md](../architecture/sync-protocol.md)). |
| F-07 | Account deletion and data deletion; a JSON export of phrases and progress.                                                       |
| F-08 | UI in English, Bulgarian or Russian; learn Spanish, Bulgarian or Russian (different from the UI language): seven pairs.          |

## Listening and rating

| ID    | Requirement                                                                                          |
| ----- | ---------------------------------------------------------------------------------------------------- |
| P3-01 | Continuous hands-free playback: native prompt → a measured pause to say it → target, repeated.       |
| P3-11 | Background audio with lock-screen / notification transport controls.                                 |
| P3-31 | Grades Missed / Hard / Easy, which show no intervals: the real FSRS model in core-rs schedules them. |
| P2-24 | How well a phrase is known sets its repetitions (3 while new or shaky, 1 under review; overridable). |
| AS-01 | Native-quality TTS for every phrase, cached on the device (voice choice: Q-15).                      |

## Making and finding phrases

| ID    | Requirement                                                                                          |
| ----- | ---------------------------------------------------------------------------------------------------- |
| P2-04 | Suggestions re-rank toward "more like" the phrase just added.                                        |
| P2-06 | Make a set from a topic, keywords or pasted text, deciding one suggested card at a time.             |
| P2-07 | Add your own phrase when it isn't in the library.                                                    |
| AI-05 | Every AI path is signed-in, limited, schema-validated, and has a labelled fallback that still works. |
| AI-06 | AI phrase suggestions are marked as unchecked by a native speaker and are added only explicitly.     |

## Library and sharing

| ID     | Requirement                                                                                                            |
| ------ | ---------------------------------------------------------------------------------------------------------------------- |
| LIB-01 | Everything a learner makes is private, shared by link, or public in Community; Loro's content is public and read-only. |
| LIB-02 | Generation (phrase decks, covers, songs) has per-user daily limits, shown before the learner asks.                     |
| LIB-03 | Songs sung from a set's phrases live in that set and play in the one player; albums are in Library.                    |
| LIB-04 | Covers are drawn: topic colour and icons, sanitized SVG shapes, or an AI illustration asked to carry no text.          |

## Principles

| ID   | Requirement                                                                                                 |
| ---- | ----------------------------------------------------------------------------------------------------------- |
| N-04 | No guilt, streak-loss or re-engagement-bait copy anywhere ([copy-and-tone.md](../design/copy-and-tone.md)). |
| —    | Recorded audio never leaves the device; every number shown is real ([CLAUDE.md](../../CLAUDE.md)).          |
