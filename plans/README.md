# Plans

Active plans live here as `NN-topic.md`; finished ones move to [the archive](archive/README.md).
Plans 1–103 and 105, the dated archives and the reviews were removed on 2026-09-30 as stale (they
described the first app); they remain in Git history at `e36cc758`. Numbers are never reused.

The highest assigned ID is **111** and the next new plan is **112**. Recheck concurrent worktrees
and untracked `plans/` files before allocating.

| Mark | Meaning                                           |
| ---- | ------------------------------------------------- |
| 🟡   | In progress; the plan says what is left and why.  |
| —    | Ready to start.                                   |
| ⛔   | Blocked by a named decision or piece of evidence. |
| ✅   | Done; listed only in the archive index.           |

## Active

| Plan                                 | Outcome                                                                                | Status                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [104](104-prototype-react-native.md) | The v2.0 player as the Expo app in `apps/mobile`, shared logic in `src/shared`         | 🟡 Scope 5 left: full verification, gestures on a device, iOS (Xcode) |
| [106](106-connected-app.md)          | The connected app: sign-in, limits, AI phrases/covers/songs, a server catalog, sharing | 🟡 Item 15 left: iOS, live provider runs, a live Apple sign-in        |
| [111](111-open-model-providers.md)   | DeepSeek on Fireworks (OpenRouter fallback) writes; Muse Image draws covers            | 🟡 Started 2026-10-01; all scope left                                 |

## Working rules

- Each plan has a `**Status:**` line and a row here; keep both current in the same change.
- Archive a finished plan in the same change that finishes it and list it in the archive index.
- Unresolved product decisions live in
  [`docs/decisions/open-questions.md`](../docs/decisions/open-questions.md); a plan never resolves
  one silently.
