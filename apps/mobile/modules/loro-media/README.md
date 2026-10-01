# The one player on the lock screen (P3-11)

This local Expo module (`LoroMedia`) puts the app's one player — the phrase loop or a song, whichever
is in front — on the lock screen and at the top of the notification shade, with play or pause,
next, previous and the three grades (P3-31). `src/audio/lockScreen.ts` drives it; what it shows is
worked out in `src/audio/nowPlaying.ts` (tested), and the wrapper is `src/audio/media.ts`.

Nothing plays here. The app plays (expo-audio) and says what is playing with `show(nowPlaying)`;
`hide()` takes it away; every press comes back as an `onCommand` event (`play`, `pause`, `next`,
`previous`, `seek`, `rate`), which the app handles as the same tap in the app would be: a grade is
the same `RATE` (a song's `RATE_PHRASES`) the player dispatches, so FSRS scheduling, the rating
window, undo and sync are unchanged. A grade carries the id of the item it was shown on, and the app
drops it if the player has moved on. Only text crosses the bridge, into the system's media controls:
no audio, nothing recorded (ADR-0011).

`wait(ms)` is a timer that keeps running with the screen locked. React Native's timers stop on
Android once the app leaves the screen, so the loop's silences (the learner's turn, the rating hold),
its clip watchdogs and the store's save are timed through it (`after` in `src/audio/media.ts`).
Nothing on the loop's path may wait on a React Native timer, directly or not: `fetch` settles
through `setTimeout(…, 0)`, so the check that a clip exists is a bare `XMLHttpRequest`
(`src/platform/speech.ts`) — with `fetch` the loop stopped after the first clip once the phone was
locked. On iOS each clip's player keeps the audio session active (`keepAudioSessionActive`):
expo-audio otherwise ends the session when a clip finishes, which stops the silent loop below and
lets iOS suspend the app before the next clip.

## Android

- `LoroMediaService` is a media3 `MediaSessionService` (foreground service of type `mediaPlayback`,
  not exported) with a `MediaSession` (id `loro`) over `LoroPlayer`, a `SimpleBasePlayer` that only
  mirrors what the app sends. media3's `DefaultMediaNotificationProvider` builds the notification;
  from Android 13 the system builds its controls from the session.
- The system's media controls have five slots. While the item can be rated they hold play or pause,
  then Missed, Hard, Easy (the app's icons, `res/drawable/loro_media_grade_*`, traced from the
  Material Symbols glyphs in `assets/fonts/MaterialSymbols.ttf`; a grade sent `selected` would show
  `task_alt`, though the app sends none) and Next. "Previous" gives way to the grades, as on the bar
  above the tabs; headset previous and next still work. Without grades (a queue that has ended, a song
  that sings none of the course's phrases, an item rated within its five-minute window) the standard
  previous, play or pause and next show.
- `Playback` holds, while the player plays: the audio focus for the whole session (expo-audio is set
  to mix on Android, so it asks for none per clip) — a call or another app pauses the player, and a
  short interruption resumes it; a receiver for headphones being unplugged (pause); a partial wake
  lock, so the silences are timed with the screen off.
- The notification channel (`loro_player`) is named in the learner's language (`player.dialog`).
  Media notifications don't need the Android 13 notification permission; a learner who turned the
  app's notifications off won't see it.

## iOS

`MPNowPlayingInfoCenter` and `MPRemoteCommandCenter`: play, pause, toggle, next, previous and a
song's position. The grades ride on the feedback commands with the app's localized names — Missed on
`dislike`, Hard on `bookmark`, Easy on `like` — the closest the system offers; where (and whether)
iOS shows them depends on its version. Audio-session interruptions pause (and resume when iOS says
so); unplugged headphones pause. While the phrase loop plays, a silent looping `AVAudioPlayer` keeps
the audio session running through its silences, so the app isn't suspended between clips.

**Unverified:** written without Xcode (plan 104). Build it and try it on a device before relying on
it.

## Checking it on a device

A development build or `pnpm apk:local` APK (Expo Go has no native modules). Play a set, lock the
phone: the loop should go on, and the lock screen and the top of the shade show the phrase (the
prompt until the target is heard), the set, play or pause and the grades. A grade pressed there
shows in the app afterwards with its usual window and undo. Check a call (pauses, resumes after),
another media app (pauses), unplugged headphones (pauses) and a song (seek bar, grades when it sings
the course's phrases). The notification's look, lock-screen visibility and OEM variants (Samsung One
UI's media player) can only be confirmed there.
