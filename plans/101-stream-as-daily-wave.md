# Stream as the daily wave

- **Requirement IDs:** `LB-03`, `LB-08`, `P3-09`
- **Milestone:** M2
- **Status:** 🟡 Stream lists today's frozen wave; Refrain is a targeted drill from Stream or a
  difficult-only menu entry. Main's listen-complete waves keep practice open before the first hour;
  `?wave=` is still wave focus, not a clock lock. Browser mouse/touch covers Stream → phrase Refrain
  and menu hard-filter, including a phrase-focus switcher hop. Linux emulator `emulator-5554` (AVD
  `loro-wave`, API 36) passed the pointer, spine/sheet, and TalkBack rows on APK `b0b4e3b77746` with
  chrome plus the exact URL or gesture proof; physical-device and iOS execution remain the plan
  58/93 gates. `pnpm native:evidence --platform ios --execute-scenarios` now drives pointer and
  spine/sheet rows through simctl + idb and fail-closes without chrome/URL/gesture proof. TalkBack
  `-at` rows stay unavailable on iOS. Authored v1.1 still treats Refrain as the wave hero and is not
  edited. ID collides with phrase-graph 101.
- **Depends on:** 64 wave/resume runtime; 81 menu/More destinations; 56 route declaration
- **Number allocation:** 101 follows inspection of active and archived plans. 96, 100 and this
  file's collision with [`101-phrase-sound-graph.md`](101-phrase-sound-graph.md) remain unresolved.
  The next new plan is 102.
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
   `/practice/refrain` URL is the same hard-only drill. Untargeted `?wave=morning` is still a wave
   session; the clock no longer locks it.
5. Completing a phrase or hard-only session does not mark the day wave done unless the session
   covers the full frozen set. Targeted entry still does not complete the day wave. The finish
   screen names the drill, not the day. Resume opens `?phrase=` or `?filter=hard` from the paused
   plan. While a drill is paused, Today's day-list start is inert so it cannot replace the resume
   action.

## Remaining

- Physical-device and iOS execution of the wave-path rows (plans 58/93). Closest-available Android
  evidence is the Linux emulator run at `.local-builds/native-evidence/wave-101-emulator-v6/`
  against preview APK `b0b4e3b77746` (`app.loro.android.preview` on `emulator-5554`): Stream →
  `?phrase=01a09640-97b3-7000-9669-f12bcf0fc9d1`, switcher and More both `?filter=hard`, practice
  edge-swipe stayed on the session, spine pull opened the switcher, sheet pull dismissed it on
  Today, and the TalkBack `-at` variants of the three pointer rows passed the same chrome/URL gates.
  That is not physical-device or iOS proof. iOS `--execute-scenarios` is a simctl + idb runner with
  the same chrome/URL/gesture gates; `pnpm ios:local` is the Mac-only retained-zip path those rows
  bind. This Linux host has no Xcode/idb, so those rows stay unevaluated until a Mac simulator or
  iPhone run drives them. Phrase-focus Refrain is not the menu destination; the switcher replaces
  into `?filter=hard` and only a matching hard checkpoint owns that empty screen. A screenshot
  collector must not mark those rows passed.
- `deep_link_for` now opens Stream for the daily reminder and the midday wave nudge. The plan 70
  scheduler that delivers those links is still unbuilt. A bare `/practice` path also resolves to
  Stream.
- Authored v1.1 still treats Refrain as the wave hero; docs record the divergence and the
  `design/**/*.dc.html` artifacts are not edited.
