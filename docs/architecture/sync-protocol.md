# Sync

How a learner's progress converges across tabs, devices and their account. The device's copy is
always the one that plays; syncing never blocks practice.

## What the app does: whole-state merge

Learner state is merged as a whole by `mergeLearner` in `apps/mobile/src/shared/state/merge.ts`,
with a class per field:

| Field                               | Rule                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `log`                               | Grow-only set: union by entry id. Memory and points are re-derived from it  |
| Likes, own phrases, own sets        | Last writer wins per item by its own timestamp; deletion is a tombstone     |
| Profile                             | Last writer wins as a whole, by `updatedAt`                                 |
| Pending ratings (tabs of a browser) | Last change wins per phrase; an undo is a tombstone until its window closes |
| Prefs (tabs of a browser)           | Per setting, the later change wins                                          |

The player queue is per tab and never merged. Because the log is the truth and every review has a
stable id, a review made on either device counts exactly once.

**Account copy.** A signed-in device reads the account's progress (`GET /library/progress`), merges
it into its own, and writes the result back with the revision it merged onto
(`POST /library/progress`, at most 3.8 MB). A write on an older revision is refused with
`409 CURSOR_EXPIRED`; the device merges again and retries, so no device's progress is lost. It runs
on sign-in, on returning to the foreground and 20 s after a change
(`apps/mobile/src/state/progressSync.ts`).

**Shared phones.** The device remembers whose progress it holds. Signing out first saves it to that
account; signing in as someone else keeps the first learner's progress aside and loads the second's
instead of merging two learners.

## The HLC sync API (not used by the current app)

`POST /v1/sync/push` and `/v1/sync/pull` implement per-field last-writer-wins over hybrid logical
clocks, tenant-scoped in PostgreSQL. The merge is the Rust one in `packages/core-rs/src/sync/`,
compiled to WASM; production refuses to start without it. Every field's merge class is declared in
`packages/core/src/sync/fieldPolicy.ts` (`lww`, `max`, `latest-review`, `append-only`, `tombstone`),
and the API rejects undeclared fields rather than guessing. Keep this rule when touching it: a
syncable server field needs a declared merge class.

## What never syncs

- Recorded audio, in any form.
- Caches that can be rebuilt: packs, phrase clips, song audio.
- Per-tab UI state (the player queue, navigation).
