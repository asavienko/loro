# 0011 · Recorded audio never leaves the device

- **Status:** Accepted (updated 2026-09-30 for the current app)
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

The app records no audio. Learner data is never used to train models.

### Product analytics and session replay (amended 2026-09-30)

To learn how the distributed app is really used, the app sends product analytics and session replay
to **PostHog EU Cloud** (`apps/mobile/src/analytics`). This replaces the earlier rule that analytics
be off by default with an allowlist of properties:

- **On by default, opt-out.** Settings → Privacy → "Share usage data" turns it off; PostHog keeps
  the choice on the device (it survives sign-out) and stops events and recording at once.
- **Events:** every store action (`src/shared/analytics/events.ts`: the event's scalar fields, list
  lengths and the phrase playing), screen views, autocaptured taps, app lifecycle. A signed-in
  person is identified by user id and email.
- **Session replay** on iOS and Android, unmasked — screens as the learner sees them, including text
  they wrote. The sign-in code is the one masked view: it is a credential.
- **Never audio.** Replay captures pixels, not sound; the audio promise above is unchanged.
- A build without `EXPO_PUBLIC_POSTHOG_KEY` sends nothing.

## Consequences

- Voice data is never in Loro's possession, so it cannot be breached or leaked by Loro.
- Any pronunciation scoring must run on the device, which bounds its accuracy.
- Debugging can never inspect a learner's recording. It can see their screen, and so their text,
  unless they opted out.
- Default-on replay of EU learners needs a lawful basis (GDPR / ePrivacy consent); the store
  listings must declare it (App Store privacy label, Play Data safety) and the privacy policy must
  name PostHog as a processor.
