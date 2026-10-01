# Sync

How a learner's progress converges across browser tabs, devices and their account. The device's copy
is always the one that plays; syncing never blocks practice.

## What the app does: whole-state merge

Learner state (`LearnerState` in `apps/mobile/src/shared/state/types.ts`) is merged as a whole by
`mergeLearner` in `apps/mobile/src/shared/state/merge.ts`, with a class per field:

| Field                        | Rule                                                                       |
| ---------------------------- | -------------------------------------------------------------------------- |
| `log`                        | Grow-only set: union by entry id. Memory and points are re-derived from it |
| Likes, own phrases, own sets | Last writer wins per item by its own timestamp; deletion is a tombstone    |
| Profile                      | Last writer wins as a whole, by `updatedAt`                                |

A tie goes the same way on every device (by content), so two copies never each keep their own.
Because the log is the truth and every review has a stable id, a review made on either device counts
exactly once. Own phrases and sets remain only for what a device made before sign-in: they are
uploaded to the library once and then marked deleted
([library.md](library.md#sets-and-phrases-a-learner-makes)).

The rest of the app's state belongs to the device and never reaches the account. Tabs of one browser
share it and merge it with their own rules:

| Field           | Rule between tabs                                                           |
| --------------- | --------------------------------------------------------------------------- |
| Pending ratings | Last change wins per phrase; an undo is a tombstone until its window closes |
| Prefs           | Per setting, the later change wins                                          |

The player queue is per tab and never merged.

**Account copy.** A signed-in device reads the account's progress (`GET /v1/library/progress`),
merges it into its own, and writes the result back with the revision it merged onto
(`POST /v1/library/progress`, at most 3.8 MB, within the API's 4 MB JSON limit). A write on an older
revision is refused with `409 CURSOR_EXPIRED`; the device merges again and retries, so no device's
progress is lost. It runs on sign-in, when the app returns to the foreground or goes to the
background, and 20 s after the last change — no later than two minutes after the first unsent one
(`apps/mobile/src/state/progressSync.ts`). Offline, it waits.

**Shared phones.** The device remembers whose progress it holds. Signing out first saves it to that
account. Signing in as someone else keeps the first learner's progress aside on the device and loads
the second's, instead of merging two learners; the kept progress rejoins the first learner's when
they sign in there again.

<a id="per-field-lww"></a>

## The HLC sync API (not used by the current app)

`POST /v1/sync/push`, `/v1/sync/pull` and `/v1/sync/status` implement per-field last-writer-wins
over hybrid logical clocks, per account in PostgreSQL. The merge is the Rust one in
`packages/core-rs/src/sync/`, run through its Node WASM build (`apps/api/src/sync/merge.ts`);
production refuses to start without it. Every field's merge class is declared in
`packages/core/src/sync/fieldPolicy.ts` (`lww`, `max`, `latest-review`, `append-only`, `tombstone`),
and the API rejects undeclared fields rather than guessing. Keep this rule when touching it: a
syncable server field needs a declared merge class.

<a id="time"></a>A hybrid logical clock orders writes for this merge and nothing else: it is never
shown to a learner. The days a learner sees are local days (`localDay` in
`apps/mobile/src/shared/state/clock.ts`; `calendar` in core-rs).

## What never syncs

- Recorded audio, in any form.
- Caches that can be rebuilt: packs, the language list, phrase clips, song audio.
- Device state: prefs, pending ratings, the player queue, navigation.
