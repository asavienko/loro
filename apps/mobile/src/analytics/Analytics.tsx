// Wires PostHog (./posthog) into the app: taps are autocaptured, every route is a screen view and
// the signed-in account names the person. Store events are recorded where they are dispatched
// (src/state/store.tsx).
import { usePathname } from 'expo-router';
import { PostHogProvider } from 'posthog-react-native';
import { ReactNode, useEffect, useRef } from 'react';
import { useAccount } from '../state/account';
import { identify, posthog, trackScreen } from './posthog';

export function Analytics({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  useEffect(() => trackScreen(pathname), [pathname]);

  const { status, account } = useAccount();
  const identified = useRef<string | null>(null);
  useEffect(() => {
    if (status === 'loading') return;
    const id = status === 'signedIn' && account ? account.userId : null;
    if (id === identified.current) return;
    // Signing out of an account starts a new anonymous person; a first signed-out launch doesn't.
    if (id || identified.current) identify(id && account ? account : null);
    identified.current = id;
  }, [status, account]);

  if (!posthog) return <>{children}</>;
  return (
    <PostHogProvider client={posthog} autocapture={{ captureScreens: false, captureTouches: true }}>
      {children}
    </PostHogProvider>
  );
}
