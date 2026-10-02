// Wires PostHog (./posthog) into the app: taps are autocaptured, every route is a screen view, the
// signed-in account names the person and the learner's own figures describe them. Store events are
// recorded where they are dispatched (src/state/store.tsx).
import { usePathname } from 'expo-router';
import { PostHogProvider } from 'posthog-react-native';
import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { learnerProperties } from '@shared/analytics/person';
import { clock } from '@shared/state/clock';
import type { LearnerState } from '@shared/state/types';
import { useAccount } from '../state/account';
import { analyticsAvailable, identify, posthog, setAccount, setPerson, trackScreen } from './posthog';

export function Analytics({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  useEffect(() => trackScreen(pathname), [pathname]);

  const { status, account } = useAccount();
  const identified = useRef<string | null>(null);
  // The account by its fields, so a new display name re-sends the person without re-identifying.
  const userId = status === 'signedIn' && account ? account.userId : null;
  const email = account?.email ?? null;
  const provider = account?.provider ?? 'email';
  const displayName = account?.displayName ?? null;
  const details = useMemo(() => (userId ? { userId, email, provider, displayName } : null), [userId, email, provider, displayName]);
  useEffect(() => {
    if (status === 'loading') return;
    const id = details?.userId ?? null;
    if (id === identified.current) {
      if (details) setAccount(details);
      return;
    }
    // Signing out of an account starts a new anonymous person; a first signed-out launch doesn't.
    if (id || identified.current) identify(details);
    identified.current = id;
  }, [status, details]);

  if (!posthog) return <>{children}</>;
  return (
    <PostHogProvider client={posthog} autocapture={{ captureScreens: false, captureTouches: true }}>
      {children}
    </PostHogProvider>
  );
}

/** Learner data that changes in a burst (a phrase heard, then rated) is sent once, after it settles. */
const PERSON_SETTLE_MS = 5_000;

/**
 * Keeps the person's name, course and figures (`learnerProperties`) current in PostHog: a few
 * seconds after the learner's data last changed, from the state as it then is.
 */
export function useLearnerPerson(learner: LearnerState): void {
  useEffect(() => {
    if (!analyticsAvailable()) return;
    const timer = setTimeout(() => setPerson(learnerProperties(learner, clock.now())), PERSON_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [learner]);
}
