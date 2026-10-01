// Product analytics and session replay (ADR-0011): PostHog, EU cloud. On unless the learner turns
// "Share usage data" off in Settings; PostHog keeps that choice on the device. A build without
// EXPO_PUBLIC_POSTHOG_KEY (development, tests) sends nothing.
//
// Session replay records the screen on iOS and Android (not the web, and never sound): text and
// images are shown, only the sign-in code is masked (<PostHogMaskView> in AccountScreen).
import PostHog from 'posthog-react-native';
import type { AppEvent } from '@shared/state/machine';
import type { AppState } from '@shared/state/types';
import { analyticsEvent } from '@shared/analytics/events';

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY || '';
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';

export const posthog: PostHog | null = KEY
  ? new PostHog(KEY, {
      host: HOST,
      captureAppLifecycleEvents: true,
      enableSessionReplay: true,
      sessionReplayConfig: {
        maskAllTextInputs: false,
        maskAllImages: false,
        captureLog: true,
        captureNetworkTelemetry: true,
      },
    })
  : null;

/** Records one dispatched store event, as `analyticsEvent` describes it. */
export function trackEvent(event: AppEvent, before: AppState): void {
  if (!posthog) return;
  const recorded = analyticsEvent(event, before);
  if (recorded) posthog.capture(recorded.name, recorded.properties);
}

/** Records the route the learner is on. */
export function trackScreen(pathname: string): void {
  posthog?.screen(pathname);
}

/** Ties this device's events to the signed-in account, or starts a fresh anonymous id. */
export function identify(account: { userId: string; email?: string | null } | null): void {
  if (!posthog) return;
  if (account) {
    posthog.identify(account.userId, account.email ? { email: account.email } : undefined);
    return;
  }
  // reset() forgets an opt-out along with the identity: keep the learner's choice.
  const out = posthog.optedOut;
  posthog.reset();
  if (out) void posthog.optOut();
}

export function analyticsAvailable(): boolean {
  return posthog !== null;
}

export function sharingUsage(): boolean {
  return posthog !== null && !posthog.optedOut;
}

export async function setSharingUsage(on: boolean): Promise<void> {
  if (!posthog) return;
  await (on ? posthog.optIn() : posthog.optOut());
}
