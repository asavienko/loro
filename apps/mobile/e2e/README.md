# Headless end-to-end tests

The whole app — expo-router and every route in `app/`, every screen and sheet, the store, the
learner's state machine and the Rust core (its WASM build) — rendered in Node by React Native Testing
Library and driven the way a learner drives it: by what is on screen. No browser, simulator or device;
the suite runs in seconds.

```bash
pnpm --filter @loro/mobile e2e                     # every flow
pnpm --filter @loro/mobile e2e -- player            # the files matching "player"
pnpm --filter @loro/mobile e2e -- -t "undo"         # the tests whose name matches "undo"
```

## What is real and what is faked

Real: everything in `app/` and `src/`, run through the same platform swaps Metro makes for iOS
(`resolver.js` mirrors `metro.config.js`): `src/platform/storage.ts`, `kv.ts`, `secrets.ts`,
`speech.ts`, `cues.ts`, `haptics.ts`, `oauth.ts` and `push.ts` all run. The one difference: the Rust
core is the WASM build (as on the web), since the LoroCore native module can't load in Node, and
Intl is Node's (as on the web) rather than Hermes's polyfills.

Faked, below those modules (`setup.ts`, `fakes/`):

| Fake                 | Stands in for                                       | A test reads or steers                                                               |
| -------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `fakes/api.ts`       | The API (`fetch`, `XMLHttpRequest`)                 | `app.api.requests`, `calls(route)`, `mail`/`codeFor(email)`, `offline`, `failNext`   |
| `fakes/library.ts`   | The API's library routes (sets, songs, sharing, …)  | `app.api.store`                                                                      |
| `fakes/audio.ts`     | expo-audio: phrase clips, songs, cues               | `audio.heard`, `audio.clips()`, `audio.silent`, `audio.lengths`, `audio.songPlayer()` |
| `fakes/device.ts`    | Alerts, Share, Linking, notifications, Keychain, provider sign-in page, the lock screen | `device.dialogs`/`answer(button)`, `shared`, `notifications`, `authSession`, `pushProject`, `lockScreen`/`nowPlaying`/`press(command)` |
| AsyncStorage         | The official in-memory mock                         | `app.saved()` reads what the phone saved                                             |

A request the fake API doesn't answer fails the test (`setup.ts`): add the route to `fakes/`, as
`apps/api` answers it, rather than letting the app see a 404 it never would.

## Writing a flow

One file per area in `flows/<area>.e2e.tsx`. Each test launches the app afresh:

```tsx
import { audio, device, launch, MINUTE } from '../harness';

it('rates a phrase and can undo it', async () => {
  const app = await launch({ url: '/set/set-cafe' }); // an onboarded learner, en-GB → es-ES
  const { c } = app; // the learner's UI copy: find things by the words they see
  await app.tap(c.set.playAll('Café & Mañanas'));
  await app.advance(8_000); // fake time: no real waiting
  await app.tap(c.player.rateAs(c.common.grade.easy));
  await app.tap(c.player.undoGrade(c.common.grade.easy));
  expect((await app.saved()).pending).toEqual([]);
});
```

- **Find things as the learner does**: by visible text or accessibility label (`app.tap`,
  `app.sees`, `app.waitFor`), using the copy (`app.c`, from `src/shared/copy/en.ts`) and the seeded
  content (`packages/content/v2`), never hard-coded English or test ids.
- **Time is fake** and starts at `T0` (1 Sep 2026, 09:00 UTC). `app.advance(ms)` runs the timers due
  one by one, each with the renders and effects it causes, so a phrase's loop or the rating window
  take no real time. For a long idle wait (days) use `app.skip(ms)`, one jump in which what the
  timers start runs only at the end, or `app.restart({ now })`.
- **Assert what the learner sees** first, and what the phone saved (`app.saved()`) or the server was
  sent (`app.api.calls('POST /library/sets')`) where that is the point. Never read React state.
- **Launch options** (`LaunchOptions` in `harness.tsx`): `learner: 'new'` for onboarding, or a
  learner with languages, prefs and a saved-state `edit`; `signedIn: email`; `url`; `api` (a second
  device on the same server); `app.restart()` (the same device, relaunched).
- **Gestures**: `app.swipe(name, { dx, dy })` pans the gesture around an element (a queue row's
  swipe, its handle's drag, the mini player swiped, a sheet or the player pulled down) and lets go:
  its callbacks run frame by frame, each frame's renders and effects done before the next.
  Activation offsets aren't simulated; where gestures race, `gesture` picks one.
- **The lock screen** (modules/loro-media) is there only in a file that sets `device.lockScreen =
  true` at its top: as on the store app, the loop then plays on in the background, the player shows
  on the lock screen (`device.nowPlaying`) and its presses come back (`device.press({ type: 'next' })`).
  Without it, as in a build without the module, going to the background pauses.
- Views that measure themselves get a phone-sized layout automatically (`layoutAll`): 390 points
  wide and 64 high unless their style sets a height.
