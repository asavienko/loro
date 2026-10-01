# v2.0 design decisions

The v2.0 rapid prototype explored a Spotify-shaped, listening-first Loro. On 2026-09-30 it became
the app (`apps/mobile`); the web prototype and its review rounds are in Git history at `52a0e3b`.
These are the decisions the app carries. They are the app's behaviour; Product has not formally
signed them off.

Requirement IDs touched: `P3-01`, `P2-24`, `F-03`, `F-04`, `AI-06`.

## Decisions

| Area                      | Decision                                                                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vocabulary                | Two nouns: **Set** (a group of phrases) and **Phrase**. No waves, packs, decks or drills.                                                                                                                                                                                       |
| Tabs                      | Home, Explore, Create and Library. Songs live in their sets, marked by a music-note icon, and play in the one player; albums are in Library (plan 107).                                                                                                                         |
| The loop                  | Prompt in the native language → silence sized to the measured target → target; repeated; then a short hold for a rating.                                                                                                                                                        |
| Recall rule               | The target text stays hidden (player, mini-player, queue, lock screen) until it has been heard.                                                                                                                                                                                 |
| Grades                    | Missed / Hard / Easy → FSRS Again / Hard / Good. FSRS Easy is not offered. The grades show no intervals: FSRS schedules each review.                                                                                                                                            |
| Rating window             | A rating can be changed or undone for five minutes, then counts at its original time. Statuses, due counts and review dates show it at once; points wait for the window.                                                                                                        |
| Points                    | +1 per phrase listened (once per 5 minutes), +1/+2/+3 per rating, +10 once when learned; derived from the log.                                                                                                                                                                  |
| Learned                   | FSRS review state, stability ≥ 21 days, ≥ 3 successful recalls.                                                                                                                                                                                                                 |
| First review              | The first successful rating comes back within 1 day if the phrase was first heard that day, or within 4 days if it was also heard earlier. Days are the learner's local days, stamped on each log entry, so every device replays one log to the same schedule in any time zone. |
| Review date               | A phrase is due when predicted recall falls to 90%; the core's 50% date is the upper bound (open question [Q-24](../decisions/open-questions.md#q-24)).                                                                                                                         |
| Repetitions               | Auto: 3 while new or shaky, 1 under review; override 1 or 3.                                                                                                                                                                                                                    |
| Lock screen               | On iOS and Android the player plays on with the screen locked, on the lock screen and atop the notification shade: the prompt until the target is heard, play or pause, Next, and Missed / Hard / Easy, given as in the app (same window and undo).                             |
| Time to say it            | The silence is 1.3× the measured phrase plus 0.6 s (Standard) or 2× plus 1 s, 2.5–12 s (Longer). Timing is measured, never estimated.                                                                                                                                           |
| End of a queue            | A review, the demo and a Library list play one pass and end on a panel; a set offers "play again" or "continue" with the course's next phrases.                                                                                                                                 |
| Where rating happens      | In the full player and on the mini-player. Once a grade is given the mini-player shows it, with Undo, until the next item; given during the hold, the rated card stays a moment before the next slides in, and a message offers Undo.                                           |
| Gestures                  | Swipe the mini-player sideways: the next or previous item slides in beside it, as it does for Next and the loop moving on. Windows that slide up (the player, the queue, Make a set, the account, sheets) close when pulled down by their top.                                  |
| Home                      | One hero at a time: the demo, then the review, then Continue, then the next set once every phrase of the last one has been started and none is due.                                                                                                                             |
| Make a set                | A topic, keywords or pasted text become suggested phrases, decided one card at a time (swipe or Add/Skip, Undo, correct before adding). Each card names its source: a course set, the learner's own, the phrase bank, or AI marked as unchecked by a native speaker.            |
| Phrase notes and pictures | Every phrase has a picture (one to three Material Symbols on its topic's colour, never a photograph), a mnemonic (a hook for remembering it: a sound-alike, a picture or a known word, never an invented fact), a grammar rule and its sounds (IPA and a respelling).           |
| Covers                    | Drawn from content (topic colour and icon, or a sanitized SVG), never photos with invented text.                                                                                                                                                                                |
| Visual system             | One light palette. Terracotta fill only for play and the primary action; a selected state is ink; flat rows, tonal cards, one hero per screen.                                                                                                                                  |
| Compact screens           | Under 380 dp of width at 100% text (`shared/ui/room.ts`): a foldable's cover screen, or large text. Words stay whole: a label shrinks or takes its own line rather than breaking, and decoration goes first (a smaller player picture, only the current step or tab named).     |

## Engineering

- **Scheduling through core-rs.** FSRS runs in `packages/core-rs` (native module or WASM); display
  retrievability mirrors `scheduler.rs::retrievability`. The one local policy is the review date.
- **Event-sourced learner state.** An append-only log with device-scoped ids; memory and points are
  derived. Merge is a union of logs plus last-writer-wins per like, own item and profile (see
  [sync-protocol.md](../architecture/sync-protocol.md)).
- **An explicit player statechart** whose allowed events per status are data
  (`apps/mobile/src/shared/state/chart.ts`).

## Findings for Product

- The core's 50% desired retention makes intervals about 90× stability; a second on-time Easy
  scheduled the next review years away (see [fsrs-model.md](../architecture/fsrs-model.md)). That is
  why the app reviews at 90% ([Q-24](../decisions/open-questions.md#q-24)).
- New Spanish, Bulgarian and Russian text awaits native review
  ([Q-23](../decisions/open-questions.md#q-23)).
