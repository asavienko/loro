// Product analytics, session replay, logs, error tracking and metrics (ADR-0011, ADR-0020): PostHog,
// US cloud. On unless the learner turns "Share usage data" off in Settings; PostHog keeps that choice
// on the device and it stops all of them. A build without EXPO_PUBLIC_POSTHOG_KEY (development,
// tests) sends nothing.
//
// Session replay records the screen on iOS and Android (not the web, and never sound): text and
// images are shown, only the sign-in code is masked (<PostHogMaskView> in AccountScreen).
// Logs and metrics come from shared code through @shared/analytics/telemetry; crashes, uncaught
// exceptions and unhandled rejections are captured by PostHog's error tracking.
import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';
import type { AppEvent } from '@shared/state/machine';
import type { AppState } from '@shared/state/types';
import { analyticsEvent, AnalyticsProperties } from '@shared/analytics/events';
import { AccountLike, accountProperties } from '@shared/analytics/person';
import { Attributes, setTelemetrySink } from '@shared/analytics/telemetry';

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY || '';
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

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
      // PostHog's logs product, tagged so the mobile app's lines are told from the API's.
      logs: {
        serviceName: 'loro-mobile',
        serviceVersion: Constants.expoConfig?.version,
        environment: __DEV__ ? 'development' : 'production',
      },
      // Crashes (native ones through @posthog/react-native-plugin, sent on the next launch) and
      // JavaScript errors nothing caught.
      errorTracking: {
        autocapture: { uncaughtExceptions: true, unhandledRejections: true, nativeCrashes: true },
      },
    })
  : null;

/** Attributes may leave a field undefined (one the caller didn't have): PostHog gets those with a value. */
const defined = (attributes: Attributes) => Object.fromEntries(Object.entries(attributes).filter(([, v]) => v !== undefined)) as Record<string, string | number | boolean | null>;

if (posthog) {
  const client = posthog;
  setTelemetrySink({
    log: (level, message, attributes) => client.captureLog({ body: message, level, attributes: defined(attributes) }),
    exception: (error, attributes) => client.captureException(error, defined(attributes)),
    metric: (name, properties) => client.capture(name, defined(properties)),
  });
}

/** Records one dispatched store event, as `analyticsEvent` describes it. */
export function trackEvent(event: AppEvent, before: AppState): void {
  if (!posthog) return;
  const recorded = analyticsEvent(event, before);
  if (recorded) posthog.capture(recorded.name, recorded.properties);
}

/**
 * Sent with every event from here on, so any of them can be broken down by course: the language
 * learned, the interface's language and whether the learner is past onboarding.
 */
export function setContext(next: { course: string; uiLang: string; onboarded: boolean }): void {
  context = { course: next.course, ui_lang: next.uiLang, onboarded: next.onboarded };
  void posthog?.register(context);
}

/** The last context set, registered again after `reset()` forgets it. */
let context: Record<string, string | boolean> | null = null;

/** Records the route the learner is on. */
export function trackScreen(pathname: string): void {
  posthog?.screen(pathname);
}

/**
 * Ties this device's events to the signed-in account and names the person by it (id, email, provider
 * and display name), or starts a fresh anonymous id.
 */
export function identify(account: AccountLike | null): void {
  if (!posthog) return;
  if (account) {
    posthog.identify(account.userId, { $set: defined(accountProperties(account)) });
    return;
  }
  // reset() forgets an opt-out, the context and the person along with the identity: keep the
  // learner's choice, and say again who this (now anonymous) person is in the app.
  const out = posthog.optedOut;
  posthog.reset();
  if (out) void posthog.optOut();
  if (context) void posthog.register(context);
  if (person) posthog.setPersonProperties(person, undefined, false);
}

/** The account's details changed while signed in (the display name arrives after the sign-in). */
export function setAccount(account: AccountLike): void {
  posthog?.setPersonProperties(defined(accountProperties(account)), undefined, false);
}

/**
 * The learner's name, course and figures as the person's properties (`learnerProperties`), for the
 * anonymous person as much as a signed-in one. No feature flags are reloaded: the app uses none.
 */
export function setPerson(properties: AnalyticsProperties): void {
  person = defined(properties);
  posthog?.setPersonProperties(person, undefined, false);
}

/** The last learner properties set, sent again after `reset()` forgets them. */
let person: Record<string, string | number | boolean | null> | null = null;

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
