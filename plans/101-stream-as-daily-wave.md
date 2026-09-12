# Stream as the daily wave

- **Requirement IDs:** `LB-03`, `LB-08`, `P3-09`
- **Milestone:** M2
- **Status:** 🟡 Stream lists today's frozen wave; Refrain is a targeted drill from Stream or a
  difficult-only menu entry. Wave time-lock remains for untargeted `?wave=` entry. Browser
  mouse/touch covers Stream → phrase Refrain and menu hard-filter. The native-evidence catalog and
  fail-closed adb/uiautomator runner exist; physical-device execution of those rows remains the plan
  58/93 gate. Authored v1.1 still treats Refrain as the wave hero and is not edited.
- **Depends on:** 64 wave/resume runtime; 81 menu/More destinations; 56 route declaration
- **Number allocation:** 101 follows inspection of active and archived plans. 96 and 100 remain
  unresolved collisions. The next new plan is 102.
- **Blueprint:** `Loro.dc.html:600–677` (Stream), `1405–1532` (Refrain), `1316–1391` (Today).
  Authored artifacts are not edited. Production diverges: Today starts the wave in Stream; Refrain
  is remediation for phrases the learner marks Difficult.

## Outcome

A wave is the list of phrases shown in Stream. Stream is the daily practice surface. Refrain remains
the six-rep drill, reached for a specific phrase from Stream (or phrase detail) or, from the menu /
More, filtered to active `difficulty === 'hard'` phrases only.

## Behaviour

1. **Today CTA** “Start the * wave” and the next-wave day row open `/practice/stream`. An
   in-progress Refrain resumes on the inferred `?phrase=` / `?filter=hard` / `?wave=` URL.
2. **Stream queue** is today's frozen `refrainSet`, ranked inside the set, listed in full under
   “This wave”. If the wave has no live members, Stream falls back to every remaining active phrase.
3. **Stream → Refrain** for the current phrase: `/practice/refrain?phrase=<id>`. Phrase detail
   “Practice now” does the same.
4. **Menu / switcher / More → Refrain** is `/practice/refrain?filter=hard`. A bare
   `/practice/refrain` URL is the same hard-only drill. Untargeted `?wave=morning` keeps the timed
   lock.
5. Completing a phrase or hard-only session does not mark the day wave done unless the session
   covers the full frozen set. Targeted entry skips the wave lock. The finish screen names the
   drill, not the day. Resume opens `?phrase=` or `?filter=hard` from the paused plan. While a drill
   is paused, Today's day-list start is inert so it cannot replace the resume action.

## Remaining

- Physical-device / assistive-technology execution of `stream-to-phrase-refrain`,
  `menu-hard-refrain`, and `practice-back-swipe-disabled` (plans 58/93). Browser pointer coverage,
  the native-evidence catalog, and `pnpm native:evidence --execute-scenarios` exist; a screenshot
  collector must not mark those rows passed. This host has no adb/device, so those rows stay
  `unavailable` until a supported Android run records chrome plus the exact URL.
- Wave-nudge `deep_link_for` still emits `loro://practice/refrain` (now hard-filter). Intended
  Stream targets are recorded in
  [widgets-notifications](../docs/architecture/widgets-notifications.md). The Rust strings wait on
  rustc ≥ 1.88 and the plan 70 adapter. A bare `/practice` path now resolves to Stream.
- Authored v1.1 still treats Refrain as the wave hero; docs record the divergence and the
  `design/**/*.dc.html` artifacts are not edited.
