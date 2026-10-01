# 0011 · Recorded audio never leaves the device

- **Status:** Accepted (amended 2026-09-30; updated 2026-10-01 for the current app)
- **Date:** 2026-07-28

## Context

A speaking app is tempted to upload the learner's voice and score it in the cloud: easier and more
accurate. But a learner's voice is identifying, the promise "your audio stays on your device" is one
Loro makes to learners, and analytics is where privacy promises usually leak.

## Decision

**Recorded audio never leaves the device.** There is no consent exception, no cloud ASR and no
"anonymous" sampling. The promise is kept by making a violation hard to write:

- If the app records, PCM stays in native memory. No JavaScript API returns audio bytes, paths or
  uploadable handles.
- Recorded audio is not written to disk and is never attached to crash reports.
- No API route accepts recorded learner audio.

Licensed **model** audio — server phrase clips, songs — is not learner audio; it may be downloaded
and cached.

The current app records no audio: `apps/mobile/app.config.ts` blocks the microphone permission on
Android and turns off `expo-audio`'s microphone and recording permissions. Learner data is never
used to train models.

### Product analytics and session replay (amended 2026-09-30)

To learn how the distributed app is really used, the app sends product analytics and session replay
to **PostHog EU Cloud** (`apps/mobile/src/analytics`). This replaces the earlier rule that analytics
be off by default with an allowlist of properties:

- **On by default, opt-out.** Settings → Privacy → "Share usage data" turns it off; PostHog keeps
  the choice on the device (it survives sign-out) and stops events and recording at once.
- **Events:** every store action the learner causes (`src/shared/analytics/events.ts`: the event's
  scalar fields, list lengths, and the phrase and phase playing), failed playback, screen views,
  autocaptured taps and app lifecycle. A signed-in person is identified by user id and email.
- **Session replay** on iOS and Android, unmasked — screens as the learner sees them, including text
  they wrote — with the app's console log and network request metadata. The sign-in code is the one
  masked view: it is a credential.
- **Never audio.** Replay captures pixels, not sound; the audio promise above is unchanged.
- A build without `EXPO_PUBLIC_POSTHOG_KEY` sends nothing.

### Logs, errors and metrics (amended 2026-10-01)

The same PostHog project also receives what the app needs to be operated, under the same opt-out
(PostHog stops all of it at once):

- **Error tracking:** native crashes (through `@posthog/react-native-plugin`, sent on the next
  launch), uncaught JavaScript exceptions and unhandled promise rejections, plus failures the app
  recovers from but must not hide (a save that didn't reach storage, an unreadable saved progress,
  storage or content that failed to open). Console errors are not captured as exceptions; replay
  already holds the console.
- **Logs** go to PostHog's logs product as service `loro-mobile`: every failed API request (at
  `info` when the server couldn't be reached, `warn` when it refused, `error` for a 5xx or an
  unreadable reply) and the recovered failures above.
- **Metrics** are events with numeric properties, since PostHog's React Native SDK has no metrics
  API: `api_request` (route, method, status, error code, `duration_ms`) for every request,
  `progress_sync` (outcome, `duration_ms`), `course_refresh` (course, whether a copy was installed,
  pack size, `duration_ms`) and `app_start` (`boot_ms`, `ready_ms`).
- Every event carries `course`, `ui_lang` and `onboarded` as super properties.
- Shared code reports through one seam, `src/shared/analytics/telemetry.ts`, which sends nothing
  until `src/analytics/posthog.ts` sets PostHog as its sink. Attributes are scalars the code chose:
  never phrase text, words the learner wrote, or tokens. A request's path is sent as its route, with
  ids, share codes and query strings replaced (`/library/sets/:id/songs`); a segment that is not one
  of the API's route words is treated as an id.

Rejected: Sentry or another crash reporter beside PostHog (a second processor to declare, and
replay, logs and errors would not share a person and session); a separate metrics backend
(OpenTelemetry collector, Prometheus pushgateway) for a handful of client timings that PostHog
insights already chart.

## Consequences

- Voice data is never in Loro's possession, so it cannot be breached or leaked by Loro.
- Any pronunciation scoring must run on the device, which bounds its accuracy.
- Debugging can never inspect a learner's recording. It can see their screen, and so their text,
  unless they opted out.
- Default-on replay of EU learners needs a lawful basis (GDPR / ePrivacy consent); the store
  listings must declare it (App Store privacy label, Play Data safety) and the privacy policy must
  name PostHog as a processor.
